import { redirect } from "next/navigation";
import { listClassesForScope, resolveStaffWorkspace } from "@/lib/workspace";
import { SessionSelectClient, type SessionCard } from "./session-select-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose Year Server · Electify" };

/** Only same-site faculty paths are accepted as a destination. */
function safeNext(next: string | undefined) {
  return next && /^\/faculty\/[a-z0-9\-/]*$/i.test(next) && !next.startsWith("/faculty/session-select") ? next : null;
}

export default async function SessionSelectPage({ searchParams }: { searchParams: Promise<{ next?: string; choose?: string }> }) {
  const { next, choose } = await searchParams;
  const res = await resolveStaffWorkspace();
  if (res.status === "NOT_STAFF") redirect("/login");

  const role = res.status === "OK" ? res.workspace.scope.role : res.scope.role;
  const destination = safeNext(next) ?? (role === "COURSE_COORDINATOR" ? "/faculty/portal-select" : "/faculty/dashboard");

  // Only one session to work in: no need to ask (it stays visible in the header).
  if (res.status === "OK" && res.workspace.implicit && !choose) redirect(destination);

  const scope = res.status === "OK" ? res.workspace.scope : res.scope;
  const cards: SessionCard[] = await Promise.all(
    res.sessions.map(async (s) => {
      const classes = s.status === "ARCHIVED" ? [] : await listClassesForScope(scope, s.id);
      const own = classes.filter((c) => c.isTutorClass);
      const shown = (own.length ? own : classes).slice(0, 4);
      return {
        id: s.id,
        year: s.startYear,
        label: `${s.startYear} Year Server`,
        status: s.status,
        classCount: classes.length,
        programmes: Array.from(new Set(classes.map((c) => c.programmeName))).slice(0, 4),
        classes: shown.map((c) => ({ label: c.label, stage: c.stage })),
        moreClasses: Math.max(0, (own.length ? own.length : classes.length) - shown.length),
      };
    })
  );

  return (
    <SessionSelectClient
      sessions={cards.sort((a, b) => b.label.localeCompare(a.label))}
      currentId={res.status === "OK" ? res.workspace.session.id : null}
      destination={destination}
      isAdmin={role === "SYSTEM_ADMIN"}
      canManage={role === "SYSTEM_ADMIN" || role === "COURSE_COORDINATOR"}
    />
  );
}
