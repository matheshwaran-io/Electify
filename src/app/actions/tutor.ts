"use server";

import { db } from "@/lib/db";
import {
  users, electives, electiveGroups, registrationEvents,
  studentRegistrations, eventSections, sections
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, asc, count, desc } from "drizzle-orm";

async function assertTutor() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") throw new Error("Unauthorized");
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
