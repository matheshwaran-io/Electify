"use server";

import { db } from "@/lib/db";
import {
  users, electives, electiveGroups, registrationEvents,
  studentRegistrations, eventSections, sections, programmes, academicBatches, auditLogs
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, asc, count, desc, inArray } from "drizzle-orm";

async function assertTutor() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") throw new Error("Unauthorized");

  // Fetch missing hierarchy details if the session token is incomplete
  if (session.sectionId && (!session.academicBatchId || !session.programmeId || !session.departmentId)) {
    const [sectionData] = await db
      .select({ 
        academicBatchId: sections.academicBatchId,
        programmeId: academicBatches.programmeId, 
        departmentId: programmes.departmentId 
      })
      .from(sections)
      .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
      .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
      .where(eq(sections.id, session.sectionId));

    if (sectionData) {
      session.academicBatchId = session.academicBatchId || sectionData.academicBatchId;
      session.programmeId = session.programmeId || sectionData.programmeId;
      session.departmentId = session.departmentId || sectionData.departmentId;
    }
  }

  return session;
}

// ── Section Students ─────────────────────────────────────────────────────

export async function getSectionStudents() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      registerNumber: users.registerNumber,
      isActive: users.isActive,
      isEligible: users.isEligible,
    })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)))
    .orderBy(asc(users.name));
}

// ── Section Registrations (Approvals) ────────────────────────────────────

export async function getSectionRegistrations() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  return db
    .select({
      id: studentRegistrations.id,
      studentId: studentRegistrations.studentId,
      studentName: users.name,
      registerNumber: users.registerNumber,
      submittedAt: studentRegistrations.submittedAt,
      electiveName: electives.name,
      courseCode: electives.courseCode,
      groupName: electiveGroups.name,
      eventName: registrationEvents.name,
      eventStatus: registrationEvents.status,
    })
    .from(studentRegistrations)
    .innerJoin(users, eq(studentRegistrations.studentId, users.id))
    .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
    .innerJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
    .innerJoin(registrationEvents, eq(studentRegistrations.eventId, registrationEvents.id))
    .where(eq(users.sectionId, session.sectionId))
    .orderBy(asc(users.name));
}

// ── Tutor Electives ───────────────────────────────────────────────────────

export async function getTutorElectives() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  const sectionEvents = await db
    .select({ eventId: eventSections.eventId })
    .from(eventSections)
    .where(eq(eventSections.sectionId, session.sectionId));

  if (sectionEvents.length === 0) return [];

  const eventIds = sectionEvents.map(se => se.eventId);

  const [events, allGroups, allElectives] = await Promise.all([
    db.select({ 
        id: registrationEvents.id, 
        name: registrationEvents.name, 
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate
      })
      .from(registrationEvents)
      .where(inArray(registrationEvents.id, eventIds)),
    
    db.select()
      .from(electiveGroups)
      .where(inArray(electiveGroups.eventId, eventIds))
      .orderBy(asc(electiveGroups.sortOrder)),
    
    db.select()
      .from(electives)
      .where(inArray(electives.groupId, db.select({ id: electiveGroups.id }).from(electiveGroups).where(inArray(electiveGroups.eventId, eventIds))))
      .orderBy(asc(electives.name))
  ]);

  return events.map(event => {
    const eventGroups = allGroups.filter(g => g.eventId === event.id);
    const groupsWithElectives = eventGroups.map(group => ({
      ...group,
      electives: allElectives.filter(e => e.groupId === group.id)
    }));
    return { event, groups: groupsWithElectives };
  });
}

// ── Tutor Reports ─────────────────────────────────────────────────────────

export async function getTutorReports() {
  const session = await assertTutor();
  if (!session.sectionId) return { students: [], totalStudents: 0, registeredCount: 0 };

  const students = await db
    .select({ 
      id: users.id, 
      name: users.name, 
      registerNumber: users.registerNumber, 
      isEligible: users.isEligible,
      isActive: users.isActive,
      email: users.email
    })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)))
    .orderBy(asc(users.name));

  const registrations = await db
    .select({ studentId: studentRegistrations.studentId, electiveName: electives.name, groupName: electiveGroups.name, eventName: registrationEvents.name })
    .from(studentRegistrations)
    .innerJoin(users, eq(studentRegistrations.studentId, users.id))
    .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
    .innerJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
    .innerJoin(registrationEvents, eq(studentRegistrations.eventId, registrationEvents.id))
    .where(eq(users.sectionId, session.sectionId));

  const enriched = students.map((s) => ({
    ...s,
    registrations: registrations.filter((r) => r.studentId === s.id),
  }));

  return {
    students: enriched,
    totalStudents: students.length,
    registeredCount: enriched.filter((s) => s.registrations.length > 0).length,
  };
}

// ── Portal Window ─────────────────────────────────────────────────────────

export async function getPortalWindow() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  const sectionEvents = await db
    .select({ eventId: eventSections.eventId })
    .from(eventSections)
    .where(eq(eventSections.sectionId, session.sectionId));

  if (sectionEvents.length === 0) return [];

  const eventIds = sectionEvents.map(se => se.eventId);

  const [events, allGroups] = await Promise.all([
    db.select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      academicYear: registrationEvents.academicYear,
      status: registrationEvents.status,
      openDate: registrationEvents.openDate,
      closeDate: registrationEvents.closeDate,
      description: registrationEvents.description,
    })
    .from(registrationEvents)
    .where(inArray(registrationEvents.id, eventIds)),
    
    db.select({ eventId: electiveGroups.eventId })
      .from(electiveGroups)
      .where(inArray(electiveGroups.eventId, eventIds))
  ]);

  return events.map(event => {
    const groupCount = allGroups.filter(g => g.eventId === event.id).length;
    return { ...event, groupCount };
  });
}

// ── CRUD Actions for Tutor ────────────────────────────────────────────────

export async function createRegistrationWindow(data: { name: string; academicYear: string; description?: string }) {
  const session = await assertTutor();
  if (!session.sectionId || !session.academicBatchId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data (section/programme/department)");
  }

  // Check if a window already exists for this section to prevent duplicates
  const existing = await db
    .select({ id: eventSections.eventId })
    .from(eventSections)
    .where(eq(eventSections.sectionId, session.sectionId));

  if (existing.length > 0) {
    throw new Error("A registration window already exists for your section.");
  }

  const [newEvent] = await db
    .insert(registrationEvents)
    .values({
      name: data.name,
      academicYear: data.academicYear,
      description: data.description,
      academicBatchId: session.academicBatchId,
      createdById: session.userId,
      status: "DRAFT",
    })
    .returning();

  await db.insert(eventSections).values({
    eventId: newEvent.id,
    sectionId: session.sectionId,
  });

  return newEvent;
}

export async function updateWindowTimers(eventId: string, openDate: Date | null, closeDate: Date | null) {
  const session = await assertTutor();

  // Basic authorization: Verify the event belongs to this tutor's section
  const [eventLink] = await db
    .select()
    .from(eventSections)
    .where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId!)));

  if (!eventLink) throw new Error("Unauthorized to edit this window.");

  // Determine status based on dates relative to now
  let status = "PUBLISHED";
  const now = new Date();
  if (openDate && now >= openDate) status = "ACTIVE";
  if (closeDate && now >= closeDate) status = "CLOSED";
  if (!openDate && !closeDate) status = "DRAFT";

  await db
    .update(registrationEvents)
    .set({ openDate, closeDate, status })
    .where(eq(registrationEvents.id, eventId));
}

import * as bcrypt from "bcryptjs";
import { z } from "zod";

const createStudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  registerNumber: z.string().min(1, "Register number is required"),
  email: z.string().email("Invalid email format"),
});

export async function createStudent(formData: { name: string; registerNumber: string; email: string }) {
  const parsed = createStudentSchema.safeParse(formData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }
  const data = parsed.data;

  const session = await assertTutor();
  if (!session.sectionId || !session.academicBatchId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data");
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email.toLowerCase().trim()))
    .limit(1);

  if (existing) throw new Error("A user with this email already exists.");

  // Default password is their register number, securely hashed.
  // Note: System architecture enforces server-side validation.
  const hashed = await bcrypt.hash(data.registerNumber.toUpperCase().trim(), 12);

  await db.insert(users).values({
    name: data.name.trim(),
    email: data.email.toLowerCase().trim(),
    registerNumber: data.registerNumber.trim(),
    passwordHash: hashed,
    role: "STUDENT",
    sectionId: session.sectionId,
    academicBatchId: session.academicBatchId,
    departmentId: session.departmentId,
    isActive: true,
    isEligible: true,
  });
}

export async function unlockStudentRegistration(studentId: string, eventId?: string) {
  const session = await assertTutor();
  const [student] = await db.select({ email: users.email }).from(users).where(and(eq(users.id, studentId), eq(users.sectionId, session.sectionId!)));
  if (!student) throw new Error("Student not found.");

  // Use a transaction to unlock registrations
  await db.transaction(async (tx) => {
    const conditions = [eq(studentRegistrations.studentId, studentId)];
    if (eventId) {
       const [eventLink] = await tx.select().from(eventSections).where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId!)));
       if (!eventLink) throw new Error("Unauthorized access to this event.");
       conditions.push(eq(studentRegistrations.eventId, eventId));
    }

    await tx.update(studentRegistrations)
      .set({ isLocked: false })
      .where(and(...conditions));

    // Audit log
    await tx.insert(auditLogs).values({
      action: "UNLOCK_STUDENT_REGISTRATION",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: {
        studentId,
        studentEmail: student.email,
        eventId: eventId || "ALL_EVENTS",
      },
    });
  });
}

export async function createElectiveGroup(eventId: string, name: string) {
  const session = await assertTutor();
  const [eventLink] = await db
    .select()
    .from(eventSections)
    .where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

  const existingGroups = await db.select().from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
  const sortOrder = existingGroups.length;

  const [newGroup] = await db.insert(electiveGroups).values({
    eventId,
    name: name.trim(),
    sortOrder,
  }).returning({ id: electiveGroups.id });
  return newGroup;
}

export async function createElective(groupId: string, data: { name: string; maxSeats: number; credits: number; courseCode?: string }) {
  const session = await assertTutor();
  
  // Verify group belongs to tutor's section event
  const [group] = await db
    .select({ eventId: electiveGroups.eventId })
    .from(electiveGroups)
    .where(eq(electiveGroups.id, groupId));
  if (!group) throw new Error("Group not found");

  const [eventLink] = await db
    .select()
    .from(eventSections)
    .where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

  await db.insert(electives).values({
    groupId,
    name: data.name.trim(),
    courseCode: data.courseCode || null,
    maxSeats: data.maxSeats,
    availableSeats: data.maxSeats,
    credits: data.credits,
    isFull: false,
  });
}

export async function importStudentsCSV(studentsData: { name: string; registerNumber: string; email: string }[]) {
  const session = await assertTutor();
  if (!session.sectionId || !session.academicBatchId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data");
  }

  const valuesToInsert = await Promise.all(studentsData.map(async (s) => {
    const hashed = await bcrypt.hash(s.registerNumber.toUpperCase().trim(), 12);
    return {
      name: s.name.trim(),
      email: s.email.toLowerCase().trim(),
      registerNumber: s.registerNumber.trim(),
      passwordHash: hashed,
      role: "STUDENT" as const,
      sectionId: session.sectionId,
      academicBatchId: session.academicBatchId,
      departmentId: session.departmentId,
      isActive: true,
      isEligible: true,
    };
  }));

  // Simple loop or batch insert. Let's do a batch insert with ON CONFLICT DO NOTHING.
  // Wait, Drizzle pg doesn't have a simple generic ON CONFLICT DO NOTHING for all rows without specifying columns easily in this setup, 
  // so we'll just check existing emails first to avoid failing the whole batch if one exists.
  
  const existingUsers = await db.select({ email: users.email }).from(users);
  const existingEmails = new Set(existingUsers.map(u => u.email));

  const newUsers = valuesToInsert.filter(u => !existingEmails.has(u.email));
  if (newUsers.length === 0) return { imported: 0, skipped: valuesToInsert.length };

  await db.insert(users).values(newUsers);
  
  return { imported: newUsers.length, skipped: valuesToInsert.length - newUsers.length };
}

export async function updateElective(id: string, data: { name: string; maxSeats: number; credits: number; courseCode?: string }) {
  const session = await assertTutor();
  // Ensure the elective belongs to a group managed by the tutor's section event
  const [elective] = await db.select({ groupId: electives.groupId }).from(electives).where(eq(electives.id, id));
  if (!elective) throw new Error("Elective not found.");

  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, elective.groupId));
  if (!group) throw new Error("Group not found.");

  const [eventLink] = await db.select().from(eventSections).where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

  // Adjust availableSeats based on the new maxSeats
  // We need to know how many seats are already taken.
  const [current] = await db.select({ maxSeats: electives.maxSeats, availableSeats: electives.availableSeats }).from(electives).where(eq(electives.id, id));
  const bookedSeats = current.maxSeats - current.availableSeats;
  const newAvailable = data.maxSeats - bookedSeats;

  if (newAvailable < 0) {
    throw new Error("Cannot reduce seats below the number of currently booked seats.");
  }

  await db.update(electives).set({
    name: data.name.trim(),
    courseCode: data.courseCode || null,
    maxSeats: data.maxSeats,
    credits: data.credits,
    availableSeats: newAvailable,
    isFull: newAvailable === 0,
    updatedAt: new Date(),
  }).where(eq(electives.id, id));
}

export async function deleteElective(id: string) {
  const session = await assertTutor();
  
  const [elective] = await db.select({ groupId: electives.groupId }).from(electives).where(eq(electives.id, id));
  if (!elective) throw new Error("Elective not found.");

  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, elective.groupId));
  if (!group) throw new Error("Group not found.");

  const [eventLink] = await db.select().from(eventSections).where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

  // Delete registrations associated with this elective first
  await db.transaction(async (tx) => {
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.electiveId, id));
    await tx.delete(electives).where(eq(electives.id, id));
  });
}

export async function updateStudent(id: string, data: { name: string; registerNumber: string; email: string }) {
  const session = await assertTutor();
  
  // Verify student belongs to tutor's section
  const [student] = await db.select({ sectionId: users.sectionId }).from(users).where(and(eq(users.id, id), eq(users.role, "STUDENT")));
  if (!student || student.sectionId !== session.sectionId) {
    throw new Error("Unauthorized or student not found.");
  }

  // Check if email already exists on another user
  const [existing] = await db.select().from(users).where(and(eq(users.email, data.email.toLowerCase().trim())));
  if (existing && existing.id !== id) {
    throw new Error("A user with this email already exists.");
  }

  await db.update(users).set({
    name: data.name.trim(),
    registerNumber: data.registerNumber.trim(),
    email: data.email.toLowerCase().trim(),
    updatedAt: new Date(),
  }).where(eq(users.id, id));
}

export async function deleteStudent(id: string) {
  const session = await assertTutor();
  
  const [student] = await db.select({ sectionId: users.sectionId }).from(users).where(and(eq(users.id, id), eq(users.role, "STUDENT")));
  if (!student || student.sectionId !== session.sectionId) {
    throw new Error("Unauthorized or student not found.");
  }

  // Use a transaction to refund seats and delete registrations before deleting student
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(studentRegistrations).where(eq(studentRegistrations.studentId, id));
    
    // Refund seats
    for (const reg of existing) {
      const [elective] = await tx.select({ availableSeats: electives.availableSeats }).from(electives).where(eq(electives.id, reg.electiveId));
      if (elective) {
        await tx.update(electives).set({ 
          availableSeats: elective.availableSeats + 1,
          isFull: false 
        }).where(eq(electives.id, reg.electiveId));
      }
    }

    await tx.delete(studentRegistrations).where(eq(studentRegistrations.studentId, id));
    await tx.delete(users).where(eq(users.id, id));
  });
}
