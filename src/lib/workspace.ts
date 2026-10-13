/**
 * Staff academic workspace: which academic session a staff member is working
 * in, and which classes (cohort sections) they may manage inside it.
 *
 * Rules (all enforced here, on the server, for every request):
 * - Permissions come from trusted data only: the role and programme on the
 *   user record, tutor_sections assignments, and cohort_session_terms. The
 *   selected-session cookie is navigation state and is re-validated each time.
 * - SYSTEM_ADMIN: every session and every class enrolled in it.
 *   COURSE_COORDINATOR: classes of their programme plus classes they tutor.
 *   CLASS_TUTOR: only the classes they are assigned to.
 * - A session is only offered if the staff member has at least one class in it
 *   (admins: all sessions). Archived sessions cannot be entered.
 * - With exactly one enterable session it is used without asking.
 */
import { cache } from "react";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  academicSessions,
  cohortSessionTerms,
  departments,
  eventSections,
  programmes,
  registrationEvents,
  sections,
  tutorSections,
  users,
} from "@/lib/db/schema";
import { getSession, type UserSession } from "@/lib/auth";
import { cohortLabel, cohortYears, sessionLabel, stageLabel, type SessionStatus } from "@/lib/academic";

export const WORKSPACE_COOKIE = "electify_academic_session";

export type StaffRole = "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR";

export type StaffScope = {
  userId: string;
  role: StaffRole;
  /** Admins manage every class. */
  allClasses: boolean;
  /** Programmes a coordinator manages (from the user record). */
  programmeIds: string[];
  /** Classes explicitly assigned through tutor_sections. */
  tutorSectionIds: string[];
};

export type WorkspaceSession = {
  id: string;
  startYear: number;
  endYear: number;
  status: SessionStatus;
  label: string;
};

export type WorkspaceClass = {
  sectionId: string;
  sectionLabel: string;
  batchId: string;
  admissionYear: number | null;
  expectedEndYear: number | null;
  datesConfirmed: boolean;
  legacyYear: string;
  programmeId: string;
  programmeName: string;
  programmeCode: string;
  departmentId: string;
  departmentName: string;
  facultyId: string;
  studyYear: number | null;
  semester: number | null;
  termConfirmed: boolean;
  /** "MCA F · 2025–2027" */
  label: string;
  /** "2025–2027" */
  years: string;
  /** "Year 2 · Semester 3" */
  stage: string;
  /** The staff member is assigned to this class as its tutor. */
  isTutorClass: boolean;
};

export type Workspace = {
  user: UserSession;
  scope: StaffScope;
  session: WorkspaceSession;
  /** True when the session was chosen automatically (only one available). */
  implicit: boolean;
  /** Every class this staff member may manage in the session. */
  classes: WorkspaceClass[];
  /** Classes they tutor in the session (the class switcher). */
  tutorClasses: WorkspaceClass[];
  /** The class tutor views operate on, if any. */
  activeClass: WorkspaceClass | null;
};

export type WorkspaceResolution =
  | { status: "OK"; workspace: Workspace; sessions: WorkspaceSession[] }
  | { status: "SELECT"; user: UserSession; scope: StaffScope; sessions: WorkspaceSession[] }
  | { status: "EMPTY"; user: UserSession; scope: StaffScope; sessions: WorkspaceSession[] }
  | { status: "NOT_STAFF" };

export class WorkspaceError extends Error {}

const STAFF_ROLES = new Set<string>(["SYSTEM_ADMIN", "COURSE_COORDINATOR", "CLASS_TUTOR"]);

// Tests have no request cookies; they pick the session explicitly.
let testWorkspaceSessionId: string | null | undefined = undefined;
export function setTestWorkspaceSession(sessionId: string | null | undefined) {
  testWorkspaceSessionId = sessionId;
}

async function selectedSessionCookie(): Promise<string | null> {
  if (testWorkspaceSessionId !== undefined) return testWorkspaceSessionId;
  try {
    const { cookies } = await import("next/headers");
    return (await cookies()).get(WORKSPACE_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

function toSession(row: typeof academicSessions.$inferSelect): WorkspaceSession {
  return {
    id: row.id,
    startYear: row.startYear,
    endYear: row.endYear,
    status: row.status as SessionStatus,
    label: sessionLabel(row),
  };
}

/** Loads the staff member's scope from trusted server-side records. */
export async function loadStaffScope(user: UserSession): Promise<StaffScope | null> {
  if (!STAFF_ROLES.has(user.role)) return null;
  const [record] = await db
    .select({ role: users.role, programmeId: users.programmeId, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, user.userId))
    .limit(1);
  // The role on the record wins over the token, so a demotion takes effect immediately.
  if (!record || !record.isActive || !STAFF_ROLES.has(record.role)) return null;
  const role = record.role as StaffRole;

  const assigned =
    role === "SYSTEM_ADMIN"
      ? []
      : await db.select({ sectionId: tutorSections.sectionId }).from(tutorSections).where(eq(tutorSections.tutorId, user.userId));

  return {
    userId: user.userId,
    role,
    allClasses: role === "SYSTEM_ADMIN",
    programmeIds: role === "COURSE_COORDINATOR" && record.programmeId ? [record.programmeId] : [],
    tutorSectionIds: assigned.map((a) => a.sectionId),
  };
}

/** SQL filter on academic_batches/sections for the classes a scope may manage. */
function classFilter(scope: StaffScope) {
  if (scope.allClasses) return undefined;
  const conditions = [];
  if (scope.programmeIds.length) conditions.push(inArray(academicBatches.programmeId, scope.programmeIds));
  if (scope.tutorSectionIds.length) conditions.push(inArray(sections.id, scope.tutorSectionIds));
  return conditions.length ? or(...conditions) : sql`false`;
}

/** Sessions in which this staff member has at least one class (admins: all). */
export async function listSessionsForScope(scope: StaffScope): Promise<WorkspaceSession[]> {
  if (scope.allClasses) {
    const rows = await db.select().from(academicSessions).orderBy(asc(academicSessions.startYear));
    return rows.map(toSession);
  }
  const filter = classFilter(scope);
  const rows = await db
    .selectDistinct({ session: academicSessions })
    .from(academicSessions)
    .innerJoin(cohortSessionTerms, eq(cohortSessionTerms.academicSessionId, academicSessions.id))
    .innerJoin(academicBatches, eq(academicBatches.id, cohortSessionTerms.academicBatchId))
    .innerJoin(sections, eq(sections.academicBatchId, academicBatches.id))
    .where(filter)
    .orderBy(asc(academicSessions.startYear));
  return rows.map((r) => toSession(r.session));
}

/** Every class the scope may manage inside one session, with its full identity. */
export async function listClassesForScope(scope: StaffScope, sessionId: string): Promise<WorkspaceClass[]> {
  const rows = await db
    .select({
      sectionId: sections.id,
      sectionLabel: sections.label,
      batchId: academicBatches.id,
      admissionYear: academicBatches.admissionYear,
      expectedEndYear: academicBatches.expectedEndYear,
      datesConfirmed: academicBatches.datesConfirmed,
      legacyYear: academicBatches.year,
      programmeId: programmes.id,
      programmeName: programmes.name,
      programmeCode: programmes.code,
      departmentId: departments.id,
      departmentName: departments.name,
      facultyId: departments.facultyId,
      studyYear: cohortSessionTerms.studyYear,
      semester: cohortSessionTerms.currentSemester,
      termConfirmed: cohortSessionTerms.confirmed,
    })
    .from(cohortSessionTerms)
    .innerJoin(academicBatches, eq(academicBatches.id, cohortSessionTerms.academicBatchId))
    .innerJoin(sections, eq(sections.academicBatchId, academicBatches.id))
    .innerJoin(programmes, eq(programmes.id, academicBatches.programmeId))
    .innerJoin(departments, eq(departments.id, programmes.departmentId))
    .where(and(eq(cohortSessionTerms.academicSessionId, sessionId), eq(sections.isActive, true), classFilter(scope)))
    .orderBy(asc(programmes.name), asc(academicBatches.admissionYear), asc(sections.label));

  const tutorSet = new Set(scope.tutorSectionIds);
  return rows.map((r) => ({
    ...r,
    label: cohortLabel({ ...r, programmeName: r.programmeName }),
    years: cohortYears(r),
    stage: stageLabel(r),
    isTutorClass: tutorSet.has(r.sectionId),
  }));
}

/**
 * Resolves the workspace for the current request. Cached per request, so the
 * layout, the page and its actions share one lookup.
 */
export const resolveStaffWorkspace = cache(async (): Promise<WorkspaceResolution> => {
  const user = await getSession();
  if (!user) return { status: "NOT_STAFF" };
  const scope = await loadStaffScope(user);
  if (!scope) return { status: "NOT_STAFF" };

  const sessions = await listSessionsForScope(scope);
  const enterable = sessions.filter((s) => s.status !== "ARCHIVED");
  const cookieId = await selectedSessionCookie();

  let selected = cookieId ? enterable.find((s) => s.id === cookieId) ?? null : null;
  let implicit = false;
  if (!selected && enterable.length === 1 && cookieId) {
    selected = enterable[0];
    implicit = true;
  }
  if (!selected) {
    return { status: sessions.length ? "SELECT" : "EMPTY", user, scope, sessions };
  }

  const classes = await listClassesForScope(scope, selected.id);
  const tutorClasses = classes.filter((c) => c.isTutorClass);
  // getSession() has already checked the active-class cookie against tutor_sections.
  const activeClass = tutorClasses.find((c) => c.sectionId === user.sectionId) ?? tutorClasses[0] ?? null;

  return { status: "OK", sessions, workspace: { user, scope, session: selected, implicit, classes, tutorClasses, activeClass } };
});

/** For server actions: the current workspace, or a clear error asking to pick a session. */
export async function requireStaffWorkspace(): Promise<Workspace> {
  const res = await resolveStaffWorkspace();
  if (res.status === "OK") return res.workspace;
  if (res.status === "NOT_STAFF") throw new WorkspaceError("Unauthorized");
  throw new WorkspaceError("Choose an academic session first.");
}

/** The class with this id, if the workspace may manage it. */
export function findClass(ws: Workspace, sectionId: string | null | undefined) {
  return sectionId ? ws.classes.find((c) => c.sectionId === sectionId) ?? null : null;
}

export function assertClass(ws: Workspace, sectionId: string | null | undefined): WorkspaceClass {
  const found = findClass(ws, sectionId);
  if (!found) throw new WorkspaceError(`You are not authorized to manage this class in Academic Session ${ws.session.label}.`);
  return found;
}

export type ScopedEvent = typeof registrationEvents.$inferSelect & {
  targetSectionIds: string[];
  /** Classes of this event that the workspace manages. */
  classes: WorkspaceClass[];
};

/** Loads an event with the classes it targets. */
export async function loadEventTargets(eventId: string) {
  const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
  if (!event) return null;
  const targets = await db.select({ sectionId: eventSections.sectionId }).from(eventSections).where(eq(eventSections.eventId, eventId));
  return { event, targetSectionIds: targets.map((t) => t.sectionId) };
}

/**
 * Checks that an event belongs to the selected session and to a class the
 * staff member manages. Use before reading or changing anything event-scoped.
 */
export async function assertEventInWorkspace(ws: Workspace, eventId: string): Promise<ScopedEvent> {
  const loaded = await loadEventTargets(eventId);
  if (!loaded) throw new WorkspaceError("Registration event not found.");
  const { event, targetSectionIds } = loaded;

  if (event.academicSessionId !== ws.session.id) {
    throw new WorkspaceError(
      event.academicSessionId
        ? `This event belongs to another academic session. Switch to that session to manage it.`
        : "This event is not linked to an academic session yet. An administrator must reconcile it first."
    );
  }

  const classes = ws.classes.filter((c) => targetSectionIds.includes(c.sectionId));
  const programmeOwned =
    ws.scope.programmeIds.length > 0 && ws.classes.some((c) => c.batchId === event.academicBatchId && ws.scope.programmeIds.includes(c.programmeId));
  if (!ws.scope.allClasses && classes.length === 0 && !programmeOwned) {
    throw new WorkspaceError("You are not authorized to manage this registration event.");
  }
  return { ...event, targetSectionIds, classes };
}

/** Event ids in the selected session that the workspace may manage (optionally one class only). */
export async function workspaceEventIds(ws: Workspace, opts: { sectionId?: string } = {}): Promise<string[]> {
  const sectionIds = opts.sectionId ? [assertClass(ws, opts.sectionId).sectionId] : ws.classes.map((c) => c.sectionId);
  if (sectionIds.length === 0) return [];
  const rows = await db
    .selectDistinct({ id: registrationEvents.id })
    .from(registrationEvents)
    .innerJoin(eventSections, eq(eventSections.eventId, registrationEvents.id))
    .where(and(eq(registrationEvents.academicSessionId, ws.session.id), inArray(eventSections.sectionId, sectionIds)));
  return rows.map((r) => r.id);
}

/** Paths that show session-specific data and therefore need a selected session. */
const SESSION_SCOPED_PREFIXES = [
  "/faculty/dashboard",
  "/faculty/monitor",
  "/faculty/window",
  "/faculty/replay",
  "/faculty/events",
  "/faculty/electives",
  "/faculty/tutor-electives",
  "/faculty/section",
  "/faculty/students",
  "/faculty/reports",
  "/faculty/tutor-reports",
  "/faculty/approvals",
  "/faculty/database",
];

export function isSessionScopedPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  return SESSION_SCOPED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
