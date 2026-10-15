import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { isSessionScopedPath, resolveStaffWorkspace } from "@/lib/workspace";
import type { AssignedSection } from "@/components/layout/section-switcher";
import { SignOutButton } from "@/components/student/sign-out-button";

export const dynamic = "force-dynamic";

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Double check that students don't access this layout
  if (session.role === "STUDENT") {
    redirect("/dashboard");
  }

  // Maintenance mode: only a SYSTEM_ADMIN may stay (to reach settings).
  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
  if (settings?.maintenanceMode && session.role !== "SYSTEM_ADMIN") {
    redirect("/maintenance");
  }

  const { cookies, headers } = await import("next/headers");
  const cookieStore = await cookies();
  const activeWorkspace = cookieStore.get("electify_active_workspace")?.value || "COORDINATOR";
  const sidebarCollapsed = cookieStore.get("electify_sidebar")?.value === "collapsed";
  const pathname = (await headers()).get("x-electify-pathname");

  // Session-specific pages need a valid, authorized academic session. The
  // check runs on every request, so an archived session or a revoked
  // assignment sends the user back to the selection screen.
  const resolution = await resolveStaffWorkspace();
  if (resolution.status === "NOT_STAFF") {
    // The token says staff but the account record no longer does (role changed
    // or deactivated). Redirecting to /login would bounce, so say so plainly.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-light tracking-display text-fg">Your staff access has changed</h1>
        <p className="max-w-md text-fg-muted">Sign out and sign in again. If this keeps happening, contact your administrator.</p>
        <SignOutButton />
      </main>
    );
  }
  const isSessionSelect = pathname === "/faculty/session-select" || pathname?.startsWith("/faculty/session-select?");
  const isUnscopedPath =
    pathname === "/faculty/settings" ||
    pathname === "/faculty/academic-sessions" ||
    pathname === "/faculty/users" ||
    pathname === "/faculty/invites" ||
    pathname === "/faculty/templates" ||
    pathname === "/faculty/portal-select";
  const shouldRequireSession = isSessionScopedPath(pathname) || (!pathname && !isSessionSelect);

  if (!isSessionSelect && !isUnscopedPath && shouldRequireSession && resolution.status !== "OK") {
    redirect(`/faculty/session-select?next=${encodeURIComponent(pathname ?? "/faculty/dashboard")}`);
  }

  let assignedSections: AssignedSection[] = [];
  let academicSession = null;
  if (resolution.status === "OK") {
    const ws = resolution.workspace;
    // Only classes of the selected session: the session and class never disagree.
    assignedSections = ws.tutorClasses.map((c) => ({
      id: c.sectionId,
      label: c.sectionLabel,
      batch: c.years,
      programme: c.programmeName,
      classLabel: c.label,
      stage: c.stage,
    }));
    session.sectionId = ws.activeClass?.sectionId;
    academicSession = {
      id: ws.session.id,
      label: ws.session.label,
      startYear: ws.session.startYear,
      endYear: ws.session.endYear,
      status: ws.session.status,
      implicit: ws.implicit,
      switchable: resolution.sessions.filter((s) => s.status !== "ARCHIVED").length > 1,
    };
  }

  return (
    <AppShell
      session={session}
      assignedSections={assignedSections}
      activeWorkspace={activeWorkspace}
      initialCollapsed={sidebarCollapsed}
      academicSession={academicSession}
    >
      {children}
    </AppShell>
  );
}
