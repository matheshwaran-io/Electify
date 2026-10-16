import { redirect } from "next/navigation";
import { listClassesForScope, resolveStaffWorkspace } from "@/lib/workspace";
import { SessionSelectClient, type SessionCard } from "./session-select-client";
import { db } from "@/lib/db";
import { academicSessions } from "@/lib/db/schema";
import { asc, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose an Academic Timeline · Electify" };

/** Only same-site faculty paths are accepted as a destination. */
function safeNext(next: string | undefined) {
  return next && /^\/faculty\/[a-z0-9\-/]*$/i.test(next) && !next.startsWith("/faculty/session-select") ? next : null;
}

export default async function SessionSelectPage({ searchParams }: { searchParams: Promise<{ next?: string; choose?: string }> }) {
  const { next } = await searchParams;
  const res = await resolveStaffWorkspace();
  if (res.status === "NOT_STAFF") redirect("/login");

  const role = res.status === "OK" ? res.workspace.scope.role : res.scope.role;
  const destination = safeNext(next) ?? (role === "COURSE_COORDINATOR" ? "/faculty/portal-select" : "/faculty/dashboard");

  const scope = res.status === "OK" ? res.workspace.scope : res.scope;

  const currentYear = new Date().getFullYear();
  // Strictly show 3 years: Last Year (currentYear - 1), Current Year (currentYear), Next Year (currentYear + 1)
  const allowedYears = [currentYear - 1, currentYear, currentYear + 1];

  const dbSessions = await db
    .select()
    .from(academicSessions)
    .where(inArray(academicSessions.startYear, allowedYears))
    .orderBy(asc(academicSessions.startYear));

  const foundYears = new Set(dbSessions.map((s) => s.startYear));
  for (const yr of allowedYears) {
    if (!foundYears.has(yr)) {
      try {
        const [inserted] = await db
          .insert(academicSessions)
          .values({
            startYear: yr,
            endYear: yr + 1,
            status: yr > currentYear ? "PLANNED" : "ACTIVE",
          })
          .returning();
        if (inserted) dbSessions.push(inserted);
      } catch {
        // ignore conflict
      }
    }
  }

  const sessionsToDisplay = dbSessions.map((row) => ({
    id: row.id,
    startYear: row.startYear,
    endYear: row.endYear,
    status: row.status as "ACTIVE" | "PLANNED" | "ARCHIVED",
    label: `${row.startYear} Academic Timeline`,
  }));

  const cards: SessionCard[] = await Promise.all(
    sessionsToDisplay.map(async (s) => {
      const classes = s.status === "ARCHIVED" ? [] : await listClassesForScope(scope, s.id);
      const own = classes.filter((c) => c.isTutorClass);
      const shown = (own.length ? own : classes).slice(0, 4);

      let timelineTag: "Last Year" | "Current Year" | "Next Year" | undefined;
      if (s.startYear === currentYear - 1) {
        timelineTag = "Last Year";
      } else if (s.startYear === currentYear) {
        timelineTag = "Current Year";
      } else if (s.startYear === currentYear + 1) {
        timelineTag = "Next Year";
      }

      return {
        id: s.id,
        year: s.startYear,
        label: `${s.startYear} Academic Timeline`,
        status: s.status,
        classCount: classes.length,
        programmes: Array.from(new Set(classes.map((c) => c.programmeName))).slice(0, 4),
        classes: shown.map((c) => ({ label: c.label, stage: c.stage })),
        moreClasses: Math.max(0, (own.length ? own.length : classes.length) - shown.length),
        timelineTag,
      };
    })
  );

  // Ascending order: 2025, 2026, 2027
  cards.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  return (
    <SessionSelectClient
      sessions={cards}
      currentId={res.status === "OK" ? res.workspace.session.id : null}
      destination={destination}
      isAdmin={role === "SYSTEM_ADMIN"}
      canManage={role === "SYSTEM_ADMIN" || role === "COURSE_COORDINATOR"}
    />
  );
}

