import test, { describe, after } from "node:test";
import assert from "node:assert";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, electiveSeatAllocations, registrations, replayEvents, studentRegistrations } from "@/lib/db/schema";
import {
  registerElectives,
  changeStudentElective,
  cancelStudentElective,
  cancelEntireRegistration,
  finalizeStudentRegistration,
} from "@/app/actions/register";
import { addSectionQuota, asStudent, cleanup, createWorld, seats, setEventWindow, type World } from "./helpers/world";

/**
 * Registration, change and cancellation behaviour without a waitlist.
 * Each test builds its own fixtures so one failure cannot cascade into the next.
 */
describe("Registration changes, cancellations and capacity (no waitlist)", () => {
  const worlds: World[] = [];
  const make = async (...args: Parameters<typeof createWorld>) => {
    const w = await createWorld(...args);
    worlds.push(w);
    return w;
  };

  after(async () => {
    for (const w of worlds) await cleanup(w);
  });

  const twoGroups = (aSeats: [number, number], bSeats = 5) => ({
    groups: [
      {
        key: "A",
        name: "Professional Elective",
        electives: [
          { key: "A1", name: "Course A1", seats: aSeats[0] },
          { key: "A2", name: "Course A2", seats: aSeats[1] },
        ],
      },
      { key: "B", name: "Open Elective", electives: [{ key: "B1", name: "Course B1", seats: bSeats }] },
    ],
    students: 4,
  });

  test("1. Changing to an elective with seats moves the seat in one step", async () => {
    const w = await make(twoGroups([1, 1]));
    asStudent(w, 0);
    const reg = await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }]);
    assert.strictEqual(reg.success, true, reg.error);
    assert.strictEqual(await seats(w.electives.A1), 0);

    const res = await changeStudentElective(w.eventId, w.groups.A, w.electives.A1, w.electives.A2);
    assert.strictEqual(res.success, true, res.error);
    assert.strictEqual(await seats(w.electives.A1), 1, "old seat released");
    assert.strictEqual(await seats(w.electives.A2), 0, "new seat taken");

    const [choice] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, w.students[0]), eq(studentRegistrations.groupId, w.groups.A)));
    assert.strictEqual(choice.electiveId, w.electives.A2);
    assert.strictEqual(choice.status, "CONFIRMED");

    // Finalize registration to lock choices and generate official receipt
    const fin = await finalizeStudentRegistration(w.eventId);
    assert.strictEqual(fin.success, true);

    const [parent] = await db.select().from(registrations).where(and(eq(registrations.studentId, w.students[0]), eq(registrations.eventId, w.eventId)));
    const snapshot = parent.receiptSnapshot as { electives: { electiveId: string; status: string }[] };
    assert.strictEqual(snapshot.electives[0].electiveId, w.electives.A2, "receipt points at the new elective");
    assert.strictEqual(snapshot.electives[0].status, "CONFIRMED");

    // Once finalized, changes are locked
    const changeAfterFinal = await changeStudentElective(w.eventId, w.groups.A, w.electives.A2, w.electives.A1);
    assert.strictEqual(changeAfterFinal.success, false, "change rejected after finalization");
  });

  test("2. Changing to a full elective is rejected and the current seat is kept", async () => {
    const w = await make(twoGroups([1, 0]));
    asStudent(w, 0);
    assert.strictEqual((await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }])).success, true);

    const res = await changeStudentElective(w.eventId, w.groups.A, w.electives.A1, w.electives.A2);
    assert.strictEqual(res.success, false);
    assert.match(res.error ?? "", /full/i);
    assert.strictEqual(await seats(w.electives.A1), 0, "current seat still held");
    assert.strictEqual(await seats(w.electives.A2), 0, "full elective unchanged, never negative");

    const [choice] = await db.select().from(studentRegistrations).where(eq(studentRegistrations.studentId, w.students[0]));
    assert.strictEqual(choice.electiveId, w.electives.A1);
    assert.strictEqual(choice.status, "CONFIRMED");
  });

  test("3. Registering for a full elective is rejected with SEAT_TAKEN and creates nothing", async () => {
    const w = await make(twoGroups([0, 1]));
    asStudent(w, 0);
    const res = await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }]);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, "SEAT_TAKEN");
    assert.strictEqual(res.electiveId, w.electives.A1);

    const rows = await db.select().from(studentRegistrations).where(eq(studentRegistrations.eventId, w.eventId));
    assert.strictEqual(rows.length, 0, "no choice row of any kind (no waitlist entry)");
    const parents = await db.select().from(registrations).where(eq(registrations.eventId, w.eventId));
    assert.strictEqual(parents.length, 0);
    assert.strictEqual(await seats(w.electives.A1), 0);
  });

  test("4. Cancelling a confirmed elective releases the seat and keeps the record", async () => {
    const w = await make(twoGroups([1, 1]));
    await addSectionQuota(w, "A1", 1);
    asStudent(w, 0);
    assert.strictEqual(
      (await registerElectives(w.eventId, [
        { groupId: w.groups.A, electiveId: w.electives.A1 },
        { groupId: w.groups.B, electiveId: w.electives.B1 },
      ])).success,
      true
    );
    const [quotaBefore] = await db.select().from(electiveSeatAllocations).where(eq(electiveSeatAllocations.electiveId, w.electives.A1));
    assert.strictEqual(quotaBefore.availableSeats, 0, "section quota consumed");

    const res = await cancelStudentElective(w.eventId, w.groups.A, w.electives.A1);
    assert.strictEqual(res.success, true, res.error);
    assert.strictEqual(await seats(w.electives.A1), 1, "elective seat released");
    const [quotaAfter] = await db.select().from(electiveSeatAllocations).where(eq(electiveSeatAllocations.electiveId, w.electives.A1));
    assert.strictEqual(quotaAfter.availableSeats, 1, "section quota released");

    const [choice] = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.studentId, w.students[0]), eq(studentRegistrations.groupId, w.groups.A)));
    assert.ok(choice, "record kept for audit");
    assert.strictEqual(choice.status, "CANCELLED");

    const [parent] = await db.select().from(registrations).where(and(eq(registrations.studentId, w.students[0]), eq(registrations.eventId, w.eventId)));
    assert.strictEqual(parent.status, "CONFIRMED", "B1 is still confirmed");
  });

  test("5. Cancelling the entire registration releases every seat", async () => {
    const w = await make(twoGroups([1, 1], 2));
    asStudent(w, 0);
    assert.strictEqual(
      (await registerElectives(w.eventId, [
        { groupId: w.groups.A, electiveId: w.electives.A2 },
        { groupId: w.groups.B, electiveId: w.electives.B1 },
      ])).success,
      true
    );
    assert.strictEqual(await seats(w.electives.A2), 0);
    assert.strictEqual(await seats(w.electives.B1), 1);

    const res = await cancelEntireRegistration(w.eventId);
    assert.strictEqual(res.success, true, res.error);
    assert.strictEqual(await seats(w.electives.A2), 1);
    assert.strictEqual(await seats(w.electives.B1), 2);

    const choices = await db.select().from(studentRegistrations).where(eq(studentRegistrations.studentId, w.students[0]));
    assert.ok(choices.length === 2 && choices.every((c) => c.status === "CANCELLED"));
    const [parent] = await db.select().from(registrations).where(eq(registrations.studentId, w.students[0]));
    assert.strictEqual(parent.status, "CANCELLED");
  });

  test("6. Modifications after the deadline are rejected and change nothing", async () => {
    const w = await make(twoGroups([2, 2]));
    asStudent(w, 0);
    assert.strictEqual((await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }])).success, true);

    await setEventWindow(w.eventId, { closeDate: new Date(Date.now() - 1000) });

    const change = await changeStudentElective(w.eventId, w.groups.A, w.electives.A1, w.electives.A2);
    assert.strictEqual(change.success, false);
    assert.match(change.error ?? "", /deadline|closed/i);
    const cancel = await cancelStudentElective(w.eventId, w.groups.A, w.electives.A1);
    assert.strictEqual(cancel.success, false);
    const cancelAll = await cancelEntireRegistration(w.eventId);
    assert.strictEqual(cancelAll.success, false);

    assert.strictEqual(await seats(w.electives.A1), 1, "confirmed seat preserved");
    const [parent] = await db.select().from(registrations).where(eq(registrations.studentId, w.students[0]));
    assert.strictEqual(parent.status, "CONFIRMED", "confirmed registration preserved after the deadline");
  });

  test("7. A student cannot cancel another student's registration", async () => {
    const w = await make(twoGroups([2, 2]));
    asStudent(w, 0);
    assert.strictEqual((await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }])).success, true);

    asStudent(w, 1);
    const res = await cancelStudentElective(w.eventId, w.groups.A, w.electives.A1);
    assert.strictEqual(res.success, false);
    assert.match(res.error ?? "", /no active elective registration/i);
    assert.strictEqual(await seats(w.electives.A1), 1, "student 0's seat untouched");
  });

  test("8. Concurrent registrations for the last seat: exactly one succeeds", async () => {
    const w = await make({ ...twoGroups([1, 5]), students: 4 });
    const attempts = w.students.map((_, i) => {
      asStudent(w, i); // read synchronously by getSession() before the first await
      return registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }]);
    });
    const results = await Promise.all(attempts);

    const winners = results.filter((r) => r.success);
    assert.strictEqual(winners.length, 1, `exactly one success, got ${JSON.stringify(results)}`);
    for (const r of results.filter((x) => !x.success)) assert.strictEqual(r.code, "SEAT_TAKEN");
    assert.strictEqual(await seats(w.electives.A1), 0, "never negative");

    const confirmed = await db
      .select()
      .from(studentRegistrations)
      .where(and(eq(studentRegistrations.electiveId, w.electives.A1), eq(studentRegistrations.status, "CONFIRMED")));
    assert.strictEqual(confirmed.length, 1);
  });

  test("9. Concurrent changes into the last seat: exactly one succeeds", async () => {
    const w = await make(twoGroups([5, 1]));
    for (const i of [0, 1, 2]) {
      asStudent(w, i);
      assert.strictEqual((await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }])).success, true);
    }
    const attempts = [0, 1, 2].map((i) => {
      asStudent(w, i);
      return changeStudentElective(w.eventId, w.groups.A, w.electives.A1, w.electives.A2);
    });
    const results = await Promise.all(attempts);
    assert.strictEqual(results.filter((r) => r.success).length, 1, JSON.stringify(results));
    assert.strictEqual(await seats(w.electives.A2), 0);
    assert.strictEqual(await seats(w.electives.A1), 5 - 3 + 1, "only the winner released an A1 seat");
  });

  test("10. Retrying a cancellation does not release the seat twice", async () => {
    const w = await make(twoGroups([1, 1]));
    asStudent(w, 0);
    assert.strictEqual((await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }])).success, true);
    assert.strictEqual((await cancelStudentElective(w.eventId, w.groups.A, w.electives.A1)).success, true);
    const again = await cancelStudentElective(w.eventId, w.groups.A, w.electives.A1);
    assert.strictEqual(again.success, false);
    assert.match(again.error ?? "", /already been cancelled/i);
    assert.strictEqual(await seats(w.electives.A1), 1, "released exactly once");
  });

  test("11. A failed multi-group registration rolls back completely", async () => {
    const w = await make(twoGroups([3, 3], 0)); // B1 is full
    asStudent(w, 0);
    const res = await registerElectives(w.eventId, [
      { groupId: w.groups.A, electiveId: w.electives.A1 },
      { groupId: w.groups.B, electiveId: w.electives.B1 },
    ]);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, "SEAT_TAKEN");
    assert.strictEqual(await seats(w.electives.A1), 3, "A1 seat not consumed");
    const rows = await db.select().from(studentRegistrations).where(eq(studentRegistrations.eventId, w.eventId));
    assert.strictEqual(rows.length, 0);
    const logs = await db.select().from(replayEvents).where(eq(replayEvents.registrationEventId, w.eventId));
    assert.strictEqual(logs.length, 0, "no replay rows from the rolled-back transaction");
  });

  test("12. Receipts, replay events and audit stay consistent and waitlist-free", async () => {
    const w = await make(twoGroups([2, 2]));
    asStudent(w, 0);
    assert.strictEqual(
      (await registerElectives(w.eventId, [
        { groupId: w.groups.A, electiveId: w.electives.A1 },
        { groupId: w.groups.B, electiveId: w.electives.B1 },
      ])).success,
      true
    );

    // Finalize registration
    const fin = await finalizeStudentRegistration(w.eventId);
    assert.strictEqual(fin.success, true);

    const [parent] = await db.select().from(registrations).where(eq(registrations.studentId, w.students[0]));
    assert.strictEqual(parent.status, "CONFIRMED");
    assert.strictEqual(parent.isFinalized, true);
    assert.match(parent.receiptNumber ?? "", /^ELC-\d{4}-(ODD|EVEN)-\d{6}$/);
    const snap = JSON.stringify(parent.receiptSnapshot);
    assert.ok(!/waitlist/i.test(snap), "receipt has no waitlist fields");

    const types = (await db.select().from(replayEvents).where(eq(replayEvents.registrationEventId, w.eventId))).map((r) => r.eventType);
    assert.ok(types.includes("STUDENT_REGISTERED"));
    assert.ok(types.includes("STUDENT_FINALIZED_REGISTRATION"));

    const audits = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.userId, w.students[0]), eq(auditLogs.action, "STUDENT_FINALIZED_REGISTRATION")));
    assert.strictEqual(audits.length, 1);
  });

  test("13. Simultaneous confirmations never share a receipt number", async () => {
    const w = await make({ ...twoGroups([10, 10]), students: 4 });
    const results = await Promise.all(
      w.students.map((_, i) => {
        asStudent(w, i);
        return registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }]);
      })
    );
    assert.ok(results.every((r) => r.success), JSON.stringify(results));

    // Simultaneously finalize all 4 registrations
    const finResults = await Promise.all(
      w.students.map((_, i) => {
        asStudent(w, i);
        return finalizeStudentRegistration(w.eventId);
      })
    );
    assert.ok(finResults.every((r) => r.success), JSON.stringify(finResults));

    const parents = await db.select().from(registrations).where(eq(registrations.eventId, w.eventId));
    const numbers = new Set(parents.map((p) => p.receiptNumber));
    assert.strictEqual(numbers.size, 4, "four distinct receipt numbers");
  });
});
