import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  academicSessions,
  auditLogs,
  cohortSessionTerms,
  departments,
  faculties,
  programmes,
  registrationEvents,
  sections,
  tutorSections,
  users,
} from "@/lib/db/schema";
import { setTestSession } from "@/lib/auth";
import { setTestWorkspaceSession } from "@/lib/workspace";
import {
  createYearServer,
  deleteEmptyYearServers,
  deleteYearServer,
  getHistoricalReviewReport,
  getYearServerDeleteImpact,
  getYearServerWorkspaceDetails,
  getYearServersOverview,
  linkHistoricalEventToYearServer,
  setYearServerStatus,
} from "@/app/actions/year-servers";

describe("Year Servers System — Simplified Annual Workspaces", () => {
  const tag = randomUUID().slice(0, 8);
  let adminUser: { id: string; role: "SYSTEM_ADMIN" };
  let tutorUser: { id: string; role: "CLASS_TUTOR" };
  let coordUser: { id: string; role: "COURSE_COORDINATOR"; programmeId: string };
  let mcaProgrammeId: string;
  let mscProgrammeId: string;
  let batch2025Id: string;
  let batch2026Id: string;
  let section2025FId: string;
  let section2026FId: string;
  let section2026GId: string;
  let session2025Id: string;
  let session2026Id: string;

  before(async () => {
    // 1. Setup Admin
    const [admin] = await db
      .insert(users)
      .values({
        name: `Admin ${tag}`,
        email: `admin_${tag}@srmist.edu.in`,
        role: "SYSTEM_ADMIN",
        passwordHash: "dummy",
      })
      .returning();
    adminUser = { id: admin.id, role: "SYSTEM_ADMIN" };

    // 2. Setup Hierarchy
    const [fac] = await db.insert(faculties).values({ name: `Fac ${tag}`, code: `F_${tag}` }).returning();
    const [dept] = await db.insert(departments).values({ name: `Dept ${tag}`, code: `D_${tag}`, facultyId: fac.id }).returning();
    const [mca] = await db.insert(programmes).values({ name: `MCA ${tag}`, code: `MCA_${tag}`, departmentId: dept.id, durationYears: 2 }).returning();
    const [msc] = await db.insert(programmes).values({ name: `MSc IT ${tag}`, code: `MSC_${tag}`, departmentId: dept.id, durationYears: 2 }).returning();
    mcaProgrammeId = mca.id;
    mscProgrammeId = msc.id;

    // 3. Batches for 2025 and 2026
    const [b2025] = await db.insert(academicBatches).values({ year: `2025_${tag}`, programmeId: mca.id, admissionYear: 2025, expectedEndYear: 2027, datesConfirmed: true }).returning();
    const [b2026] = await db.insert(academicBatches).values({ year: `2026_${tag}`, programmeId: mca.id, admissionYear: 2026, expectedEndYear: 2028, datesConfirmed: true }).returning();
    batch2025Id = b2025.id;
    batch2026Id = b2026.id;

    // 4. Classes: Section F in 2025, Section F and Section G in 2026
    const [s25F] = await db.insert(sections).values({ label: "F", academicBatchId: b2025.id }).returning();
    const [s26F] = await db.insert(sections).values({ label: "F", academicBatchId: b2026.id }).returning();
    const [s26G] = await db.insert(sections).values({ label: "G", academicBatchId: b2026.id }).returning();
    section2025FId = s25F.id;
    section2026FId = s26F.id;
    section2026GId = s26G.id;

    // 5. Year Server sessions 2025 and 2026
    const [s2025] = await db.select().from(academicSessions).where(eq(academicSessions.startYear, 2025)).limit(1);
    if (s2025) {
      session2025Id = s2025.id;
    } else {
      const [created] = await db.insert(academicSessions).values({ startYear: 2025, endYear: 2026, status: "ACTIVE" }).returning();
      session2025Id = created.id;
    }

    const [s2026] = await db.select().from(academicSessions).where(eq(academicSessions.startYear, 2026)).limit(1);
    session2026Id = s2026.id;

    // Link batches to sessions
    await db.insert(cohortSessionTerms).values([
      { academicBatchId: b2025.id, academicSessionId: session2025Id, studyYear: 1, confirmed: true },
      { academicBatchId: b2026.id, academicSessionId: session2026Id, studyYear: 1, confirmed: true },
    ]).onConflictDoNothing();

    // 6. Setup Tutor assigned to BOTH 2025 Section F AND 2026 Section F
    const [tutor] = await db
      .insert(users)
      .values({
        name: `Tutor ${tag}`,
        email: `tutor_${tag}@srmist.edu.in`,
        role: "CLASS_TUTOR",
        passwordHash: "dummy",
      })
      .returning();
    tutorUser = { id: tutor.id, role: "CLASS_TUTOR" };

    await db.insert(tutorSections).values([
      { tutorId: tutor.id, sectionId: s25F.id },
      { tutorId: tutor.id, sectionId: s26F.id },
    ]);

    // 7. Setup Coordinator for MCA
    const [coord] = await db
      .insert(users)
      .values({
        name: `Coordinator ${tag}`,
        email: `coord_${tag}@srmist.edu.in`,
        role: "COURSE_COORDINATOR",
        programmeId: mca.id,
        departmentId: dept.id,
        passwordHash: "dummy",
      })
      .returning();
    coordUser = { id: coord.id, role: "COURSE_COORDINATOR", programmeId: mca.id };
  });

  after(async () => {
    setTestSession(null);
    setTestWorkspaceSession(undefined);

    // 1. Clean up test events
    await db.delete(registrationEvents).where(or(
      eq(registrationEvents.createdById, adminUser.id),
      inArray(registrationEvents.academicBatchId, [batch2025Id, batch2026Id])
    ));

    // 2. Unlink any academic sessions created by this admin user so user can be deleted
    await db.update(academicSessions).set({ createdById: null }).where(eq(academicSessions.createdById, adminUser.id));

    // Clean up any test Year Servers created during test runs (e.g. currentYear + 1 or + 2)
    const currentYear = new Date().getFullYear();
    const testSessions = await db.select({ id: academicSessions.id }).from(academicSessions).where(inArray(academicSessions.startYear, [currentYear + 1, currentYear + 2]));
    if (testSessions.length > 0) {
      await db.delete(cohortSessionTerms).where(inArray(cohortSessionTerms.academicSessionId, testSessions.map((s) => s.id)));
      await db.delete(academicSessions).where(inArray(academicSessions.id, testSessions.map((s) => s.id)));
    }

    // 3. Clean up tutor assignments, audit logs, and test users
    await db.delete(tutorSections).where(eq(tutorSections.tutorId, tutorUser.id));
    await db.delete(auditLogs).where(inArray(auditLogs.userId, [adminUser.id, tutorUser.id, coordUser.id]));
    await db.delete(users).where(inArray(users.id, [adminUser.id, tutorUser.id, coordUser.id]));

    // 4. Clean up test sections & batches
    await db.delete(cohortSessionTerms).where(inArray(cohortSessionTerms.academicBatchId, [batch2025Id, batch2026Id]));
    await db.delete(sections).where(inArray(sections.id, [section2025FId, section2026FId, section2026GId]));
    await db.delete(academicBatches).where(inArray(academicBatches.id, [batch2025Id, batch2026Id]));

    // 5. Clean up test programmes, departments, faculties
    await db.delete(programmes).where(inArray(programmes.id, [mcaProgrammeId, mscProgrammeId]));
    await db.delete(departments).where(eq(departments.code, `D_${tag}`));
    await db.delete(faculties).where(eq(faculties.code, `F_${tag}`));
  });

  const asAdmin = () => {
    setTestSession({
      userId: adminUser.id,
      name: "Admin",
      email: `admin_${tag}@srmist.edu.in`,
      role: "SYSTEM_ADMIN",
    });
    setTestWorkspaceSession(undefined);
  };

  const asTutor = (sessionId: string) => {
    setTestSession({
      userId: tutorUser.id,
      name: "Tutor",
      email: `tutor_${tag}@srmist.edu.in`,
      role: "CLASS_TUTOR",
    });
    setTestWorkspaceSession(sessionId);
  };

  test("1. Year Servers overview returns simple cards with programme, class, student, and event counts", async () => {
    asAdmin();
    const res = await getYearServersOverview();
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.isAdmin, true);
    assert.ok(res.servers.length >= 2, "Expected at least 2 Year Servers (2025, 2026)");

    const server2025 = res.servers.find((s) => s.year === 2025);
    const server2026 = res.servers.find((s) => s.year === 2026);
    assert.ok(server2025, "2025 Year Server card should exist");
    assert.ok(server2026, "2026 Year Server card should exist");

    assert.strictEqual(server2025.label, "2025 Year Server");
    assert.strictEqual(server2026.label, "2026 Year Server");
    assert.strictEqual(typeof server2025.programmeCount, "number");
    assert.strictEqual(typeof server2025.classCount, "number");
    assert.strictEqual(typeof server2025.studentCount, "number");
    assert.strictEqual(typeof server2025.eventCount, "number");
  });

  test("2. Admin can create a new Year Server with status PLANNED or ACTIVE", async () => {
    asAdmin();
    const currentYear = new Date().getFullYear();
    const testYear = currentYear + 1; // within max 2 years
    await db.delete(academicSessions).where(eq(academicSessions.startYear, testYear));
    const res = await createYearServer({ year: testYear, status: "PLANNED" });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.year, testYear);

    // Verify it is returned in overview
    const overview = await getYearServersOverview();
    assert.strictEqual(overview.success, true);
    if (!overview.success) return;

    const created = overview.servers.find((s) => s.year === testYear);
    assert.ok(created, "Newly created Year Server should appear in overview");
    assert.strictEqual(created.status, "PLANNED");

    // Creating duplicate year is rejected
    const dupRes = await createYearServer({ year: testYear });
    assert.strictEqual(dupRes.success, false);
    assert.ok(dupRes.error.includes("already exists"));

    // Planning more than 2 years in advance is rejected (locked)
    const futureRes = await createYearServer({ year: currentYear + 3 });
    assert.strictEqual(futureRes.success, false);
    assert.ok(futureRes.error.includes("maximum of 2 years in advance"));

    // Activate the server
    const activateRes = await setYearServerStatus(res.id, "ACTIVE");
    assert.strictEqual(activateRes.success, true);
  });

  test("3. Staff can enter a Year Server workspace and view its programmes and classes", async () => {
    asAdmin();
    const details = await getYearServerWorkspaceDetails(2026);
    assert.strictEqual(details.success, true);
    if (!details.success) return;

    assert.strictEqual(details.year, 2026);
    assert.strictEqual(details.title, "2026 Year Server");
    assert.ok(details.metrics.programmesCount > 0);
    assert.ok(details.metrics.classesCount > 0);

    // Verify MCA programme exists and contains both Section F and Section G
    const mcaProg = details.programmes.find((p) => p.programmeId === mcaProgrammeId);
    assert.ok(mcaProg, "MCA programme should be present in 2026 Year Server");
    const sectionLabels = mcaProg.classes.map((c) => c.sectionLabel);
    assert.ok(sectionLabels.includes("F"));
    assert.ok(sectionLabels.includes("G"));
  });

  test("4. One tutor account can manage classes in multiple Year Servers with scoped access", async () => {
    // In 2025 Year Server: Tutor only has MCA Section F · 2025
    asTutor(session2025Id);
    const details2025 = await getYearServerWorkspaceDetails(2025);
    assert.strictEqual(details2025.success, true);
    if (!details2025.success) return;

    const mca2025 = details2025.programmes.find((p) => p.programmeId === mcaProgrammeId);
    assert.ok(mca2025);
    assert.strictEqual(mca2025.classes.length, 1);
    assert.strictEqual(mca2025.classes[0].sectionId, section2025FId);
    assert.ok(mca2025.classes[0].classLabel.includes("2025"));

    // In 2026 Year Server: Tutor only has MCA Section F · 2026 (Section G was NOT assigned to this tutor)
    asTutor(session2026Id);
    const details2026 = await getYearServerWorkspaceDetails(2026);
    assert.strictEqual(details2026.success, true);
    if (!details2026.success) return;

    const mca2026 = details2026.programmes.find((p) => p.programmeId === mcaProgrammeId);
    assert.ok(mca2026);
    assert.strictEqual(mca2026.classes.length, 1);
    assert.strictEqual(mca2026.classes[0].sectionId, section2026FId);
    assert.ok(mca2026.classes[0].classLabel.includes("2026"));
  });

  test("5. Historical data review report tracks unlinked events and enables administrator linking", async () => {
    asAdmin();
    // Create an unlinked historical event
    const [histEvent] = await db
      .insert(registrationEvents)
      .values({
        name: `Historical Audit Event ${tag}`,
        academicBatchId: batch2026Id,
        academicSessionId: null, // intentionally unlinked
        academicYear: "2026-2028",
        status: "DRAFT",
        createdById: adminUser.id,
      })
      .returning();

    const report = await getHistoricalReviewReport();
    assert.strictEqual(report.success, true);
    if (!report.success) return;

    const found = report.unlinkedEvents.find((e) => e.id === histEvent.id);
    assert.ok(found, "Historical unlinked event should appear in review report");

    // Link it to 2026 Year Server
    const linkRes = await linkHistoricalEventToYearServer(histEvent.id, session2026Id);
    assert.strictEqual(linkRes.success, true);

    // Verify it is now resolved
    const [linked] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, histEvent.id));
    assert.strictEqual(linked.academicSessionId, session2026Id);
  });

  test("6. getYearServerDeleteImpact calculates accurate impact metrics", async () => {
    asAdmin();
    const impact2026 = await getYearServerDeleteImpact(session2026Id);
    assert.strictEqual(impact2026.success, true);
    if (!impact2026.success) return;

    assert.strictEqual(impact2026.year, 2026);
    assert.strictEqual(impact2026.label, "2026 Year Server");
    assert.ok(impact2026.programmeCount > 0);
    assert.ok(impact2026.classCount > 0);
    assert.strictEqual(impact2026.isEmpty, false);
  });

  test("7. deleteYearServer deletes a Year Server and unlinks attached events without data loss", async () => {
    asAdmin();
    // Create a temporary Year Server to test deletion (within 2-year planning window)
    const currentYear = new Date().getFullYear();
    const testYear = currentYear + 2;
    await db.delete(academicSessions).where(eq(academicSessions.startYear, testYear));
    const created = await createYearServer({ year: testYear });
    assert.strictEqual(created.success, true);
    if (!created.success) return;

    // Attach an event to this server
    const [ev] = await db
      .insert(registrationEvents)
      .values({
        name: `Temporary Event ${tag}`,
        academicBatchId: batch2026Id,
        academicSessionId: created.id,
        status: "DRAFT",
        createdById: adminUser.id,
      })
      .returning();

    // Check impact before deletion
    const impact = await getYearServerDeleteImpact(created.id);
    assert.strictEqual(impact.success, true);
    if (!impact.success) return;
    assert.strictEqual(impact.eventCount, 1);

    // Delete the server
    const delRes = await deleteYearServer(created.id);
    assert.strictEqual(delRes.success, true);
    if (!delRes.success) return;
    assert.strictEqual(delRes.deletedYear, testYear);

    // Confirm the academic_session record is removed
    const [checkSession] = await db.select().from(academicSessions).where(eq(academicSessions.id, created.id));
    assert.strictEqual(checkSession, undefined);

    // Confirm the event was NOT deleted, but safely unlinked (academicSessionId = null)
    const [checkEvent] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, ev.id));
    assert.ok(checkEvent, "Event should remain preserved in database");
    assert.strictEqual(checkEvent.academicSessionId, null, "Event should be safely unlinked");

    // Clean up temporary event
    await db.delete(registrationEvents).where(eq(registrationEvents.id, ev.id));
  });

  test("8. Non-administrators cannot delete a Year Server", async () => {
    asTutor(session2026Id);
    const delRes = await deleteYearServer(session2026Id);
    assert.strictEqual(delRes.success, false);
    assert.ok(delRes.error.toLowerCase().includes("only an administrator") || delRes.error.toLowerCase().includes("unauthorized"));
  });

  test("9. deleteEmptyYearServers safely prunes empty test servers", async () => {
    asAdmin();
    const currentYear = new Date().getFullYear();
    const pruneYear = currentYear + 2;
    await db.delete(academicSessions).where(eq(academicSessions.startYear, pruneYear));
    const created = await createYearServer({ year: pruneYear });
    assert.strictEqual(created.success, true);

    const pruneRes = await deleteEmptyYearServers();
    assert.strictEqual(pruneRes.success, true);
    if (!pruneRes.success) return;

    assert.ok(pruneRes.deletedYears.includes(pruneYear), "Pruned years should include the empty server");

    const [check] = await db.select().from(academicSessions).where(eq(academicSessions.startYear, pruneYear));
    assert.strictEqual(check, undefined);
  });
});
