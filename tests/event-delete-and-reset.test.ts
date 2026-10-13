import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
import {
  users,
  faculties,
  departments,
  programmes,
  academicBatches,
  registrationEvents,
  electiveGroups,
  electives,
  electiveSeatAllocations,
  studentRegistrations,
  registrations,
  replayEvents,
  auditLogs,
  sections,
  eventSections,
  cohortSessionTerms,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { setTestSession } from "@/lib/auth";
import { setTestWorkspaceSession } from "@/lib/workspace";
import { testAcademicSession } from "./helpers/world";
import { deleteRegistrationEvent, resetRegistrationEvent } from "@/app/actions/coordinator";

describe("Event Management: Delete Event & Reset Registrations", () => {
  let adminUser: { id: string; email: string };
  let coordinatorUser: { id: string; email: string };
  let studentUser: { id: string; email: string };
  let facultyId: string;
  let departmentId: string;
  let programmeId: string;
  let batchId: string;
  let sectionId: string;
  let academicSessionId: string;

  before(async () => {
    // 1. Setup Academic hierarchy
    const [fac] = await db
      .insert(faculties)
      .values({
        name: "Faculty of Event Test",
        code: `FET_${Date.now().toString().slice(-6)}`,
      })
      .returning();
    facultyId = fac.id;

    const [dept] = await db
      .insert(departments)
      .values({
        name: "Dept of Event Test",
        code: `DET_${Date.now().toString().slice(-6)}`,
        facultyId,
      })
      .returning();
    departmentId = dept.id;

    const [prog] = await db
      .insert(programmes)
      .values({
        name: "Programme of Event Test",
        code: `PET_${Date.now().toString().slice(-6)}`,
        departmentId,
      })
      .returning();
    programmeId = prog.id;

    const [batch] = await db
      .insert(academicBatches)
      .values({
        year: `T${Date.now().toString().slice(-6)}`,
        programmeId,
      })
      .returning();
    batchId = batch.id;

    // The cohort's class, and an academic session it studies in. Staff act inside that session.
    const [sec] = await db.insert(sections).values({ label: "E", academicBatchId: batchId }).returning();
    sectionId = sec.id;
    academicSessionId = (await testAcademicSession()).id;
    await db.insert(cohortSessionTerms).values({ academicBatchId: batchId, academicSessionId, studyYear: 1, confirmed: true });
    setTestWorkspaceSession(academicSessionId);

    // 2. Setup Users
    const [uAdmin] = await db
      .insert(users)
      .values({
        name: "Admin User",
        email: `admin_evt_${Date.now()}@srmist.edu.in`,
        role: "SYSTEM_ADMIN",
        passwordHash: "hash",
      })
      .returning();
    adminUser = { id: uAdmin.id, email: uAdmin.email };

    const [uCoord] = await db
      .insert(users)
      .values({
        name: "Coordinator User",
        email: `coord_evt_${Date.now()}@srmist.edu.in`,
        role: "COURSE_COORDINATOR",
        departmentId,
        programmeId,
        passwordHash: "hash",
      })
      .returning();
    coordinatorUser = { id: uCoord.id, email: uCoord.email };

    const [uStudent] = await db
      .insert(users)
      .values({
        name: "Student User",
        email: `stud_evt_${Date.now()}@srmist.edu.in`,
        registerNumber: `RA${Math.floor(100000 + Math.random() * 900000)}`,
        role: "STUDENT",
        academicBatchId: batchId,
        sectionId,
        departmentId,
        passwordHash: "hash",
      })
      .returning();
    studentUser = { id: uStudent.id, email: uStudent.email };
  });

  // Every event a test creates, so cleanup can remove whatever a test left behind.
  const createdEventIds: string[] = [];

  async function createTestEventWithRegistrations(suffix: string) {
    const [ev] = await db
      .insert(registrationEvents)
      .values({
        name: `Event Test ${suffix} ${Date.now()}`,
        academicBatchId: batchId,
        academicSessionId,
        createdById: adminUser.id,
        openDate: new Date(Date.now() - 3600000),
        closeDate: new Date(Date.now() + 86400000),
        status: "OPEN",
        allowEditing: true,
      })
      .returning();
    createdEventIds.push(ev.id);
    await db.insert(eventSections).values({ eventId: ev.id, sectionId, academicBatchId: batchId });

    const [grp] = await db
      .insert(electiveGroups)
      .values({
        eventId: ev.id,
        name: `Group ${suffix}`,
        minChoices: 1,
        maxChoices: 1,
        sortOrder: 1,
      })
      .returning();

    const [el] = await db
      .insert(electives)
      .values({
        groupId: grp.id,
        courseCode: `CS-${suffix}`,
        name: `Course ${suffix}`,
        credits: 3,
        maxSeats: 10,
        availableSeats: 9, // 1 registered
        isFull: false,
        isActive: true,
      })
      .returning();

    await db.insert(registrations).values({
      studentId: studentUser.id,
      eventId: ev.id,
      status: "CONFIRMED",
      receiptNumber: `ELC-2026-EVT-${Math.floor(100000 + Math.random() * 900000)}`,
    });

    await db.insert(studentRegistrations).values({
      studentId: studentUser.id,
      eventId: ev.id,
      groupId: grp.id,
      electiveId: el.id,
      status: "CONFIRMED",
    });

    await db.insert(replayEvents).values({
      registrationEventId: ev.id,
      studentId: studentUser.id,
      studentName: "Student User",
      eventType: "STUDENT_REGISTERED",
      subjectId: el.id,
      subjectName: el.name,
      newSubject: el.name,
    });

    return { eventId: ev.id, groupId: grp.id, electiveId: el.id };
  }

  test("1. Unauthorized users or students cannot reset or delete events", async () => {
    const { eventId } = await createTestEventWithRegistrations("AuthCheck");

    // Unauthenticated
    setTestSession(null);
    await assert.rejects(async () => {
      await resetRegistrationEvent(eventId);
    }, /Unauthorized/i);

    await assert.rejects(async () => {
      await deleteRegistrationEvent(eventId);
    }, /Unauthorized/i);

    // Student role
    setTestSession({
      userId: studentUser.id,
      name: "Student User",
      email: studentUser.email,
      role: "STUDENT",
    });

    await assert.rejects(async () => {
      await resetRegistrationEvent(eventId);
    }, /Unauthorized/i);

    await assert.rejects(async () => {
      await deleteRegistrationEvent(eventId);
    }, /Unauthorized/i);
  });

  test("2. Resetting an event clears registrations and restores seats without deleting the event", async () => {
    const { eventId, electiveId } = await createTestEventWithRegistrations("ResetCheck");

    setTestSession({
      userId: coordinatorUser.id,
      name: "Coordinator User",
      email: coordinatorUser.email,
      role: "COURSE_COORDINATOR",
    });

    const resetRes = await resetRegistrationEvent(eventId);
    assert.strictEqual(resetRes.success, true);

    // Verify registrations are cleared
    const remainingRegs = await db
      .select()
      .from(studentRegistrations)
      .where(eq(studentRegistrations.eventId, eventId));
    assert.strictEqual(remainingRegs.length, 0, "Student choices must be cleared");

    // Verify elective available seats were restored back to maxSeats (10)
    const [elAfter] = await db
      .select()
      .from(electives)
      .where(eq(electives.id, electiveId));
    assert.strictEqual(elAfter.availableSeats, 10, "Available seats refunded back to maximum");

    // Verify the registration event itself is STILL present in database
    const [evAfter] = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId));
    assert.ok(evAfter, "Registration event must still exist after reset");
  });

  test("3. Deleting an event permanently purges event, baskets, electives, allocations, and logs", async () => {
    const { eventId, groupId, electiveId } = await createTestEventWithRegistrations("DeleteCheck");

    setTestSession({
      userId: adminUser.id,
      name: "Admin User",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    const delRes = await deleteRegistrationEvent(eventId);
    assert.strictEqual(delRes.success, true);

    // 1. Verify event is gone
    const [ev] = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId));
    assert.strictEqual(ev, undefined, "Event must be permanently removed");

    // 2. Verify elective groups are gone
    const grps = await db
      .select()
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventId));
    assert.strictEqual(grps.length, 0, "Elective groups must be purged");

    // 3. Verify electives are gone
    const [el] = await db
      .select()
      .from(electives)
      .where(eq(electives.id, electiveId));
    assert.strictEqual(el, undefined, "Electives must be purged");

    // 4. Verify registrations are gone
    const regs = await db
      .select()
      .from(studentRegistrations)
      .where(eq(studentRegistrations.eventId, eventId));
    assert.strictEqual(regs.length, 0, "Student choices must be purged");

    // 5. Verify audit log recorded DELETE_REGISTRATION_EVENT
    const [audit] = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "DELETE_REGISTRATION_EVENT"))
      .orderBy(auditLogs.createdAt);
    assert.ok(audit, "Audit log must contain DELETE_REGISTRATION_EVENT action");
  });

  after(async () => {
    setTestSession(null);
    setTestWorkspaceSession(undefined);
    // Events deleted by a test are already gone; these deletes are then no-ops.
    for (const eventId of createdEventIds) {
      await db.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
      await db.delete(registrations).where(eq(registrations.eventId, eventId));
      await db.delete(replayEvents).where(eq(replayEvents.registrationEventId, eventId));
      const groups = await db.select({ id: electiveGroups.id }).from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
      if (groups.length > 0) {
        await db.delete(electives).where(inArray(electives.groupId, groups.map((g) => g.id)));
      }
      await db.delete(electiveGroups).where(eq(electiveGroups.eventId, eventId));
      await db.delete(registrationEvents).where(eq(registrationEvents.id, eventId));
    }
    const testUserIds = [adminUser?.id, coordinatorUser?.id, studentUser?.id].filter(Boolean);
    if (testUserIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.userId, testUserIds));
      await db.delete(users).where(inArray(users.id, testUserIds));
    }
    if (batchId) await db.delete(academicBatches).where(eq(academicBatches.id, batchId));
    if (programmeId) await db.delete(programmes).where(eq(programmes.id, programmeId));
    if (departmentId) await db.delete(departments).where(eq(departments.id, departmentId));
    if (facultyId) await db.delete(faculties).where(eq(faculties.id, facultyId));
  });
});
