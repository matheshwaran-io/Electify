/**
 * Server-side data for the student subject explorer.
 *
 * Scope rules (enforced here, not in the UI):
 * - A student only ever sees subjects offered in the latest registration event
 *   for their own batch, among the statuses students can see.
 * - Only active electives are listed, and only PUBLISHED subject profiles are joined.
 * - Nothing about other students is returned: no names, no counts per student,
 *   only the seat numbers that apply to this student.
 *
 * Callers authenticate first and pass the session's userId.
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { electiveGroups, electiveSeatAllocations, electives, subjectProfiles } from "@/lib/db/schema";
import { type RegistrationWindow } from "@/lib/registration-window";
import { resolveStudentEvent } from "@/lib/student-events";
import { studentSeatAvailability, type StudentSeatAvailability } from "@/lib/seats";
import { normalizeSubjectName, readSubjectContent, type SubjectContent } from "@/lib/subjects/content-schema";

export type SubjectProfileSummary = {
  slug: string;
  title: string;
  summary: string | null;
  tags: string[];
  difficulty: SubjectContent["difficulty"] | undefined;
};

export type SubjectSummary = {
  electiveId: string;
  name: string;
  courseCode: string | null;
  credits: number;
  description: string | null;
  category: { id: string; name: string };
  programme: { id: string; name: string; code: string } | null;
  department: { id: string; name: string } | null;
  availability: StudentSeatAvailability;
  profile: SubjectProfileSummary | null;
  /** Lower-cased text the client search runs over: names, codes, tags, syllabus topics. */
  searchText: string;
};

export type SubjectDetail = SubjectSummary & {
  content: SubjectContent | null;
  /** Other subjects in the same basket, for "explore alternatives" when this one is full. */
  alternatives: Pick<SubjectSummary, "electiveId" | "name" | "courseCode" | "availability">[];
};

export type StudentContext =
  | { status: "NO_STUDENT" | "NOT_STUDENT" | "NO_BATCH" | "NO_EVENT" }
  | {
      status: "OK";
      student: { id: string; name: string; isEligible: boolean; isActive: boolean; sectionId: string | null };
      event: {
        id: string;
        name: string;
        status: string;
        openDate: Date | null;
        closeDate: Date | null;
        sessionLabel: string | null;
        /** "MCA F · 2025–2027" */
        classLabel: string;
      };
      window: RegistrationWindow;
      registrationStatus: string | null;
      programme: { id: string; name: string; code: string } | null;
      department: { id: string; name: string } | null;
      serverNow: number;
    };

type OkContext = Extract<StudentContext, { status: "OK" }>;

/**
 * The student's class and the registration event the explorer shows. Uses the
 * shared eligibility rule (lib/student-events): only events that target the
 * student's own class, never "the newest event for the batch".
 */
export async function getStudentSubjectContext(studentId: string, now: Date = new Date(), requestedEventId?: string | null): Promise<StudentContext> {
  const res = await resolveStudentEvent(studentId, requestedEventId ?? null, now);
  if (res.status === "NO_STUDENT") return { status: "NO_STUDENT" };
  if (res.status === "NOT_STUDENT") return { status: "NOT_STUDENT" };
  if (res.status === "NO_CLASS") return { status: "NO_BATCH" };
  if (res.status !== "OK") return { status: "NO_EVENT" };

  const { student, studentClass, event } = res;
  return {
    status: "OK",
    student: { id: student.id, name: student.name, isEligible: student.isEligible, isActive: student.isActive, sectionId: student.sectionId },
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      openDate: event.openDate,
      closeDate: event.closeDate,
      sessionLabel: event.sessionLabel,
      classLabel: studentClass.label,
    },
    window: event.window,
    registrationStatus: event.registrationStatus,
    programme: { id: studentClass.programmeId, name: studentClass.programmeName, code: "" },
    department: { id: studentClass.departmentId, name: studentClass.departmentName },
    serverNow: now.getTime(),
  };
}

type ProfileRow = typeof subjectProfiles.$inferSelect;

async function publishedProfiles(): Promise<ProfileRow[]> {
  try {
    return await db.select().from(subjectProfiles).where(eq(subjectProfiles.status, "PUBLISHED"));
  } catch (err) {
    // The table is created by migration 0005 / the login-time self-heal. If it is
    // missing, show official offering data without guidance rather than failing.
    console.warn("[subjects] subject_profiles unavailable:", (err as Error).message);
    return [];
  }
}

/** Course code match wins; otherwise the normalised name must equal the title or an alias. */
export function matchProfile<P extends Pick<ProfileRow, "courseCode" | "title" | "aliases" | "programmeId">>(
  offering: { name: string; courseCode: string | null },
  programmeId: string | null,
  profiles: P[]
): P | null {
  const scoped = profiles.filter((p) => !p.programmeId || p.programmeId === programmeId);
  const code = offering.courseCode?.trim().toLowerCase();
  if (code) {
    const byCode = scoped.find((p) => p.courseCode && p.courseCode.trim().toLowerCase() === code);
    if (byCode) return byCode;
  }
  const name = normalizeSubjectName(offering.name);
  return (
    scoped.find((p) => [p.title, ...(Array.isArray(p.aliases) ? p.aliases : [])].some((n) => normalizeSubjectName(n) === name)) ?? null
  );
}

async function loadOfferings(ctx: OkContext) {
  const groups = await db.select().from(electiveGroups).where(eq(electiveGroups.eventId, ctx.event.id)).orderBy(electiveGroups.sortOrder);
  if (groups.length === 0) return { groups, rows: [] as (typeof electives.$inferSelect)[], quotas: new Map<string, { availableSeats: number; maxSeats: number }>() };

  const rows = await db
    .select()
    .from(electives)
    .where(and(inArray(electives.groupId, groups.map((g) => g.id)), eq(electives.isActive, true)));

  const quotas = new Map<string, { availableSeats: number; maxSeats: number }>();
  if (ctx.student.sectionId && rows.length > 0) {
    const allocs = await db
      .select({
        electiveId: electiveSeatAllocations.electiveId,
        availableSeats: electiveSeatAllocations.availableSeats,
        maxSeats: electiveSeatAllocations.maxSeats,
      })
      .from(electiveSeatAllocations)
      .where(and(inArray(electiveSeatAllocations.electiveId, rows.map((r) => r.id)), eq(electiveSeatAllocations.sectionId, ctx.student.sectionId)));
    for (const a of allocs) quotas.set(a.electiveId, a);
  }
  return { groups, rows, quotas };
}

function summarise(
  ctx: OkContext,
  row: typeof electives.$inferSelect,
  group: typeof electiveGroups.$inferSelect,
  quota: { availableSeats: number; maxSeats: number } | undefined,
  profile: ProfileRow | null
): { summary: SubjectSummary; content: SubjectContent | null } {
  const content = profile ? readSubjectContent(profile.content) : null;
  const topics = content?.syllabus?.units.flatMap((u) => [u.title, ...u.topics]) ?? [];
  const summary: SubjectSummary = {
    electiveId: row.id,
    name: row.name,
    courseCode: row.courseCode,
    credits: row.credits,
    description: row.description,
    category: { id: group.id, name: group.name },
    programme: ctx.programme,
    department: ctx.department,
    availability: studentSeatAvailability(row, quota),
    profile: profile
      ? { slug: profile.slug, title: profile.title, summary: profile.summary, tags: content?.tags ?? [], difficulty: content?.difficulty }
      : null,
    searchText: [row.name, row.courseCode, row.description, group.name, profile?.summary, ...(content?.tags ?? []), ...topics]
      .filter(Boolean)
      .join(" \n ")
      .toLowerCase(),
  };
  return { summary, content };
}

export async function loadSubjectCatalog(studentId: string, now: Date = new Date(), requestedEventId?: string | null) {
  const ctx = await getStudentSubjectContext(studentId, now, requestedEventId);
  if (ctx.status !== "OK") return { ctx, subjects: [] as SubjectSummary[] };

  const [{ groups, rows, quotas }, profiles] = await Promise.all([loadOfferings(ctx), publishedProfiles()]);
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const subjects = rows
    .map((row) => {
      const group = groupById.get(row.groupId)!;
      return summarise(ctx, row, group, quotas.get(row.id), matchProfile(row, ctx.programme?.id ?? null, profiles)).summary;
    })
    .sort((a, b) => {
      const ga = groupById.get(a.category.id)?.sortOrder ?? 0;
      const gb = groupById.get(b.category.id)?.sortOrder ?? 0;
      return ga - gb || a.name.localeCompare(b.name);
    });

  return { ctx, subjects };
}

export async function loadSubjectDetail(studentId: string, electiveId: string, now: Date = new Date()) {
  // The elective decides the event; the student must be eligible for that event.
  const [owner] = await db
    .select({ eventId: electiveGroups.eventId })
    .from(electives)
    .innerJoin(electiveGroups, eq(electiveGroups.id, electives.groupId))
    .where(eq(electives.id, electiveId))
    .limit(1);
  const ctx = await getStudentSubjectContext(studentId, now, owner?.eventId ?? "00000000-0000-0000-0000-000000000000");
  if (ctx.status !== "OK") return { ctx, subject: null as SubjectDetail | null };

  const { groups, rows, quotas } = await loadOfferings(ctx);
  const row = rows.find((r) => r.id === electiveId);
  // Not in this student's event (or inactive): treat as not found, never leak other batches' offerings.
  if (!row) return { ctx, subject: null };

  const profiles = await publishedProfiles();
  const group = groups.find((g) => g.id === row.groupId)!;
  const { summary, content } = summarise(ctx, row, group, quotas.get(row.id), matchProfile(row, ctx.programme?.id ?? null, profiles));

  const alternatives = rows
    .filter((r) => r.groupId === row.groupId && r.id !== row.id)
    .map((r) => ({ electiveId: r.id, name: r.name, courseCode: r.courseCode, availability: studentSeatAvailability(r, quotas.get(r.id)) }))
    .sort((a, b) => b.availability.available - a.availability.available);

  return { ctx, subject: { ...summary, content, alternatives } satisfies SubjectDetail };
}
