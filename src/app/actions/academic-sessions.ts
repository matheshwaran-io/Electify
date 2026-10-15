"use server";

/**
 * Managing academic sessions, cohort dates and which cohorts study in which
 * session, plus the reconciliation of records the 0006 migration could not map
 * with confidence.
 *
 * - SYSTEM_ADMIN: everything.
 * - COURSE_COORDINATOR: cohorts of their own programme (dates, membership,
 *   study stage). Only admins create/archive sessions or re-link events.
 * - Everyone else: rejected.
 * Every change is audited.
 */
import { and, asc, count, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  academicSessions,
  auditLogs,
  cohortSessionTerms,
  eventSections,
  inviteCodes,
  programmes,
  registrationEvents,
  registrations,
  sections,
  users,
} from "@/lib/db/schema";
import { getSession, isRootAdmin, type UserSession } from "@/lib/auth";
import { loadStaffScope, type StaffScope } from "@/lib/workspace";
import { cohortYears, sessionLabel, stageLabel, suggestedStudyYear } from "@/lib/academic";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function requireManager(adminOnly = false): Promise<{ user: UserSession; scope: StaffScope }> {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  const scope = await loadStaffScope(user);
  if (!scope || (scope.role !== "SYSTEM_ADMIN" && scope.role !== "COURSE_COORDINATOR")) throw new Error("Unauthorized");
  if (adminOnly && scope.role !== "SYSTEM_ADMIN") throw new Error("Only an administrator can do this.");
  if (scope.role === "COURSE_COORDINATOR" && scope.programmeIds.length === 0) throw new Error("Your account is not linked to a programme.");
  return { user, scope };
}

function programmeFilter(scope: StaffScope) {
  return scope.allClasses ? undefined : inArray(academicBatches.programmeId, scope.programmeIds);
}

async function assertBatchInScope(scope: StaffScope, batchId: string) {
  const [batch] = await db.select().from(academicBatches).where(eq(academicBatches.id, batchId)).limit(1);
  if (!batch) throw new Error("Cohort not found.");
  if (!scope.allClasses && !scope.programmeIds.includes(batch.programmeId)) throw new Error("You can only manage cohorts of your own programme.");
  return batch;
}

async function audit(user: UserSession, action: string, metadata: Record<string, unknown>) {
  await db.insert(auditLogs).values({ action, userId: user.userId, userEmail: user.email, userRole: user.role, metadata });
}

function fail(err: unknown): { success: false; error: string } {
  return { success: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

async function revalidate() {
  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
  } catch {
    // tests
  }
}

// ── Sessions ────────────────────────────────────────────────────────────

export type SessionOverview = {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  status: string;
  cohortCount: number;
  unconfirmedCount: number;
  eventCount: number;
};

export async function getAcademicSessionsOverview(): Promise<Result<{ sessions: SessionOverview[]; isAdmin: boolean }>> {
  try {
    const { scope } = await requireManager();
    const rows = await db.select().from(academicSessions).orderBy(asc(academicSessions.startYear));
    const terms = await db
      .select({ sessionId: cohortSessionTerms.academicSessionId, confirmed: cohortSessionTerms.confirmed })
      .from(cohortSessionTerms)
      .innerJoin(academicBatches, eq(academicBatches.id, cohortSessionTerms.academicBatchId))
      .where(programmeFilter(scope));
    const events = await db
      .select({ sessionId: registrationEvents.academicSessionId, n: count() })
      .from(registrationEvents)
      .innerJoin(academicBatches, eq(academicBatches.id, registrationEvents.academicBatchId))
      .where(programmeFilter(scope))
      .groupBy(registrationEvents.academicSessionId);
    const eventCount = new Map(events.map((e) => [e.sessionId, e.n]));
    return {
      success: true,
      isAdmin: scope.allClasses,
      sessions: rows.map((s) => ({
        id: s.id,
        label: sessionLabel(s),
        startYear: s.startYear,
        endYear: s.endYear,
        status: s.status,
        cohortCount: terms.filter((t) => t.sessionId === s.id).length,
        unconfirmedCount: terms.filter((t) => t.sessionId === s.id && !t.confirmed).length,
        eventCount: eventCount.get(s.id) ?? 0,
      })),
    };
  } catch (err) {
    return fail(err);
  }
}

export async function createAcademicSession(input: { startYear: number; status?: "PLANNED" | "ACTIVE" }): Promise<Result<{ id: string }>> {
  try {
    const { user } = await requireManager(true);
    if (!isRootAdmin(user.email)) {
      throw new Error("Only the Root Administrator can create an Academic Timeline.");
    }
    const startYear = Math.trunc(Number(input.startYear));
    const currentYear = new Date().getFullYear();
    const minAllowedYear = currentYear - 1;
    const maxAllowedYear = currentYear + 3;

    if (!Number.isFinite(startYear)) {
      throw new Error("Enter a valid start year.");
    }
    if (startYear < minAllowedYear) {
      throw new Error(`Only 1 past year from the current year can exist (minimum year ${minAllowedYear}).`);
    }
    if (startYear > maxAllowedYear) {
      throw new Error(`Only up to 3 years from the current year can be added (maximum year ${maxAllowedYear}).`);
    }
    const status = input.status === "PLANNED" ? "PLANNED" : "ACTIVE";
    const [existing] = await db.select().from(academicSessions).where(eq(academicSessions.startYear, startYear)).limit(1);
    if (existing) throw new Error(`Academic session ${sessionLabel(existing)} already exists.`);
    const [row] = await db
      .insert(academicSessions)
      .values({ startYear, endYear: startYear + 1, status, createdById: user.userId })
      .returning();
    await audit(user, "ACADEMIC_SESSION_CREATED", { sessionId: row.id, label: sessionLabel(row), status });
    await revalidate();
    return { success: true, id: row.id };
  } catch (err) {
    return fail(err);
  }
}

export async function setAcademicSessionStatus(sessionId: string, status: "PLANNED" | "ACTIVE" | "ARCHIVED"): Promise<Result> {
  try {
    const { user } = await requireManager(true);
    if (!["PLANNED", "ACTIVE", "ARCHIVED"].includes(status)) throw new Error("Invalid status.");
    const [row] = await db.select().from(academicSessions).where(eq(academicSessions.id, sessionId)).limit(1);
    if (!row) throw new Error("Academic session not found.");
    if (status === "ARCHIVED") {
      const [open] = await db
        .select({ n: count() })
        .from(registrationEvents)
        .where(and(eq(registrationEvents.academicSessionId, sessionId), inArray(registrationEvents.status, ["OPEN", "ACTIVE", "PAUSED", "PUBLISHED"])));
      if (open.n > 0) throw new Error(`Close the ${open.n} running or scheduled event(s) in ${sessionLabel(row)} before archiving it.`);
    }
    await db.update(academicSessions).set({ status, updatedAt: new Date() }).where(eq(academicSessions.id, sessionId));
    await audit(user, "ACADEMIC_SESSION_STATUS", { sessionId, label: sessionLabel(row), from: row.status, to: status });
    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

// ── Cohorts in a session ────────────────────────────────────────────────

export type SessionCohort = {
  termId: string;
  batchId: string;
  programmeName: string;
  programmeCode: string;
  years: string;
  admissionYear: number | null;
  expectedEndYear: number | null;
  datesConfirmed: boolean;
  studyYear: number | null;
  semester: number | null;
  stage: string;
  confirmed: boolean;
  classes: string[];
  eventCount: number;
  studentCount: number;
};

export type CohortCandidate = {
  batchId: string;
  programmeName: string;
  programmeCode: string;
  years: string;
  datesConfirmed: boolean;
  suggestedStudyYear: number | null;
  classes: string[];
  studentCount: number;
};

export async function getSessionCohorts(sessionId: string): Promise<Result<{ session: { id: string; label: string; status: string }; cohorts: SessionCohort[]; candidates: CohortCandidate[] }>> {
  try {
    const { scope } = await requireManager();
    const [session] = await db.select().from(academicSessions).where(eq(academicSessions.id, sessionId)).limit(1);
    if (!session) throw new Error("Academic session not found.");

    const batches = await db
      .select({
        batch: academicBatches,
        programmeName: programmes.name,
        programmeCode: programmes.code,
        durationYears: programmes.durationYears,
      })
      .from(academicBatches)
      .innerJoin(programmes, eq(programmes.id, academicBatches.programmeId))
      .where(and(eq(academicBatches.isActive, true), programmeFilter(scope)))
      .orderBy(asc(programmes.name), asc(academicBatches.admissionYear));
    const batchIds = batches.map((b) => b.batch.id);

    const [terms, secRows, studentRows, eventRows] = batchIds.length
      ? await Promise.all([
          db.select().from(cohortSessionTerms).where(and(eq(cohortSessionTerms.academicSessionId, sessionId), inArray(cohortSessionTerms.academicBatchId, batchIds))),
          db.select({ batchId: sections.academicBatchId, label: sections.label }).from(sections).where(and(inArray(sections.academicBatchId, batchIds), eq(sections.isActive, true))).orderBy(asc(sections.label)),
          db.select({ batchId: users.academicBatchId, n: count() }).from(users).where(and(eq(users.role, "STUDENT"), inArray(users.academicBatchId, batchIds))).groupBy(users.academicBatchId),
          db.select({ batchId: registrationEvents.academicBatchId, n: count() }).from(registrationEvents).where(and(eq(registrationEvents.academicSessionId, sessionId), inArray(registrationEvents.academicBatchId, batchIds))).groupBy(registrationEvents.academicBatchId),
        ])
      : [[], [], [], []];

    const classesOf = (id: string) => secRows.filter((r) => r.batchId === id).map((r) => r.label);
    const students = new Map(studentRows.map((r) => [r.batchId, r.n]));
    const events = new Map(eventRows.map((r) => [r.batchId, r.n]));
    const termByBatch = new Map(terms.map((t) => [t.academicBatchId, t]));

    const cohorts: SessionCohort[] = [];
    const candidates: CohortCandidate[] = [];
    for (const { batch, programmeName, programmeCode, durationYears } of batches) {
      const years = cohortYears({ admissionYear: batch.admissionYear, expectedEndYear: batch.expectedEndYear, legacyYear: batch.year });
      const term = termByBatch.get(batch.id);
      if (term) {
        cohorts.push({
          termId: term.id,
          batchId: batch.id,
          programmeName,
          programmeCode,
          years,
          admissionYear: batch.admissionYear,
          expectedEndYear: batch.expectedEndYear,
          datesConfirmed: batch.datesConfirmed,
          studyYear: term.studyYear,
          semester: term.currentSemester,
          stage: stageLabel({ studyYear: term.studyYear, semester: term.currentSemester }),
          confirmed: term.confirmed,
          classes: classesOf(batch.id),
          eventCount: events.get(batch.id) ?? 0,
          studentCount: students.get(batch.id) ?? 0,
        });
        continue;
      }
      // Suggest cohorts whose recorded years cover this session.
      const start = batch.admissionYear;
      const end = batch.expectedEndYear;
      if (start != null && start <= session.startYear && (end == null || session.startYear < end)) {
        candidates.push({
          batchId: batch.id,
          programmeName,
          programmeCode,
          years,
          datesConfirmed: batch.datesConfirmed,
          suggestedStudyYear: suggestedStudyYear(start, session, durationYears),
          classes: classesOf(batch.id),
          studentCount: students.get(batch.id) ?? 0,
        });
      }
    }

    return { success: true, session: { id: session.id, label: sessionLabel(session), status: session.status }, cohorts, candidates };
  } catch (err) {
    return fail(err);
  }
}

const validYear = (n: number | null | undefined) => n == null || (Number.isInteger(n) && n >= 1 && n <= 6);
const validSemester = (n: number | null | undefined) => n == null || (Number.isInteger(n) && n >= 1 && n <= 12);

export async function addCohortsToSession(
  sessionId: string,
  entries: { batchId: string; studyYear: number | null; semester: number | null }[]
): Promise<Result<{ added: number }>> {
  try {
    const { user, scope } = await requireManager();
    const [session] = await db.select().from(academicSessions).where(eq(academicSessions.id, sessionId)).limit(1);
    if (!session) throw new Error("Academic session not found.");
    if (session.status === "ARCHIVED") throw new Error("Archived sessions can't be changed.");
    if (!entries.length) throw new Error("Choose at least one cohort.");
    for (const e of entries) {
      if (!validYear(e.studyYear) || !validSemester(e.semester)) throw new Error("Study year must be 1–6 and semester 1–12.");
      await assertBatchInScope(scope, e.batchId);
    }
    const inserted = await db
      .insert(cohortSessionTerms)
      .values(entries.map((e) => ({ academicBatchId: e.batchId, academicSessionId: sessionId, studyYear: e.studyYear, currentSemester: e.semester, confirmed: true })))
      .onConflictDoNothing()
      .returning({ id: cohortSessionTerms.id });
    await audit(user, "COHORTS_ADDED_TO_SESSION", { sessionId, label: sessionLabel(session), batchIds: entries.map((e) => e.batchId), added: inserted.length });
    await revalidate();
    return { success: true, added: inserted.length };
  } catch (err) {
    return fail(err);
  }
}

export async function updateCohortTerm(termId: string, input: { studyYear: number | null; semester: number | null }): Promise<Result> {
  try {
    const { user, scope } = await requireManager();
    if (!validYear(input.studyYear) || !validSemester(input.semester)) throw new Error("Study year must be 1–6 and semester 1–12.");
    const [term] = await db.select().from(cohortSessionTerms).where(eq(cohortSessionTerms.id, termId)).limit(1);
    if (!term) throw new Error("Cohort term not found.");
    await assertBatchInScope(scope, term.academicBatchId);
    await db
      .update(cohortSessionTerms)
      .set({ studyYear: input.studyYear, currentSemester: input.semester, confirmed: true, updatedAt: new Date() })
      .where(eq(cohortSessionTerms.id, termId));
    await audit(user, "COHORT_TERM_UPDATED", { termId, from: { studyYear: term.studyYear, semester: term.currentSemester }, to: input });
    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

export async function removeCohortFromSession(termId: string): Promise<Result> {
  try {
    const { user, scope } = await requireManager();
    const [term] = await db.select().from(cohortSessionTerms).where(eq(cohortSessionTerms.id, termId)).limit(1);
    if (!term) throw new Error("Cohort term not found.");
    await assertBatchInScope(scope, term.academicBatchId);
    const [ev] = await db
      .select({ n: count() })
      .from(registrationEvents)
      .where(and(eq(registrationEvents.academicSessionId, term.academicSessionId), eq(registrationEvents.academicBatchId, term.academicBatchId)));
    if (ev.n > 0) throw new Error(`This cohort has ${ev.n} registration event(s) in this session, so it can't be removed.`);
    await db.delete(cohortSessionTerms).where(eq(cohortSessionTerms.id, termId));
    await audit(user, "COHORT_REMOVED_FROM_SESSION", { termId, batchId: term.academicBatchId, sessionId: term.academicSessionId });
    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

/** Records a cohort's admission and expected completion year and marks them confirmed. */
export async function setCohortDates(batchId: string, input: { admissionYear: number; expectedEndYear: number }): Promise<Result> {
  try {
    const { user, scope } = await requireManager();
    const batch = await assertBatchInScope(scope, batchId);
    const { admissionYear, expectedEndYear } = input;
    if (!Number.isInteger(admissionYear) || admissionYear < 2000 || admissionYear > 2100) throw new Error("Enter a valid admission year.");
    if (!Number.isInteger(expectedEndYear) || expectedEndYear <= admissionYear || expectedEndYear - admissionYear > 6) {
      throw new Error("The completion year must be 1–6 years after admission.");
    }
    await db
      .update(academicBatches)
      .set({ admissionYear, expectedEndYear, datesConfirmed: true, updatedAt: new Date() })
      .where(eq(academicBatches.id, batchId));
    await audit(user, "COHORT_DATES_CONFIRMED", {
      batchId,
      from: { admissionYear: batch.admissionYear, expectedEndYear: batch.expectedEndYear, confirmed: batch.datesConfirmed },
      to: { admissionYear, expectedEndYear },
    });
    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

// ── Reconciliation ──────────────────────────────────────────────────────

export type ReconciliationReport = {
  eventsWithoutSession: { id: string; name: string; academicYear: string | null; status: string; cohort: string }[];
  eventsWithoutClasses: { id: string; name: string; status: string; cohort: string; sessionLabel: string | null; classes: { id: string; label: string }[] }[];
  unconfirmedCohortDates: number;
  unconfirmedTerms: number;
  studentsWithoutClass: number;
  studentCodesWithoutClass: number;
  archivedTargets: number;
};

export async function getReconciliationReport(): Promise<Result<{ report: ReconciliationReport }>> {
  try {
    const { scope } = await requireManager();
    const pf = programmeFilter(scope);

    const eventBase = db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        academicYear: registrationEvents.academicYear,
        status: registrationEvents.status,
        batchId: registrationEvents.academicBatchId,
        sessionId: registrationEvents.academicSessionId,
        programmeName: programmes.name,
        programmeCode: programmes.code,
        admissionYear: academicBatches.admissionYear,
        expectedEndYear: academicBatches.expectedEndYear,
        legacyYear: academicBatches.year,
      })
      .from(registrationEvents)
      .innerJoin(academicBatches, eq(academicBatches.id, registrationEvents.academicBatchId))
      .innerJoin(programmes, eq(programmes.id, academicBatches.programmeId));

    const noSession = await eventBase.where(and(isNull(registrationEvents.academicSessionId), pf));
    const noClasses = await eventBase.where(
      and(pf, notExists(db.select({ x: sql`1` }).from(eventSections).where(eq(eventSections.eventId, registrationEvents.id))))
    );
    const classRows = noClasses.length
      ? await db
          .select({ id: sections.id, label: sections.label, batchId: sections.academicBatchId })
          .from(sections)
          .where(inArray(sections.academicBatchId, Array.from(new Set(noClasses.map((e) => e.batchId)))))
          .orderBy(asc(sections.label))
      : [];
    const sessionRows = await db.select().from(academicSessions);
    const sessionName = new Map(sessionRows.map((s) => [s.id, sessionLabel(s)]));
    const cohortOf = (e: (typeof noSession)[number]) => `${e.programmeName} · ${cohortYears(e)}`;

    const [dates] = await db
      .select({ n: count() })
      .from(academicBatches)
      .where(and(eq(academicBatches.datesConfirmed, false), pf, sql`exists (select 1 from users u where u.academic_batch_id = ${academicBatches.id})`));
    const [terms] = await db
      .select({ n: count() })
      .from(cohortSessionTerms)
      .innerJoin(academicBatches, eq(academicBatches.id, cohortSessionTerms.academicBatchId))
      .where(and(eq(cohortSessionTerms.confirmed, false), pf));
    const [noClassStudents] = await db
      .select({ n: count() })
      .from(users)
      .leftJoin(academicBatches, eq(academicBatches.id, users.academicBatchId))
      .where(
        and(
          eq(users.role, "STUDENT"),
          sql`(${users.sectionId} IS NULL OR ${users.academicBatchId} IS NULL)`,
          scope.allClasses ? undefined : inArray(users.programmeId, scope.programmeIds)
        )
      );
    const [codes] = await db
      .select({ n: count() })
      .from(inviteCodes)
      .where(and(eq(inviteCodes.role, "STUDENT"), isNull(inviteCodes.sectionId), scope.allClasses ? undefined : inArray(inviteCodes.programmeId, scope.programmeIds)));
    let archivedTargets = 0;
    if (scope.allClasses) {
      try {
        const res = await db.execute(sql`select count(*)::int as n from academic_reconciliation_archive`);
        archivedTargets = Number((res.rows[0] as { n: number } | undefined)?.n ?? 0);
      } catch {
        archivedTargets = 0;
      }
    }

    return {
      success: true,
      report: {
        eventsWithoutSession: noSession.map((e) => ({ id: e.id, name: e.name, academicYear: e.academicYear, status: e.status, cohort: cohortOf(e) })),
        eventsWithoutClasses: noClasses.map((e) => ({
          id: e.id,
          name: e.name,
          status: e.status,
          cohort: cohortOf(e),
          sessionLabel: e.sessionId ? sessionName.get(e.sessionId) ?? null : null,
          classes: classRows.filter((c) => c.batchId === e.batchId).map((c) => ({ id: c.id, label: c.label })),
        })),
        unconfirmedCohortDates: dates.n,
        unconfirmedTerms: terms.n,
        studentsWithoutClass: noClassStudents.n,
        studentCodesWithoutClass: codes.n,
        archivedTargets,
      },
    };
  } catch (err) {
    return fail(err);
  }
}

/** Links a legacy event to a session. The event's cohort must already be part of that session. */
export async function linkEventToSession(eventId: string, sessionId: string, semester?: number | null): Promise<Result> {
  try {
    const { user } = await requireManager(true);
    if (!validSemester(semester ?? null)) throw new Error("Semester must be 1–12.");
    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    if (!event) throw new Error("Registration event not found.");
    const [term] = await db
      .select()
      .from(cohortSessionTerms)
      .where(and(eq(cohortSessionTerms.academicSessionId, sessionId), eq(cohortSessionTerms.academicBatchId, event.academicBatchId)))
      .limit(1);
    if (!term) throw new Error("Add this event's cohort to that academic session first.");
    await db
      .update(registrationEvents)
      .set({ academicSessionId: sessionId, semester: semester ?? event.semester, updatedAt: new Date() })
      .where(eq(registrationEvents.id, eventId));
    await audit(user, "EVENT_LINKED_TO_SESSION", { eventId, eventName: event.name, from: event.academicSessionId, to: sessionId });
    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Explicitly sets which classes of its cohort an event is open to. Only adds
 * classes, or removes ones nobody from that class has registered through.
 */
export async function setEventClasses(eventId: string, sectionIds: string[]): Promise<Result> {
  try {
    const { user, scope } = await requireManager();
    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    if (!event) throw new Error("Registration event not found.");
    await assertBatchInScope(scope, event.academicBatchId);
    const unique = Array.from(new Set(sectionIds));
    if (unique.length === 0) throw new Error("Choose at least one class.");
    const valid = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(inArray(sections.id, unique), eq(sections.academicBatchId, event.academicBatchId)));
    if (valid.length !== unique.length) throw new Error("Every class must belong to the event's own cohort.");

    await db.transaction(async (tx) => {
      const current = await tx.select().from(eventSections).where(eq(eventSections.eventId, eventId));
      const removing = current.filter((c) => !unique.includes(c.sectionId));
      for (const r of removing) {
        const [used] = await tx
          .select({ n: count() })
          .from(registrations)
          .innerJoin(users, eq(users.id, registrations.studentId))
          .where(and(eq(registrations.eventId, eventId), eq(users.sectionId, r.sectionId)));
        if (used.n > 0) throw new Error("A class with registrations can't be removed from the event.");
        await tx.delete(eventSections).where(eq(eventSections.id, r.id));
      }
      const have = new Set(current.map((c) => c.sectionId));
      const adding = unique.filter((id) => !have.has(id));
      if (adding.length) {
        await tx.insert(eventSections).values(adding.map((sectionId) => ({ eventId, sectionId, academicBatchId: event.academicBatchId })));
      }
    });
    await audit(user, "EVENT_CLASSES_SET", { eventId, eventName: event.name, sectionIds: unique });
    await revalidate();
    return { success: true };
  } catch (err) {
    return fail(err);
  }
}
