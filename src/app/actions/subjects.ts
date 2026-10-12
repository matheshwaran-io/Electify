"use server";

/**
 * Managing subject profiles (the supplementary information in the student
 * subject explorer). Students can read published profiles through the
 * explorer pages but can never call anything here.
 *
 * - SYSTEM_ADMIN: any profile.
 * - COURSE_COORDINATOR: profiles scoped to their own programme.
 * - Everyone else: rejected.
 *
 * Link checking is an explicit, on-demand action; pages never fetch external
 * sites when a student opens them.
 */
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, subjectProfiles } from "@/lib/db/schema";
import { getSession, type UserSession } from "@/lib/auth";
import { subjectContentSchema, type SubjectContent } from "@/lib/subjects/content-schema";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

const profileInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(2).max(160),
  courseCode: z.string().trim().max(40).nullable().optional(),
  aliases: z.array(z.string().trim().min(2).max(160)).max(20).default([]),
  programmeId: z.string().uuid().nullable().optional(),
  summary: z.string().trim().max(600).nullable().optional(),
  content: subjectContentSchema,
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});
export type SubjectProfileInput = z.input<typeof profileInputSchema>;

async function requireEditor(programmeId: string | null | undefined): Promise<UserSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (session.role === "SYSTEM_ADMIN") return session;
  if (session.role === "COURSE_COORDINATOR") {
    if (!session.programmeId) throw new Error("Your account is not linked to a programme.");
    if (programmeId && programmeId !== session.programmeId) throw new Error("You can only manage subjects for your own programme.");
    if (!programmeId) throw new Error("Coordinators must scope subject profiles to their programme.");
    return session;
  }
  throw new Error("Unauthorized");
}

/** Create or update a profile by slug. Content is validated strictly (bad URLs are rejected). */
export async function upsertSubjectProfile(input: SubjectProfileInput) {
  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const data = parsed.data;

  let session: UserSession;
  try {
    session = await requireEditor(data.programmeId ?? null);
  } catch (err) {
    return { success: false as const, error: (err as Error).message };
  }

  const [existing] = await db.select().from(subjectProfiles).where(eq(subjectProfiles.slug, data.slug)).limit(1);
  if (existing && session.role === "COURSE_COORDINATOR" && existing.programmeId !== session.programmeId) {
    return { success: false as const, error: "You can only manage subjects for your own programme." };
  }

  const values = {
    slug: data.slug,
    title: data.title,
    courseCode: data.courseCode || null,
    aliases: data.aliases,
    programmeId: data.programmeId ?? null,
    summary: data.summary || null,
    content: data.content,
    status: data.status,
    updatedById: session.userId,
    updatedAt: new Date(),
  };

  const [row] = existing
    ? await db.update(subjectProfiles).set(values).where(eq(subjectProfiles.id, existing.id)).returning()
    : await db.insert(subjectProfiles).values({ ...values, createdById: session.userId }).returning();

  await db.insert(auditLogs).values({
    action: existing ? "SUBJECT_PROFILE_UPDATED" : "SUBJECT_PROFILE_CREATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { slug: row.slug, status: row.status },
  });

  return { success: true as const, id: row.id };
}

export async function setSubjectProfileStatus(id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const [existing] = await db.select().from(subjectProfiles).where(eq(subjectProfiles.id, id)).limit(1);
  if (!existing) return { success: false as const, error: "Subject profile not found." };
  let session: UserSession;
  try {
    session = await requireEditor(existing.programmeId);
  } catch (err) {
    return { success: false as const, error: (err as Error).message };
  }
  await db.update(subjectProfiles).set({ status, updatedById: session.userId, updatedAt: new Date() }).where(eq(subjectProfiles.id, id));
  await db.insert(auditLogs).values({
    action: "SUBJECT_PROFILE_STATUS",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { slug: existing.slug, status },
  });
  return { success: true as const };
}

export async function listSubjectProfiles() {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
    return { success: false as const, error: "Unauthorized" };
  }
  const rows = await db.select().from(subjectProfiles).orderBy(asc(subjectProfiles.title));
  const visible = session.role === "SYSTEM_ADMIN" ? rows : rows.filter((r) => !r.programmeId || r.programmeId === session.programmeId);
  return {
    success: true as const,
    data: visible.map((r) => ({ id: r.id, slug: r.slug, title: r.title, status: r.status, programmeId: r.programmeId, updatedAt: r.updatedAt })),
  };
}

/**
 * Checks each resource URL once (HEAD, falling back to GET) and records the
 * result and time on the profile. Run on demand by an editor, never on page view.
 */
export async function checkSubjectResourceLinks(id: string) {
  const [existing] = await db.select().from(subjectProfiles).where(eq(subjectProfiles.id, id)).limit(1);
  if (!existing) return { success: false as const, error: "Subject profile not found." };
  try {
    await requireEditor(existing.programmeId);
  } catch (err) {
    return { success: false as const, error: (err as Error).message };
  }

  const content = subjectContentSchema.parse(existing.content) as SubjectContent;
  const checked = await checkResourceUrls(content.resources);
  await db
    .update(subjectProfiles)
    .set({ content: { ...content, resources: checked }, updatedAt: new Date() })
    .where(eq(subjectProfiles.id, id));
  return { success: true as const, results: checked.map((r) => ({ url: r.url, status: r.lastCheckStatus })) };
}

async function checkResourceUrls(resources: SubjectContent["resources"]) {
  return Promise.all(
    resources.map(async (r) => {
      const status = await probe(r.url);
      return { ...r, lastCheckedAt: new Date().toISOString(), lastCheckStatus: status };
    })
  );
}

async function probe(url: string): Promise<"ok" | "redirect" | "failed"> {
  for (const method of ["HEAD", "GET"] as const) {
    try {
      const res = await fetch(url, { method, redirect: "manual", signal: AbortSignal.timeout(8000) });
      if (res.status >= 200 && res.status < 300) return "ok";
      if (res.status >= 300 && res.status < 400) return "redirect";
    } catch {
      // try the next method
    }
  }
  return "failed";
}
