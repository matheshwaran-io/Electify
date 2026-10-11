"use server";

import { db } from "@/lib/db";
import {
  users, registrationEvents, sections, departments, programmes,
  electiveGroups, electives, electiveSeatAllocations, studentRegistrations,
  academicBatches, auditLogs, registrations
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, count, asc, desc, inArray, sql } from "drizzle-orm";

async function assertCoordinator() {
  const session = await getSession();
  if (!session || (session.role !== "COURSE_COORDINATOR" && session.role !== "SYSTEM_ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Electives & Seat Allotments ──────────────────────────────────────────

export async function getCoordinatorElectives() {
  const session = await assertCoordinator();

  const events = await db
    .select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      status: registrationEvents.status,
      academicBatchId: registrationEvents.academicBatchId,
    })
    .from(registrationEvents)
    .leftJoin(academicBatches, eq(registrationEvents.academicBatchId, academicBatches.id))
    .where(
      session.programmeId
        ? eq(academicBatches.programmeId, session.programmeId)
        : undefined
    )
    .orderBy(desc(registrationEvents.createdAt));

  if (events.length === 0) return [];

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

export async function getAcademicHierarchyForAllocations() {
  await assertCoordinator();

  const allDepts = await db.select().from(departments).where(eq(departments.isActive, true)).orderBy(asc(departments.name));
  const allProgs = await db.select().from(programmes).where(eq(programmes.isActive, true)).orderBy(asc(programmes.name));
  const allBatches = await db.select().from(academicBatches).orderBy(asc(academicBatches.year));
  const allSections = await db.select().from(sections).orderBy(asc(sections.label));

  return allDepts.map((dept) => {
    const deptProgs = allProgs.filter((p) => p.departmentId === dept.id);
    const deptSections: {
      id: string;
      label: string;
      programmeName: string;
      batchYear: string;
      departmentId: string;
      displayName: string;
    }[] = [];

    for (const prog of deptProgs) {
      const progBatches = allBatches.filter((b) => b.programmeId === prog.id);
      for (const batch of progBatches) {
        const batchSecs = allSections.filter((s) => s.academicBatchId === batch.id);
        for (const sec of batchSecs) {
          deptSections.push({
            id: sec.id,
            label: sec.label,
            programmeName: prog.name,
            batchYear: batch.year,
            departmentId: dept.id,
            displayName: `${prog.name} (${batch.year}) - Sec ${sec.label}`,
          });
        }
      }
    }

    return {
      id: dept.id,
      name: dept.name,
      code: dept.code,
      sections: deptSections,
    };
  });
}

export async function setElectiveSeatAllocations(
  electiveId: string,
  allotments: { departmentId: string; sectionId?: string | null; maxSeats: number }[]
) {
  const session = await assertCoordinator();

  const [elective] = await db.select().from(electives).where(eq(electives.id, electiveId));
  if (!elective) throw new Error("Subject not found.");

  const totalAllotted = allotments.reduce((sum, a) => sum + a.maxSeats, 0);
  if (totalAllotted > elective.maxSeats) {
    throw new Error(
      `Total allotted seats (${totalAllotted}) cannot exceed subject capacity (${elective.maxSeats}). Please increase total subject capacity first.`
    );
  }

  await db.transaction(async (tx) => {
    // 1. Existing allocations for this elective
    const existingAllocations = await tx
      .select()
      .from(electiveSeatAllocations)
      .where(eq(electiveSeatAllocations.electiveId, electiveId));

    // 2. Count current student registrations per section
    const currentStudentRegs = await tx
      .select({ sectionId: users.sectionId, departmentId: users.departmentId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(eq(studentRegistrations.electiveId, electiveId));

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
  await assertCoordinator();

  const [group] = await db.select().from(electiveGroups).where(eq(electiveGroups.id, groupId));
  if (!group) throw new Error("Elective basket not found.");

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
  await assertCoordinator();

  const [elective] = await db.select().from(electives).where(eq(electives.id, id));
  if (!elective) throw new Error("Subject not found.");

  const bookedSeats = elective.maxSeats - elective.availableSeats;
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
  await assertCoordinator();

  const [elective] = await db.select().from(electives).where(eq(electives.id, id));
  if (!elective) throw new Error("Subject not found.");

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
  await assertCoordinator();

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
  await assertCoordinator();

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
  await assertCoordinator();

  const existingElectives = await db.select().from(electives).where(eq(electives.groupId, id));
  if (existingElectives.length > 0) {
    throw new Error(`Cannot delete basket containing ${existingElectives.length} subjects. Delete subjects first.`);
  }

  await db.delete(electiveGroups).where(eq(electiveGroups.id, id));
  return { success: true };
}

// ── Students ──────────────────────────────────────────────────────────────

export async function getCoordinatorStudents() {
  const session = await assertCoordinator();

  const students = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      registerNumber: users.registerNumber,
      isActive: users.isActive,
      isEligible: users.isEligible,
      createdAt: users.createdAt,
      sectionLabel: sections.label,
    })
    .from(users)
    .leftJoin(sections, eq(users.sectionId, sections.id))
    .leftJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .where(
      and(
        eq(users.role, "STUDENT"),
        session.programmeId ? eq(academicBatches.programmeId, session.programmeId) : undefined
      )
    )
    .orderBy(asc(users.name));

  return students;
}

export async function deleteMultipleStudents(ids: string[]) {
  await assertCoordinator();
  if (!ids || ids.length === 0) return;

  await db.transaction(async (tx) => {
    // We should refund seats before deleting registrations
    const existing = await tx.select().from(studentRegistrations).where(inArray(studentRegistrations.studentId, ids));
    
    for (const reg of existing) {
      const [elective] = await tx.select({ availableSeats: electives.availableSeats }).from(electives).where(eq(electives.id, reg.electiveId));
      if (elective) {
        await tx.update(electives).set({ 
          availableSeats: elective.availableSeats + 1,
          isFull: false 
        }).where(eq(electives.id, reg.electiveId));
      }

      const [student] = await tx.select({ sectionId: users.sectionId }).from(users).where(eq(users.id, reg.studentId));
      if (student?.sectionId) {
        await tx
          .update(electiveSeatAllocations)
          .set({
            availableSeats: sql`${electiveSeatAllocations.availableSeats} + 1`,
            isFull: false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(electiveSeatAllocations.electiveId, reg.electiveId),
              eq(electiveSeatAllocations.sectionId, student.sectionId)
            )
          );
      }
    }

    await tx.delete(studentRegistrations).where(inArray(studentRegistrations.studentId, ids));
    await tx.delete(registrations).where(inArray(registrations.studentId, ids));
    await tx.delete(users).where(inArray(users.id, ids));
  });
}

export async function updateMultipleStudentsStatus(ids: string[], updates: { isActive?: boolean; isEligible?: boolean }) {
  await assertCoordinator();
  if (!ids || ids.length === 0) return;

  const updatePayload: Partial<{ isActive: boolean; isEligible: boolean }> = {};
  if (updates.isActive !== undefined) updatePayload.isActive = updates.isActive;
  if (updates.isEligible !== undefined) updatePayload.isEligible = updates.isEligible;

  if (Object.keys(updatePayload).length > 0) {
    await db.update(users)
      .set(updatePayload)
      .where(inArray(users.id, ids));
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
  totalStudents: number;
  registeredCount: number;
};

export type CoordinatorReportsPayload = {
  sections: SectionReport[];
  allotments: StudentAllotment[];
  events: { id: string; name: string; status: string; academicYear: string | null }[];
};

export async function getCoordinatorReports(): Promise<CoordinatorReportsPayload> {
  const session = await assertCoordinator();

  const events = await db
    .select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      status: registrationEvents.status,
      academicYear: registrationEvents.academicYear,
    })
    .from(registrationEvents)
    .leftJoin(academicBatches, eq(registrationEvents.academicBatchId, academicBatches.id))
    .where(
      session.programmeId ? eq(academicBatches.programmeId, session.programmeId) : undefined
    )
    .orderBy(desc(registrationEvents.createdAt));

  const allSections = await db
    .select({ id: sections.id, label: sections.label })
    .from(sections)
    .leftJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .where(
      session.programmeId ? eq(academicBatches.programmeId, session.programmeId) : undefined
    )
    .orderBy(asc(sections.label));

  const sectionReports: SectionReport[] = [];
  for (const sec of allSections) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, sec.id)));

    // Count distinct students who registered for at least one elective
    const registered = await db
      .selectDistinct({ studentId: studentRegistrations.studentId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(eq(users.sectionId, sec.id));

    sectionReports.push({
      sectionId: sec.id,
      sectionLabel: sec.label,
      totalStudents: total,
      registeredCount: registered.length,
    });
  }

  // Fetch student registrations with subjects
  const studentRegs = await db
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
      session.programmeId ? eq(academicBatches.programmeId, session.programmeId) : undefined
    )
    .orderBy(asc(users.registerNumber), asc(electiveGroups.name));

  const confirmedRegs = await db
    .select({
      studentId: registrations.studentId,
      eventId: registrations.eventId,
      status: registrations.status,
      receiptNumber: registrations.receiptNumber,
      submittedAt: registrations.submittedAt,
    })
    .from(registrations);

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
    sections: sectionReports,
    allotments,
    events,
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
  // Allow both System Admin and Course Coordinator to reset events
  const session = await getSession();
  if (!session || (session.role !== "COURSE_COORDINATOR" && session.role !== "SYSTEM_ADMIN")) {
    throw new Error("Unauthorized");
  }

  // Make sure event exists
  const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId));
  if (!event) throw new Error("Event not found.");

  await db.transaction(async (tx) => {
    // 1. Fetch all registrations for this event to identify the electives affected
    const existingRegistrations = await tx.select().from(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));

    // 2. Refund all seats for these electives
    // Group by elective to minimize updates
    const counts: Record<string, number> = {};
    for (const reg of existingRegistrations) {
      counts[reg.electiveId] = (counts[reg.electiveId] || 0) + 1;
    }

    for (const [electiveId, countToRefund] of Object.entries(counts)) {
      const [elective] = await tx.select({ availableSeats: electives.availableSeats }).from(electives).where(eq(electives.id, electiveId));
      if (elective) {
        await tx.update(electives).set({ 
          availableSeats: elective.availableSeats + countToRefund,
          isFull: false 
        }).where(eq(electives.id, electiveId));
      }
    }

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
        clearedRegistrationsCount: existingRegistrations.length,
      },
    });
  });
}

