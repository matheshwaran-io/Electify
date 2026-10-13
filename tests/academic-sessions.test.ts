import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  academicSessions,
  auditLogs,
  cohortSessionTerms,
  departments,
  electiveGroups,
  electives,
  faculties,
  inviteCodes,
  programmes,
  registrationEvents,
  registrationStatusEnum,
  registrations,
  replayEvents,
  sections,
  studentRegistrations,
  tutorSections,
  users,
} from "@/lib/db/schema";
import { setTestSession } from "@/lib/auth";
import { assertEventInWorkspace, listSessionsForScope, loadStaffScope, requireStaffWorkspace, resolveStaffWorkspace, setTestWorkspaceSession } from "@/lib/workspace";
import { listStudentEvents, resolveStudentEvent } from "@/lib/student-events";
import { loadSubjectDetail } from "@/lib/subjects/queries";
import {
  createCoordinatorElective,
  createCoordinatorElectiveGroup,
  createRegistrationEvent,
  deleteMultipleStudents,
  getCoordinatorReports,
  getCoordinatorStudents,
} from "@/app/actions/coordinator";
import { createClassSignupCode, getRegistrationMetrics } from "@/app/actions/tutor";
import { getUnregisteredStudentsList, toggleEventStatusFromMonitor } from "@/app/actions/monitor";
import { cancelStudentElective, registerElectives } from "@/app/actions/register";
import { registerStudentWithClassCode } from "@/app/actions/auth";
import { testAcademicSession } from "./helpers/world";

/**
 * Acceptance scenario from the spec: one tutor manages "MCA F" in two
 * admission cohorts (here 2095–2097 and 2096–2098, far-future years so test
 * data never meets real data) inside academic session 2096–2097, with one
 * registration event per class running at the same time.
 */
describe("Academic sessions and cohort-isolated registration", () => {
  const tag = randomUUID().slice(0, 8);
  const HOUR = 3600_000;

  type Staff = { id: string; role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR"; programmeId?: string };
  const ids = {} as Record<string, string>;
  let s1: { id: string };
  let s2: { id: string };
  let tutorT: Staff;
  let tutorU: Staff;
  let coordC: Staff;
  let coordD: Staff;
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  const asStaff = (u: Staff, sessionId: string | null, sectionId?: string) => {
    setTestSession({ userId: u.id, name: u.role, email: `${u.role.toLowerCase()}_${tag}@test.local`, role: u.role, programmeId: u.programmeId, sectionId });
    setTestWorkspaceSession(sessionId);
  };
  const asStudent = (id: string) => {
    setTestSession({ userId: id, name: "Student", email: `s_${tag}@test.local`, role: "STUDENT" });
    setTestWorkspaceSession(undefined);
  };
  const seats = async (id: string) => (await db.select().from(electives).where(eq(electives.id, id)))[0].availableSeats;

  async function user(values: Partial<typeof users.$inferInsert> & { role: string; name: string }) {
    const [row] = await db
      .insert(users)
      .values({ email: `${values.name.replace(/\W/g, "").toLowerCase()}_${tag}@srmist.edu.in`, passwordHash: "x", ...values })
      .returning();
    createdUserIds.push(row.id);
    return row;
  }

  before(async () => {
    s1 = await testAcademicSession(2096);
    s2 = await testAcademicSession(2097);

    const [fac] = await db.insert(faculties).values({ name: `Fac ${tag}`, code: `F_${tag}` }).returning();
    const [dept] = await db.insert(departments).values({ name: `Dept ${tag}`, code: `D_${tag}`, facultyId: fac.id }).returning();
    const [mca] = await db.insert(programmes).values({ name: "MCA", code: `MCA_${tag}`, departmentId: dept.id, durationYears: 2 }).returning();
    const [msc] = await db.insert(programmes).values({ name: "MSc IT", code: `MSC_${tag}`, departmentId: dept.id, durationYears: 2 }).returning();
    Object.assign(ids, { fac: fac.id, dept: dept.id, mca: mca.id, msc: msc.id });

    const [batchA] = await db.insert(academicBatches).values({ year: `A${tag}`, programmeId: mca.id, admissionYear: 2095, expectedEndYear: 2097, datesConfirmed: true }).returning();
    const [batchB] = await db.insert(academicBatches).values({ year: `B${tag}`, programmeId: mca.id, admissionYear: 2096, expectedEndYear: 2098, datesConfirmed: true }).returning();
    const [batchX] = await db.insert(academicBatches).values({ year: `X${tag}`, programmeId: msc.id, admissionYear: 2096, expectedEndYear: 2098, datesConfirmed: true }).returning();
    const [aF] = await db.insert(sections).values({ label: "F", academicBatchId: batchA.id }).returning();
    const [aG] = await db.insert(sections).values({ label: "G", academicBatchId: batchA.id }).returning();
    const [bF] = await db.insert(sections).values({ label: "F", academicBatchId: batchB.id }).returning();
    const [xA] = await db.insert(sections).values({ label: "A", academicBatchId: batchX.id }).returning();
    Object.assign(ids, { batchA: batchA.id, batchB: batchB.id, batchX: batchX.id, aF: aF.id, aG: aG.id, bF: bF.id, xA: xA.id });

    // 2096–2097: both MCA cohorts; 2097–2098: only the 2096 cohort. MSc IT is in no session.
    await db.insert(cohortSessionTerms).values([
      { academicBatchId: batchA.id, academicSessionId: s1.id, studyYear: 2, currentSemester: 3, confirmed: true },
      { academicBatchId: batchB.id, academicSessionId: s1.id, studyYear: 1, currentSemester: 1, confirmed: true },
      { academicBatchId: batchB.id, academicSessionId: s2.id, studyYear: 2, currentSemester: 3, confirmed: true },
    ]);

    const t = await user({ name: `Tutor T ${tag}`, role: "CLASS_TUTOR" });
    const u = await user({ name: `Tutor U ${tag}`, role: "CLASS_TUTOR" });
    const c = await user({ name: `Coord C ${tag}`, role: "COURSE_COORDINATOR", programmeId: mca.id, departmentId: dept.id });
    const d = await user({ name: `Coord D ${tag}`, role: "COURSE_COORDINATOR", programmeId: msc.id, departmentId: dept.id });
    tutorT = { id: t.id, role: "CLASS_TUTOR" };
    tutorU = { id: u.id, role: "CLASS_TUTOR" };
    coordC = { id: c.id, role: "COURSE_COORDINATOR", programmeId: mca.id };
    coordD = { id: d.id, role: "COURSE_COORDINATOR", programmeId: msc.id };
    // One tutor account, both MCA F classes. Tutor U only has the other class of the 2095 cohort.
    await db.insert(tutorSections).values([
      { tutorId: t.id, sectionId: aF.id },
      { tutorId: t.id, sectionId: bF.id },
      { tutorId: u.id, sectionId: aG.id },
    ]);

    const student = (name: string, sectionId: string, batchId: string, i: number, programmeId = mca.id) =>
      user({ name, role: "STUDENT", registerNumber: `RA${tag.toUpperCase()}${i}`, sectionId, academicBatchId: batchId, programmeId, departmentId: dept.id });
    ids.a1 = (await student(`A1 ${tag}`, aF.id, batchA.id, 1)).id;
    ids.a2 = (await student(`A2 ${tag}`, aF.id, batchA.id, 2)).id;
    ids.g1 = (await student(`G1 ${tag}`, aG.id, batchA.id, 3)).id;
    ids.b1 = (await student(`B1 ${tag}`, bF.id, batchB.id, 4)).id;
    ids.b2 = (await student(`B2 ${tag}`, bF.id, batchB.id, 5)).id;
    ids.x1 = (await student(`X1 ${tag}`, xA.id, batchX.id, 6, msc.id)).id;

    // Event A for MCA F · 2095–2097 and Event B for MCA F · 2096–2098, created through
    // the coordinator's real action, each for exactly one class, open at the same time.
    asStaff(coordC, s1.id);
    const now = Date.now();
    const evA = await createRegistrationEvent({
      name: `Event A ${tag}`,
      targetSectionId: aF.id,
      semester: 3,
      status: "PUBLISHED",
      openDate: new Date(now - HOUR).toISOString(),
      closeDate: new Date(now + 24 * HOUR).toISOString(),
    });
    const evB = await createRegistrationEvent({
      name: `Event B ${tag}`,
      targetSectionId: bF.id,
      semester: 1,
      status: "PUBLISHED",
      openDate: new Date(now - 2 * HOUR).toISOString(),
      closeDate: new Date(now + 48 * HOUR).toISOString(),
    });
    ids.evA = evA.event.id;
    ids.evB = evB.event.id;
    createdEventIds.push(ids.evA, ids.evB);

    const gA = await createCoordinatorElectiveGroup(ids.evA, { name: "Professional Elective" });
    const gB = await createCoordinatorElectiveGroup(ids.evB, { name: "Professional Elective" });
    ids.gA = gA.id;
    ids.gB = gB.id;
    ids.ccA = (await createCoordinatorElective(gA.id, { name: "Cloud Computing", credits: 3, maxSeats: 40 })).id;
    ids.csA = (await createCoordinatorElective(gA.id, { name: "Cyber Security", credits: 3, maxSeats: 30 })).id;
    ids.aiB = (await createCoordinatorElective(gB.id, { name: "Artificial Intelligence", credits: 3, maxSeats: 25 })).id;
    ids.ccB = (await createCoordinatorElective(gB.id, { name: "Cloud Computing", credits: 3, maxSeats: 35 })).id;
    ids.capB = (await createCoordinatorElective(gB.id, { name: "Capstone Lab", credits: 3, maxSeats: 1 })).id;
  });

  after(async () => {
    setTestSession(undefined);
    setTestWorkspaceSession(undefined);
    const events = await db.select({ id: registrationEvents.id }).from(registrationEvents).where(inArray(registrationEvents.academicBatchId, [ids.batchA, ids.batchB, ids.batchX].filter(Boolean)));
    const eventIds = Array.from(new Set([...createdEventIds, ...events.map((e) => e.id)]));
    if (eventIds.length) {
      await db.delete(replayEvents).where(inArray(replayEvents.registrationEventId, eventIds));
      await db.delete(studentRegistrations).where(inArray(studentRegistrations.eventId, eventIds));
      await db.delete(registrations).where(inArray(registrations.eventId, eventIds));
      const groups = await db.select({ id: electiveGroups.id }).from(electiveGroups).where(inArray(electiveGroups.eventId, eventIds));
      if (groups.length) await db.delete(electives).where(inArray(electives.groupId, groups.map((g) => g.id)));
      await db.delete(electiveGroups).where(inArray(electiveGroups.eventId, eventIds));
      await db.delete(registrationEvents).where(inArray(registrationEvents.id, eventIds));
    }
    const signedUp = await db.select({ id: users.id }).from(users).where(inArray(users.academicBatchId, [ids.batchA, ids.batchB, ids.batchX].filter(Boolean)));
    const allUsers = Array.from(new Set([...createdUserIds, ...signedUp.map((u) => u.id)]));
    if (allUsers.length) {
      await db.delete(inviteCodes).where(inArray(inviteCodes.createdById, allUsers));
      await db.delete(tutorSections).where(inArray(tutorSections.tutorId, allUsers));
      await db.delete(auditLogs).where(inArray(auditLogs.userId, allUsers));
      await db.delete(users).where(inArray(users.id, allUsers));
    }
    await db.delete(inviteCodes).where(inArray(inviteCodes.sectionId, [ids.aF, ids.aG, ids.bF, ids.xA].filter(Boolean)));
    await db.delete(sections).where(inArray(sections.academicBatchId, [ids.batchA, ids.batchB, ids.batchX].filter(Boolean)));
    if (ids.batchA) await db.delete(academicBatches).where(inArray(academicBatches.id, [ids.batchA, ids.batchB, ids.batchX]));
    if (ids.mca) await db.delete(programmes).where(inArray(programmes.id, [ids.mca, ids.msc]));
    if (ids.dept) await db.delete(departments).where(eq(departments.id, ids.dept));
    if (ids.fac) await db.delete(faculties).where(eq(faculties.id, ids.fac));
    for (const s of [s1, s2]) {
      // Shared test sessions: removed only when nothing else still uses them.
      await db.delete(academicSessions).where(eq(academicSessions.id, s.id)).catch(() => undefined);
    }
  });

  test("1. One tutor account manages both MCA F cohorts, each with its full identity", async () => {
    asStaff(tutorT, s1.id);
    const ws = await requireStaffWorkspace();
    assert.strictEqual(ws.session.label, "2096–2097");
    assert.deepStrictEqual(
      ws.tutorClasses.map((c) => c.label),
      ["MCA F · 2095–2097", "MCA F · 2096–2098"]
    );
    assert.notStrictEqual(ws.tutorClasses[0].sectionId, ws.tutorClasses[1].sectionId);
    assert.deepStrictEqual(ws.tutorClasses.map((c) => c.stage), ["Year 2 · Semester 3", "Year 1 · Semester 1"], "study stage is per cohort in this session");
  });

  test("2. The selected academic session filters the workspace", async () => {
    asStaff(tutorT, s2.id);
    const ws = await requireStaffWorkspace();
    assert.deepStrictEqual(ws.classes.map((c) => c.label), ["MCA F · 2096–2098"], "the 2095 cohort is not in 2097–2098");

    const scopeT = (await loadStaffScope({ userId: tutorT.id, name: "", email: "", role: "CLASS_TUTOR" }))!;
    assert.deepStrictEqual((await listSessionsForScope(scopeT)).map((s) => s.label).sort(), ["2096–2097", "2097–2098"]);
    const scopeU = (await loadStaffScope({ userId: tutorU.id, name: "", email: "", role: "CLASS_TUTOR" }))!;
    assert.deepStrictEqual((await listSessionsForScope(scopeU)).map((s) => s.label), ["2096–2097"], "only sessions with the tutor's own classes");

    // A selection the user has no classes in is ignored, never honoured.
    asStaff(tutorT, "00000000-0000-0000-0000-000000000000");
    const res = await resolveStaffWorkspace();
    assert.strictEqual(res.status, "SELECT", "two sessions available, so the user must choose");

    // Archived sessions cannot be entered.
    await db.update(academicSessions).set({ status: "ARCHIVED" }).where(eq(academicSessions.id, s2.id));
    try {
      asStaff(tutorT, s2.id);
      const archived = await resolveStaffWorkspace();
      assert.strictEqual(archived.status, "OK");
      if (archived.status === "OK") assert.strictEqual(archived.workspace.session.id, s1.id, "falls back to the only enterable session");
    } finally {
      await db.update(academicSessions).set({ status: "ACTIVE" }).where(eq(academicSessions.id, s2.id));
    }
  });

  test("3. Same-named classes stay distinct; a class from another session cannot be made active", async () => {
    asStaff(tutorT, s2.id, ids.aF);
    const ws = await requireStaffWorkspace();
    assert.strictEqual(ws.activeClass?.sectionId, ids.bF, "the 2095–2097 class is not active in 2097–2098");
    asStaff(tutorT, s1.id, ids.aF);
    assert.strictEqual((await requireStaffWorkspace()).activeClass?.label, "MCA F · 2095–2097");
  });

  test("4. The two cohorts have their own offerings, capacities, semesters and windows", async () => {
    const offered = async (eventId: string) =>
      (
        await db
          .select({ name: electives.name, maxSeats: electives.maxSeats })
          .from(electives)
          .innerJoin(electiveGroups, eq(electiveGroups.id, electives.groupId))
          .where(eq(electiveGroups.eventId, eventId))
      ).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepStrictEqual(await offered(ids.evA), [
      { name: "Cloud Computing", maxSeats: 40 },
      { name: "Cyber Security", maxSeats: 30 },
    ]);
    assert.deepStrictEqual(await offered(ids.evB), [
      { name: "Artificial Intelligence", maxSeats: 25 },
      { name: "Capstone Lab", maxSeats: 1 },
      { name: "Cloud Computing", maxSeats: 35 },
    ]);
    const evs = await db.select().from(registrationEvents).where(inArray(registrationEvents.id, [ids.evA, ids.evB]));
    const a = evs.find((e) => e.id === ids.evA)!;
    const b = evs.find((e) => e.id === ids.evB)!;
    assert.strictEqual(a.academicSessionId, s1.id);
    assert.strictEqual(b.academicSessionId, s1.id);
    assert.deepStrictEqual([a.semester, b.semester], [3, 1]);
    assert.notStrictEqual(a.closeDate?.getTime(), b.closeDate?.getTime());
  });

  test("5. Simultaneous events route each student only to their own class", async () => {
    const forA = await listStudentEvents(ids.a1);
    const forB = await listStudentEvents(ids.b1);
    assert.ok(forA.status === "OK" && forB.status === "OK");
    if (forA.status !== "OK" || forB.status !== "OK") return;
    assert.deepStrictEqual(forA.events.map((e) => e.id), [ids.evA]);
    assert.deepStrictEqual(forB.events.map((e) => e.id), [ids.evB]);
    assert.strictEqual(forA.studentClass.label, "MCA F · 2095–2097");
    assert.strictEqual(forA.events[0].sessionLabel, "2096–2097");
    // Another class of the same cohort is not targeted by Event A
    const forG = await resolveStudentEvent(ids.g1);
    assert.strictEqual(forG.status, "NO_EVENT");
  });

  test("6. A student cannot see or register for another cohort's event", async () => {
    assert.strictEqual((await resolveStudentEvent(ids.a1, ids.evB)).status, "NOT_ELIGIBLE");
    assert.strictEqual((await loadSubjectDetail(ids.a1, ids.aiB)).subject, null, "subject pages of another cohort's event are not reachable");
    asStudent(ids.a1);
    const res = await registerElectives(ids.evB, [{ groupId: ids.gB, electiveId: ids.aiB }]);
    assert.strictEqual(res.code, "WRONG_EVENT");
    assert.strictEqual(await seats(ids.aiB), 25);
  });

  test("7. Crafted requests cannot bypass class targeting or mix offerings", async () => {
    asStudent(ids.g1);
    const otherClass = await registerElectives(ids.evA, [{ groupId: ids.gA, electiveId: ids.ccA }]);
    assert.strictEqual(otherClass.code, "WRONG_EVENT", "same cohort, but class G is not targeted");

    asStudent(ids.a1);
    const mixed = await registerElectives(ids.evA, [{ groupId: ids.gA, electiveId: ids.ccB }]);
    assert.strictEqual(mixed.success, false, "Event B's Cloud Computing cannot be booked through Event A");
    const foreignGroup = await registerElectives(ids.evA, [{ groupId: ids.gB, electiveId: ids.ccB }]);
    assert.strictEqual(foreignGroup.code, "INVALID_SELECTION");
    assert.strictEqual(await seats(ids.ccA), 40);
    assert.strictEqual(await seats(ids.ccB), 35);
  });

  test("8. Seat counts of the same subject in two cohorts are independent", async () => {
    asStudent(ids.a1);
    const res = await registerElectives(ids.evA, [{ groupId: ids.gA, electiveId: ids.ccA }]);
    assert.strictEqual(res.success, true, res.error);
    assert.strictEqual(await seats(ids.ccA), 39);
    assert.strictEqual(await seats(ids.ccB), 35, "Event B's Cloud Computing is untouched");
  });

  test("9. Concurrent registration never exceeds capacity", async () => {
    asStudent(ids.b1);
    const p1 = registerElectives(ids.evB, [{ groupId: ids.gB, electiveId: ids.capB }]);
    asStudent(ids.b2);
    const p2 = registerElectives(ids.evB, [{ groupId: ids.gB, electiveId: ids.capB }]);
    const results = await Promise.all([p1, p2]);
    assert.strictEqual(results.filter((r) => r.success).length, 1);
    assert.strictEqual(results.filter((r) => r.code === "SEAT_TAKEN").length, 1);
    assert.strictEqual(await seats(ids.capB), 0);
    const held = await db.select().from(studentRegistrations).where(and(eq(studentRegistrations.electiveId, ids.capB), eq(studentRegistrations.status, "CONFIRMED")));
    assert.strictEqual(held.length, 1);
  });

  test("10. Receipts and reports carry the full cohort and session identity", async () => {
    const [reg] = await db.select().from(registrations).where(and(eq(registrations.studentId, ids.a1), eq(registrations.eventId, ids.evA)));
    const academic = (reg.receiptSnapshot as { academic: Record<string, unknown> }).academic;
    assert.strictEqual(academic.classLabel, "MCA F · 2095–2097");
    assert.strictEqual(academic.academicSession, "2096–2097");
    assert.strictEqual(academic.semester, 3);

    asStaff(coordC, s1.id);
    const report = await getCoordinatorReports();
    assert.strictEqual(report.academicSession, "2096–2097");
    const row = report.allotments.find((a) => a.studentId === ids.a1)!;
    assert.strictEqual(row.classLabel, "MCA F · 2095–2097");
    assert.strictEqual(row.academicSession, "2096–2097");
    assert.deepStrictEqual(
      report.sections.map((s) => s.classLabel).filter((l) => l.startsWith("MCA")).sort(),
      ["MCA F · 2095–2097", "MCA F · 2096–2098", "MCA G · 2095–2097"]
    );
    assert.deepStrictEqual(report.events.find((e) => e.id === ids.evA)?.classLabels, ["MCA F · 2095–2097"]);
  });

  test("11. Cancelling returns the seat and keeps the audit trail", async () => {
    asStudent(ids.a1);
    const res = await cancelStudentElective(ids.evA, ids.gA, ids.ccA);
    assert.strictEqual(res.success, true, res.error);
    assert.strictEqual(await seats(ids.ccA), 40);
    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.userId, ids.a1), eq(auditLogs.action, "STUDENT_REGISTERED")));
    assert.strictEqual(audit.length, 1, "the original registration stays in the audit log");
    assert.strictEqual((audit[0].metadata as { academicSessionId: string }).academicSessionId, s1.id);
  });

  test("12. A signup code never moves an existing student to another cohort", async () => {
    asStaff(tutorT, s1.id, ids.bF);
    const code = await createClassSignupCode({ sectionId: ids.bF, maxActivations: 5, expiryDays: 3 });

    const takeover = await registerStudentWithClassCode({
      code: code.code,
      email: `takeover_${tag}@srmist.edu.in`,
      registerNumber: `RA${tag.toUpperCase()}1`, // student A1's register number
      password: "Cohort#Test9",
      confirmPassword: "Cohort#Test9",
    });
    assert.strictEqual(takeover.success, false);
    const [a1] = await db.select().from(users).where(eq(users.id, ids.a1));
    assert.deepStrictEqual([a1.sectionId, a1.academicBatchId], [ids.aF, ids.batchA], "A1 is still in MCA F · 2095–2097");

    const fresh = await registerStudentWithClassCode({
      code: code.code,
      email: `fresh_${tag}@srmist.edu.in`,
      registerNumber: `RA${tag.toUpperCase()}9`,
      password: "Cohort#Test9",
      confirmPassword: "Cohort#Test9",
    });
    assert.strictEqual(fresh.success, true, fresh.error);
    const [created] = await db.select().from(users).where(eq(users.registerNumber, `RA${tag.toUpperCase()}9`));
    assert.deepStrictEqual([created.sectionId, created.academicBatchId, created.programmeId], [ids.bF, ids.batchB, ids.mca], "assigned from the code's class on the server");

    // A tutor cannot issue codes for a class they don't manage
    asStaff(tutorU, s1.id);
    await assert.rejects(createClassSignupCode({ sectionId: ids.bF }), /not authorized/);
  });

  test("13. Staff cannot reach classes, sessions, events, students or reports outside their scope", async () => {
    // Tutor U manages only MCA G · 2095–2097
    asStaff(tutorU, s1.id);
    const wsU = await requireStaffWorkspace();
    await assert.rejects(assertEventInWorkspace(wsU, ids.evA), /not authorized/);
    await assert.rejects(getRegistrationMetrics(ids.evA), /not authorized/);
    assert.strictEqual((await toggleEventStatusFromMonitor(ids.evA, "PAUSED")).success, false);
    assert.strictEqual((await getUnregisteredStudentsList(ids.evA)).success, false);
    const [evA] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, ids.evA));
    assert.strictEqual(evA.status, "PUBLISHED", "the event was not paused");

    // Coordinator of another programme (no classes in any session)
    asStaff(coordD, s1.id);
    await assert.rejects(getCoordinatorStudents(), /Choose an academic session/);

    // Coordinator of MCA cannot delete a student of MSc IT
    asStaff(coordC, s1.id);
    await assert.rejects(deleteMultipleStudents([ids.x1]), /not in a class you manage/);
    assert.ok((await db.select().from(users).where(eq(users.id, ids.x1))).length === 1, "the student still exists");
    const roster = await getCoordinatorStudents();
    assert.ok(!roster.some((r) => r.id === ids.x1));
    assert.ok(roster.some((r) => r.id === ids.a1) && roster.some((r) => r.id === ids.b1));

    // Events from another session are refused even for an authorized class
    asStaff(tutorT, s2.id);
    await assert.rejects(assertEventInWorkspace(await requireStaffWorkspace(), ids.evB), /another academic session/);
  });

  test("14. Event creation is limited to classes managed in the selected session", async () => {
    asStaff(tutorU, s1.id);
    await assert.rejects(createRegistrationEvent({ name: "x", targetSectionId: ids.aG }), /Unauthorized/, "tutors don't use the coordinator action");
    asStaff(coordC, s2.id);
    await assert.rejects(createRegistrationEvent({ name: "x", targetSectionId: ids.aF }), /Choose a class you manage/, "MCA F · 2095–2097 is not in 2097–2098");
    asStaff(coordD, null);
    await assert.rejects(createRegistrationEvent({ name: "x", targetSectionId: ids.xA }), /Choose an academic session/);
  });

  test("15. The waitlist does not come back", async () => {
    assert.ok(!("isWaitlisted" in studentRegistrations), "no waitlist flag on choices");
    assert.ok(!("waitlistPosition" in studentRegistrations));
    assert.ok(!("enableWaitlist" in registrationEvents));
    assert.ok(!registrationStatusEnum.enumValues.includes("WAITLISTED" as never));
    // A full subject is refused outright; no queued row is created.
    asStudent(ids.b1);
    const full = await registerElectives(ids.evB, [{ groupId: ids.gB, electiveId: ids.capB }]);
    assert.strictEqual(full.success, false);
    const rows = await db.select().from(studentRegistrations).where(eq(studentRegistrations.electiveId, ids.capB));
    assert.ok(rows.every((r) => r.status === "CONFIRMED"), "no non-confirmed rows for the full subject");
  });
});
