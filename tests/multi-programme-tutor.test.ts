import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  auditLogs,
  cohortSessionTerms,
  departments,
  faculties,
  inviteCodes,
  programmes,
  registrationEvents,
  sections,
  tutorSections,
  users,
} from "@/lib/db/schema";
import { setTestSession } from "@/lib/auth";
import {
  requireStaffWorkspace,
  setTestWorkspaceSession,
} from "@/lib/workspace";
import {
  claimTutorSection,
  createClassSignupCode,
  exitTutorSection,
  getAllAvailableSections,
  getMyAssignedSections,
  getSectionStudents,
  getMaxTutorSectionsLimit,
  updateMaxTutorSectionsLimit,
} from "@/app/actions/tutor";
import { registerStudentWithClassCode } from "@/app/actions/auth";
import { testAcademicSession } from "./helpers/world";

describe("Multi-Programme Class Tutor Assignments & Isolation", () => {
  const tag = randomUUID().slice(0, 8);

  type Staff = {
    id: string;
    role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR";
    departmentId?: string;
    programmeId?: string;
  };

  const ids = {} as Record<string, string>;
  let session2026: { id: string };
  let session2025: { id: string };
  let tutorAngel: Staff;
  let adminUser: Staff;

  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  const asStaff = (u: Staff, sessionId: string | null, sectionId?: string) => {
    setTestSession({
      userId: u.id,
      name: `Dr. ${u.id.slice(0, 5)}`,
      email: `tutor_${tag}@srmist.edu.in`,
      role: u.role,
      departmentId: u.departmentId,
      programmeId: u.programmeId,
      sectionId,
    });
    setTestWorkspaceSession(sessionId);
  };

  async function createUser(values: Partial<typeof users.$inferInsert> & { role: string; name: string }) {
    const [row] = await db
      .insert(users)
      .values({
        email: `${values.name.replace(/\W/g, "").toLowerCase()}_${tag}@srmist.edu.in`,
        passwordHash: "x",
        ...values,
      })
      .returning();
    createdUserIds.push(row.id);
    return row;
  }

  before(async () => {
    // 1. Academic Sessions (Year Servers)
    session2025 = await testAcademicSession(2025);
    session2026 = await testAcademicSession(2026);

    // 2. Faculties & Departments
    const [fac] = await db
      .insert(faculties)
      .values({ name: `School of Computing ${tag}`, code: `SOC_${tag}` })
      .returning();

    // Department of Computer Applications
    const [deptCA] = await db
      .insert(departments)
      .values({ name: `Department of Computer Applications ${tag}`, code: `DCA_${tag}`, facultyId: fac.id })
      .returning();

    // Foreign Department (Mechanical Engineering) to test authorization boundaries
    const [deptMech] = await db
      .insert(departments)
      .values({ name: `Department of Mechanical Engineering ${tag}`, code: `DME_${tag}`, facultyId: fac.id })
      .returning();

    // 3. Programmes
    // MCA (Computer Applications)
    const [progMCA] = await db
      .insert(programmes)
      .values({ name: `MCA ${tag}`, code: `MCA_${tag}`, departmentId: deptCA.id, degreeType: "PG", durationYears: 2 })
      .returning();

    // MSc IT (Computer Applications)
    const [progMScIT] = await db
      .insert(programmes)
      .values({ name: `MSc IT ${tag}`, code: `MSCIT_${tag}`, departmentId: deptCA.id, degreeType: "PG", durationYears: 2 })
      .returning();

    // B.Tech Mech (Foreign Department)
    const [progMech] = await db
      .insert(programmes)
      .values({ name: `BTech Mechanical ${tag}`, code: `MECH_${tag}`, departmentId: deptMech.id, degreeType: "UG", durationYears: 4 })
      .returning();

    // 4. Batches
    // MCA 2026 batch (2026-2028)
    const [batchMCA2026] = await db
      .insert(academicBatches)
      .values({ year: `2026_${tag}`, programmeId: progMCA.id, admissionYear: 2026, expectedEndYear: 2028, datesConfirmed: true })
      .returning();

    // MSc IT 2026 batch (2026-2028)
    const [batchMSc2026] = await db
      .insert(academicBatches)
      .values({ year: `2026_${tag}`, programmeId: progMScIT.id, admissionYear: 2026, expectedEndYear: 2028, datesConfirmed: true })
      .returning();

    // MCA 2025 batch (2025-2027)
    const [batchMCA2025] = await db
      .insert(academicBatches)
      .values({ year: `2025_${tag}`, programmeId: progMCA.id, admissionYear: 2025, expectedEndYear: 2027, datesConfirmed: true })
      .returning();

    // Mech 2026 batch (Foreign)
    const [batchMech2026] = await db
      .insert(academicBatches)
      .values({ year: `2026_${tag}`, programmeId: progMech.id, admissionYear: 2026, expectedEndYear: 2030, datesConfirmed: true })
      .returning();

    // 5. Sections
    // MCA 2026 Section F
    const [secMCA2026F] = await db.insert(sections).values({ label: "F", academicBatchId: batchMCA2026.id }).returning();
    // MSc IT 2026 Section F (Same label 'F', same year 2026, DIFFERENT programme)
    const [secMSc2026F] = await db.insert(sections).values({ label: "F", academicBatchId: batchMSc2026.id }).returning();
    // MCA 2025 Section A (Different batch 2025, label 'A')
    const [secMCA2025A] = await db.insert(sections).values({ label: "A", academicBatchId: batchMCA2025.id }).returning();
    // Mech 2026 Section M (Foreign)
    const [secMech2026M] = await db.insert(sections).values({ label: "M", academicBatchId: batchMech2026.id }).returning();

    // 6. Year Server Enrolments (Cohort Session Terms)
    // 2026 Year Server: MCA 2026 (Year 1 Sem 1), MSc IT 2026 (Year 1 Sem 1), MCA 2025 (Year 2 Sem 3)
    await db.insert(cohortSessionTerms).values([
      { academicBatchId: batchMCA2026.id, academicSessionId: session2026.id, studyYear: 1, currentSemester: 1, confirmed: true },
      { academicBatchId: batchMSc2026.id, academicSessionId: session2026.id, studyYear: 1, currentSemester: 1, confirmed: true },
      { academicBatchId: batchMCA2025.id, academicSessionId: session2026.id, studyYear: 2, currentSemester: 3, confirmed: true },
      // 2025 Year Server: MCA 2025 (Year 1 Sem 1)
      { academicBatchId: batchMCA2025.id, academicSessionId: session2025.id, studyYear: 1, currentSemester: 1, confirmed: true },
    ]);

    // 7. Staff Accounts
    // One Class Tutor in Department of Computer Applications
    const tutorRow = await createUser({
      name: `Dr. Angel ${tag}`,
      role: "CLASS_TUTOR",
      departmentId: deptCA.id,
      programmeId: progMCA.id,
    });
    tutorAngel = { id: tutorRow.id, role: "CLASS_TUTOR", departmentId: deptCA.id, programmeId: progMCA.id };

    const adminRow = await createUser({
      name: `Admin Master ${tag}`,
      role: "SYSTEM_ADMIN",
    });
    adminUser = { id: adminRow.id, role: "SYSTEM_ADMIN" };

    // 8. Students in each section
    // MCA 2026 F students
    const mcaStudent1 = await createUser({
      name: `MCA Student 1 ${tag}`,
      role: "STUDENT",
      registerNumber: `RA_MCA_${tag}_1`,
      sectionId: secMCA2026F.id,
      academicBatchId: batchMCA2026.id,
      programmeId: progMCA.id,
      departmentId: deptCA.id,
    });

    // MSc IT 2026 F students
    const mscStudent1 = await createUser({
      name: `MSc Student 1 ${tag}`,
      role: "STUDENT",
      registerNumber: `RA_MSC_${tag}_1`,
      sectionId: secMSc2026F.id,
      academicBatchId: batchMSc2026.id,
      programmeId: progMScIT.id,
      departmentId: deptCA.id,
    });

    Object.assign(ids, {
      fac: fac.id,
      deptCA: deptCA.id,
      deptMech: deptMech.id,
      progMCA: progMCA.id,
      progMScIT: progMScIT.id,
      progMech: progMech.id,
      batchMCA2026: batchMCA2026.id,
      batchMSc2026: batchMSc2026.id,
      batchMCA2025: batchMCA2025.id,
      batchMech2026: batchMech2026.id,
      secMCA2026F: secMCA2026F.id,
      secMSc2026F: secMSc2026F.id,
      secMCA2025A: secMCA2025A.id,
      secMech2026M: secMech2026M.id,
      mcaStudent1: mcaStudent1.id,
      mscStudent1: mscStudent1.id,
    });
  });

  after(async () => {
    setTestSession(undefined);
    setTestWorkspaceSession(undefined);

    if (createdEventIds.length > 0) {
      await db.delete(registrationEvents).where(inArray(registrationEvents.id, createdEventIds));
    }
    if (tutorAngel?.id) {
      await db.delete(inviteCodes).where(eq(inviteCodes.createdById, tutorAngel.id));
    }
    if (ids.secMSc2026F) {
      await db.delete(inviteCodes).where(inArray(inviteCodes.sectionId, [ids.secMCA2026F, ids.secMSc2026F, ids.secMCA2025A]));
    }
    if (createdUserIds.length > 0) {
      await db.delete(tutorSections).where(inArray(tutorSections.tutorId, createdUserIds));
      await db.delete(auditLogs).where(inArray(auditLogs.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (ids.secMCA2026F) {
      await db.delete(tutorSections).where(inArray(tutorSections.sectionId, [ids.secMCA2026F, ids.secMSc2026F, ids.secMCA2025A, ids.secMech2026M]));
      await db.delete(sections).where(inArray(sections.id, [ids.secMCA2026F, ids.secMSc2026F, ids.secMCA2025A, ids.secMech2026M]));
    }
    if (ids.batchMCA2026) {
      await db.delete(cohortSessionTerms).where(inArray(cohortSessionTerms.academicBatchId, [ids.batchMCA2026, ids.batchMSc2026, ids.batchMCA2025]));
      await db.delete(academicBatches).where(inArray(academicBatches.id, [ids.batchMCA2026, ids.batchMSc2026, ids.batchMCA2025, ids.batchMech2026]));
    }
    if (ids.progMCA) {
      await db.delete(programmes).where(inArray(programmes.id, [ids.progMCA, ids.progMScIT, ids.progMech]));
    }
    if (ids.deptCA) {
      await db.delete(departments).where(inArray(departments.id, [ids.deptCA, ids.deptMech]));
    }
    if (ids.fac) {
      await db.delete(faculties).where(eq(faculties.id, ids.fac));
    }
  });

  test("1. One tutor can claim and manage multiple classes across different programmes (MCA F and MSc IT F)", async () => {
    asStaff(tutorAngel, null);

    // Tutor claims MCA 2026 F and MSc IT 2026 F
    await claimTutorSection([ids.secMCA2026F, ids.secMSc2026F]);

    // Check assignments
    const assigned = await getMyAssignedSections();
    assert.strictEqual(assigned.length, 2, "Tutor should have 2 assigned classes");

    const mcaCard = assigned.find((c) => c.id === ids.secMCA2026F);
    const mscCard = assigned.find((c) => c.id === ids.secMSc2026F);

    assert.ok(mcaCard, "MCA 2026 Section F must be assigned");
    assert.ok(mscCard, "MSc IT 2026 Section F must be assigned");

    assert.strictEqual(mcaCard.programmeName, `MCA ${tag}`);
    assert.strictEqual(mscCard.programmeName, `MSc IT ${tag}`);
    assert.strictEqual(mcaCard.label, "F");
    assert.strictEqual(mscCard.label, "F");

    // Full labels distinguish them
    assert.notStrictEqual(mcaCard.classLabel, mscCard.classLabel);
    assert.ok(mcaCard.classLabel.includes(`MCA ${tag}`), "MCA label contains MCA programme name");
    assert.ok(mscCard.classLabel.includes(`MSc IT ${tag}`), "MSc label contains MSc IT programme name");
  });

  test("2. One tutor can manage classes from different admission batches (2025 and 2026)", async () => {
    asStaff(tutorAngel, null);

    // Tutor claims MCA 2025 Section A
    await claimTutorSection([ids.secMCA2025A]);

    const assigned = await getMyAssignedSections();
    assert.strictEqual(assigned.length, 3, "Tutor now manages 3 classes across 2 programmes and 2 batches");

    const batch2025Card = assigned.find((c) => c.id === ids.secMCA2025A);
    assert.ok(batch2025Card, "MCA 2025 Section A is assigned");
    assert.strictEqual(batch2025Card.admissionYear, 2025);
    assert.strictEqual(batch2025Card.expectedEndYear, 2027);
    assert.ok(batch2025Card.cohortYears.includes("2025–2027"));
  });

  test("3. Search and discovery (getAllAvailableSections) returns all programmes in authorized department with clear statuses", async () => {
    asStaff(tutorAngel, null);

    const result = await getAllAvailableSections();
    assert.ok("sections" in result);
    assert.ok(result.sections.length >= 3);

    // MCA 2026 F should have status ASSIGNED_TO_ME
    const mcaF = result.sections.find((s) => s.id === ids.secMCA2026F);
    assert.ok(mcaF);
    assert.strictEqual(mcaF.status, "ASSIGNED_TO_ME");

    // MSc IT 2026 F should have status ASSIGNED_TO_ME
    const mscF = result.sections.find((s) => s.id === ids.secMSc2026F);
    assert.ok(mscF);
    assert.strictEqual(mscF.status, "ASSIGNED_TO_ME");

    // Foreign department (Mech) must NOT appear in Computer Applications tutor available list
    const mech = result.sections.find((s) => s.id === ids.secMech2026M);
    assert.strictEqual(mech, undefined, "Classes in foreign departments must not be visible or claimable");
  });

  test("4. Server rejects claiming classes outside tutor's authorized department", async () => {
    asStaff(tutorAngel, null);

    // Attempting to claim Mechanical Engineering section
    await assert.rejects(
      async () => {
        await claimTutorSection([ids.secMech2026M]);
      },
      /only authorized to manage classes within your department/i,
      "Direct server request for foreign department section must be rejected"
    );
  });

  test("5. Server enforces configurable max tutor sections limit", async () => {
    asStaff(adminUser, null);

    // Temporarily set limit to 3
    await updateMaxTutorSectionsLimit(3);
    const limit = await getMaxTutorSectionsLimit();
    assert.strictEqual(limit, 3);

    // Tutor already has 3 sections (MCA 2026 F, MSc 2026 F, MCA 2025 A)
    // Create a 4th dummy section in MCA to test exceeding
    const [secDummy] = await db.insert(sections).values({ label: "Z", academicBatchId: ids.batchMCA2026 }).returning();

    asStaff(tutorAngel, null);
    await assert.rejects(
      async () => {
        await claimTutorSection([secDummy.id]);
      },
      /manage up to 3 classes total/i,
      "Server must reject claiming beyond configurable limit"
    );

    // Restore limit to 10
    asStaff(adminUser, null);
    await updateMaxTutorSectionsLimit(10);
    await db.delete(sections).where(eq(sections.id, secDummy.id));
  });

  test("6. Year Server navigation presents only authorized classes active in that Year Server", async () => {
    // Enter Year Server 2026
    asStaff(tutorAngel, session2026.id, ids.secMCA2026F);
    const ws2026 = await requireStaffWorkspace();

    assert.strictEqual(ws2026.session.id, session2026.id);
    const classLabels = ws2026.tutorClasses.map((c) => c.sectionLabel);
    assert.ok(classLabels.includes("F"), "Year Server 2026 has Section F");
    // Should have MCA 2026 F, MSc IT 2026 F, and MCA 2025 A (studying in Year 2 in 2026)
    assert.strictEqual(ws2026.tutorClasses.length, 3);

    // Enter Year Server 2025
    asStaff(tutorAngel, session2025.id, ids.secMCA2025A);
    const ws2025 = await requireStaffWorkspace();

    assert.strictEqual(ws2025.session.id, session2025.id);
    // In Year Server 2025, MCA 2026 and MSc IT 2026 are not enrolled yet
    assert.strictEqual(ws2025.tutorClasses.length, 1);
    assert.strictEqual(ws2025.tutorClasses[0].sectionId, ids.secMCA2025A);
  });

  test("7. Class switching updates active section and strictly isolates student rosters", async () => {
    // View MCA 2026 Section F
    asStaff(tutorAngel, session2026.id, ids.secMCA2026F);
    const mcaStudents = await getSectionStudents();
    assert.strictEqual(mcaStudents.length, 1);
    assert.strictEqual(mcaStudents[0].id, ids.mcaStudent1);

    // Switch to MSc IT 2026 Section F
    asStaff(tutorAngel, session2026.id, ids.secMSc2026F);
    const mscStudents = await getSectionStudents();
    assert.strictEqual(mscStudents.length, 1);
    assert.strictEqual(mscStudents[0].id, ids.mscStudent1);

    // Verify MCA student NEVER appears in MSc roster
    assert.strictEqual(
      mscStudents.some((s) => s.id === ids.mcaStudent1),
      false,
      "MCA student must not leak into MSc IT roster"
    );
  });

  test("8. Signup codes are bound strictly to intended class and prevent cross-class enrollment", async () => {
    // Tutor generates signup code for MSc IT 2026 Section F
    asStaff(tutorAngel, session2026.id, ids.secMSc2026F);
    const codeResult = await createClassSignupCode({ sectionId: ids.secMSc2026F, maxActivations: 10 });
    assert.ok(codeResult.code);

    // Verify code record in DB
    const [codeRow] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, codeResult.code));
    assert.strictEqual(codeRow.sectionId, ids.secMSc2026F);
    assert.strictEqual(codeRow.programmeId, ids.progMScIT);
    assert.strictEqual(codeRow.academicBatchId, ids.batchMSc2026);

    // Student self-onboarding with this code
    setTestSession(undefined);
    const regNum = `RA${tag.toUpperCase()}999`;
    const studentRegResult = await registerStudentWithClassCode({
      name: `Self Enrolled MSc Student ${tag}`,
      registerNumber: regNum,
      email: `self_msc_${tag}@srmist.edu.in`,
      password: "SecurePassword123!",
      confirmPassword: "SecurePassword123!",
      code: codeResult.code,
    });

    assert.ok(studentRegResult.success, `Registration should succeed but got: ${studentRegResult.error}`);
    const [newStudent] = await db.select().from(users).where(eq(users.registerNumber, regNum));
    createdUserIds.push(newStudent.id);

    // Student is strictly in MSc IT 2026 F
    assert.strictEqual(newStudent.sectionId, ids.secMSc2026F);
    assert.strictEqual(newStudent.programmeId, ids.progMScIT);
    assert.strictEqual(newStudent.academicBatchId, ids.batchMSc2026);
    assert.notStrictEqual(newStudent.sectionId, ids.secMCA2026F);
  });

  test("9. A tutor cannot access an unassigned section even in the same department", async () => {
    // Create an unclaimed section in MCA
    const [secUnclaimed] = await db.insert(sections).values({ label: "B", academicBatchId: ids.batchMCA2026 }).returning();

    // Tutor attempts to operate with secUnclaimed as their active section
    asStaff(tutorAngel, session2026.id, secUnclaimed.id);
    const ws = await requireStaffWorkspace();

    // Workspace MUST NOT grant access to unassigned section
    assert.notStrictEqual(ws.activeClass?.sectionId, secUnclaimed.id);
    assert.ok(
      !ws.tutorClasses.some((c) => c.sectionId === secUnclaimed.id),
      "Unassigned section cannot be in tutor classes"
    );

    await db.delete(sections).where(eq(sections.id, secUnclaimed.id));
  });

  test("10. Exiting a class safely removes assignment and keeps underlying students intact", async () => {
    asStaff(tutorAngel, null);

    // Tutor exits MCA 2025 Section A
    await exitTutorSection(ids.secMCA2025A);

    const remaining = await getMyAssignedSections();
    assert.strictEqual(remaining.length, 2);
    assert.ok(!remaining.some((c) => c.id === ids.secMCA2025A));

    // Underlying section record and batch must still exist in DB
    const [secCheck] = await db.select().from(sections).where(eq(sections.id, ids.secMCA2025A));
    assert.ok(secCheck, "Underlying section must remain intact");
  });
});
