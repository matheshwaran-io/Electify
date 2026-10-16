"use server";

import { db } from "@/lib/db";
import { confirmedCount } from "@/lib/seat-ops";
import {
  users, registrationEvents, sections, departments, programmes,
  electiveGroups, electives, electiveSeatAllocations, studentRegistrations,
  academicBatches, auditLogs, registrations,
  eventSections, eventStudents, replayEvents
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, count, asc, desc, inArray, sql } from "drizzle-orm";
import { assertEventInWorkspace, requireStaffWorkspace, workspaceEventIds, type Workspace } from "@/lib/workspace";
import { sessionLabel } from "@/lib/academic";
import { toDate } from "@/lib/registration-window";

async function assertCoordinator() {
  const session = await getSession();
  if (!session || (session.role !== "COURSE_COORDINATOR" && session.role !== "SYSTEM_ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

/**
 * Coordinator/admin access to the selected academic session. Every read and
 * write below is limited to the session and to the classes the user manages
 * there (lib/workspace.ts); nothing relies on the client to hide other data.
 */
async function coordinatorWorkspace(): Promise<Workspace> {
  const ws = await requireStaffWorkspace();
  if (ws.scope.role !== "COURSE_COORDINATOR" && ws.scope.role !== "SYSTEM_ADMIN") throw new Error("Unauthorized");
  return ws;
}

/** The event that owns an elective group, checked against the workspace. */
async function assertGroupInWorkspace(ws: Workspace, groupId: string) {
  const [group] = await db.select().from(electiveGroups).where(eq(electiveGroups.id, groupId)).limit(1);
  if (!group) throw new Error("Elective basket not found.");
  const event = await assertEventInWorkspace(ws, group.eventId);
  return { group, event };
}

async function assertElectiveInWorkspace(ws: Workspace, electiveId: string) {
  const [elective] = await db.select().from(electives).where(eq(electives.id, electiveId)).limit(1);
  if (!elective) throw new Error("Subject not found.");
  const { group, event } = await assertGroupInWorkspace(ws, elective.groupId);
  return { elective, group, event };
}

/** Students (by id) that the workspace manages; throws if any is outside it. */
async function assertStudentsInWorkspace(ws: Workspace, ids: string[]) {
  const unique = Array.from(new Set(ids));
  const rows = await db
    .select({ id: users.id, sectionId: users.sectionId, role: users.role })
    .from(users)
    .where(inArray(users.id, unique));
  const allowed = new Set(ws.classes.map((c) => c.sectionId));
  if (rows.length !== unique.length || rows.some((r) => r.role !== "STUDENT" || !r.sectionId || !allowed.has(r.sectionId))) {
    throw new Error(`Some of these students are not in a class you manage in Academic Session ${ws.session.label}.`);
  }
  return rows;
}

// ── Electives & Seat Allotments ──────────────────────────────────────────

export async function getCoordinatorElectives() {
  const ws = await coordinatorWorkspace();
  const eventIds = await workspaceEventIds(ws);
  if (eventIds.length === 0) return [];

  const events = await db
    .select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      status: registrationEvents.status,
      academicBatchId: registrationEvents.academicBatchId,
    })
    .from(registrationEvents)
    .where(inArray(registrationEvents.id, eventIds))
    .orderBy(desc(registrationEvents.createdAt));
  const targets = await db
    .select({ eventId: eventSections.eventId, sectionId: eventSections.sectionId })
    .from(eventSections)
    .where(inArray(eventSections.eventId, eventIds));
  const classLabelsFor = (eventId: string) =>
    targets
      .filter((t) => t.eventId === eventId)
      .map((t) => ws.classes.find((c) => c.sectionId === t.sectionId)?.label)
      .filter((l): l is string => Boolean(l));

  const result = [];
  for (const event of events) {
    const groups = await db
      .select()
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, event.id))
      .orderBy(asc(electiveGroups.sortOrder));

    for (const group of groups) {
      const groupElectives = await db
        .select()
        .from(electives)
        .where(eq(electives.groupId, group.id))
        .orderBy(asc(electives.name));

      const electiveIds = groupElectives.map((e) => e.id);
      let allocations: {
        id: string;
        electiveId: string;
        departmentId: string;
        departmentName: string;
        departmentCode: string;
        sectionId: string | null;
        sectionLabel: string | null;
        maxSeats: number;
        availableSeats: number;
        isFull: boolean;
      }[] = [];

      if (electiveIds.length > 0) {
        allocations = await db
          .select({
            id: electiveSeatAllocations.id,
            electiveId: electiveSeatAllocations.electiveId,
            departmentId: electiveSeatAllocations.departmentId,
            departmentName: departments.name,
            departmentCode: departments.code,
            sectionId: electiveSeatAllocations.sectionId,
            sectionLabel: sections.label,
            maxSeats: electiveSeatAllocations.maxSeats,
            availableSeats: electiveSeatAllocations.availableSeats,
            isFull: electiveSeatAllocations.isFull,
          })
          .from(electiveSeatAllocations)
          .innerJoin(departments, eq(electiveSeatAllocations.departmentId, departments.id))
          .leftJoin(sections, eq(electiveSeatAllocations.sectionId, sections.id))
          .where(inArray(electiveSeatAllocations.electiveId, electiveIds));
      }

      const electivesWithAllocations = groupElectives.map((e) => {
        const itemAllocs = allocations
          .filter((a) => a.electiveId === e.id)
          .map((a) => ({
            ...a,
            bookedSeats: Math.max(0, a.maxSeats - a.availableSeats),
          }));

        const totalAllotted = itemAllocs.reduce((sum, a) => sum + a.maxSeats, 0);
        const totalBooked = itemAllocs.reduce((sum, a) => sum + a.bookedSeats, 0);
        const unallocatedSeats = Math.max(0, e.maxSeats - totalAllotted);

        return {
          ...e,
          allocations: itemAllocs,
          totalAllottedSeats: totalAllotted,
          totalBookedSeats: totalBooked,
          unallocatedSeats,
        };
      });

      result.push({
        eventId: event.id,
        eventName: event.name,
        eventStatus: event.status,
        eventClasses: classLabelsFor(event.id),
        groupId: group.id,
        groupName: group.name,
        minChoices: group.minChoices,
        maxChoices: group.maxChoices,
        electives: electivesWithAllocations,
      });
    }
  }
  return result;
}

/** Classes a seat quota can be set for: those the user manages in the selected session. */
export async function getAcademicHierarchyForAllocations() {
  const ws = await coordinatorWorkspace();
  const byDept = new Map<string, { id: string; name: string; code: string; sections: { id: string; label: string; programmeName: string; batchYear: string; departmentId: string; displayName: string }[] }>();
  for (const c of ws.classes) {
    const dept = byDept.get(c.departmentId) ?? { id: c.departmentId, name: c.departmentName, code: "", sections: [] };
    dept.sections.push({
      id: c.sectionId,
      label: c.sectionLabel,
      programmeName: c.programmeName,
      batchYear: c.years,
      departmentId: c.departmentId,
      displayName: c.label,
    });
    byDept.set(c.departmentId, dept);
  }
  return Array.from(byDept.values());
}

export async function setElectiveSeatAllocations(
  electiveId: string,
  allotments: { departmentId: string; sectionId?: string | null; maxSeats: number }[]
) {
  const ws = await coordinatorWorkspace();
  const session = ws.user;
  const { elective, event } = await assertElectiveInWorkspace(ws, electiveId);

  // A class quota only makes sense for a class this event is open to.
  for (const allot of allotments) {
    if (allot.sectionId && !event.targetSectionIds.includes(allot.sectionId)) {
      throw new Error("Seat quotas can only be set for classes this registration event is open to.");
    }
    if (!Number.isInteger(allot.maxSeats) || allot.maxSeats < 0) {
      throw new Error("Seat quotas must be whole numbers of zero or more.");
    }
  }

  const totalAllotted = allotments.reduce((sum, a) => sum + a.maxSeats, 0);
  if (totalAllotted > elective.maxSeats) {
    throw new Error(
      `Total allotted seats (${totalAllotted}) cannot exceed subject capacity (${elective.maxSeats}). Please increase total subject capacity first.`
    );
  }

  await db.transaction(async (tx) => {
    // Serialise with registrations on this elective while quotas change.
    await tx.select({ id: electives.id }).from(electives).where(eq(electives.id, electiveId)).for("update");

    // 1. Existing allocations for this elective
    const existingAllocations = await tx
      .select()
      .from(electiveSeatAllocations)
      .where(eq(electiveSeatAllocations.electiveId, electiveId));

    // 2. Count seats currently held per section (cancelled choices hold no seat)
    const currentStudentRegs = await tx
      .select({ sectionId: users.sectionId, departmentId: users.departmentId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(and(eq(studentRegistrations.electiveId, electiveId), eq(studentRegistrations.status, "CONFIRMED")));

    const bookedPerSection: Record<string, number> = {};
    for (const reg of currentStudentRegs) {
      if (reg.sectionId) {
        bookedPerSection[reg.sectionId] = (bookedPerSection[reg.sectionId] || 0) + 1;
      }
    }

    // 3. Verify no section's maxSeats is set below already registered students
    for (const allot of allotments) {
      const booked = allot.sectionId ? (bookedPerSection[allot.sectionId] || 0) : 0;
      if (allot.maxSeats < booked) {
        throw new Error(
          `Cannot reduce seats to ${allot.maxSeats}. ${booked} students have already registered in this class.`
        );
      }
    }

    // 4. Remove allocations omitted in new list (only if 0 students booked)
    const incomingKeys = new Set(allotments.map((a) => a.sectionId || `dept_${a.departmentId}`));
    for (const existing of existingAllocations) {
      const key = existing.sectionId || `dept_${existing.departmentId}`;
      if (!incomingKeys.has(key)) {
        const booked = existing.sectionId ? (bookedPerSection[existing.sectionId] || 0) : 0;
        if (booked > 0) {
          throw new Error(
            `Cannot remove class allotment that already has ${booked} registered students.`
          );
        }
        await tx.delete(electiveSeatAllocations).where(eq(electiveSeatAllocations.id, existing.id));
      }
    }

    // 5. Upsert allotments
    for (const allot of allotments) {
      const booked = allot.sectionId ? (bookedPerSection[allot.sectionId] || 0) : 0;
      const availableSeats = Math.max(0, allot.maxSeats - booked);
      const isFull = availableSeats <= 0;

      const existing = existingAllocations.find((e) =>
        allot.sectionId
          ? e.sectionId === allot.sectionId
          : e.departmentId === allot.departmentId && !e.sectionId
      );

      if (existing) {
        await tx
          .update(electiveSeatAllocations)
          .set({
            departmentId: allot.departmentId,
            sectionId: allot.sectionId || null,
            maxSeats: allot.maxSeats,
            availableSeats,
            isFull,
            updatedAt: new Date(),
          })
          .where(eq(electiveSeatAllocations.id, existing.id));
      } else {
        await tx.insert(electiveSeatAllocations).values({
          electiveId,
          departmentId: allot.departmentId,
          sectionId: allot.sectionId || null,
          maxSeats: allot.maxSeats,
          availableSeats,
          isFull,
        });
      }
    }

    // 6. Audit log
    await tx.insert(auditLogs).values({
      action: "UPDATE_ELECTIVE_SEAT_ALLOTMENTS",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: {
        electiveId,
        electiveName: elective.name,
        eventId: event.id,
        academicSessionId: ws.session.id,
        totalAllotted,
        allotmentsCount: allotments.length,
      },
    });
  });

  return { success: true };
}

export async function createCoordinatorElective(
  groupId: string,
  data: { name: string; courseCode?: string; credits: number; maxSeats: number; description?: string }
) {
  const ws = await coordinatorWorkspace();
  await assertGroupInWorkspace(ws, groupId);
  if (!Number.isInteger(data.maxSeats) || data.maxSeats < 1) throw new Error("Capacity must be at least 1 seat.");

  const [newElective] = await db
    .insert(electives)
    .values({
      groupId,
      name: data.name.trim(),
      courseCode: data.courseCode?.trim() || null,
      credits: data.credits || 3,
      maxSeats: data.maxSeats,
      availableSeats: data.maxSeats,
      description: data.description?.trim() || null,
      isFull: false,
      isActive: true,
    })
    .returning();

  return newElective;
}

export async function updateCoordinatorElective(
  id: string,
  data: { name: string; courseCode?: string; credits: number; maxSeats: number; description?: string; isActive?: boolean }
) {
  const ws = await coordinatorWorkspace();
  const { elective } = await assertElectiveInWorkspace(ws, id);

  // From the confirmed choices, not the counter (see confirmedCount).
  const bookedSeats = await confirmedCount(db, id);
  if (data.maxSeats < bookedSeats) {
    throw new Error(`Cannot decrease max seats below ${bookedSeats} (already registered students).`);
  }

  const newAvailableSeats = data.maxSeats - bookedSeats;

  await db
    .update(electives)
    .set({
      name: data.name.trim(),
      courseCode: data.courseCode?.trim() || null,
      credits: data.credits,
      maxSeats: data.maxSeats,
      availableSeats: newAvailableSeats,
      isFull: newAvailableSeats <= 0,
      description: data.description?.trim() || null,
      isActive: data.isActive !== undefined ? data.isActive : elective.isActive,
      updatedAt: new Date(),
    })
    .where(eq(electives.id, id));

  return { success: true };
}

export async function deleteCoordinatorElective(id: string) {
  const ws = await coordinatorWorkspace();
  await assertElectiveInWorkspace(ws, id);

  const regs = await db.select().from(studentRegistrations).where(eq(studentRegistrations.electiveId, id));
  if (regs.length > 0) {
    throw new Error(`Cannot delete subject with ${regs.length} registered students. Please reset selections first.`);
  }

  await db.delete(electives).where(eq(electives.id, id));
  return { success: true };
}

export async function createCoordinatorElectiveGroup(
  eventId: string,
  data: { name: string; minChoices?: number; maxChoices?: number }
) {
  const ws = await coordinatorWorkspace();
  await assertEventInWorkspace(ws, eventId);

  const [group] = await db
    .insert(electiveGroups)
    .values({
      eventId,
      name: data.name.trim(),
      minChoices: data.minChoices || 1,
      maxChoices: data.maxChoices || 1,
    })
    .returning();

  return group;
}

export async function updateCoordinatorElectiveGroup(
  id: string,
  data: { name: string; minChoices?: number; maxChoices?: number }
) {
  const ws = await coordinatorWorkspace();
  await assertGroupInWorkspace(ws, id);

  await db
    .update(electiveGroups)
    .set({
      name: data.name.trim(),
      minChoices: data.minChoices !== undefined ? data.minChoices : undefined,
      maxChoices: data.maxChoices !== undefined ? data.maxChoices : undefined,
    })
    .where(eq(electiveGroups.id, id));

  return { success: true };
}

export async function deleteCoordinatorElectiveGroup(id: string) {
  const ws = await coordinatorWorkspace();
  await assertGroupInWorkspace(ws, id);

  const existingElectives = await db.select().from(electives).where(eq(electives.groupId, id));
  if (existingElectives.length > 0) {
    throw new Error(`Cannot delete basket containing ${existingElectives.length} subjects. Delete subjects first.`);
  }

  await db.delete(electiveGroups).where(eq(electiveGroups.id, id));
  return { success: true };
}

// ── Students ──────────────────────────────────────────────────────────────

/** Students of the classes this user manages in the selected academic session. */
export async function getCoordinatorStudents() {
  const ws = await coordinatorWorkspace();
  const sectionIds = ws.classes.map((c) => c.sectionId);
  if (sectionIds.length === 0) return [];

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      registerNumber: users.registerNumber,
      isActive: users.isActive,
      isEligible: users.isEligible,
      createdAt: users.createdAt,
      sectionId: users.sectionId,
      sectionLabel: sections.label,
    })
    .from(users)
    .innerJoin(sections, eq(users.sectionId, sections.id))
    .where(and(eq(users.role, "STUDENT"), inArray(users.sectionId, sectionIds)))
    .orderBy(asc(users.name));

  const labelOf = new Map(ws.classes.map((c) => [c.sectionId, c.label]));
  return students.map((s) => ({ ...s, classLabel: (s.sectionId && labelOf.get(s.sectionId)) || s.sectionLabel }));
}

/**
 * Deletes students of classes the user manages in the selected session. Seats
 * are returned only for choices that actually hold one (CONFIRMED), capped at
 * each subject's capacity.
 */
export async function deleteMultipleStudents(ids: string[]) {
  const ws = await coordinatorWorkspace();
  if (!ids || ids.length === 0) return;
  await assertStudentsInWorkspace(ws, ids);

  await db.transaction(async (tx) => {
    const held = await tx
      .select({ electiveId: studentRegistrations.electiveId, sectionId: users.sectionId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(and(inArray(studentRegistrations.studentId, ids), eq(studentRegistrations.status, "CONFIRMED")));

    const electiveIds = Array.from(new Set(held.map((h) => h.electiveId))).sort();
    if (electiveIds.length) {
      await tx.select({ id: electives.id }).from(electives).where(inArray(electives.id, electiveIds)).orderBy(asc(electives.id)).for("update");
    }
    for (const h of held) {
      await tx
        .update(electives)
        .set({ availableSeats: sql`LEAST(${electives.availableSeats} + 1, ${electives.maxSeats})`, isFull: false, updatedAt: new Date() })
        .where(eq(electives.id, h.electiveId));
      if (h.sectionId) {
        await tx
          .update(electiveSeatAllocations)
          .set({
            availableSeats: sql`LEAST(${electiveSeatAllocations.availableSeats} + 1, ${electiveSeatAllocations.maxSeats})`,
            isFull: false,
            updatedAt: new Date(),
          })
          .where(and(eq(electiveSeatAllocations.electiveId, h.electiveId), eq(electiveSeatAllocations.sectionId, h.sectionId)));
      }
    }

    await tx.delete(studentRegistrations).where(inArray(studentRegistrations.studentId, ids));
    await tx.delete(registrations).where(inArray(registrations.studentId, ids));
    await tx.delete(eventStudents).where(inArray(eventStudents.studentId, ids));
    await tx.delete(users).where(inArray(users.id, ids));

    await tx.insert(auditLogs).values({
      action: "DELETE_STUDENTS",
      userId: ws.user.userId,
      userEmail: ws.user.email,
      userRole: ws.user.role,
      metadata: { studentIds: ids, count: ids.length, seatsReturned: held.length, academicSessionId: ws.session.id },
    });
  });
}

export async function updateMultipleStudentsStatus(ids: string[], updates: { isActive?: boolean; isEligible?: boolean }) {
  const ws = await coordinatorWorkspace();
  if (!ids || ids.length === 0) return;
  await assertStudentsInWorkspace(ws, ids);

  const updatePayload: Partial<{ isActive: boolean; isEligible: boolean }> = {};
  if (updates.isActive !== undefined) updatePayload.isActive = updates.isActive;
  if (updates.isEligible !== undefined) updatePayload.isEligible = updates.isEligible;

  if (Object.keys(updatePayload).length > 0) {
    await db.update(users).set(updatePayload).where(inArray(users.id, ids));
    await db.insert(auditLogs).values({
      action: "UPDATE_STUDENTS_STATUS",
      userId: ws.user.userId,
      userEmail: ws.user.email,
      userRole: ws.user.role,
      metadata: { studentIds: ids, updates: updatePayload, academicSessionId: ws.session.id },
    });
  }
}

// ── Reports ───────────────────────────────────────────────────────────────

export type StudentSubjectItem = {
  courseCode: string | null;
  name: string;
  groupName: string;
  credits: number;
};

export type StudentAllotment = {
  studentId: string;
  registerNumber: string | null;
  name: string;
  email: string;
  sectionId: string | null;
  sectionLabel: string;
  /** Full class identity, e.g. "MCA F · 2025–2027" */
  classLabel: string;
  academicSession: string;
  programmeName: string;
  batchYear: string;
  eventId: string;
  eventName: string;
  eventStatus: string;
  status: string;
  receiptNumber: string | null;
  submittedAt: string | null;
  subjects: StudentSubjectItem[];
};

export type SectionReport = {
  sectionId: string;
  sectionLabel: string;
  /** Full class identity, e.g. "MCA F · 2025–2027" */
  classLabel: string;
  totalStudents: number;
  registeredCount: number;
};

export type CoordinatorReportsPayload = {
  academicSession: string;
  sections: SectionReport[];
  allotments: StudentAllotment[];
  events: { id: string; name: string; status: string; academicYear: string | null; classLabels: string[] }[];
};

/**
 * Reports for the selected academic session only: its events, the classes the
 * user manages in it, and confirmed (seat-holding) choices.
 */
export async function getCoordinatorReports(): Promise<CoordinatorReportsPayload> {
  const ws = await coordinatorWorkspace();
  const academicSession = ws.session.label;
  const eventIds = await workspaceEventIds(ws);
  const classBySection = new Map(ws.classes.map((c) => [c.sectionId, c]));

  const events = eventIds.length
    ? await db
        .select({
          id: registrationEvents.id,
          name: registrationEvents.name,
          status: registrationEvents.status,
          academicYear: registrationEvents.academicYear,
        })
        .from(registrationEvents)
        .where(inArray(registrationEvents.id, eventIds))
        .orderBy(desc(registrationEvents.createdAt))
    : [];
  const targets = eventIds.length
    ? await db.select({ eventId: eventSections.eventId, sectionId: eventSections.sectionId }).from(eventSections).where(inArray(eventSections.eventId, eventIds))
    : [];

  const sectionIds = ws.classes.map((c) => c.sectionId);
  const totals = sectionIds.length
    ? await db
        .select({ sectionId: users.sectionId, total: count() })
        .from(users)
        .where(and(eq(users.role, "STUDENT"), inArray(users.sectionId, sectionIds)))
        .groupBy(users.sectionId)
    : [];
  const registeredRows = sectionIds.length && eventIds.length
    ? await db
        .selectDistinct({ studentId: registrations.studentId, sectionId: users.sectionId })
        .from(registrations)
        .innerJoin(users, eq(registrations.studentId, users.id))
        .where(and(inArray(registrations.eventId, eventIds), eq(registrations.status, "CONFIRMED"), inArray(users.sectionId, sectionIds)))
    : [];

  const sectionReports: SectionReport[] = ws.classes.map((c) => ({
    sectionId: c.sectionId,
    sectionLabel: c.sectionLabel,
    classLabel: c.label,
    totalStudents: totals.find((t) => t.sectionId === c.sectionId)?.total ?? 0,
    registeredCount: new Set(registeredRows.filter((r) => r.sectionId === c.sectionId).map((r) => r.studentId)).size,
  }));

  const studentRegs = eventIds.length && sectionIds.length
    ? await db
        .select({
          studentId: users.id,
          registerNumber: users.registerNumber,
          name: users.name,
          email: users.email,
          sectionId: users.sectionId,
          sectionLabel: sections.label,
          programmeName: programmes.name,
          batchYear: academicBatches.year,
          eventId: registrationEvents.id,
          eventName: registrationEvents.name,
          eventStatus: registrationEvents.status,
          electiveId: electives.id,
          electiveName: electives.name,
          courseCode: electives.courseCode,
          groupName: electiveGroups.name,
          credits: electives.credits,
          submittedAt: studentRegistrations.submittedAt,
        })
        .from(studentRegistrations)
        .innerJoin(users, eq(studentRegistrations.studentId, users.id))
        .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
        .innerJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
        .innerJoin(registrationEvents, eq(studentRegistrations.eventId, registrationEvents.id))
        .leftJoin(sections, eq(users.sectionId, sections.id))
        .leftJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
        .leftJoin(programmes, eq(academicBatches.programmeId, programmes.id))
        .where(
          and(
            inArray(studentRegistrations.eventId, eventIds),
            eq(studentRegistrations.status, "CONFIRMED"),
            inArray(users.sectionId, sectionIds)
          )
        )
        .orderBy(asc(users.registerNumber), asc(electiveGroups.name))
    : [];

  const confirmedRegs = eventIds.length
    ? await db
        .select({
          studentId: registrations.studentId,
          eventId: registrations.eventId,
          status: registrations.status,
          receiptNumber: registrations.receiptNumber,
          submittedAt: registrations.submittedAt,
        })
        .from(registrations)
        .where(inArray(registrations.eventId, eventIds))
    : [];

  const confirmedMap = new Map(confirmedRegs.map((r) => [`${r.studentId}:${r.eventId}`, r]));
  const studentMap = new Map<string, StudentAllotment>();

  for (const r of studentRegs) {
    const key = `${r.studentId}:${r.eventId}`;
    if (!studentMap.has(key)) {
      const regMeta = confirmedMap.get(key);
      studentMap.set(key, {
        studentId: r.studentId,
        registerNumber: r.registerNumber,
        name: r.name,
        email: r.email,
        sectionId: r.sectionId,
        sectionLabel: r.sectionLabel || "Unassigned",
        classLabel: (r.sectionId && classBySection.get(r.sectionId)?.label) || r.sectionLabel || "Unassigned",
        academicSession,
        programmeName: r.programmeName || "",
        batchYear: r.batchYear || "",
        eventId: r.eventId,
        eventName: r.eventName,
        eventStatus: r.eventStatus,
        status: regMeta?.status || "CONFIRMED",
        receiptNumber: regMeta?.receiptNumber || null,
        submittedAt: (regMeta?.submittedAt || r.submittedAt)?.toISOString() || null,
        subjects: [],
      });
    }

    studentMap.get(key)!.subjects.push({
      courseCode: r.courseCode,
      name: r.electiveName,
      groupName: r.groupName,
      credits: r.credits,
    });
  }

  // Sort ascending by register number
  const allotments = Array.from(studentMap.values()).sort((a, b) => {
    const regA = (a.registerNumber || "").trim();
    const regB = (b.registerNumber || "").trim();
    if (regA && regB) {
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: "base" });
    }
    if (regA) return -1;
    if (regB) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    academicSession,
    sections: sectionReports,
    allotments,
    events: events.map((e) => ({
      ...e,
      classLabels: targets
        .filter((t) => t.eventId === e.id)
        .map((t) => classBySection.get(t.sectionId)?.label)
        .filter((l): l is string => Boolean(l)),
    })),
  };
}

// ── Coordinator Templates ─────────────────────────────────────────────────

export async function getCoordinatorTemplates() {
  const session = await assertCoordinator();

  const { eventTemplates, programmes: prog } = await import("@/lib/db/schema");

  const templates = await db
    .select({
      id: eventTemplates.id,
      name: eventTemplates.name,
      description: eventTemplates.description,
      createdAt: eventTemplates.createdAt,
      programmeName: prog.name,
    })
    .from(eventTemplates)
    .leftJoin(prog, eq(eventTemplates.programmeId, prog.id))
    .where(
      session.programmeId ? eq(eventTemplates.programmeId, session.programmeId) : undefined
    )
    .orderBy(desc(eventTemplates.createdAt));

  return templates;
}

export async function resetRegistrationEvent(eventId: string) {
  const ws = await coordinatorWorkspace();
  const session = ws.user;
  const event = await assertEventInWorkspace(ws, eventId);

  await db.transaction(async (tx) => {
    // 1. Fetch all registrations for this event to identify the electives affected
    const existingRegistrations = await tx.select().from(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));

    // 2. Every choice is removed, so every subject of the event is back to full
    // capacity. Recomputing (instead of adding refunds) cannot overshoot, even
    // if cancelled choices are among the rows.
    await tx.execute(sql`
      UPDATE electives e
      SET available_seats = e.max_seats,
          is_full = false,
          updated_at = NOW()
      FROM elective_groups eg
      WHERE e.group_id = eg.id
        AND eg.event_id = ${eventId}
    `);

    // 2.5 Refund all section allocations for this event
    await tx.execute(sql`
      UPDATE elective_seat_allocations esa
      SET available_seats = esa.max_seats,
          is_full = false,
          updated_at = NOW()
      FROM electives e, elective_groups eg
      WHERE esa.elective_id = e.id
        AND e.group_id = eg.id
        AND eg.event_id = ${eventId}
    `);

    // 3. Delete all registrations (individual selections) and preserve status
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));

    await tx
      .update(registrations)
      .set({
        status: "RESET_BY_COORDINATOR",
        receiptNumber: null,
        receiptSnapshot: null,
        updatedAt: new Date(),
      })
      .where(eq(registrations.eventId, eventId));

    // 4. Create an audit log
    await tx.insert(auditLogs).values({
      action: "RESET_REGISTRATION_EVENT",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: {
        eventId,
        eventName: event.name,
        academicSessionId: ws.session.id,
        clearedRegistrationsCount: existingRegistrations.length,
      },
    });
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/events");
    revalidatePath("/faculty/window");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/faculty/monitor");
    revalidatePath("/faculty/database");
    revalidatePath("/", "layout");
  } catch {
    // Ignore in non-HTTP / unit test environment
  }

  return { success: true };
}

// ── Registration Event Management ───────────────────────────────────────────

export async function deleteRegistrationEvent(eventId: string) {
  const ws = await coordinatorWorkspace();
  const session = ws.user;
  const event = await assertEventInWorkspace(ws, eventId);

  // Deleting an event deletes its receipts. Only an administrator may do that;
  // coordinators archive events that have registrations.
  const [{ n: registrationCount }] = await db.select({ n: count() }).from(registrations).where(eq(registrations.eventId, eventId));
  if (registrationCount > 0 && ws.scope.role !== "SYSTEM_ADMIN") {
    throw new Error(`This event has ${registrationCount} registration record(s). Archive it instead, or ask an administrator.`);
  }

  await db.transaction(async (tx) => {
    // 1. Delete student registrations (selections)
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));

    // 2. Delete registrations (overall student registration state)
    await tx.delete(registrations).where(eq(registrations.eventId, eventId));

    // 3. Delete event replay logs
    await tx.delete(replayEvents).where(eq(replayEvents.registrationEventId, eventId));

    // 4. Delete event students and sections
    await tx.delete(eventStudents).where(eq(eventStudents.eventId, eventId));
    await tx.delete(eventSections).where(eq(eventSections.eventId, eventId));

    // 5. Delete elective groups, electives, and seat allocations cleanly
    const groups = await tx
      .select({ id: electiveGroups.id })
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventId));
    const groupIds = groups.map((g) => g.id);
    if (groupIds.length > 0) {
      const allElectives = await tx
        .select({ id: electives.id })
        .from(electives)
        .where(inArray(electives.groupId, groupIds));
      const electiveIds = allElectives.map((e) => e.id);
      if (electiveIds.length > 0) {
        await tx.delete(electiveSeatAllocations).where(inArray(electiveSeatAllocations.electiveId, electiveIds));
        await tx.delete(electives).where(inArray(electives.id, electiveIds));
      }
      await tx.delete(electiveGroups).where(eq(electiveGroups.eventId, eventId));
    }

    // 6. Delete the event itself
    await tx.delete(registrationEvents).where(eq(registrationEvents.id, eventId));

    // 7. Audit log
    await tx.insert(auditLogs).values({
      action: "DELETE_REGISTRATION_EVENT",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: {
        eventId,
        eventName: event.name,
        academicSessionId: event.academicSessionId,
        academicBatchId: event.academicBatchId,
        sectionIds: event.targetSectionIds,
        deletedRegistrations: registrationCount,
      },
    });
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/events");
    revalidatePath("/faculty/window");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/faculty/monitor");
    revalidatePath("/faculty/database");
    revalidatePath("/", "layout");
  } catch {
    // Ignore in non-HTTP / unit test environment
  }

  return { success: true };
}

export async function updateRegistrationEventStatus(eventId: string, status: string) {
  const ws = await coordinatorWorkspace();
  const session = ws.user;

  const validStatuses = ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"];
  if (!validStatuses.includes(status)) {
    throw new Error("Invalid status.");
  }

  const event = await assertEventInWorkspace(ws, eventId);

  await db.transaction(async (tx) => {
    await tx
      .update(registrationEvents)
      .set({ status, updatedAt: new Date() })
      .where(eq(registrationEvents.id, eventId));

    await tx.insert(auditLogs).values({
      action: "UPDATE_EVENT_STATUS",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      oldValue: { status: event.status },
      newValue: { status },
      metadata: { eventId, eventName: event.name },
    });
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/events");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/", "layout");
  } catch {
    // Ignore outside a request (tests, scripts)
  }

  return { success: true };
}

export async function updateRegistrationEvent(
  eventId: string,
  data: {
    name: string;
    academicYear?: string | null;
    semester?: number | null;
    openDate?: string | null;
    closeDate?: string | null;
    status?: string;
    description?: string | null;
  }
) {
  const ws = await coordinatorWorkspace();
  const session = ws.user;

  const name = data.name?.trim();
  if (!name) throw new Error("Event name is required.");

  const event = await assertEventInWorkspace(ws, eventId);
  if (data.semester != null && !(Number.isInteger(data.semester) && data.semester >= 1 && data.semester <= 12)) {
    throw new Error("Semester must be between 1 and 12.");
  }

  const openDate = toDate(data.openDate);
  const closeDate = toDate(data.closeDate);

  if (openDate && closeDate && closeDate.getTime() < openDate.getTime()) {
    throw new Error("Close date cannot be before open date.");
  }

  const now = new Date();
  let status = data.status || event.status;
  if (!data.status && openDate && now.getTime() < openDate.getTime() && status === "OPEN") {
    status = "PUBLISHED";
  }

  await db.transaction(async (tx) => {
    await tx
      .update(registrationEvents)
      .set({
        name,
        // The session is fixed by the workspace; the legacy label follows it.
        academicYear: ws.session.label,
        semester: data.semester === undefined ? event.semester : data.semester,
        description: data.description?.trim() || null,
        openDate,
        closeDate,
        status,
        updatedAt: new Date(),
      })
      .where(eq(registrationEvents.id, eventId));

    await tx.insert(auditLogs).values({
      action: "UPDATE_REGISTRATION_EVENT",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      oldValue: { name: event.name, status: event.status, openDate: event.openDate, closeDate: event.closeDate, semester: event.semester },
      newValue: { name, status: data.status || event.status, openDate, closeDate, semester: data.semester ?? event.semester },
      metadata: { eventId, academicSessionId: ws.session.id, sectionIds: event.targetSectionIds },
    });
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/events");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/", "layout");
  } catch {
    // Ignore outside a request (tests, scripts)
  }

  return { success: true };
}

/**
 * Creates a registration event for exactly one class (cohort section) in the
 * selected academic session. The class must be one the user manages in that
 * session; the cohort, programme and session are derived on the server.
 */
export async function createRegistrationEvent(data: {
  name: string;
  targetSectionId: string;
  semester?: number | null;
  openDate?: string | null;
  closeDate?: string | null;
  status?: string;
  description?: string;
}) {
  const ws = await coordinatorWorkspace();
  const session = ws.user;

  const name = data.name?.trim();
  if (!name) throw new Error("Event name is required.");
  const target = ws.classes.find((c) => c.sectionId === data.targetSectionId);
  if (!target) throw new Error(`Choose a class you manage in Academic Session ${ws.session.label}.`);
  if (data.semester != null && !(Number.isInteger(data.semester) && data.semester >= 1 && data.semester <= 12)) {
    throw new Error("Semester must be between 1 and 12.");
  }
  const status = data.status && ["DRAFT", "PUBLISHED"].includes(data.status) ? data.status : "DRAFT";

  const openDate = data.openDate ? new Date(data.openDate) : null;
  const closeDate = data.closeDate ? new Date(data.closeDate) : null;

  if (openDate && closeDate && closeDate < openDate) {
    throw new Error("Close date cannot be before open date.");
  }

  const newEvent = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(registrationEvents)
      .values({
        name,
        academicBatchId: target.batchId,
        academicSessionId: ws.session.id,
        academicYear: sessionLabel(ws.session),
        semester: data.semester ?? target.semester ?? null,
        description: data.description?.trim() || null,
        openDate,
        closeDate,
        status,
        createdById: session.userId,
      })
      .returning();

    await tx.insert(eventSections).values({ eventId: created.id, sectionId: target.sectionId, academicBatchId: target.batchId });

    await tx.insert(auditLogs).values({
      action: "CREATE_REGISTRATION_EVENT",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      newValue: { id: created.id, name: created.name, status: created.status },
      metadata: { academicSessionId: ws.session.id, sectionId: target.sectionId, academicBatchId: target.batchId, classLabel: target.label },
    });
    return created;
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/events");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/", "layout");
  } catch {
    // Ignore outside a request (tests, scripts)
  }

  return { success: true, event: newEvent };
}
