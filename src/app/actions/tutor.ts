"use server";

import { db } from "@/lib/db";
import {
  users, electives, electiveGroups, registrationEvents,
  studentRegistrations, eventSections, sections, programmes
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, asc, count, desc } from "drizzle-orm";

async function assertTutor() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") throw new Error("Unauthorized");

  // Fetch missing hierarchy details if the session token is incomplete
  if (session.sectionId && (!session.programmeId || !session.departmentId)) {
    const [sectionData] = await db
      .select({ 
        programmeId: sections.programmeId, 
        departmentId: programmes.departmentId 
      })
      .from(sections)
      .innerJoin(programmes, eq(sections.programmeId, programmes.id))
      .where(eq(sections.id, session.sectionId));

    if (sectionData) {
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

  const result = [];
  for (const { eventId } of sectionEvents) {
    const [event] = await db
      .select({ 
        id: registrationEvents.id, 
        name: registrationEvents.name, 
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate
      })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId))
      .limit(1);

    if (!event) continue;

    const groups = await db
      .select()
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventId))
      .orderBy(asc(electiveGroups.sortOrder));

    const groupsWithElectives = [];
    for (const group of groups) {
      const groupElectives = await db
        .select()
        .from(electives)
        .where(eq(electives.groupId, group.id))
        .orderBy(asc(electives.name));
      groupsWithElectives.push({ ...group, electives: groupElectives });
    }
    result.push({ event, groups: groupsWithElectives });
  }
  return result;
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

  const result = [];
  for (const { eventId } of sectionEvents) {
    const [event] = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        academicYear: registrationEvents.academicYear,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
        description: registrationEvents.description,
      })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId))
      .limit(1);

    if (!event) continue;

    const [{ total }] = await db
      .select({ total: count() })
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventId));

    result.push({ ...event, groupCount: total });
  }
  return result;
}

// ── CRUD Actions for Tutor ────────────────────────────────────────────────

export async function createRegistrationWindow(data: { name: string; academicYear: string; description?: string }) {
  const session = await assertTutor();
  if (!session.sectionId || !session.programmeId || !session.departmentId) {
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
      programmeId: session.programmeId,
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

export async function createStudent(data: { name: string; registerNumber: string; email: string }) {
  const session = await assertTutor();
  if (!session.sectionId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data");
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email.toLowerCase().trim()))
    .limit(1);

  if (existing) throw new Error("A user with this email already exists.");

  const hashed = await bcrypt.hash("Student@123", 12); // Default password

  await db.insert(users).values({
    name: data.name.trim(),
    email: data.email.toLowerCase().trim(),
    registerNumber: data.registerNumber.trim(),
    passwordHash: hashed,
    role: "STUDENT",
    sectionId: session.sectionId,
    programmeId: session.programmeId,
    departmentId: session.departmentId,
    isActive: true,
    isEligible: true,
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
  if (!session.sectionId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data");
  }

  const hashed = await bcrypt.hash("Student@123", 12);

  const valuesToInsert = studentsData.map(s => ({
    name: s.name.trim(),
    email: s.email.toLowerCase().trim(),
    registerNumber: s.registerNumber.trim(),
    passwordHash: hashed,
    role: "STUDENT" as const,
    sectionId: session.sectionId,
    programmeId: session.programmeId,
    departmentId: session.departmentId,
    isActive: true,
    isEligible: true,
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
