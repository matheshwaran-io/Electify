"use server";

/**
 * Selecting the academic session a staff member works in. The selection is a
 * cookie for navigation only: every request re-validates it against the
 * staff member's assignments (lib/workspace.ts), so it can never widen access.
 */
import { getSession } from "@/lib/auth";
import { listClassesForScope, listSessionsForScope, loadStaffScope, resolveStaffWorkspace, WORKSPACE_COOKIE } from "@/lib/workspace";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 12,
};

export async function selectAcademicSession(sessionId: string): Promise<{ success: boolean; error?: string; label?: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Your sign-in has expired. Sign in again." };
  const scope = await loadStaffScope(user);
  if (!scope) return { success: false, error: "Unauthorized" };

  const sessions = await listSessionsForScope(scope);
  const target = sessions.find((s) => s.id === sessionId);
  if (!target) return { success: false, error: "You don't have access to that academic session." };
  if (target.status === "ARCHIVED") return { success: false, error: `Academic session ${target.label} is archived.` };

  try {
    const { cookies } = await import("next/headers");
    const store = await cookies();
    store.set(WORKSPACE_COOKIE, target.id, COOKIE_OPTIONS);

    // Keep the active class inside the new session, so tutor pages never show a
    // class from the previous session.
    const tutorClasses = (await listClassesForScope(scope, target.id)).filter((c) => c.isTutorClass);
    const current = store.get("electify_active_section")?.value ?? user.sectionId;
    if (tutorClasses.length === 0) {
      store.delete("electify_active_section");
    } else if (!tutorClasses.some((c) => c.sectionId === current)) {
      store.set("electify_active_section", tutorClasses[0].sectionId, { ...COOKIE_OPTIONS, maxAge: 7200 });
    }

    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
  } catch {
    // Graceful no-op in test environments without a request context
  }

  return { success: true, label: target.label };
}

/**
 * Id of the session the server currently resolves for this browser, so an open
 * tab can notice a switch made in another tab and refresh itself.
 */
export async function getActiveWorkspaceStamp(): Promise<string | null> {
  const res = await resolveStaffWorkspace();
  return res.status === "OK" ? `${res.workspace.session.id}:${res.workspace.activeClass?.sectionId ?? ""}` : null;
}
