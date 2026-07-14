"use server";

import { db } from "@/lib/db";
import {
  users, registrationEvents, programmes, sections,
  electiveGroups, electives, studentRegistrations, academicBatches, eventTemplates,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, count, desc, asc } from "drizzle-orm";

async function assertCoordinator() {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") throw new Error("Unauthorized");
  return session;
}

// ── Electives ─────────────────────────────────────────────────────────────

export async function getCoordinatorElectives() {
  const session = await assertCoordinator();

  const events = await db
    .select({ id: registrationEvents.id, name: registrationEvents.name, status: registrationEvents.status })
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

      result.push({
        eventId: event.id,
        eventName: event.name,
        eventStatus: event.status,
        groupId: group.id,
        groupName: group.name,
        electives: groupElectives,
      });
    }
  }
  return result;
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

// ── Reports ───────────────────────────────────────────────────────────────

export async function getCoordinatorReports() {
  const session = await assertCoordinator();

  const allSections = await db
    .select({ id: sections.id, label: sections.label })
    .from(sections)
    .leftJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .where(
      session.programmeId ? eq(academicBatches.programmeId, session.programmeId) : undefined
    )
    .orderBy(asc(sections.label));

  const report = [];
  for (const sec of allSections) {
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, sec.id)));

    // Count distinct students who registered for at least one elective
    // We use studentRegistrations to get distinct studentIds
    const registered = await db
      .selectDistinct({ studentId: studentRegistrations.studentId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(eq(users.sectionId, sec.id));

    report.push({
      sectionId: sec.id,
      sectionLabel: sec.label,
      totalStudents: total,
      registeredCount: registered.length,
    });
  }

  return report;
}

// ── Coordinator Templates ─────────────────────────────────────────────────

export async function getCoordinatorTemplates() {
  const session = await assertCoordinator();

  const { eventTemplates, templateGroups, programmes: prog } = await import("@/lib/db/schema");
  const { count: cnt } = await import("drizzle-orm");

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
