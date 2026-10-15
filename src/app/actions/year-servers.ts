"use server";

/**
 * Year Servers management: simplifying academic management into direct,
 * self-contained annual workspaces (e.g. 2025, 2026, 2027).
 *
 * Each Year Server groups the relevant academic batches, programmes, classes,
 * students, registration events, and subjects for that admission year.
 *
 * Staff access rules:
 * - SYSTEM_ADMIN: full control across all Year Servers.
 * - COURSE_COORDINATOR: scoped to their assigned programmes in each Year Server.
 * - CLASS_TUTOR: scoped to their assigned classes in each Year Server.
 */
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  academicSessions,
  auditLogs,
  cohortSessionTerms,
  departments,
  eventSections,
  programmes,
  registrationEvents,
  sections,
  studentRegistrations,
  tutorSections,
  users,
} from "@/lib/db/schema";
import { getSession, isRootAdmin, type UserSession } from "@/lib/auth";
import { loadStaffScope, resolveStaffWorkspace, WORKSPACE_COOKIE, type StaffScope } from "@/lib/workspace";
import { cohortLabel, sessionLabel } from "@/lib/academic";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

function fail(err: unknown): { success: false; error: string } {
  return { success: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

async function requireStaff(): Promise<{ user: UserSession; scope: StaffScope }> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  const scope = await loadStaffScope(user);
  if (!scope) throw new Error("Unauthorized. Staff access required.");
  return { user, scope };
}

async function requireAdmin(): Promise<{ user: UserSession; scope: StaffScope }> {
  const { user, scope } = await requireStaff();
  if (scope.role !== "SYSTEM_ADMIN") throw new Error("Only an administrator can perform this action.");
  return { user, scope };
}

async function audit(user: UserSession, action: string, metadata: Record<string, unknown>) {
  await db.insert(auditLogs).values({
    action,
    userId: user.userId,
    userEmail: user.email,
    userRole: user.role,
    metadata,
  });
}

async function revalidate() {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
    revalidatePath("/faculty/academic-sessions");
    revalidatePath("/faculty/session-select");
  } catch {
    // inside tests or non-request context
  }
}

export type YearServerCard = {
  id: string;
  year: number;
  label: string; // e.g. "2026 Academic Timeline"
  status: "ACTIVE" | "PLANNED" | "ARCHIVED";
  programmeCount: number;
  classCount: number;
  studentCount: number;
  eventCount: number;
  isCurrent: boolean;
  canEnter: boolean;
};

/**
 * Returns simple, high-level cards for all Year Servers:
 * 2025, 2026, 2027 etc., along with counts of programmes, classes,
 * students and registration events matching the staff member's scope.
 */
export async function getYearServersOverview(): Promise<
  Result<{
    servers: YearServerCard[];
    isAdmin: boolean;
    isRootAdmin: boolean;
    currentSessionId: string | null;
    unresolvedCount: number;
  }>
> {
  try {
    const { user, scope } = await requireStaff();
    const resolution = await resolveStaffWorkspace();
    const currentSessionId = resolution.status === "OK" ? resolution.workspace.session.id : null;

    // Fetch all sessions so administrators can see, manage, and delete any session in the database
    const allSessions = await db
      .select()
      .from(academicSessions)
      .orderBy(asc(academicSessions.startYear));

    // Get unlinked historical events count for administrators
    let unresolvedCount = 0;
    if (scope.allClasses) {
      const [unlinked] = await db
        .select({ n: count() })
        .from(registrationEvents)
        .where(isNull(registrationEvents.academicSessionId));
      unresolvedCount = unlinked?.n ?? 0;
    }

    const cards: YearServerCard[] = [];

    for (const s of allSessions) {
      // Programmes & batches in scope
      const batchQuery = db
        .select({
          batchId: academicBatches.id,
          programmeId: academicBatches.programmeId,
        })
        .from(academicBatches)
        .innerJoin(cohortSessionTerms, eq(cohortSessionTerms.academicBatchId, academicBatches.id))
        .where(eq(cohortSessionTerms.academicSessionId, s.id));

      const scopedBatches = await batchQuery;
      let relevantBatchIds = scopedBatches.map((b) => b.batchId);
      let relevantProgrammeIds = Array.from(new Set(scopedBatches.map((b) => b.programmeId)));

      if (!scope.allClasses && scope.programmeIds.length > 0) {
        relevantProgrammeIds = relevantProgrammeIds.filter((p) => scope.programmeIds.includes(p));
        relevantBatchIds = scopedBatches.filter((b) => scope.programmeIds.includes(b.programmeId)).map((b) => b.batchId);
      }

      // Sections in scope
      let sectionIds: string[] = [];
      if (relevantBatchIds.length > 0) {
        const sectionRows = await db
          .select({ id: sections.id })
          .from(sections)
          .where(
            and(
              inArray(sections.academicBatchId, relevantBatchIds),
              eq(sections.isActive, true),
              scope.allClasses || scope.tutorSectionIds.length === 0
                ? undefined
                : inArray(sections.id, scope.tutorSectionIds)
            )
          );
        sectionIds = sectionRows.map((r) => r.id);
      }

      // If tutor has specific assigned sections, narrow down
      if (!scope.allClasses && scope.role === "CLASS_TUTOR") {
        sectionIds = sectionIds.filter((id) => scope.tutorSectionIds.includes(id));
      }

      // Count students in these sections
      let studentCount = 0;
      if (sectionIds.length > 0) {
        const [st] = await db
          .select({ n: count() })
          .from(users)
          .where(and(eq(users.role, "STUDENT"), inArray(users.sectionId, sectionIds), eq(users.isActive, true)));
        studentCount = st?.n ?? 0;
      }

      // Count registration events in this Year Server targeting these sections
      let eventCount = 0;
      if (scope.allClasses) {
        const [ev] = await db
          .select({ n: count() })
          .from(registrationEvents)
          .where(eq(registrationEvents.academicSessionId, s.id));
        eventCount = ev?.n ?? 0;
      } else if (sectionIds.length > 0) {
        const [ev] = await db
          .select({ n: count() })
          .from(registrationEvents)
          .innerJoin(eventSections, eq(eventSections.eventId, registrationEvents.id))
          .where(
            and(
              eq(registrationEvents.academicSessionId, s.id),
              inArray(eventSections.sectionId, sectionIds)
            )
          );
        eventCount = ev?.n ?? 0;
      }

      const isCurrent = s.id === currentSessionId;
      const canEnter = s.status !== "ARCHIVED" && (scope.allClasses || sectionIds.length > 0 || relevantProgrammeIds.length > 0);

      cards.push({
        id: s.id,
        year: s.startYear,
        label: `${s.startYear} Academic Timeline`,
        status: s.status as "ACTIVE" | "PLANNED" | "ARCHIVED",
        programmeCount: relevantProgrammeIds.length,
        classCount: sectionIds.length,
        studentCount,
        eventCount,
        isCurrent,
        canEnter,
      });
    }

    return {
      success: true,
      servers: cards.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)),
      isAdmin: scope.allClasses,
      isRootAdmin: isRootAdmin(user.email),
      currentSessionId,
      unresolvedCount,
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Creates a new Year Server (e.g. 2027 Year Server).
 * Automatically links any existing academic batches with that admission year.
 */
export async function createYearServer(input: {
  year: number;
  status?: "ACTIVE" | "PLANNED";
}): Promise<Result<{ id: string; year: number }>> {
  try {
    const { user } = await requireAdmin();
    if (!isRootAdmin(user.email)) {
      throw new Error("Only the Root Administrator can create an Academic Timeline.");
    }
    const year = Math.trunc(Number(input.year));
    const currentYear = new Date().getFullYear();
    const minAllowedYear = currentYear - 1; // 1 year old from current year
    const maxAllowedYear = currentYear + 3; // up to 3 years from current year

    if (!Number.isFinite(year)) {
      throw new Error("Enter a valid admission year.");
    }
    if (year < minAllowedYear) {
      throw new Error(`Only 1 past year from the current year can exist (minimum year ${minAllowedYear}).`);
    }
    if (year > maxAllowedYear) {
      throw new Error(`Only up to 3 years from the current year can be added (maximum year ${maxAllowedYear}).`);
    }

    const [existing] = await db
      .select()
      .from(academicSessions)
      .where(eq(academicSessions.startYear, year))
      .limit(1);

    if (existing) {
      throw new Error(`${year} Academic Timeline already exists.`);
    }

    const status = input.status === "PLANNED" ? "PLANNED" : "ACTIVE";

    const [row] = await db
      .insert(academicSessions)
      .values({
        startYear: year,
        endYear: year + 1,
        status,
        createdById: user.userId,
      })
      .returning();

    // Auto-link any batches for this admission year
    const matchingBatches = await db
      .select({ id: academicBatches.id })
      .from(academicBatches)
      .where(
        sql`${academicBatches.admissionYear} = ${year} OR btrim(${academicBatches.year}) = ${String(year)}`
      );

    for (const b of matchingBatches) {
      await db
        .insert(cohortSessionTerms)
        .values({
          academicBatchId: b.id,
          academicSessionId: row.id,
          studyYear: 1,
          confirmed: true,
        })
        .onConflictDoNothing();
    }

    await audit(user, "YEAR_SERVER_CREATED", {
      sessionId: row.id,
      year,
      status,
      linkedBatches: matchingBatches.length,
    });

    await revalidate();
    return { success: true, id: row.id, year };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Sets a Year Server to ACTIVE, PLANNED or ARCHIVED.
 */
export async function setYearServerStatus(
  id: string,
  status: "ACTIVE" | "PLANNED" | "ARCHIVED"
): Promise<Result> {
  try {
    const { user } = await requireAdmin();
    if (!["ACTIVE", "PLANNED", "ARCHIVED"].includes(status)) {
      throw new Error("Invalid status.");
    }

    const [row] = await db.select().from(academicSessions).where(eq(academicSessions.id, id)).limit(1);
    if (!row) throw new Error("Academic Timeline not found.");

    if (status === "ARCHIVED") {
      const [open] = await db
        .select({ n: count() })
        .from(registrationEvents)
        .where(and(eq(registrationEvents.academicSessionId, id), inArray(registrationEvents.status, ["OPEN", "PUBLISHED", "PAUSED"])));
      if (open && open.n > 0) {
        throw new Error(
          `Cannot archive ${row.startYear} Academic Timeline while it has ${open.n} active or open registration event(s). Close them first.`
        );
      }
    }

    await db.update(academicSessions).set({ status, updatedAt: new Date() }).where(eq(academicSessions.id, id));

    await audit(user, "YEAR_SERVER_STATUS_CHANGED", {
      sessionId: id,
      year: row.startYear,
      from: row.status,
      to: status,
    });

    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export type YearServerDeleteImpact = {
  id: string;
  year: number;
  label: string;
  status: string;
  programmeCount: number;
  classCount: number;
  studentCount: number;
  eventCount: number;
  registrationCount: number;
  isCurrent: boolean;
  isEmpty: boolean;
};

/**
 * Computes exact impact metrics for deleting a Year Server so the user
 * is clearly informed before proceeding with a destructive action.
 */
export async function getYearServerDeleteImpact(
  id: string
): Promise<Result<YearServerDeleteImpact>> {
  try {
    await requireAdmin();

    const [session] = await db
      .select()
      .from(academicSessions)
      .where(eq(academicSessions.id, id))
      .limit(1);

    if (!session) {
      throw new Error("Academic Timeline not found.");
    }

    // Cohorts linked
    const linkedBatches = await db
      .select({
        batchId: cohortSessionTerms.academicBatchId,
        programmeId: academicBatches.programmeId,
      })
      .from(cohortSessionTerms)
      .innerJoin(academicBatches, eq(academicBatches.id, cohortSessionTerms.academicBatchId))
      .where(eq(cohortSessionTerms.academicSessionId, id));

    const programmeIds = Array.from(new Set(linkedBatches.map((b) => b.programmeId)));
    const batchIds = linkedBatches.map((b) => b.batchId);

    let classCount = 0;
    let studentCount = 0;
    if (batchIds.length > 0) {
      const sectionRows = await db
        .select({ id: sections.id })
        .from(sections)
        .where(and(inArray(sections.academicBatchId, batchIds), eq(sections.isActive, true)));
      classCount = sectionRows.length;

      if (classCount > 0) {
        const [st] = await db
          .select({ n: count() })
          .from(users)
          .where(
            and(
              eq(users.role, "STUDENT"),
              inArray(users.sectionId, sectionRows.map((s) => s.id)),
              eq(users.isActive, true)
            )
          );
        studentCount = st?.n ?? 0;
      }
    }

    const events = await db
      .select({ id: registrationEvents.id })
      .from(registrationEvents)
      .where(eq(registrationEvents.academicSessionId, id));

    let registrationCount = 0;
    if (events.length > 0) {
      const [regs] = await db
        .select({ n: count() })
        .from(studentRegistrations)
        .where(inArray(studentRegistrations.eventId, events.map((e) => e.id)));
      registrationCount = regs?.n ?? 0;
    }

    const resolution = await resolveStaffWorkspace();
    const isCurrent = resolution.status === "OK" && resolution.workspace.session.id === id;
    const isEmpty = programmeIds.length === 0 && classCount === 0 && studentCount === 0 && events.length === 0;

    return {
      success: true,
      id: session.id,
      year: session.startYear,
      label: `${session.startYear} Academic Timeline`,
      status: session.status,
      programmeCount: programmeIds.length,
      classCount,
      studentCount,
      eventCount: events.length,
      registrationCount,
      isCurrent,
      isEmpty,
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Permanently deletes a Year Server.
 *
 * Safety & Data Integrity Guarantees:
 * - Only administrators can delete Year Servers.
 * - Any registration events belonging to this server are preserved by unlinking them
 *   (academic_session_id set to null). Zero student registrations, receipts, or audit
 *   logs are deleted or corrupted.
 * - Associated cohort_session_terms mappings are removed. The underlying programmes,
 *   batches, and sections remain untouched in the database.
 * - Active workspace cookies are cleared if pointing to the deleted session.
 * - The academic_sessions record is safely deleted.
 */
export async function deleteYearServer(
  id: string
): Promise<Result<{ deletedYear: number }>> {
  try {
    const { user } = await requireAdmin();
    if (!isRootAdmin(user.email)) {
      throw new Error("Only the Root Administrator can delete an Academic Timeline.");
    }

    const [session] = await db
      .select()
      .from(academicSessions)
      .where(eq(academicSessions.id, id))
      .limit(1);

    if (!session) {
      throw new Error("Academic Timeline not found.");
    }

    // 1. Inspect attached registration events
    const attachedEvents = await db
      .select({ id: registrationEvents.id, name: registrationEvents.name })
      .from(registrationEvents)
      .where(eq(registrationEvents.academicSessionId, id));

    const eventIds = attachedEvents.map((e) => e.id);
    let preservedRegistrationsCount = 0;

    if (eventIds.length > 0) {
      const [regs] = await db
        .select({ n: count() })
        .from(studentRegistrations)
        .where(inArray(studentRegistrations.eventId, eventIds));
      preservedRegistrationsCount = regs?.n ?? 0;

      // Disassociate events so FK restrict is satisfied without deleting historical student records
      for (const ev of attachedEvents) {
        await db
          .update(registrationEvents)
          .set({
            academicSessionId: null,
            updatedAt: new Date(),
          })
          .where(eq(registrationEvents.id, ev.id));
      }
    }

    // 2. Remove cohort session links for this session
    await db
      .delete(cohortSessionTerms)
      .where(eq(cohortSessionTerms.academicSessionId, id));

    // 3. Clear cookie if this session was selected
    try {
      const { cookies } = await import("next/headers");
      const store = await cookies();
      if (store.get(WORKSPACE_COOKIE)?.value === id) {
        store.delete(WORKSPACE_COOKIE);
        store.delete("electify_active_section");
      }
    } catch {
      // Non-request context
    }

    // 4. Delete the academic session record
    await db.delete(academicSessions).where(eq(academicSessions.id, id));

    // 5. Audit log
    await audit(user, "YEAR_SERVER_DELETED", {
      sessionId: id,
      year: session.startYear,
      status: session.status,
      unlinkedEventsCount: eventIds.length,
      preservedRegistrationsCount,
    });

    await revalidate();
    return { success: true, deletedYear: session.startYear };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Bulk cleanup utility to delete all empty Year Servers (0 programmes, 0 classes, 0 students, 0 events)
 * that have no active or historical data attached (e.g. cleaning up test servers).
 */
export async function deleteEmptyYearServers(): Promise<
  Result<{ deletedCount: number; deletedYears: number[] }>
> {
  try {
    const { user } = await requireAdmin();
    if (!isRootAdmin(user.email)) {
      throw new Error("Only the Root Administrator can delete Academic Timelines.");
    }

    const overview = await getYearServersOverview();
    if (!overview.success) {
      throw new Error(overview.error);
    }

    const emptyServers = overview.servers.filter(
      (s) => s.programmeCount === 0 && s.classCount === 0 && s.studentCount === 0 && s.eventCount === 0
    );

    if (emptyServers.length === 0) {
      return { success: true, deletedCount: 0, deletedYears: [] };
    }

    const deletedYears: number[] = [];
    for (const server of emptyServers) {
      await db.delete(cohortSessionTerms).where(eq(cohortSessionTerms.academicSessionId, server.id));
      await db.delete(academicSessions).where(eq(academicSessions.id, server.id));
      deletedYears.push(server.year);
    }

    await audit(user, "EMPTY_YEAR_SERVERS_PURGED", {
      deletedCount: deletedYears.length,
      deletedYears,
    });

    await revalidate();
    return { success: true, deletedCount: deletedYears.length, deletedYears };
  } catch (err) {
    return fail(err);
  }
}

export type YearServerWorkspaceClass = {
  sectionId: string;
  sectionLabel: string;
  classLabel: string; // e.g. "MCA F · 2026"
  programmeId: string;
  programmeName: string;
  studentCount: number;
  eventCount: number;
  tutors: { id: string; name: string; email: string }[];
};

export type YearServerProgrammeGroup = {
  programmeId: string;
  programmeName: string;
  programmeCode: string;
  departmentName: string;
  classes: YearServerWorkspaceClass[];
};

export type YearServerWorkspaceDetails = {
  id: string;
  year: number;
  title: string;
  status: string;
  programmes: YearServerProgrammeGroup[];
  events: {
    id: string;
    name: string;
    status: string;
    targetClassLabels: string[];
    openDate: Date | null;
    closeDate: Date | null;
  }[];
  metrics: {
    programmesCount: number;
    classesCount: number;
    studentsCount: number;
    eventsCount: number;
  };
};

/**
 * Returns full details of a Year Server workspace:
 * programmes, classes, student counts, and active events for that year.
 */
export async function getYearServerWorkspaceDetails(
  year: number
): Promise<Result<YearServerWorkspaceDetails>> {
  try {
    const { scope } = await requireStaff();

    const [session] = await db
      .select()
      .from(academicSessions)
      .where(eq(academicSessions.startYear, year))
      .limit(1);

    if (!session) {
      throw new Error(`Academic Timeline ${year} was not found.`);
    }

    // Find all classes in this session
    const termRows = await db
      .select({
        sectionId: sections.id,
        sectionLabel: sections.label,
        batchId: academicBatches.id,
        admissionYear: academicBatches.admissionYear,
        expectedEndYear: academicBatches.expectedEndYear,
        legacyYear: academicBatches.year,
        programmeId: programmes.id,
        programmeName: programmes.name,
        programmeCode: programmes.code,
        departmentName: departments.name,
      })
      .from(cohortSessionTerms)
      .innerJoin(academicBatches, eq(academicBatches.id, cohortSessionTerms.academicBatchId))
      .innerJoin(sections, eq(sections.academicBatchId, academicBatches.id))
      .innerJoin(programmes, eq(programmes.id, academicBatches.programmeId))
      .innerJoin(departments, eq(departments.id, programmes.departmentId))
      .where(
        and(
          eq(cohortSessionTerms.academicSessionId, session.id),
          eq(sections.isActive, true),
          scope.allClasses || scope.programmeIds.length === 0
            ? undefined
            : inArray(academicBatches.programmeId, scope.programmeIds)
        )
      )
      .orderBy(asc(programmes.name), asc(sections.label));

    // Filter to tutor classes if tutor
    const authorizedSections = scope.allClasses
      ? termRows
      : scope.role === "CLASS_TUTOR"
      ? termRows.filter((r) => scope.tutorSectionIds.includes(r.sectionId))
      : termRows;

    const sectionIds = authorizedSections.map((s) => s.sectionId);

    // Get student counts per section
    const studentCounts = sectionIds.length
      ? await db
          .select({
            sectionId: users.sectionId,
            count: count(),
          })
          .from(users)
          .where(and(eq(users.role, "STUDENT"), inArray(users.sectionId, sectionIds), eq(users.isActive, true)))
          .groupBy(users.sectionId)
      : [];

    const studentMap = new Map(studentCounts.map((s) => [s.sectionId, s.count]));

    // Get assigned tutors for these sections
    const tutorAssignments = sectionIds.length
      ? await db
          .select({
            sectionId: tutorSections.sectionId,
            tutorId: users.id,
            name: users.name,
            email: users.email,
          })
          .from(tutorSections)
          .innerJoin(users, eq(users.id, tutorSections.tutorId))
          .where(inArray(tutorSections.sectionId, sectionIds))
      : [];

    const tutorMap = new Map<string, { id: string; name: string; email: string }[]>();
    for (const a of tutorAssignments) {
      const list = tutorMap.get(a.sectionId) ?? [];
      list.push({ id: a.tutorId, name: a.name, email: a.email });
      tutorMap.set(a.sectionId, list);
    }

    // Get events in this Year Server
    const eventsQuery = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
      })
      .from(registrationEvents)
      .where(eq(registrationEvents.academicSessionId, session.id))
      .orderBy(desc(registrationEvents.createdAt));

    // Event targets
    const eventTargets = eventsQuery.length
      ? await db
          .select({
            eventId: eventSections.eventId,
            sectionId: eventSections.sectionId,
          })
          .from(eventSections)
          .where(inArray(eventSections.eventId, eventsQuery.map((e) => e.id)))
      : [];

    const eventCountBySection = new Map<string, number>();
    for (const t of eventTargets) {
      eventCountBySection.set(t.sectionId, (eventCountBySection.get(t.sectionId) ?? 0) + 1);
    }

    // Group by programme
    const programmeMap = new Map<string, YearServerProgrammeGroup>();

    for (const row of authorizedSections) {
      if (!programmeMap.has(row.programmeId)) {
        programmeMap.set(row.programmeId, {
          programmeId: row.programmeId,
          programmeName: row.programmeName,
          programmeCode: row.programmeCode,
          departmentName: row.departmentName,
          classes: [],
        });
      }

      const prog = programmeMap.get(row.programmeId)!;
      prog.classes.push({
        sectionId: row.sectionId,
        sectionLabel: row.sectionLabel,
        classLabel: cohortLabel(row),
        programmeId: row.programmeId,
        programmeName: row.programmeName,
        studentCount: studentMap.get(row.sectionId) ?? 0,
        eventCount: eventCountBySection.get(row.sectionId) ?? 0,
        tutors: tutorMap.get(row.sectionId) ?? [],
      });
    }

    const sectionLabelById = new Map(authorizedSections.map((s) => [s.sectionId, `${s.programmeCode || s.programmeName} ${s.sectionLabel}`]));

    const eventsList = eventsQuery.map((ev) => {
      const targets = eventTargets
        .filter((t) => t.eventId === ev.id)
        .map((t) => sectionLabelById.get(t.sectionId))
        .filter(Boolean) as string[];

      return {
        id: ev.id,
        name: ev.name,
        status: ev.status,
        targetClassLabels: targets,
        openDate: ev.openDate,
        closeDate: ev.closeDate,
      };
    });

    const totalStudents = Array.from(studentMap.values()).reduce((sum, n) => sum + n, 0);

    return {
      success: true,
      id: session.id,
      year: session.startYear,
      title: `${session.startYear} Academic Timeline`,
      status: session.status,
      programmes: Array.from(programmeMap.values()),
      events: eventsList,
      metrics: {
        programmesCount: programmeMap.size,
        classesCount: authorizedSections.length,
        studentsCount: totalStudents,
        eventsCount: eventsList.length,
      },
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Returns unresolved historical records for the administrator data review page.
 */
export async function getHistoricalReviewReport(): Promise<
  Result<{
    unlinkedEvents: {
      id: string;
      name: string;
      academicYear: string | null;
      status: string;
      batchYear: string | null;
      programmeName: string | null;
      createdAt: Date;
    }[];
    availableYearServers: { id: string; year: number; label: string }[];
  }>
> {
  try {
    await requireAdmin();

    const unlinked = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        academicYear: registrationEvents.academicYear,
        status: registrationEvents.status,
        batchYear: academicBatches.year,
        programmeName: programmes.name,
        createdAt: registrationEvents.createdAt,
      })
      .from(registrationEvents)
      .leftJoin(academicBatches, eq(academicBatches.id, registrationEvents.academicBatchId))
      .leftJoin(programmes, eq(programmes.id, academicBatches.programmeId))
      .where(isNull(registrationEvents.academicSessionId))
      .orderBy(desc(registrationEvents.createdAt));

    const sessions = await db
      .select({
        id: academicSessions.id,
        year: academicSessions.startYear,
      })
      .from(academicSessions)
      .orderBy(asc(academicSessions.startYear));

    return {
      success: true,
      unlinkedEvents: unlinked,
      availableYearServers: sessions.map((s) => ({
        id: s.id,
        year: s.year,
        label: `${s.year} Academic Timeline`,
      })),
    };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Allows an administrator to link a historical unlinked event to a chosen Year Server.
 */
export async function linkHistoricalEventToYearServer(
  eventId: string,
  sessionId: string
): Promise<Result> {
  try {
    const { user } = await requireAdmin();

    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    if (!event) throw new Error("Event not found.");

    const [session] = await db.select().from(academicSessions).where(eq(academicSessions.id, sessionId)).limit(1);
    if (!session) throw new Error("Academic Timeline not found.");

    await db
      .update(registrationEvents)
      .set({
        academicSessionId: session.id,
        academicYear: sessionLabel(session),
        updatedAt: new Date(),
      })
      .where(eq(registrationEvents.id, eventId));

    await audit(user, "HISTORICAL_EVENT_LINKED_TO_YEAR_SERVER", {
      eventId,
      eventName: event.name,
      sessionId,
      yearServer: `${session.startYear} Academic Timeline`,
    });

    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}
