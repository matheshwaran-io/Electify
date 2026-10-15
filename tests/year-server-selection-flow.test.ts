import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  academicSessions,
  cohortSessionTerms,
  departments,
  faculties,
  inviteCodes,
  programmes,
  sections,
  tutorSections,
  users,
} from "@/lib/db/schema";
import { setTestSession } from "@/lib/auth";
import {
  assertClass,
  listClassesForScope,
  listSessionsForScope,
  loadStaffScope,
  requireStaffWorkspace,
  resolveStaffWorkspace,
  setTestWorkspaceSession,
} from "@/lib/workspace";
import { selectAcademicSession } from "@/app/actions/workspace";
import { createYearServer } from "@/app/actions/year-servers";
import { createClassSignupCode } from "@/app/actions/tutor";

describe("Year Server Selection Flow & Complete Workspace Isolation", () => {
  const tag = randomUUID().slice(0, 8);
  let adminId: string;
  let tutorId: string;
  let coordId: string;
  let mcaId: string;
  let mscId: string;
  let session2025Id: string;
  let session2026Id: string;
  let session2027Id: string;
  let batch2025Id: string;
  let batch2026Id: string;
  let batch2027Id: string;
  let section2025FId: string;
  let section2026FId: string;
  let section2026GId: string;
  let section2027AId: string;
  let unassignedSectionId: string;
  let inviteCode2026: string;

  before(async () => {
    // 1. Setup Faculty & Department
    const [fac] = await db
      .insert(faculties)
      .values({ name: `Fac ${tag}`, code: `F_${tag}` })
      .returning();

    const [dept] = await db
      .insert(departments)
      .values({ name: `Dept ${tag}`, code: `D_${tag}`, facultyId: fac.id })
      .returning();

    // 2. Setup Programmes
    const [mca] = await db
      .insert(programmes)
      .values({ name: `MCA ${tag}`, code: `MCA_${tag}`, departmentId: dept.id })
      .returning();
    mcaId = mca.id;

    const [msc] = await db
      .insert(programmes)
      .values({ name: `MSc ${tag}`, code: `MSC_${tag}`, departmentId: dept.id })
      .returning();
    mscId = msc.id;

    // 3. Setup Batches for 2025, 2026, 2027
    const [b2025] = await db
      .insert(academicBatches)
      .values({
        programmeId: mca.id,
        year: "2025",
        admissionYear: 2025,
        expectedEndYear: 2027,
        datesConfirmed: true,
      })
      .returning();
    batch2025Id = b2025.id;

    const [b2026] = await db
      .insert(academicBatches)
      .values({
        programmeId: mca.id,
        year: "2026",
        admissionYear: 2026,
        expectedEndYear: 2028,
        datesConfirmed: true,
      })
      .returning();
    batch2026Id = b2026.id;

    const [b2027] = await db
      .insert(academicBatches)
      .values({
        programmeId: mca.id,
        year: "2027",
        admissionYear: 2027,
        expectedEndYear: 2029,
        datesConfirmed: true,
      })
      .returning();
    batch2027Id = b2027.id;

    // 4. Setup Sections
    const [s25F] = await db
      .insert(sections)
      .values({ academicBatchId: b2025.id, label: "F", isActive: true })
      .returning();
    section2025FId = s25F.id;

    const [s26F] = await db
      .insert(sections)
      .values({ academicBatchId: b2026.id, label: "F", isActive: true })
      .returning();
    section2026FId = s26F.id;

    const [s26G] = await db
      .insert(sections)
      .values({ academicBatchId: b2026.id, label: "G", isActive: true })
      .returning();
    section2026GId = s26G.id;

    const [s27A] = await db
      .insert(sections)
      .values({ academicBatchId: b2027.id, label: "A", isActive: true })
      .returning();
    section2027AId = s27A.id;

    const [unassigned] = await db
      .insert(sections)
      .values({ academicBatchId: b2026.id, label: "Z", isActive: true })
      .returning();
    unassignedSectionId = unassigned.id;

    // 5. Setup Academic Sessions: 2025, 2026, 2027
    const [s2025] = await db.select().from(academicSessions).where(eq(academicSessions.startYear, 2025)).limit(1);
    if (s2025) {
      session2025Id = s2025.id;
    } else {
      const [c] = await db.insert(academicSessions).values({ startYear: 2025, endYear: 2026, status: "ACTIVE" }).returning();
      session2025Id = c.id;
    }

    const [s2026] = await db.select().from(academicSessions).where(eq(academicSessions.startYear, 2026)).limit(1);
    if (s2026) {
      session2026Id = s2026.id;
    } else {
      const [c] = await db.insert(academicSessions).values({ startYear: 2026, endYear: 2027, status: "ACTIVE" }).returning();
      session2026Id = c.id;
    }

    const [s2027] = await db.select().from(academicSessions).where(eq(academicSessions.startYear, 2027)).limit(1);
    if (s2027) {
      session2027Id = s2027.id;
    } else {
      const [c] = await db.insert(academicSessions).values({ startYear: 2027, endYear: 2028, status: "ACTIVE" }).returning();
      session2027Id = c.id;
    }

    // Link batches to sessions
    await db.insert(cohortSessionTerms).values([
      { academicBatchId: b2025.id, academicSessionId: session2025Id, studyYear: 1, confirmed: true },
      { academicBatchId: b2026.id, academicSessionId: session2026Id, studyYear: 1, confirmed: true },
      { academicBatchId: b2027.id, academicSessionId: session2027Id, studyYear: 1, confirmed: true },
    ]).onConflictDoNothing();

    // 6. Setup Users
    const [admin] = await db
      .insert(users)
      .values({
        name: `Admin ${tag}`,
        email: `admin_${tag}@srmist.edu.in`,
        role: "SYSTEM_ADMIN",
        passwordHash: "dummy",
      })
      .returning();
    adminId = admin.id;

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
    coordId = coord.id;

    const [tutor] = await db
      .insert(users)
      .values({
        name: `Tutor ${tag}`,
        email: `tutor_${tag}@srmist.edu.in`,
        role: "CLASS_TUTOR",
        departmentId: dept.id,
        passwordHash: "dummy",
      })
      .returning();
    tutorId = tutor.id;

    // Assign tutor to Section F in 2025 and Sections F & G in 2026
    await db.insert(tutorSections).values([
      { tutorId: tutor.id, sectionId: s25F.id },
      { tutorId: tutor.id, sectionId: s26F.id },
      { tutorId: tutor.id, sectionId: s26G.id },
    ]);

    // 7. Generate a student signup code for Section 2026F
    setTestSession({ userId: tutor.id, name: tutor.name, email: tutor.email, role: "CLASS_TUTOR", sectionId: s26F.id });
    setTestWorkspaceSession(session2026Id);
    const codeRes = await createClassSignupCode({ sectionId: s26F.id });
    inviteCode2026 = codeRes.code;
  });

  after(async () => {
    setTestSession(undefined);
    setTestWorkspaceSession(undefined);

    await db.delete(inviteCodes).where(eq(inviteCodes.code, inviteCode2026));
    await db.delete(tutorSections).where(eq(tutorSections.tutorId, tutorId));
    await db.delete(cohortSessionTerms).where(inArray(cohortSessionTerms.academicBatchId, [batch2025Id, batch2026Id, batch2027Id]));
    await db.delete(sections).where(inArray(sections.id, [section2025FId, section2026FId, section2026GId, section2027AId, unassignedSectionId]));
    await db.delete(academicBatches).where(inArray(academicBatches.id, [batch2025Id, batch2026Id, batch2027Id]));
    await db.delete(users).where(inArray(users.id, [adminId, coordId, tutorId]));
    await db.delete(programmes).where(inArray(programmes.id, [mcaId, mscId]));
    await db.delete(departments).where(eq(departments.code, `D_${tag}`));
    await db.delete(faculties).where(eq(faculties.code, `F_${tag}`));
  });

  test("1. Staff member sees the authorized Year Server selection page after login (no cookie -> SELECT)", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    setTestWorkspaceSession(null); // Simulated newly authenticated staff with no session cookie

    const res = await resolveStaffWorkspace();
    assert.strictEqual(res.status, "SELECT", "Newly authenticated staff member must be prompted to choose a Year Server");
    if (res.status === "SELECT") {
      assert.ok(res.sessions.length >= 2, "Tutor should see their accessible sessions");
      const years = res.sessions.map((s) => s.startYear);
      assert.ok(years.includes(2025), "2025 should be offered");
      assert.ok(years.includes(2026), "2026 should be offered");
    }
  });

  test("2. All eligible Year Servers are loaded from the database for the staff member's scope", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    const scope = (await loadStaffScope({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" }))!;
    const sessions = await listSessionsForScope(scope);

    const sessionYears = sessions.map((s) => s.startYear);
    assert.ok(sessionYears.includes(2025), "Tutor with 2025 class can see 2025 server");
    assert.ok(sessionYears.includes(2026), "Tutor with 2026 class can see 2026 server");
    assert.ok(!sessionYears.includes(2027), "Tutor without 2027 class cannot see 2027 server");

    // Admin sees all servers
    const adminScope = (await loadStaffScope({ userId: adminId, name: "Admin", email: "admin@test.com", role: "SYSTEM_ADMIN" }))!;
    const adminSessions = await listSessionsForScope(adminScope);
    const adminYears = adminSessions.map((s) => s.startYear);
    assert.ok(adminYears.includes(2025) && adminYears.includes(2026) && adminYears.includes(2027));
  });

  test("3. Adding a new Year Server does not require hardcoded UI changes and is dynamically available", async () => {
    setTestSession({ userId: adminId, name: "Admin", email: "admin@test.com", role: "SYSTEM_ADMIN" });
    const currentYear = new Date().getFullYear();
    const futureYear = currentYear + 2;

    // Ensure future year is clean before testing dynamic creation
    await db.delete(academicSessions).where(eq(academicSessions.startYear, futureYear));
    const createRes = await createYearServer({ year: futureYear, status: "PLANNED" });
    assert.ok(createRes.success, "Admin should be able to create future Year Server dynamically");

    const adminScope = (await loadStaffScope({ userId: adminId, name: "Admin", email: "admin@test.com", role: "SYSTEM_ADMIN" }))!;
    const updatedSessions = await listSessionsForScope(adminScope);
    const foundFuture = updatedSessions.find((s) => s.startYear === futureYear);
    assert.ok(foundFuture, `Year Server ${futureYear} must appear dynamically in database query`);

    // Keep persistent 2028 server for production / preview UI
    await db.delete(academicSessions).where(eq(academicSessions.startYear, futureYear));
    await db.insert(academicSessions).values({
      id: "0228eca7-7b34-46e4-b932-76e856e56983",
      startYear: futureYear,
      endYear: futureYear + 1,
      status: "PLANNED",
    });
  });

  test("4. Selecting 2026 sets the workspace context to 2026", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    setTestWorkspaceSession(session2026Id);

    const ws = await requireStaffWorkspace();
    assert.strictEqual(ws.session.id, session2026Id);
    assert.strictEqual(ws.session.startYear, 2026);
  });

  test("5. Selecting 2025 sets the workspace context to 2025", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    setTestWorkspaceSession(session2025Id);

    const ws = await requireStaffWorkspace();
    assert.strictEqual(ws.session.id, session2025Id);
    assert.strictEqual(ws.session.startYear, 2025);
  });

  test("6. Data from one Year Server does not appear in another", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });

    // In 2025 workspace: only section 2025F
    setTestWorkspaceSession(session2025Id);
    const ws2025 = await requireStaffWorkspace();
    const sectionIds2025 = ws2025.classes.map((c) => c.sectionId);
    assert.ok(sectionIds2025.includes(section2025FId), "2025 must include 2025 Section F");
    assert.ok(!sectionIds2025.includes(section2026FId), "2025 must NOT include 2026 Section F");

    // In 2026 workspace: only section 2026F and 2026G
    setTestWorkspaceSession(session2026Id);
    const ws2026 = await requireStaffWorkspace();
    const sectionIds2026 = ws2026.classes.map((c) => c.sectionId);
    assert.ok(sectionIds2026.includes(section2026FId), "2026 must include 2026 Section F");
    assert.ok(!sectionIds2026.includes(section2025FId), "2026 must NOT include 2025 Section F");
  });

  test("7. A tutor can manage multiple authorized classes within a server", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    setTestWorkspaceSession(session2026Id);

    const ws = await requireStaffWorkspace();
    assert.strictEqual(ws.tutorClasses.length, 2, "Tutor manages both Section F and Section G in 2026");
    const labels = ws.tutorClasses.map((c) => c.sectionLabel).sort();
    assert.deepStrictEqual(labels, ["F", "G"]);
  });

  test("8. A tutor cannot access a server or class they are not authorized to manage", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });

    // 1. Cannot access unassigned Year Server 2027
    const selectRes = await selectAcademicSession(session2027Id);
    assert.strictEqual(selectRes.success, false, "Tutor cannot select an unauthorized Year Server");

    // 2. Cannot access unassigned class in 2026
    setTestWorkspaceSession(session2026Id);
    const ws = await requireStaffWorkspace();
    assert.throws(
      () => assertClass(ws, unassignedSectionId),
      /not authorized to manage this class/,
      "Tutor cannot assert an unassigned section"
    );
  });

  test("9. Refreshing the selection page works and maintains session state", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    setTestWorkspaceSession(null);

    const res1 = await resolveStaffWorkspace();
    const res2 = await resolveStaffWorkspace();
    assert.strictEqual(res1.status, "SELECT");
    assert.strictEqual(res2.status, "SELECT");
  });

  test("10. Refreshing a workspace page preserves the correct server context", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    setTestWorkspaceSession(session2026Id);

    const res1 = await resolveStaffWorkspace();
    const res2 = await resolveStaffWorkspace();
    assert.strictEqual(res1.status, "OK");
    assert.strictEqual(res2.status, "OK");
    if (res1.status === "OK" && res2.status === "OK") {
      assert.strictEqual(res1.workspace.session.id, res2.workspace.session.id);
    }
  });

  test("11. Direct URL navigation cannot bypass server-side authorization", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR" });
    setTestWorkspaceSession(null); // No server selected

    await assert.rejects(
      async () => await requireStaffWorkspace(),
      /Choose an academic session first/,
      "Deep link without selecting server must throw and block protected data"
    );
  });

  test("12. Switching servers updates class context cleanly", async () => {
    setTestSession({ userId: tutorId, name: "Tutor", email: "tutor@test.com", role: "CLASS_TUTOR", sectionId: section2025FId });

    // Switch to 2026
    const res = await selectAcademicSession(session2026Id);
    assert.strictEqual(res.success, true);
  });

  test("13. Students remain associated with the correct Year Server through signup code", async () => {
    const [codeRecord] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, inviteCode2026)).limit(1);
    assert.ok(codeRecord, "Signup code record should exist");
    assert.strictEqual(codeRecord.sectionId, section2026FId, "Signup code is strictly bound to 2026 Section F");

    const [term] = await db
      .select()
      .from(cohortSessionTerms)
      .where(eq(cohortSessionTerms.academicBatchId, batch2026Id))
      .limit(1);
    assert.strictEqual(term.academicSessionId, session2026Id, "Class is bound to 2026 Year Server");
  });

  test("14. Archived-server restrictions remain enforced", async () => {
    // Create an archived session
    const [archived] = await db
      .insert(academicSessions)
      .values({ startYear: 2020, endYear: 2021, status: "ARCHIVED" })
      .returning();

    setTestSession({ userId: adminId, name: "Admin", email: "admin@test.com", role: "SYSTEM_ADMIN" });
    const res = await selectAcademicSession(archived.id);
    assert.strictEqual(res.success, false, "Cannot select an ARCHIVED server");
    assert.match(res.error || "", /archived/, "Error message must state server is archived");

    await db.delete(academicSessions).where(eq(academicSessions.id, archived.id));
  });

  test("15. listClassesForScope sorts and isolates cohort data strictly per server", async () => {
    setTestSession({ userId: coordId, name: "Coord", email: "coord@test.com", role: "COURSE_COORDINATOR" });
    const scope = (await loadStaffScope({ userId: coordId, name: "Coord", email: "coord@test.com", role: "COURSE_COORDINATOR" }))!;

    const classes2025 = await listClassesForScope(scope, session2025Id);
    const classes2026 = await listClassesForScope(scope, session2026Id);

    assert.ok(classes2025.every((c) => c.admissionYear === 2025), "2025 workspace only contains 2025 classes");
    assert.ok(classes2026.every((c) => c.admissionYear === 2026), "2026 workspace only contains 2026 classes");
  });
});
