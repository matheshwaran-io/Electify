"use server";

/**
 * Maintenance operations from the Database page. Every operation is limited
 * to the selected academic session and to classes/events the user manages
 * (lib/workspace.ts), and is written to the audit log.
 */
import { db } from "@/lib/db";
import {
  users,
  electives,
  electiveGroups,
  registrations,
  studentRegistrations,
  registrationEvents,
  replayEvents,
  eventStudents,
  auditLogs,
} from "@/lib/db/schema";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { assertEventInWorkspace, requireStaffWorkspace, type Workspace } from "@/lib/workspace";

async function assertAdminOrCoordinator(): Promise<Workspace> {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
    throw new Error("Unauthorized");
  }
  const ws = await requireStaffWorkspace();
  if (ws.scope.role !== "SYSTEM_ADMIN" && ws.scope.role !== "COURSE_COORDINATOR") throw new Error("Unauthorized");
  return ws;
}

async function audit(ws: Workspace, action: string, metadata: Record<string, unknown>) {
  await db.insert(auditLogs).values({
    action,
    userId: ws.user.userId,
    userEmail: ws.user.email,
    userRole: ws.user.role,
    metadata: { ...metadata, academicSessionId: ws.session.id },
  });
}

/** Every subject of the event back to full capacity (used after all choices are removed). */
async function restoreEventSeats(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], eventId: string) {
  await tx.execute(sql`
    UPDATE electives e SET available_seats = e.max_seats, is_full = false, updated_at = NOW()
    FROM elective_groups eg WHERE e.group_id = eg.id AND eg.event_id = ${eventId}
  `);
  await tx.execute(sql`
    UPDATE elective_seat_allocations esa SET available_seats = esa.max_seats, is_full = false, updated_at = NOW()
    FROM electives e, elective_groups eg WHERE esa.elective_id = e.id AND e.group_id = eg.id AND eg.event_id = ${eventId}
  `);
}

export async function deleteAllRegistrations(eventId: string) {
  const ws = await assertAdminOrCoordinator();
  const event = await assertEventInWorkspace(ws, eventId);

  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(registrations).where(eq(registrations.eventId, eventId));
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
    await tx.delete(registrations).where(eq(registrations.eventId, eventId));
    await tx.delete(replayEvents).where(eq(replayEvents.registrationEventId, eventId));
    await restoreEventSeats(tx, eventId);
    await tx.insert(auditLogs).values({
      action: "DELETE_ALL_REGISTRATIONS",
      userId: ws.user.userId,
      userEmail: ws.user.email,
      userRole: ws.user.role,
      metadata: { eventId, eventName: event.name, deletedRegistrations: n, academicSessionId: ws.session.id },
    });
  });
}

/**
 * Deletes the students of the classes the user manages in the selected
 * session (never students of other programmes, cohorts or sessions).
 */
export async function deleteAllStudents() {
  const ws = await assertAdminOrCoordinator();
  const sectionIds = ws.classes.map((c) => c.sectionId);
  if (sectionIds.length === 0) return;

  const students = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), inArray(users.sectionId, sectionIds)));
  const ids = students.map((s) => s.id);
  if (ids.length === 0) return;

  await db.transaction(async (tx) => {
    const held = await tx
      .select({ electiveId: studentRegistrations.electiveId, sectionId: users.sectionId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(and(inArray(studentRegistrations.studentId, ids), eq(studentRegistrations.status, "CONFIRMED")));
    const { releaseSeat } = await import("@/lib/seat-ops");
    const electiveIds = Array.from(new Set(held.map((h) => h.electiveId))).sort();
    if (electiveIds.length) await tx.select({ id: electives.id }).from(electives).where(inArray(electives.id, electiveIds)).for("update");
    for (const h of held) await releaseSeat(tx, h.electiveId, h.sectionId);

    await tx.delete(studentRegistrations).where(inArray(studentRegistrations.studentId, ids));
    await tx.delete(registrations).where(inArray(registrations.studentId, ids));
    await tx.delete(eventStudents).where(inArray(eventStudents.studentId, ids));
    await tx.delete(users).where(inArray(users.id, ids));
  });
  await audit(ws, "DELETE_ALL_STUDENTS", { deletedStudents: ids.length, sectionIds });
}

export async function deleteAllSubjects(eventId: string) {
  const ws = await assertAdminOrCoordinator();
  const event = await assertEventInWorkspace(ws, eventId);
  const [{ n }] = await db.select({ n: count() }).from(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
  if (n > 0) throw new Error(`Students have made ${n} choice(s) in this event. Delete or reset the registrations first.`);

  const groups = await db.select({ id: electiveGroups.id }).from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
  const groupIds = groups.map((g) => g.id);
  if (groupIds.length > 0) {
    await db.delete(electives).where(inArray(electives.groupId, groupIds));
  }
  await audit(ws, "DELETE_ALL_SUBJECTS", { eventId, eventName: event.name });
}

export async function resetAllSeats(eventId: string) {
  const ws = await assertAdminOrCoordinator();
  const event = await assertEventInWorkspace(ws, eventId);

  await db.transaction(async (tx) => {
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
    await tx.delete(registrations).where(eq(registrations.eventId, eventId));
    await restoreEventSeats(tx, eventId);
  });
  await audit(ws, "RESET_ALL_SEATS", { eventId, eventName: event.name });
}

export async function archiveEvent(eventId: string) {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR" && session.role !== "CLASS_TUTOR")) {
    throw new Error("Unauthorized");
  }
  const ws = await requireStaffWorkspace();
  const event = await assertEventInWorkspace(ws, eventId);

  await db.update(registrationEvents).set({ status: "CLOSED", updatedAt: new Date() }).where(eq(registrationEvents.id, eventId));
  await audit(ws, "CLOSE_EVENT", { eventId, eventName: event.name, from: event.status });
}
