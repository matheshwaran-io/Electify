"use server";

import { db } from "@/lib/db";
import { users, electives, electiveGroups, registrationEvents, studentRegistrations } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, asc, count } from "drizzle-orm";

async function assertTutor() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") throw new Error("Unauthorized");
  return session;
}

// ── Section Students ─────────────────────────────────────────────────────

export async function getSectionStudents() {
  const session = await assertTutor();

  if (!session.sectionId) return [];

  const students = await db
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

  return students;
}

// ── Section Registrations (Approvals) ────────────────────────────────────

export async function getSectionRegistrations() {
  const session = await assertTutor();

  if (!session.sectionId) return [];

  const registrations = await db
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

  return registrations;
}
