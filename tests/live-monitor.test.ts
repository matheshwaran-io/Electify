import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db, pool } from "@/lib/db";
import {
  users,
  registrationEvents,
  eventSections,
  sections,
  academicBatches,
  programmes,
  departments,
  faculties,
  electiveGroups,
  electives,
  registrations,
  studentRegistrations,
  replayEvents,
  auditLogs,
  tutorSections,
  cohortSessionTerms,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { setTestSession } from "@/lib/auth";
import { setTestWorkspaceSession } from "@/lib/workspace";
import { testAcademicSession } from "./helpers/world";
import {
  getLiveMonitorEvents,
  getLiveMonitoringData,
  getLiveFeedUpdates,
  getUnregisteredStudentsList,
  toggleEventStatusFromMonitor,
} from "@/app/actions/monitor";

describe("Live Event Registration Monitor & Surveillance Module", () => {
  let facultyId: string;
  let departmentId: string;
  let programmeId: string;
  let batchId: string;
  let section1Id: string;
  let section2Id: string;

  let adminUser: { id: string; email: string };
  let coordinatorUser: { id: string; email: string };
  let tutorUser: { id: string; email: string };
  let student1: { id: string; email: string };
  let student2: { id: string; email: string };
  let student3: { id: string; email: string };

  let eventId: string;
  let groupId: string;
  let elective1Id: string;
  let elective2Id: string;

  before(async () => {
    // 1. Fixtures: Faculty, Dept, Prog, Batch, Sections
    const [fac] = await db
      .insert(faculties)
      .values({
        name: `Faculty Live Monitor ${Date.now()}`,
        code: `FLM_${Date.now()}`,
      })
      .returning();
    facultyId = fac.id;

    const [dept] = await db
      .insert(departments)
      .values({
        name: `Dept Live Monitor ${Date.now()}`,
        code: `DLM_${Date.now()}`,
        facultyId,
      })
      .returning();
    departmentId = dept.id;

    const [prog] = await db
      .insert(programmes)
      .values({
        name: `Programme Live Monitor ${Date.now()}`,
        code: `PLM_${Date.now().toString().slice(-4)}`,
        departmentId,
      })
      .returning();
    programmeId = prog.id;

    const [batch] = await db
      .insert(academicBatches)
      .values({
        year: "2026",
        programmeId,
      })
      .returning();
    batchId = batch.id;

    const [sec1] = await db
      .insert(sections)
      .values({
        label: "Section LM-A",
        academicBatchId: batchId,
      })
      .returning();
    section1Id = sec1.id;

    const [sec2] = await db
      .insert(sections)
      .values({
        label: "Section LM-B",
        academicBatchId: batchId,
      })
      .returning();
    section2Id = sec2.id;

    // 2. Users
    const [uAdmin] = await db
      .insert(users)
      .values({
        name: "Admin Live",
        email: `admin_live_${Date.now()}@srmist.edu.in`,
        role: "SYSTEM_ADMIN",
        passwordHash: "hash",
      })
      .returning();
    adminUser = { id: uAdmin.id, email: uAdmin.email };

    const [uCoord] = await db
      .insert(users)
      .values({
        name: "Coordinator Live",
        email: `coord_live_${Date.now()}@srmist.edu.in`,
        role: "COURSE_COORDINATOR",
        departmentId,
        programmeId,
        passwordHash: "hash",
      })
      .returning();
    coordinatorUser = { id: uCoord.id, email: uCoord.email };

    const [uTutor] = await db
      .insert(users)
      .values({
        name: "Tutor Live",
        email: `tutor_live_${Date.now()}@srmist.edu.in`,
        role: "CLASS_TUTOR",
        departmentId,
        sectionId: section1Id,
        passwordHash: "hash",
      })
      .returning();
    tutorUser = { id: uTutor.id, email: uTutor.email };

    await db.insert(tutorSections).values({
      tutorId: tutorUser.id,
      sectionId: section1Id,
    });

    const regPrefix = `RA${Math.floor(100000 + Math.random() * 900000)}`;

    const [s1] = await db
      .insert(users)
      .values({
        name: "Student Alpha",
        email: `student_alpha_${Date.now()}_1@srmist.edu.in`,
        registerNumber: `${regPrefix}1`,
        role: "STUDENT",
        sectionId: section1Id,
        passwordHash: "hash",
      })
      .returning();
    student1 = { id: s1.id, email: s1.email };

    const [s2] = await db
      .insert(users)
      .values({
        name: "Student Beta",
        email: `student_beta_${Date.now()}_2@srmist.edu.in`,
        registerNumber: `${regPrefix}2`,
        role: "STUDENT",
        sectionId: section1Id,
        passwordHash: "hash",
      })
      .returning();
    student2 = { id: s2.id, email: s2.email };

    const [s3] = await db
      .insert(users)
      .values({
        name: "Student Gamma",
        email: `student_gamma_${Date.now()}_3@srmist.edu.in`,
        registerNumber: `${regPrefix}3`,
        role: "STUDENT",
        sectionId: section2Id,
        passwordHash: "hash",
      })
      .returning();
    student3 = { id: s3.id, email: s3.email };

    // 3. Registration Event, in a test academic session that includes this cohort.
    // Staff in these tests work inside that session (the test stand-in for the session cookie).
    const academicSession = await testAcademicSession();
    await db.insert(cohortSessionTerms).values({ academicBatchId: batchId, academicSessionId: academicSession.id, studyYear: 1, confirmed: true });
    setTestWorkspaceSession(academicSession.id);

    const [ev] = await db
      .insert(registrationEvents)
      .values({
        name: "Live Monitor Test Registration 2026",
        academicBatchId: batchId,
        academicSessionId: academicSession.id,
        academicYear: "2026–2027",
        status: "OPEN",
        createdById: coordinatorUser.id,
      })
      .returning();
    eventId = ev.id;

    await db.insert(eventSections).values([
      { eventId, sectionId: section1Id, academicBatchId: batchId },
      { eventId, sectionId: section2Id, academicBatchId: batchId },
    ]);

    // 4. Electives & Baskets
    const [grp] = await db
      .insert(electiveGroups)
      .values({
        eventId,
        name: "Core Elective Pool 1",
        minChoices: 1,
        maxChoices: 1,
      })
      .returning();
    groupId = grp.id;

    const [el1] = await db
      .insert(electives)
      .values({
        groupId,
        name: "Cloud Native Microservices",
        courseCode: "CS701",
        credits: 3,
        maxSeats: 10,
        availableSeats: 8,
        isFull: false,
      })
      .returning();
    elective1Id = el1.id;

    const [el2] = await db
      .insert(electives)
      .values({
        groupId,
        name: "Deep Reinforcement Learning",
        courseCode: "CS702",
        credits: 3,
        maxSeats: 5,
        availableSeats: 5,
        isFull: false,
      })
      .returning();
    elective2Id = el2.id;

    // 5. Seed one confirmed registration and one replay event
    await db.insert(registrations).values({
      studentId: student1.id,
      eventId,
      status: "CONFIRMED",
      receiptNumber: `REC_LIVE_${Date.now()}`,
      submittedAt: new Date(),
    });

    await db.insert(studentRegistrations).values({
      studentId: student1.id,
      eventId,
      groupId,
      electiveId: elective1Id,
      status: "CONFIRMED",
      submittedAt: new Date(),
    });

    await db.insert(replayEvents).values({
      registrationEventId: eventId,
      studentId: student1.id,
      studentName: "Student Alpha",
      eventType: "STUDENT_REGISTERED",
      subjectId: elective1Id,
      subjectName: "Cloud Native Microservices",
      newSubject: "Cloud Native Microservices",
      seatBefore: 10,
      seatAfter: 9,
    });
  });

  test("1. Unauthorized users or students cannot access live monitoring data", async () => {
    setTestSession(null);
    const res = await getLiveMonitorEvents();
    assert.strictEqual(res.success, false);
    assert.match(res.error || "", /Unauthorized/i);

    setTestSession({
      userId: student1.id,
      name: "Student Alpha",
      email: student1.email,
      role: "STUDENT",
    });
    const studentRes = await getLiveMonitoringData();
    assert.strictEqual(studentRes.success, false);
    assert.match(studentRes.error || "", /Unauthorized/i);
  });

  test("2. Admin can retrieve monitor events and full live telemetry", async () => {
    setTestSession({
      userId: adminUser.id,
      name: "Admin Live",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    const eventsRes = await getLiveMonitorEvents();
    assert.strictEqual(eventsRes.success, true);
    assert.ok(eventsRes.data && eventsRes.data.length > 0);

    const monitorData = await getLiveMonitoringData(eventId);
    assert.strictEqual(monitorData.success, true);
    assert.ok(monitorData.data);

    const d = monitorData.data;
    assert.strictEqual(d.event?.id, eventId);
    assert.strictEqual(d.event?.status, "OPEN");

    // Total eligible students: student1, student2 in sec1 + student3 in sec2 = 3
    assert.strictEqual(d.kpis.totalEligibleStudents, 3);
    assert.strictEqual(d.kpis.registeredStudents, 1);
    assert.strictEqual(d.kpis.unregisteredStudents, 2);
    assert.strictEqual(d.kpis.completionRate, 33); // 1/3 = 33%

    // Total capacity = 10 + 5 = 15
    assert.strictEqual(d.kpis.totalCapacity, 15);
    assert.strictEqual(d.courses.length, 2);

    // Section stats
    assert.strictEqual(d.sections.length, 2);
    const sec1Stat = d.sections.find((s) => s.sectionId === section1Id);
    assert.strictEqual(sec1Stat?.registeredCount, 1);
    assert.strictEqual(sec1Stat?.totalStudents, 2);

    // Activity log should have the seeded replay event
    assert.ok(d.recentActivity.length >= 1);
    assert.strictEqual(d.recentActivity[0].studentName, "Student Alpha");
  });

  test("3. Coordinator has access to programme live events and course saturation", async () => {
    setTestSession({
      userId: coordinatorUser.id,
      name: "Coordinator Live",
      email: coordinatorUser.email,
      role: "COURSE_COORDINATOR",
      departmentId,
      programmeId,
    });

    const monitorData = await getLiveMonitoringData(eventId);
    assert.strictEqual(monitorData.success, true);
    assert.strictEqual(monitorData.data?.event?.id, eventId);
    assert.strictEqual(monitorData.data?.courses.length, 2);
  });

  test("4. Live feed updates polling returns fresh stream events and counts", async () => {
    setTestSession({
      userId: adminUser.id,
      name: "Admin Live",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    // Simulate another registration
    await db.insert(registrations).values({
      studentId: student2.id,
      eventId,
      status: "CONFIRMED",
      receiptNumber: `REC_LIVE_2_${Date.now()}`,
      submittedAt: new Date(),
    });

    await db.insert(replayEvents).values({
      registrationEventId: eventId,
      studentId: student2.id,
      studentName: "Student Beta",
      eventType: "STUDENT_REGISTERED",
      subjectId: elective2Id,
      subjectName: "Deep Reinforcement Learning",
      newSubject: "Deep Reinforcement Learning",
      seatBefore: 5,
      seatAfter: 4,
    });

    const feedRes = await getLiveFeedUpdates(eventId);
    assert.strictEqual(feedRes.success, true);
    assert.ok(feedRes.data);
    assert.strictEqual(feedRes.data.kpis.registeredStudents, 2);
    assert.ok(feedRes.data.newEvents.length >= 2);
  });

  test("5. Querying unregistered students identifies pending cohort members", async () => {
    setTestSession({
      userId: coordinatorUser.id,
      name: "Coordinator Live",
      email: coordinatorUser.email,
      role: "COURSE_COORDINATOR",
      departmentId,
      programmeId,
    });

    // Student 3 has not registered
    const unregisteredRes = await getUnregisteredStudentsList(eventId);
    assert.strictEqual(unregisteredRes.success, true);
    assert.ok(unregisteredRes.data);

    // Only student3 should be in pending list (student1 and student2 are registered)
    const pendingIds = unregisteredRes.data.map((s) => s.id);
    assert.ok(pendingIds.includes(student3.id));
    assert.ok(!pendingIds.includes(student1.id));
    assert.ok(!pendingIds.includes(student2.id));
  });

  test("6. Toggling event window status from monitor (Pause / Resume)", async () => {
    setTestSession({
      userId: coordinatorUser.id,
      name: "Coordinator Live",
      email: coordinatorUser.email,
      role: "COURSE_COORDINATOR",
      departmentId,
      programmeId,
    });

    // Pause
    const pauseRes = await toggleEventStatusFromMonitor(eventId, "PAUSED");
    assert.strictEqual(pauseRes.success, true);
    assert.strictEqual(pauseRes.newStatus, "PAUSED");

    const [pausedEvent] = await db
      .select({ status: registrationEvents.status })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId));
    assert.strictEqual(pausedEvent.status, "PAUSED");

    // Resume
    const resumeRes = await toggleEventStatusFromMonitor(eventId, "OPEN");
    assert.strictEqual(resumeRes.success, true);
    assert.strictEqual(resumeRes.newStatus, "OPEN");

    const [openEvent] = await db
      .select({ status: registrationEvents.status })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId));
    assert.strictEqual(openEvent.status, "OPEN");

    // Verify audit logs were written
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "LIVE_MONITOR_SET_STATUS_PAUSED"));
    assert.ok(logs.length >= 1, "Audit log must be recorded for live window pause");
  });

  after(async () => {
    setTestSession(null);
    setTestWorkspaceSession(undefined);
    if (eventId) {
      await db.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
      await db.delete(registrations).where(eq(registrations.eventId, eventId));
      await db.delete(replayEvents).where(eq(replayEvents.registrationEventId, eventId));
      await db.delete(eventSections).where(eq(eventSections.eventId, eventId));
      if (groupId) {
        await db.delete(electives).where(eq(electives.groupId, groupId));
        await db.delete(electiveGroups).where(eq(electiveGroups.id, groupId));
      }
      await db.delete(registrationEvents).where(eq(registrationEvents.id, eventId));
    }
    const testUserIds = [adminUser?.id, coordinatorUser?.id, tutorUser?.id, student1?.id, student2?.id, student3?.id].filter(Boolean);
    if (testUserIds.length > 0) {
      await db.delete(studentRegistrations).where(inArray(studentRegistrations.studentId, testUserIds));
      await db.delete(registrations).where(inArray(registrations.studentId, testUserIds));
      await db.delete(replayEvents).where(inArray(replayEvents.studentId, testUserIds));
      await db.delete(tutorSections).where(inArray(tutorSections.tutorId, testUserIds));
      await db.delete(auditLogs).where(inArray(auditLogs.userId, testUserIds));
      await db.delete(users).where(inArray(users.id, testUserIds));
    }
    const sectionIds = [section1Id, section2Id].filter(Boolean);
    if (sectionIds.length > 0) await db.delete(sections).where(inArray(sections.id, sectionIds));
    if (batchId) await db.delete(academicBatches).where(eq(academicBatches.id, batchId));
    if (programmeId) await db.delete(programmes).where(eq(programmes.id, programmeId));
    if (departmentId) await db.delete(departments).where(eq(departments.id, departmentId));
    if (facultyId) await db.delete(faculties).where(eq(faculties.id, facultyId));
  });
});
