/**
 * Which registration events a student may see and use.
 *
 * A student is eligible for an event only when ALL of these hold:
 *   - the event is in a student-visible status;
 *   - the event belongs to the student's own admission cohort
 *     (registration_events.academic_batch_id = users.academic_batch_id);
 *   - the event explicitly targets the student's class
 *     (an event_sections row for users.section_id).
 *
 * Every student page and every registration action uses this module, so what
 * a student sees always matches what the server accepts. There is no "newest
 * event for the batch" fallback: an event that does not target the class is
 * invisible to it, however recent.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  academicSessions,
  departments,
  eventSections,
  programmes,
  registrationEvents,
  registrations,
  sections,
  users,
} from "@/lib/db/schema";
import { getRegistrationWindow, STUDENT_VISIBLE_EVENT_STATUSES, type RegistrationWindow } from "@/lib/registration-window";
import { cohortLabel, sessionLabel } from "@/lib/academic";

type Executor = Pick<typeof db, "select">;

export type StudentRecord = typeof users.$inferSelect;

export type StudentClass = {
  sectionId: string;
  sectionLabel: string;
  batchId: string;
  programmeId: string;
  programmeName: string;
  departmentId: string;
  departmentName: string;
  /** "MCA F · 2025–2027" */
  label: string;
};

export type StudentEvent = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
  autoClose: boolean;
  allowEditing: boolean;
  createdAt: Date;
  academicSessionId: string | null;
  sessionLabel: string | null;
  semester: number | null;
  window: RegistrationWindow;
  registrationStatus: string | null;
};

export type StudentEventsResult =
  | { status: "NO_STUDENT" }
  | { status: "NOT_STUDENT" }
  | { status: "NO_CLASS"; student: StudentRecord }
  | { status: "OK"; student: StudentRecord; studentClass: StudentClass; events: StudentEvent[] };

/** The student's class with its full academic identity, or null if not assigned. */
export async function loadStudentClass(student: Pick<StudentRecord, "sectionId" | "academicBatchId">): Promise<StudentClass | null> {
  if (!student.sectionId || !student.academicBatchId) return null;
  const [row] = await db
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
      departmentId: departments.id,
      departmentName: departments.name,
    })
    .from(sections)
    .innerJoin(academicBatches, eq(academicBatches.id, sections.academicBatchId))
    .innerJoin(programmes, eq(programmes.id, academicBatches.programmeId))
    .innerJoin(departments, eq(departments.id, programmes.departmentId))
    // The class must belong to the student's recorded cohort.
    .where(and(eq(sections.id, student.sectionId), eq(sections.academicBatchId, student.academicBatchId)))
    .limit(1);
  if (!row) return null;
  return {
    sectionId: row.sectionId,
    sectionLabel: row.sectionLabel,
    batchId: row.batchId,
    programmeId: row.programmeId,
    programmeName: row.programmeName,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    label: cohortLabel(row),
  };
}

/** All events this student is eligible for, newest first. */
export async function listStudentEvents(studentId: string, now: Date = new Date()): Promise<StudentEventsResult> {
  const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
  if (!student) return { status: "NO_STUDENT" };
  if (student.role !== "STUDENT") return { status: "NOT_STUDENT" };

  const studentClass = await loadStudentClass(student);
  if (!studentClass) return { status: "NO_CLASS", student };

  const rows = await db
    .select({
      event: registrationEvents,
      startYear: academicSessions.startYear,
      endYear: academicSessions.endYear,
      registrationStatus: registrations.status,
    })
    .from(registrationEvents)
    .innerJoin(
      eventSections,
      and(eq(eventSections.eventId, registrationEvents.id), eq(eventSections.sectionId, studentClass.sectionId))
    )
    .leftJoin(academicSessions, eq(academicSessions.id, registrationEvents.academicSessionId))
    .leftJoin(registrations, and(eq(registrations.eventId, registrationEvents.id), eq(registrations.studentId, student.id)))
    .where(
      and(
        eq(registrationEvents.academicBatchId, studentClass.batchId),
        inArray(registrationEvents.status, [...STUDENT_VISIBLE_EVENT_STATUSES])
      )
    )
    .orderBy(desc(registrationEvents.createdAt));

  const events = rows.map(({ event, startYear, endYear, registrationStatus }) => ({
    id: event.id,
    name: event.name,
    description: event.description,
    status: event.status,
    openDate: event.openDate,
    closeDate: event.closeDate,
    autoClose: event.autoClose,
    allowEditing: event.allowEditing,
    createdAt: event.createdAt,
    academicSessionId: event.academicSessionId,
    sessionLabel: startYear != null && endYear != null ? sessionLabel({ startYear, endYear }) : null,
    semester: event.semester,
    window: getRegistrationWindow(event, now),
    registrationStatus: registrationStatus ?? null,
  }));

  return { status: "OK", student, studentClass, events };
}

const STATE_RANK: Record<RegistrationWindow["state"], number> = { OPEN: 0, PAUSED: 1, UPCOMING: 2, UNSCHEDULED: 3, CLOSED: 4 };

/**
 * The event a student should land on when they have not picked one:
 * open > paused > upcoming (soonest first) > unscheduled > closed (their own
 * registration first, then most recent).
 */
export function pickPrimaryEvent(events: StudentEvent[]): StudentEvent | null {
  const sorted = [...events].sort((a, b) => {
    const rank = STATE_RANK[a.window.state] - STATE_RANK[b.window.state];
    if (rank !== 0) return rank;
    if (a.window.state === "UPCOMING") return (a.openDate?.getTime() ?? 0) - (b.openDate?.getTime() ?? 0);
    if (a.window.state === "CLOSED") {
      const mine = Number(b.registrationStatus === "CONFIRMED") - Number(a.registrationStatus === "CONFIRMED");
      if (mine !== 0) return mine;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  return sorted[0] ?? null;
}

/** Events worth showing in a chooser: anything not closed, plus closed ones the student registered for. */
export function relevantEvents(events: StudentEvent[]) {
  return events.filter((e) => e.window.state !== "CLOSED" || (e.registrationStatus && e.registrationStatus !== "NOT_REGISTERED"));
}

export type ResolvedStudentEvent =
  | Exclude<StudentEventsResult, { status: "OK" }>
  | { status: "NO_EVENT"; student: StudentRecord; studentClass: StudentClass; events: StudentEvent[] }
  | { status: "NOT_ELIGIBLE"; student: StudentRecord; studentClass: StudentClass; events: StudentEvent[] }
  | { status: "OK"; student: StudentRecord; studentClass: StudentClass; events: StudentEvent[]; event: StudentEvent };

/**
 * The event a student page should show: the requested one if the student is
 * eligible for it, otherwise their primary event. A requested event they are
 * not eligible for is reported as NOT_ELIGIBLE, never silently swapped.
 */
export async function resolveStudentEvent(studentId: string, requestedEventId?: string | null, now: Date = new Date()): Promise<ResolvedStudentEvent> {
  const res = await listStudentEvents(studentId, now);
  if (res.status !== "OK") return res;
  if (requestedEventId) {
    const event = res.events.find((e) => e.id === requestedEventId);
    return event ? { ...res, event } : { ...res, status: "NOT_ELIGIBLE" };
  }
  const event = pickPrimaryEvent(res.events);
  return event ? { ...res, event } : { ...res, status: "NO_EVENT" };
}

/**
 * Server-side eligibility check for mutations. Pass the transaction so the
 * check reads the same snapshot as the write.
 */
export async function isStudentEligibleForEvent(executor: Executor, studentId: string, eventId: string): Promise<boolean> {
  const [row] = await executor
    .select({ ok: sql<number>`1` })
    .from(users)
    .innerJoin(sections, and(eq(sections.id, users.sectionId), eq(sections.academicBatchId, users.academicBatchId)))
    .innerJoin(eventSections, and(eq(eventSections.sectionId, sections.id), eq(eventSections.eventId, eventId)))
    .innerJoin(
      registrationEvents,
      and(eq(registrationEvents.id, eventSections.eventId), eq(registrationEvents.academicBatchId, users.academicBatchId))
    )
    .where(and(eq(users.id, studentId), eq(users.role, "STUDENT")))
    .limit(1);
  return Boolean(row);
}

/** Query-string helper for student links that must stay on one event. */
export function withEvent(path: string, eventId: string | null | undefined) {
  return eventId ? `${path}?event=${encodeURIComponent(eventId)}` : path;
}
