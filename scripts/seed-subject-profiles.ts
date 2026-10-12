/**
 * Seeds subject profiles for the student subject explorer.
 *
 *   npm run db:seed:subjects                 # upsert + publish
 *   npm run db:seed:subjects -- --draft      # upsert as DRAFT (hidden from students)
 *   npm run db:seed:subjects -- --check-links  # also probe each resource URL once and record the result
 *
 * Profiles are matched to elective offerings by course code or by name/alias,
 * so this does not need to know any event or elective ids. Safe to re-run.
 */
import { eq } from "drizzle-orm";
import { db, pool } from "@/lib/db";
import { subjectProfiles } from "@/lib/db/schema";
import { subjectContentSchema } from "@/lib/subjects/content-schema";
import { cloudComputingProfile } from "@/lib/subjects/catalog/cloud-computing";

const PROFILES = [cloudComputingProfile];

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

async function main() {
  const draft = process.argv.includes("--draft");
  const checkLinks = process.argv.includes("--check-links");

  for (const profile of PROFILES) {
    const content = subjectContentSchema.parse(profile.content);

    if (checkLinks) {
      for (const r of content.resources) {
        r.lastCheckStatus = await probe(r.url);
        r.lastCheckedAt = new Date().toISOString();
        console.log(`  ${r.lastCheckStatus.padEnd(8)} ${r.url}`);
      }
    }

    const values = {
      slug: profile.slug,
      title: profile.title,
      courseCode: profile.courseCode,
      aliases: profile.aliases,
      summary: profile.summary,
      content,
      status: draft ? "DRAFT" : "PUBLISHED",
      updatedAt: new Date(),
    };

    const [existing] = await db.select({ id: subjectProfiles.id }).from(subjectProfiles).where(eq(subjectProfiles.slug, profile.slug)).limit(1);
    if (existing) {
      await db.update(subjectProfiles).set(values).where(eq(subjectProfiles.id, existing.id));
      console.log(`Updated ${profile.slug} (${values.status})`);
    } else {
      await db.insert(subjectProfiles).values(values);
      console.log(`Created ${profile.slug} (${values.status})`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
