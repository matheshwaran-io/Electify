import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
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
  auditLogs,
  tutorSections,
  cohortSessionTerms,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { setTestSession, getSession } from "@/lib/auth";
import { setTestWorkspaceSession } from "@/lib/workspace";
import { testAcademicSession } from "./helpers/world";
import {
  getLiveMonitorEvents,
  getLiveMonitoringData,
  getLiveFeedUpdates,
  toggleEventStatusFromMonitor,
} from "@/app/actions/monitor";
import { syncExpiredRegistrationEvents } from "@/lib/auto-close";
import {
  recordStudentPresence,
  getActiveStudentsForEvent,
  clearStudentPresence,
} from "@/lib/student-presence";
import { studentSSOLogin } from "@/app/actions/auth";

describe("Live Monitor Enhancements, Event Close Options & Student Single Session", () => {
  let facultyId: string;
  let departmentId: string;
  let programmeId: string;
  let batchId: string;
  let sectionId: string;
  let academicSessionId: string;

  let adminUser: { id: string; email: string };
  let coordinatorUser: { id: string; email: string };
  let tutorUser: { id: string; email: string };
  let student1: { id: string; email: string; registerNumber: string };
  let student2: { id: string; email: string; registerNumber: string };

  let activeEventId: string;
  let expiredEventId: string;
  let closedEventId: string;

  before(async () => {
    // 1. Fixtures: Faculty, Department, Programme, Batch, Section
    const [fac] = await db
      .insert(faculties)
      .values({
        name: `Faculty LME ${Date.now()}`,
        code: `FLME_${Date.now()}`,
      })
      .returning();
    facultyId = fac.id;

    const [dept] = await db
      .insert(departments)
      .values({
        facultyId,
        name: `Dept LME ${Date.now()}`,
        code: `DLME_${Date.now()}`,
      })
      .returning();
    departmentId = dept.id;

    const [prog] = await db
      .insert(programmes)
      .values({
        departmentId,
        name: `Programme LME ${Date.now()}`,
        code: `PLME_${Date.now()}`,
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

    const [sec] = await db
      .insert(sections)
      .values({
        label: "Section LME-A",
        academicBatchId: batchId,
      })
      .returning();
    sectionId = sec.id;

    const academicSession = await testAcademicSession();
    academicSessionId = academicSession.id;
    await db.insert(cohortSessionTerms).values({
      academicBatchId: batchId,
      academicSessionId: academicSession.id,
      studyYear: 1,
      confirmed: true,
    });
    setTestWorkspaceSession(academicSession.id);

    // 2. Users
    const [adm] = await db
      .insert(users)
      .values({
        email: `admin_lme_${Date.now()}@srmist.edu.in`,
        name: "Admin LME",
        role: "SYSTEM_ADMIN",
        passwordHash: "hash",
        isActive: true,
      })
      .returning();
    adminUser = { id: adm.id, email: adm.email };

    const [coord] = await db
      .insert(users)
      .values({
        email: `coord_lme_${Date.now()}@srmist.edu.in`,
        name: "Coordinator LME",
        role: "COURSE_COORDINATOR",
        departmentId,
        programmeId,
        passwordHash: "hash",
        isActive: true,
      })
      .returning();
    coordinatorUser = { id: coord.id, email: coord.email };

    const [tut] = await db
      .insert(users)
      .values({
        email: `tutor_lme_${Date.now()}@srmist.edu.in`,
        name: "Tutor LME",
        role: "CLASS_TUTOR",
        departmentId,
        sectionId,
        passwordHash: "hash",
        isActive: true,
      })
      .returning();
    tutorUser = { id: tut.id, email: tut.email };

    await db.insert(tutorSections).values({
      tutorId: tutorUser.id,
      sectionId,
    });

    const regPrefix = `RA${Math.floor(100000 + Math.random() * 900000)}`;

    const [s1] = await db
      .insert(users)
      .values({
        email: `s1_${Date.now()}@srmist.edu.in`,
        name: "Student One",
        role: "STUDENT",
        registerNumber: `${regPrefix}1`,
        sectionId,
        passwordHash: "hash",
        isActive: true,
      })
      .returning();
    student1 = { id: s1.id, email: s1.email, registerNumber: s1.registerNumber! };

    const [s2] = await db
      .insert(users)
      .values({
        email: `s2_${Date.now()}@srmist.edu.in`,
        name: "Student Two",
        role: "STUDENT",
        registerNumber: `${regPrefix}2`,
        sectionId,
        passwordHash: "hash",
        isActive: true,
      })
      .returning();
    student2 = { id: s2.id, email: s2.email, registerNumber: s2.registerNumber! };

    // 3. Events:
    // Event 1: ACTIVE (status: OPEN)
    const [ev1] = await db
      .insert(registrationEvents)
      .values({
        name: `Active Event ${Date.now()}`,
        academicBatchId: batchId,
        academicSessionId: academicSession.id,
        status: "OPEN",
        openDate: new Date(Date.now() - 3600000),
        closeDate: new Date(Date.now() + 3600000),
        autoClose: true,
        createdById: coordinatorUser.id,
      })
      .returning();
    activeEventId = ev1.id;

    // Event 2: EXPIRED (status: OPEN, but closeDate in the past, autoClose: true)
    const [ev2] = await db
      .insert(registrationEvents)
      .values({
        name: `Expired Event ${Date.now()}`,
        academicBatchId: batchId,
        academicSessionId: academicSession.id,
        status: "OPEN",
        openDate: new Date(Date.now() - 7200000),
        closeDate: new Date(Date.now() - 60000), // 1 min ago
        autoClose: true,
        createdById: coordinatorUser.id,
      })
      .returning();
    expiredEventId = ev2.id;

    // Event 3: CLOSED (status: CLOSED)
    const [ev3] = await db
      .insert(registrationEvents)
      .values({
        name: `Closed Event ${Date.now()}`,
        academicBatchId: batchId,
        academicSessionId: academicSession.id,
        status: "CLOSED",
        openDate: new Date(Date.now() - 86400000),
        closeDate: new Date(Date.now() - 43200000),
        autoClose: true,
        createdById: coordinatorUser.id,
      })
      .returning();
    closedEventId = ev3.id;

    // Attach all 3 events to section
    for (const eid of [activeEventId, expiredEventId, closedEventId]) {
      await db.insert(eventSections).values({
        eventId: eid,
        sectionId,
        academicBatchId: batchId,
      });
    }
  });

  after(async () => {
    setTestSession(null);
    setTestWorkspaceSession(undefined);

    const eventIds = [activeEventId, expiredEventId, closedEventId].filter(Boolean);
    if (eventIds.length > 0) {
      await db.delete(eventSections).where(inArray(eventSections.eventId, eventIds));
      await db.delete(registrationEvents).where(inArray(registrationEvents.id, eventIds));
    }

    const userIds = [adminUser?.id, coordinatorUser?.id, tutorUser?.id, student1?.id, student2?.id].filter(Boolean);
    if (userIds.length > 0) {
      await db.delete(tutorSections).where(inArray(tutorSections.tutorId, userIds));
      await db.delete(auditLogs).where(inArray(auditLogs.userId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }

    if (batchId && academicSessionId) {
      await db.delete(cohortSessionTerms).where(eq(cohortSessionTerms.academicBatchId, batchId));
    }
    if (sectionId) await db.delete(sections).where(eq(sections.id, sectionId));
    if (batchId) await db.delete(academicBatches).where(eq(academicBatches.id, batchId));
    if (programmeId) await db.delete(programmes).where(eq(programmes.id, programmeId));
    if (departmentId) await db.delete(departments).where(eq(departments.id, departmentId));
    if (facultyId) await db.delete(faculties).where(eq(faculties.id, facultyId));
  });

  test("1. Admin, Course Coordinator, and Class Tutor can close the event", async () => {
    // A) Admin closes the event
    setTestSession({
      userId: adminUser.id,
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
      name: "Admin LME",
    });
    setTestWorkspaceSession(academicSessionId);

    const adminClose = await toggleEventStatusFromMonitor(activeEventId, "CLOSED");
    assert.strictEqual(adminClose.success, true);
    assert.strictEqual(adminClose.newStatus, "CLOSED");

    let [ev] = await db.select({ status: registrationEvents.status }).from(registrationEvents).where(eq(registrationEvents.id, activeEventId));
    assert.strictEqual(ev.status, "CLOSED");

    // Reopen by Admin
    await toggleEventStatusFromMonitor(activeEventId, "OPEN");

    // B) Course Coordinator closes the event
    setTestSession({
      userId: coordinatorUser.id,
      email: coordinatorUser.email,
      role: "COURSE_COORDINATOR",
      name: "Coordinator LME",
      departmentId,
      programmeId,
    });
    setTestWorkspaceSession(academicSessionId);

    const coordClose = await toggleEventStatusFromMonitor(activeEventId, "CLOSED");
    assert.strictEqual(coordClose.success, true);
    assert.strictEqual(coordClose.newStatus, "CLOSED");

    [ev] = await db.select({ status: registrationEvents.status }).from(registrationEvents).where(eq(registrationEvents.id, activeEventId));
    assert.strictEqual(ev.status, "CLOSED");

    // Reopen by Coordinator
    await toggleEventStatusFromMonitor(activeEventId, "OPEN");

    // C) Class Tutor closes the event
    setTestSession({
      userId: tutorUser.id,
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      name: "Tutor LME",
      departmentId,
      sectionId,
    });
    setTestWorkspaceSession(academicSessionId);

    const tutorClose = await toggleEventStatusFromMonitor(activeEventId, "CLOSED");
    assert.strictEqual(tutorClose.success, true);
    assert.strictEqual(tutorClose.newStatus, "CLOSED");

    [ev] = await db.select({ status: registrationEvents.status }).from(registrationEvents).where(eq(registrationEvents.id, activeEventId));
    assert.strictEqual(ev.status, "CLOSED");

    // Restore active event to OPEN for subsequent tests
    await db.update(registrationEvents).set({ status: "OPEN" }).where(eq(registrationEvents.id, activeEventId));
  });

  test("2. Auto-close cleanly flips elapsed event to CLOSED and logs audit entry", async () => {
    let [expEv] = await db.select({ status: registrationEvents.status }).from(registrationEvents).where(eq(registrationEvents.id, expiredEventId));
    assert.strictEqual(expEv.status, "OPEN");

    const closedCount = await syncExpiredRegistrationEvents();
    assert.ok(closedCount >= 1, "Should have synced at least 1 expired event");

    [expEv] = await db.select({ status: registrationEvents.status }).from(registrationEvents).where(eq(registrationEvents.id, expiredEventId));
    assert.strictEqual(expEv.status, "CLOSED");

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, "AUTO_CLOSE_DEADLINE_ELAPSED"));
    assert.ok(logs.length >= 1, "Must have an audit log for auto close");
  });

  test("3. Live Monitor switcher strictly excludes CLOSED events, showing only active events", async () => {
    setTestSession({
      userId: adminUser.id,
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
      name: "Admin LME",
    });
    setTestWorkspaceSession(academicSessionId);

    const monitorEvents = await getLiveMonitorEvents();
    assert.strictEqual(monitorEvents.success, true);
    assert.ok(monitorEvents.data, "Must return data array");

    const returnedIds = monitorEvents.data.map((e) => e.id);
    assert.ok(returnedIds.includes(activeEventId), "Active event should be listed");
    assert.ok(!returnedIds.includes(closedEventId), "Closed event must not be in monitor switcher");
    assert.ok(!returnedIds.includes(expiredEventId), "Expired closed event must not be in monitor switcher");
  });

  test("4. Real-time active student presence is visible before event (COUNTDOWN) and during event (IN_SELECTION)", async () => {
    clearStudentPresence(activeEventId);

    // Student 1 connects before event (COUNTDOWN)
    recordStudentPresence({
      eventId: activeEventId,
      studentId: student1.id,
      name: "Student One",
      registerNumber: student1.registerNumber,
      sectionName: "Section LME-A",
      stage: "COUNTDOWN",
    });

    let presence = getActiveStudentsForEvent(activeEventId);
    assert.strictEqual(presence.activeCount, 1);
    assert.strictEqual(presence.countdownCount, 1);
    assert.strictEqual(presence.inSelectionCount, 0);
    assert.strictEqual(presence.students[0].name, "Student One");
    assert.strictEqual(presence.students[0].stage, "COUNTDOWN");

    // Student 2 connects during event (IN_SELECTION)
    recordStudentPresence({
      eventId: activeEventId,
      studentId: student2.id,
      name: "Student Two",
      registerNumber: student2.registerNumber,
      sectionName: "Section LME-A",
      stage: "IN_SELECTION",
    });

    presence = getActiveStudentsForEvent(activeEventId);
    assert.strictEqual(presence.activeCount, 2);
    assert.strictEqual(presence.countdownCount, 1);
    assert.strictEqual(presence.inSelectionCount, 1);

    // Live Monitoring Data returns the presence
    setTestSession({
      userId: adminUser.id,
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
      name: "Admin LME",
    });
    setTestWorkspaceSession(academicSessionId);

    const liveData = await getLiveMonitoringData(activeEventId);
    assert.strictEqual(liveData.success, true);
    assert.strictEqual(liveData.data?.activeCount, 2);
    assert.strictEqual(liveData.data?.countdownCount, 1);
    assert.strictEqual(liveData.data?.inSelectionCount, 1);

    // Live Feed Updates returns the presence
    const feedUpdates = await getLiveFeedUpdates(activeEventId);
    assert.strictEqual(feedUpdates.success, true);
    assert.strictEqual(feedUpdates.data?.activeCount, 2);
    assert.strictEqual(feedUpdates.data?.countdownCount, 1);
    assert.strictEqual(feedUpdates.data?.inSelectionCount, 1);
  });

  test("5. Student SSO login works and strictly restricts multiple concurrent logins", async () => {
    // A) Student SSO login
    const ssoRes = await studentSSOLogin({ registerNumber: student1.registerNumber });
    assert.strictEqual(ssoRes.success, true);
    assert.strictEqual(ssoRes.role, "STUDENT");

    const [userRow1] = await db
      .select({ currentSessionId: users.currentSessionId })
      .from(users)
      .where(eq(users.id, student1.id));
    assert.ok(userRow1.currentSessionId, "Student must have a currentSessionId");
    const firstSessionId = userRow1.currentSessionId;

    // B) Student signs in a second time (e.g. from another device or tab)
    const secondSSORes = await studentSSOLogin({ registerNumber: student1.registerNumber });
    assert.strictEqual(secondSSORes.success, true);

    const [userRow2] = await db
      .select({ currentSessionId: users.currentSessionId })
      .from(users)
      .where(eq(users.id, student1.id));
    assert.notStrictEqual(userRow2.currentSessionId, firstSessionId, "Second login must assign a new distinct sessionId");

    // C) Validating with the first session's sessionId must be rejected
    const staleTestSession = {
      userId: student1.id,
      email: student1.email,
      role: "STUDENT" as const,
      name: "Student One",
      registerNumber: student1.registerNumber,
      sessionId: firstSessionId,
    };
    setTestSession(staleTestSession);

    const validated = await getSession();
    assert.strictEqual(validated, null, "First session must be revoked when a new concurrent session is created");
  });
});
