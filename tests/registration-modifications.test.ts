import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db, pool } from "@/lib/db";
import {
  users,
  registrationEvents,
  electiveGroups,
  electives,
  studentRegistrations,
  registrations,
  academicBatches,
  programmes,
  departments,
  faculties,
  replayEvents,
  auditLogs,
} from "@/lib/db/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { setTestSession } from "@/lib/auth";
import {
  registerElectives,
  changeStudentElective,
  cancelStudentElective,
  cancelEntireRegistration,
  getStudentRegistrationDetails,
} from "@/app/actions/register";
import { promoteWaitlistedStudents, recompactWaitlistPositions } from "@/lib/waitlist";

describe("Electify Student Registration Changes, Cancellations, and FIFO Waitlist Promotion", () => {
  // Test fixture identifiers
  let facultyId: string;
  let departmentId: string;
  let programmeId: string;
  let batchId: string;
  let tutorUserId: string;

  let eventId: string;
  let groupIdA: string;
  let groupIdB: string;

  let electiveA1: string; // 1 seat
  let electiveA2: string; // 1 seat
  let electiveA3: string; // 0 seats (full)
  let electiveB1: string; // 2 seats

  let student1Id: string;
  let student2Id: string;
  let student3Id: string;
  let student4Id: string;

  before(async () => {
    // 1. Set up Master Data Fixtures
    const [fac] = await db
      .insert(faculties)
      .values({
        name: "Test Faculty of Engineering",
        code: `TFEC_${Date.now()}`,
      })
      .returning();
    facultyId = fac.id;

    const [dept] = await db
      .insert(departments)
      .values({
        name: "Test Dept of Computer Applications",
        code: `TDCA_${Date.now()}`,
        facultyId,
      })
      .returning();
    departmentId = dept.id;

    const [prog] = await db
      .insert(programmes)
      .values({
        name: "Master of Computer Applications Test",
        code: `MCAT_${Date.now()}`,
        departmentId,
      })
      .returning();
    programmeId = prog.id;

    const [batch] = await db
      .insert(academicBatches)
      .values({
        year: `2099_${Date.now()}`,
        programmeId,
      })
      .returning();
    batchId = batch.id;

    const [tutor] = await db
      .insert(users)
      .values({
        name: "Test Faculty Tutor",
        email: `tutor_${Date.now()}@srmist.edu.in`,
        passwordHash: "hash",
        role: "CLASS_TUTOR",
        departmentId,
        academicBatchId: batchId,
      })
      .returning();
    tutorUserId = tutor.id;

    // Create 4 test student users
    const [s1] = await db
      .insert(users)
      .values({
        name: "Test Student 1",
        email: `student1_${Date.now()}@srmist.edu.in`,
        passwordHash: "hash",
        role: "STUDENT",
        registerNumber: `RA_TEST_1_${Date.now()}`,
        academicBatchId: batchId,
        departmentId,
        isActive: true,
        isEligible: true,
      })
      .returning();
    student1Id = s1.id;

    const [s2] = await db
      .insert(users)
      .values({
        name: "Test Student 2",
        email: `student2_${Date.now()}@srmist.edu.in`,
        passwordHash: "hash",
        role: "STUDENT",
        registerNumber: `RA_TEST_2_${Date.now()}`,
        academicBatchId: batchId,
        departmentId,
        isActive: true,
        isEligible: true,
      })
      .returning();
    student2Id = s2.id;

    const [s3] = await db
      .insert(users)
      .values({
        name: "Test Student 3",
        email: `student3_${Date.now()}@srmist.edu.in`,
        passwordHash: "hash",
        role: "STUDENT",
        registerNumber: `RA_TEST_3_${Date.now()}`,
        academicBatchId: batchId,
        departmentId,
        isActive: true,
        isEligible: true,
      })
      .returning();
    student3Id = s3.id;

    const [s4] = await db
      .insert(users)
      .values({
        name: "Test Student 4",
        email: `student4_${Date.now()}@srmist.edu.in`,
        passwordHash: "hash",
        role: "STUDENT",
        registerNumber: `RA_TEST_4_${Date.now()}`,
        academicBatchId: batchId,
        departmentId,
        isActive: true,
        isEligible: true,
      })
      .returning();
    student4Id = s4.id;

    // 2. Create Registration Event with window open and waitlist enabled
    const openDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
    const closeDate = new Date(Date.now() + 86400 * 1000); // 1 day in future

    const [event] = await db
      .insert(registrationEvents)
      .values({
        name: "Fall 2099 Test Elective Registration",
        academicBatchId: batchId,
        createdById: tutorUserId,
        openDate,
        closeDate,
        status: "OPEN",
        allowEditing: true,
        autoClose: true,
        enableWaitlist: true,
      })
      .returning();
    eventId = event.id;

    // 3. Create Elective Groups
    const [groupA] = await db
      .insert(electiveGroups)
      .values({
        eventId,
        name: "Professional Elective I",
        minChoices: 1,
        maxChoices: 1,
        sortOrder: 1,
      })
      .returning();
    groupIdA = groupA.id;

    const [groupB] = await db
      .insert(electiveGroups)
      .values({
        eventId,
        name: "Open Elective I",
        minChoices: 1,
        maxChoices: 1,
        sortOrder: 2,
      })
      .returning();
    groupIdB = groupB.id;

    // 4. Create Electives
    // Elective A1 (1 seat)
    const [eA1] = await db
      .insert(electives)
      .values({
        groupId: groupIdA,
        courseCode: "TEST-A101",
        name: "Cloud Computing Architectures",
        credits: 3,
        maxSeats: 1,
        availableSeats: 1,
        isFull: false,
        isActive: true,
      })
      .returning();
    electiveA1 = eA1.id;

    // Elective A2 (1 seat)
    const [eA2] = await db
      .insert(electives)
      .values({
        groupId: groupIdA,
        courseCode: "TEST-A102",
        name: "Distributed Systems & Concurrency",
        credits: 3,
        maxSeats: 1,
        availableSeats: 1,
        isFull: false,
        isActive: true,
      })
      .returning();
    electiveA2 = eA2.id;

    // Elective A3 (0 seats - full)
    const [eA3] = await db
      .insert(electives)
      .values({
        groupId: groupIdA,
        courseCode: "TEST-A103",
        name: "Deep Learning Foundations",
        credits: 3,
        maxSeats: 1,
        availableSeats: 0,
        isFull: true,
        isActive: true,
      })
      .returning();
    electiveA3 = eA3.id;

    // Elective B1 (2 seats)
    const [eB1] = await db
      .insert(electives)
      .values({
        groupId: groupIdB,
        courseCode: "TEST-B101",
        name: "Quantum Computing Principles",
        credits: 3,
        maxSeats: 2,
        availableSeats: 2,
        isFull: false,
        isActive: true,
      })
      .returning();
    electiveB1 = eB1.id;
  });

  after(async () => {
    // Clean up test data
    try {
      await db.delete(replayEvents).where(eq(replayEvents.registrationEventId, eventId));
      await db.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
      await db.delete(registrations).where(eq(registrations.eventId, eventId));
      await db.delete(electives).where(eq(electives.groupId, groupIdA));
      await db.delete(electives).where(eq(electives.groupId, groupIdB));
      await db.delete(electiveGroups).where(eq(electiveGroups.eventId, eventId));
      await db.delete(registrationEvents).where(eq(registrationEvents.id, eventId));
      await db.delete(users).where(eq(users.academicBatchId, batchId));
      await db.delete(academicBatches).where(eq(academicBatches.id, batchId));
      await db.delete(programmes).where(eq(programmes.id, programmeId));
      await db.delete(departments).where(eq(departments.id, departmentId));
      await db.delete(faculties).where(eq(faculties.id, facultyId));
    } catch (e) {
      // Non-fatal cleanup
    } finally {
      setTestSession(null);
      setTimeout(() => process.exit(0), 100);
    }
  });

  test("1. Changing an elective with available seats", async () => {
    // Student 1 registers for A1
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });

    const regRes = await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA1 }]);
    assert.strictEqual(regRes.success, true, "Student 1 initial registration should succeed");

    // Check seats before change: A1 has 0 seats left, A2 has 1 seat left
    const [a1Before] = await db.select().from(electives).where(eq(electives.id, electiveA1));
    const [a2Before] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    assert.strictEqual(a1Before.availableSeats, 0);
    assert.strictEqual(a2Before.availableSeats, 1);

    // Student 1 changes from A1 to A2
    const changeRes = await changeStudentElective(eventId, groupIdA, electiveA1, electiveA2);
    assert.strictEqual(changeRes.success, true, "Change to available elective A2 should succeed");
    assert.strictEqual(changeRes.isWaitlisted, false, "Replacement should be confirmed, not waitlisted");

    // Verify seat counts after change: A2 decremented to 0, A1 released to 1
    const [a1After] = await db.select().from(electives).where(eq(electives.id, electiveA1));
    const [a2After] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    assert.strictEqual(a1After.availableSeats, 1, "Original elective seat should be released");
    assert.strictEqual(a2After.availableSeats, 0, "Replacement elective seat should be consumed");

    // Verify student choice record in DB
    const [choice] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student1Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.strictEqual(choice.electiveId, electiveA2, "DB record should point to replacement elective A2");
    assert.strictEqual(choice.status, "CONFIRMED");
    assert.strictEqual(choice.isWaitlisted, false);
  });

  test("2. Changing to a full elective with waitlisting enabled", async () => {
    // Elective A3 has availableSeats = 0 (full). Waitlist is enabled on event.
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });

    // Attempting change without acceptWaitlist: should prompt for confirmation
    const promptRes = await changeStudentElective(eventId, groupIdA, electiveA2, electiveA3, false);
    assert.strictEqual(promptRes.success, false);
    assert.strictEqual(promptRes.requiresConfirmation, true);
    assert.strictEqual(promptRes.isWaitlisted, true);

    // Check that Student 1 is still in A2 and A2 seat is still 0
    const [a2Check] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    assert.strictEqual(a2Check.availableSeats, 0, "A2 seat should not be released without confirmation");

    // Now confirm change with acceptWaitlist = true
    const confirmRes = await changeStudentElective(eventId, groupIdA, electiveA2, electiveA3, true);
    assert.strictEqual(confirmRes.success, true, "Change with waitlist confirmation should succeed");
    assert.strictEqual(confirmRes.isWaitlisted, true, "Student should be waitlisted for A3");
    assert.strictEqual(confirmRes.waitlistPosition, 1, "First student on A3 waitlist gets position 1");

    // A2 seat should now be released to 1!
    const [a2After] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    assert.strictEqual(a2After.availableSeats, 1, "A2 seat should be released after joining waitlist");

    // Student's parent registration status should be WAITLISTED
    const [parentReg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, student1Id), eq(registrations.eventId, eventId)));
    assert.strictEqual(parentReg.status, "WAITLISTED");
  });

  test("3. Rejecting a change to a full elective when waitlisting is disabled", async () => {
    // Temporarily disable waitlist on event
    await db.update(registrationEvents).set({ enableWaitlist: false }).where(eq(registrationEvents.id, eventId));

    try {
      // Student 2 registers for available elective A2
      setTestSession({
        userId: student2Id,
        name: "Test Student 2",
        email: "student2@srmist.edu.in",
        role: "STUDENT",
      });

      const reg2 = await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA2 }]);
      assert.strictEqual(reg2.success, true);

      // Student 2 attempts to change to full elective A3 with waitlist disabled
      const changeFail = await changeStudentElective(eventId, groupIdA, electiveA2, electiveA3, true);
      assert.strictEqual(changeFail.success, false);
      assert.match(changeFail.error || "", /waitlist/i, "Error message should mention waitlisting is disabled");

      // Student 2's registration for A2 remains confirmed
      const [s2Reg] = await db
        .select()
        .from(studentRegistrations)
        .where(and(eq(studentRegistrations.studentId, student2Id), eq(studentRegistrations.groupId, groupIdA)));
      assert.strictEqual(s2Reg.electiveId, electiveA2);
      assert.strictEqual(s2Reg.status, "CONFIRMED");
    } finally {
      // Re-enable waitlist on event for remaining tests
      await db.update(registrationEvents).set({ enableWaitlist: true }).where(eq(registrationEvents.id, eventId));
    }
  });

  test("4. Cancelling a confirmed elective releases capacity", async () => {
    setTestSession({
      userId: student2Id,
      name: "Test Student 2",
      email: "student2@srmist.edu.in",
      role: "STUDENT",
    });

    // Check A2 seats before cancellation (currently 0 because Student 2 is in A2)
    const [a2Before] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    assert.strictEqual(a2Before.availableSeats, 0);

    // Cancel elective A2
    const cancelRes = await cancelStudentElective(eventId, groupIdA, electiveA2);
    assert.strictEqual(cancelRes.success, true);

    // A2 seat should be released to 1
    const [a2After] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    assert.strictEqual(a2After.availableSeats, 1, "Seat should be released when confirmed elective is cancelled");

    // Record should be marked CANCELLED, NOT deleted (for auditability)
    const [cancelledChoice] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student2Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.ok(cancelledChoice, "Record must not be deleted");
    assert.strictEqual(cancelledChoice.status, "CANCELLED");

    // Parent registration status should be updated to CANCELLED
    const [parentReg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, student2Id), eq(registrations.eventId, eventId)));
    assert.strictEqual(parentReg.status, "CANCELLED");
  });

  test("5. Cancelling a waitlisted elective without releasing a seat", async () => {
    // Recall Student 1 is currently waitlisted for A3 (from Test 2)
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });

    const [a3Before] = await db.select().from(electives).where(eq(electives.id, electiveA3));
    assert.strictEqual(a3Before.availableSeats, 0, "A3 seats before should be 0");

    // Student 1 cancels waitlisted choice A3
    const cancelRes = await cancelStudentElective(eventId, groupIdA, electiveA3);
    assert.strictEqual(cancelRes.success, true);

    // A3 seats MUST STILL BE 0 (never release seat for waitlist)
    const [a3After] = await db.select().from(electives).where(eq(electives.id, electiveA3));
    assert.strictEqual(a3After.availableSeats, 0, "Available seats must NOT increase when waitlist is cancelled");

    // Choice marked CANCELLED and waitlist fields cleared
    const [s1Choice] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student1Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.strictEqual(s1Choice.status, "CANCELLED");
    assert.strictEqual(s1Choice.isWaitlisted, false);
    assert.strictEqual(s1Choice.waitlistPosition, null);
  });

  test("6. Promoting the first eligible student after cancellation", async () => {
    // Setup: Elective A1 currently has 1 seat.
    // Student 1 registers for A1 (confirmed, available -> 0)
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });
    await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA1 }]);

    // Student 2 registers for A1 (A1 is now full, so Student 2 is WAITLISTED)
    setTestSession({
      userId: student2Id,
      name: "Test Student 2",
      email: "student2@srmist.edu.in",
      role: "STUDENT",
    });
    const reg2 = await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA1 }]);
    assert.strictEqual(reg2.success, true);
    assert.strictEqual(reg2.isWaitlisted, true);

    const [s2Waitlist] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student2Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.strictEqual(s2Waitlist.isWaitlisted, true);
    assert.strictEqual(s2Waitlist.waitlistPosition, 1);

    // Now Student 1 cancels confirmed seat in A1
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });
    const cancelRes = await cancelStudentElective(eventId, groupIdA, electiveA1);
    assert.strictEqual(cancelRes.success, true);

    // Student 2 must be AUTOMATICALLY PROMOTED to CONFIRMED!
    const [s2Promoted] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student2Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.strictEqual(s2Promoted.status, "CONFIRMED", "Student 2 must be promoted to CONFIRMED");
    assert.strictEqual(s2Promoted.isWaitlisted, false, "isWaitlisted should be false");
    assert.strictEqual(s2Promoted.waitlistPosition, null, "waitlistPosition should be null");

    // Parent registration status for Student 2 must now be CONFIRMED
    const [s2Parent] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, student2Id), eq(registrations.eventId, eventId)));
    assert.strictEqual(s2Parent.status, "CONFIRMED");

    // Seat count on A1 should be 0 because Student 2 consumed the released seat
    const [a1Check] = await db.select().from(electives).where(eq(electives.id, electiveA1));
    assert.strictEqual(a1Check.availableSeats, 0);

    // Verify WAITLIST_PROMOTED replay event was recorded
    const [replay] = await db
      .select()
      .from(replayEvents)
      .where(
        and(
          eq(replayEvents.registrationEventId, eventId),
          eq(replayEvents.studentId, student2Id),
          eq(replayEvents.eventType, "WAITLIST_PROMOTED")
        )
      );
    assert.ok(replay, "Replay event WAITLIST_PROMOTED must exist for promoted student");
  });

  test("7. Maintaining FIFO order when several students are waiting", async () => {
    // A1 is currently full with Student 2 confirmed.
    // Register Student 3 for A1 -> waitlist pos 1
    setTestSession({
      userId: student3Id,
      name: "Test Student 3",
      email: "student3@srmist.edu.in",
      role: "STUDENT",
    });
    const reg3 = await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA1 }]);
    assert.strictEqual(reg3.isWaitlisted, true);

    // Register Student 4 for A1 -> waitlist pos 2
    setTestSession({
      userId: student4Id,
      name: "Test Student 4",
      email: "student4@srmist.edu.in",
      role: "STUDENT",
    });
    const reg4 = await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA1 }]);
    assert.strictEqual(reg4.isWaitlisted, true);

    const [s3Check] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student3Id), eq(studentRegistrations.groupId, groupIdA)));
    const [s4Check] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student4Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.strictEqual(s3Check.waitlistPosition, 1);
    assert.strictEqual(s4Check.waitlistPosition, 2);

    // Student 2 (who holds the 1 confirmed seat) cancels A1
    setTestSession({
      userId: student2Id,
      name: "Test Student 2",
      email: "student2@srmist.edu.in",
      role: "STUDENT",
    });
    await cancelStudentElective(eventId, groupIdA, electiveA1);

    // FIFO CHECK: Student 3 (pos 1) should be promoted to CONFIRMED!
    const [s3After] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student3Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.strictEqual(s3After.status, "CONFIRMED", "Student 3 (earliest) must be promoted");
    assert.strictEqual(s3After.isWaitlisted, false);

    // FIFO CHECK: Student 4 should be recompacted from pos 2 to pos 1!
    const [s4After] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student4Id), eq(studentRegistrations.groupId, groupIdA)));
    assert.strictEqual(s4After.isWaitlisted, true);
    assert.strictEqual(s4After.waitlistPosition, 1, "Student 4 position should advance from 2 to 1");
  });

  test("8. Cancelling an entire registration with multiple electives", async () => {
    // Reset Student 1: register for A2 (1 seat) and B1 (2 seats)
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });

    const regRes = await registerElectives(eventId, [
      { groupId: groupIdA, electiveId: electiveA2 },
      { groupId: groupIdB, electiveId: electiveB1 },
    ]);
    assert.strictEqual(regRes.success, true);

    const [a2Before] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    const [b1Before] = await db.select().from(electives).where(eq(electives.id, electiveB1));
    assert.strictEqual(a2Before.availableSeats, 0);
    assert.strictEqual(b1Before.availableSeats, 1);

    // Student 1 cancels entire registration
    const cancelAllRes = await cancelEntireRegistration(eventId);
    assert.strictEqual(cancelAllRes.success, true);

    // Verify all seats released
    const [a2After] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    const [b1After] = await db.select().from(electives).where(eq(electives.id, electiveB1));
    assert.strictEqual(a2After.availableSeats, 1);
    assert.strictEqual(b1After.availableSeats, 2);

    // Verify choices marked CANCELLED
    const s1Choices = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student1Id), eq(studentRegistrations.eventId, eventId)));
    assert.ok(s1Choices.every((c) => c.status === "CANCELLED"));

    // Verify parent registration status is CANCELLED
    const [parentReg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, student1Id), eq(registrations.eventId, eventId)));
    assert.strictEqual(parentReg.status, "CANCELLED");
  });

  test("9. Rejecting modifications after the deadline", async () => {
    // Set event close date to 1 hour ago
    await db
      .update(registrationEvents)
      .set({ closeDate: new Date(Date.now() - 3600 * 1000) })
      .where(eq(registrationEvents.id, eventId));

    setTestSession({
      userId: student3Id,
      name: "Test Student 3",
      email: "student3@srmist.edu.in",
      role: "STUDENT",
    });

    // Try to change elective
    const changeRes = await changeStudentElective(eventId, groupIdA, electiveA1, electiveA2);
    assert.strictEqual(changeRes.success, false);
    assert.match(changeRes.error || "", /deadline|closed/i);

    // Try to cancel elective
    const cancelRes = await cancelStudentElective(eventId, groupIdA, electiveA1);
    assert.strictEqual(cancelRes.success, false);
    assert.match(cancelRes.error || "", /deadline|closed/i);

    // Try to cancel entire registration
    const cancelAllRes = await cancelEntireRegistration(eventId);
    assert.strictEqual(cancelAllRes.success, false);
    assert.match(cancelAllRes.error || "", /deadline|closed/i);

    // Restore event close date for other tests
    await db
      .update(registrationEvents)
      .set({ closeDate: new Date(Date.now() + 86400 * 1000) })
      .where(eq(registrationEvents.id, eventId));
  });

  test("10. Preventing access to another student's registration", async () => {
    // Student 1 attempts to cancel Student 3's registration for A1
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });

    // Student 1 does not own A1 (Student 3 owns it).
    // The server checks session.userId against studentId
    const cancelRes = await cancelStudentElective(eventId, groupIdA, electiveA1);
    assert.strictEqual(cancelRes.success, false);
    assert.match(cancelRes.error || "", /no active elective registration|already cancelled|does not match/i);
  });

  test("11. Simultaneous registrations competing for the last seat", async () => {
    // Ensure A2 has exactly 1 seat available
    await db.update(electives).set({ availableSeats: 1, isFull: false }).where(eq(electives.id, electiveA2));

    // Clear previous registrations for Student 1 and Student 2 in group A
    await db.delete(studentRegistrations).where(
      and(
        eq(studentRegistrations.eventId, eventId),
        eq(studentRegistrations.groupId, groupIdA)
      )
    );
    await db.delete(registrations).where(eq(registrations.eventId, eventId));

    // Run 2 simultaneous registrations for the single seat in A2
    const task1 = (async () => {
      setTestSession({
        userId: student1Id,
        name: "Test Student 1",
        email: "student1@srmist.edu.in",
        role: "STUDENT",
      });
      return await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA2 }]);
    })();

    const task2 = (async () => {
      setTestSession({
        userId: student2Id,
        name: "Test Student 2",
        email: "student2@srmist.edu.in",
        role: "STUDENT",
      });
      return await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA2 }]);
    })();

    const [r1, r2] = await Promise.all([task1, task2]);

    assert.ok(r1.success && r2.success, "Both registration requests must complete without database error");

    // Exactly one student must be confirmed, and one must be waitlisted!
    const results = [r1.isWaitlisted, r2.isWaitlisted];
    const confirmedCount = results.filter((w) => w === false).length;
    const waitlistedCount = results.filter((w) => w === true).length;

    assert.strictEqual(confirmedCount, 1, "Exactly one student must get the confirmed seat");
    assert.strictEqual(waitlistedCount, 1, "The competing student must be waitlisted");

    // Available seats must never drop below 0
    const [a2Check] = await db.select().from(electives).where(eq(electives.id, electiveA2));
    assert.strictEqual(a2Check.availableSeats, 0);
  });

  test("12. Simultaneous cancellations and promotions", async () => {
    // Create a fresh elective with 1 seat
    const [contestElective] = await db
      .insert(electives)
      .values({
        groupId: groupIdB,
        courseCode: `RACE_${Date.now()}`,
        name: "Race Condition Test Elective",
        credits: 3,
        maxSeats: 1,
        availableSeats: 0,
        isFull: true,
        isActive: true,
      })
      .returning();

    // Register Student 3 as waitlisted (pos 1) and Student 4 as waitlisted (pos 2)
    await db.insert(studentRegistrations).values({
      studentId: student3Id,
      eventId,
      groupId: groupIdB,
      electiveId: contestElective.id,
      status: "WAITLISTED",
      isWaitlisted: true,
      waitlistPosition: 1,
    });
    await db.insert(studentRegistrations).values({
      studentId: student4Id,
      eventId,
      groupId: groupIdB,
      electiveId: contestElective.id,
      status: "WAITLISTED",
      isWaitlisted: true,
      waitlistPosition: 2,
    });

    // Make 1 seat available
    await db.update(electives).set({ availableSeats: 1 }).where(eq(electives.id, contestElective.id));

    // Run two concurrent promotion calls for the single available seat
    const [promo1, promo2] = await Promise.all([
      db.transaction(async (tx) => promoteWaitlistedStudents(tx, contestElective.id, 1, eventId)),
      db.transaction(async (tx) => promoteWaitlistedStudents(tx, contestElective.id, 1, eventId)),
    ]);

    const totalPromoted = promo1.promotedCount + promo2.promotedCount;
    assert.strictEqual(totalPromoted, 1, "Exactly 1 student should be promoted into 1 available seat");

    // Only one student confirmed, remaining student must be waitlist pos 1
    const [s3] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student3Id), eq(studentRegistrations.electiveId, contestElective.id)));
    const [s4] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, student4Id), eq(studentRegistrations.electiveId, contestElective.id)));

    assert.strictEqual(s3.status, "CONFIRMED", "Student 3 (earliest) must be promoted");
    assert.strictEqual(s4.status, "WAITLISTED", "Student 4 must remain waitlisted");
    assert.strictEqual(s4.waitlistPosition, 1, "Student 4 must advance to position 1");

    // Clean up race elective
    await db.delete(studentRegistrations).where(eq(studentRegistrations.electiveId, contestElective.id));
    await db.delete(electives).where(eq(electives.id, contestElective.id));
  });

  test("13. Retrying the same mutation without double-processing it", async () => {
    // Student 1 has a registration in group A. Let's register for A1.
    setTestSession({
      userId: student1Id,
      name: "Test Student 1",
      email: "student1@srmist.edu.in",
      role: "STUDENT",
    });

    // Clean up student 1 registrations first
    await db.delete(studentRegistrations).where(eq(studentRegistrations.studentId, student1Id));
    await db.delete(registrations).where(eq(registrations.studentId, student1Id));
    await db.update(electives).set({ availableSeats: 1, isFull: false }).where(eq(electives.id, electiveA1));

    await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA1 }]);

    const [a1Before] = await db.select().from(electives).where(eq(electives.id, electiveA1));
    assert.strictEqual(a1Before.availableSeats, 0);

    // Call cancelStudentElective first time
    const res1 = await cancelStudentElective(eventId, groupIdA, electiveA1);
    assert.strictEqual(res1.success, true);

    const [a1AfterFirst] = await db.select().from(electives).where(eq(electives.id, electiveA1));
    assert.strictEqual(a1AfterFirst.availableSeats, 1, "Available seats should increase by 1");

    // Call cancelStudentElective a second time (retry or duplicate click)
    const res2 = await cancelStudentElective(eventId, groupIdA, electiveA1);
    assert.strictEqual(res2.success, false, "Second cancellation attempt must fail");
    assert.match(res2.error || "", /already been cancelled/i);

    // CRITICAL: Seat count must NOT increase a second time!
    const [a1AfterSecond] = await db.select().from(electives).where(eq(electives.id, electiveA1));
    assert.strictEqual(a1AfterSecond.availableSeats, 1, "Available seats must NOT be released twice");
  });

  test("14. Rolling back all changes when an operation fails", async () => {
    // Verify that if a transaction throws, seat counts and registrations roll back completely
    const [a1Before] = await db.select().from(electives).where(eq(electives.id, electiveA1));

    await assert.rejects(async () => {
      await db.transaction(async (tx) => {
        // Decrement seat
        await tx
          .update(electives)
          .set({ availableSeats: sql`${electives.availableSeats} - 1` })
          .where(eq(electives.id, electiveA1));

        // Throw an artificial error
        throw new Error("Simulated transient failure");
      });
    }, /Simulated transient failure/);

    // Verify seat count was rolled back
    const [a1After] = await db.select().from(electives).where(eq(electives.id, electiveA1));
    assert.strictEqual(a1After.availableSeats, a1Before.availableSeats, "Seat count must roll back on transaction failure");
  });

  test("15. Keeping receipts, seat counts, statuses and audit events consistent", async () => {
    // Setup clean registration for Student 4
    setTestSession({
      userId: student4Id,
      name: "Test Student 4",
      email: "student4@srmist.edu.in",
      role: "STUDENT",
    });

    await db.delete(studentRegistrations).where(eq(studentRegistrations.studentId, student4Id));
    await db.delete(registrations).where(eq(registrations.studentId, student4Id));

    // Ensure A1 has 1 seat
    await db.update(electives).set({ availableSeats: 1, isFull: false }).where(eq(electives.id, electiveA1));

    // Register Student 4 for A1
    const regRes = await registerElectives(eventId, [{ groupId: groupIdA, electiveId: electiveA1 }]);
    assert.strictEqual(regRes.success, true);

    // Fetch details via getStudentRegistrationDetails
    const details = await getStudentRegistrationDetails(eventId);
    assert.strictEqual(details.success, true);
    assert.strictEqual(details.hasRegistered, true);
    assert.ok(details.registration?.receiptNumber, "Receipt number must be generated");
    assert.strictEqual(details.registration?.status, "CONFIRMED");
    assert.strictEqual(details.choices?.length, 1);
    assert.strictEqual(details.choices?.[0].status, "CONFIRMED");
    assert.strictEqual(details.choices?.[0].isWaitlisted, false);

    // Verify receipt snapshot in DB matches choice
    const [dbReg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, student4Id), eq(registrations.eventId, eventId)));
    const snapshot = dbReg.receiptSnapshot as any;
    assert.ok(snapshot);
    assert.strictEqual(snapshot.receiptNumber, details.registration?.receiptNumber);
    assert.strictEqual(snapshot.electives.length, 1);

    // Verify audit logs exist
    const auditEntries = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, student4Id));
    assert.ok(auditEntries.length >= 1, "Audit log must be recorded");

    // Verify replay events exist
    const replayEntries = await db
      .select()
      .from(replayEvents)
      .where(eq(replayEvents.studentId, student4Id));
    assert.ok(replayEntries.length >= 1, "Replay event must be recorded");
  });
});
