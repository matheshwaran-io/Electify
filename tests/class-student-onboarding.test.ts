import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
import {
  users,
  faculties,
  departments,
  programmes,
  academicBatches,
  sections,
  tutorSections,
  inviteCodes,
  pinResetRequests,
  loginAttempts,
  auditLogs,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { setTestSession } from "@/lib/auth";
import * as bcrypt from "bcryptjs";
import {
  validateClassSignupCode,
  registerStudentWithClassCode,
  studentPinLogin,
  requestStudentPinReset,
  completeStudentPinReset,
} from "@/app/actions/auth";
import {
  createClassSignupCode,
  getClassSignupCodesForTutor,
  revokeClassSignupCode,
  getPendingPinResetsForTutor,
  authorizeStudentPinReset,
  rejectStudentPinReset,
} from "@/app/actions/tutor";
import { generateClassSignupCode } from "@/lib/invites";

describe("Class-Based Student Self-Onboarding and 6-Digit PIN Security", () => {
  let tutorUser: { id: string; email: string; name: string };
  let facultyId: string;
  let departmentId: string;
  let programmeId: string;
  let batchId: string;
  let sectionId: string;
  let classCode: string;
  let testStudentReg: string;
  let testStudentEmail: string;

  before(async () => {
    // 1. Setup Academic hierarchy: Faculty -> Department -> Programme (MCA) -> Batch (2026) -> Section (F)
    const suffix = Date.now().toString().slice(-6);
    testStudentReg = `RA253224${suffix}`;
    testStudentEmail = `rohan_${suffix}@srmist.edu.in`;

    const [fac] = await db
      .insert(faculties)
      .values({
        name: "School of Computing",
        code: `SOC_${suffix}`,
      })
      .returning();
    facultyId = fac.id;

    const [dept] = await db
      .insert(departments)
      .values({
        name: "Computer Applications",
        code: `CA_${suffix}`,
        facultyId,
      })
      .returning();
    departmentId = dept.id;

    const [existingProg] = await db.select().from(programmes).where(eq(programmes.code, "MCA")).limit(1);
    if (existingProg) {
      programmeId = existingProg.id;
      departmentId = existingProg.departmentId;
    } else {
      const [prog] = await db
        .insert(programmes)
        .values({
          name: "Master of Computer Applications",
          code: "MCA",
          departmentId,
        })
        .returning();
      programmeId = prog.id;
    }

    const [existingBatch] = await db
      .select()
      .from(academicBatches)
      .where(and(eq(academicBatches.year, "2026"), eq(academicBatches.programmeId, programmeId)))
      .limit(1);

    if (existingBatch) {
      batchId = existingBatch.id;
    } else {
      const [batch] = await db
        .insert(academicBatches)
        .values({
          year: "2026",
          programmeId,
        })
        .returning();
      batchId = batch.id;
    }

    const [existingSec] = await db
      .select()
      .from(sections)
      .where(and(eq(sections.label, "F"), eq(sections.academicBatchId, batchId)))
      .limit(1);

    if (existingSec) {
      sectionId = existingSec.id;
    } else {
      const [sec] = await db
        .insert(sections)
        .values({
          label: "F",
          academicBatchId: batchId,
        })
        .returning();
      sectionId = sec.id;
    }

    // 2. Setup Class Tutor
    const [tutor] = await db
      .insert(users)
      .values({
        name: "Prof. Rajesh Sharma",
        email: `tutor_${suffix}@srmist.edu.in`,
        role: "CLASS_TUTOR",
        employeeId: `EMP_${suffix}`,
        passwordHash: "dummy_hash",
        facultyId,
        departmentId,
        programmeId,
        academicBatchId: batchId,
        sectionId,
      })
      .returning();

    tutorUser = { id: tutor.id, email: tutor.email, name: tutor.name };

    // Link tutor to section in tutorSections
    await db.insert(tutorSections).values({
      tutorId: tutorUser.id,
      sectionId,
    });
  });

  after(() => {
    setTestSession(null);
  });

  test("1. generateClassSignupCode produces EF-[PROG]-[SEC]-[RAND4] format", () => {
    const code = generateClassSignupCode("MCA", "F");
    assert.match(
      code,
      /^EF-MCA-F-[2-9A-Z]{4}$/,
      "Class code must follow EF-[PROG]-[SEC]-[RAND4] format (e.g. EF-MCA-F-7X9K)"
    );
  });

  test("2. Class tutor creates a signup code for their section with max 100 limit", async () => {
    setTestSession({
      userId: tutorUser.id,
      name: tutorUser.name,
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      sectionId,
      programmeId,
      departmentId,
    });

    const res = await createClassSignupCode({
      sectionId,
      maxActivations: 100,
      expiryDays: 14,
    });

    assert.ok(res.success, "Tutor should successfully create class code");
    assert.match(res.code, /^EF-MCA-F-[2-9A-Z]{4}$/);
    assert.strictEqual(res.maxUses, 100, "Max uses must default and be capped at 100");
    classCode = res.code;

    // Verify stored in inviteCodes
    const [dbCode] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, classCode));
    assert.ok(dbCode, "Code must exist in database");
    assert.strictEqual(dbCode.role, "STUDENT");
    assert.strictEqual(dbCode.sectionId, sectionId);
    assert.strictEqual(dbCode.programmeId, programmeId);
    assert.strictEqual(dbCode.maxUses, 100);
    assert.strictEqual(dbCode.usedCount, 0);
  });

  test("3. validateClassSignupCode returns safe, read-only class metadata", async () => {
    const res = await validateClassSignupCode(classCode);
    assert.strictEqual(res.valid, true);
    assert.ok(res.data);
    assert.strictEqual(res.data.programmeCode, "MCA");
    assert.strictEqual(res.data.sectionLabel, "F");
    assert.strictEqual(res.data.departmentName, "Computer Applications");
    assert.strictEqual(res.data.tutorName, tutorUser.name);
    assert.strictEqual(res.data.maxUses, 100);
    assert.strictEqual(res.data.spotsRemaining, 100);

    // Invalid code check
    const invalidRes = await validateClassSignupCode("EF-INVALID-9999");
    assert.strictEqual(invalidRes.valid, false);
    assert.ok(invalidRes.error);
  });

  test("4. Student signup enforces @srmist.edu.in email domain and 6-digit PIN", async () => {
    // A. Non-SRM email rejected
    const badEmailRes = await registerStudentWithClassCode({
      code: classCode,
      email: "student@gmail.com",
      registerNumber: `${testStudentReg}_bad`,
      pin: "123456",
      confirmPin: "123456",
      name: "Rohan Patel",
    });
    assert.strictEqual(badEmailRes.success, false);
    assert.ok(badEmailRes.error?.includes("@srmist.edu.in"));

    // B. Invalid PIN length (4 digits) rejected
    const badPinRes = await registerStudentWithClassCode({
      code: classCode,
      email: `rohan1_${Date.now()}@srmist.edu.in`,
      registerNumber: `${testStudentReg}_bad2`,
      pin: "1234",
      confirmPin: "1234",
      name: "Rohan Patel",
    });
    assert.strictEqual(badPinRes.success, false);
    assert.ok(badPinRes.error?.includes("6 digits"));

    // C. Non-numeric PIN rejected
    const nonNumericRes = await registerStudentWithClassCode({
      code: classCode,
      email: `rohan2_${Date.now()}@srmist.edu.in`,
      registerNumber: `${testStudentReg}_bad3`,
      pin: "12ab56",
      confirmPin: "12ab56",
      name: "Rohan Patel",
    });
    assert.strictEqual(nonNumericRes.success, false);
    assert.ok(nonNumericRes.error?.includes("6 digits"));

    // D. Mismatched confirm PIN rejected
    const mismatchRes = await registerStudentWithClassCode({
      code: classCode,
      email: `rohan3_${Date.now()}@srmist.edu.in`,
      registerNumber: `${testStudentReg}_bad4`,
      pin: "123456",
      confirmPin: "654321",
      name: "Rohan Patel",
    });
    assert.strictEqual(mismatchRes.success, false);
    assert.ok(mismatchRes.error?.includes("do not match"));
  });

  test("5. Successful student onboarding securely hashes PIN and assigns class server-side", async () => {
    const signupRes = await registerStudentWithClassCode({
      code: classCode,
      email: testStudentEmail,
      registerNumber: testStudentReg,
      pin: "987654",
      confirmPin: "987654",
      name: "Rohan Patel",
    });

    assert.strictEqual(signupRes.success, true, signupRes.error);
    assert.strictEqual(signupRes.role, "STUDENT");

    // Verify student user in DB
    const [dbStudent] = await db
      .select()
      .from(users)
      .where(eq(users.registerNumber, testStudentReg))
      .limit(1);

    assert.ok(dbStudent, "Student record must exist");
    assert.strictEqual(dbStudent.role, "STUDENT");
    assert.strictEqual(dbStudent.sectionId, sectionId, "Section must be derived from code");
    assert.strictEqual(dbStudent.programmeId, programmeId, "Programme must be derived from code");
    assert.strictEqual(dbStudent.departmentId, departmentId, "Department must be derived from code");
    assert.strictEqual(dbStudent.academicBatchId, batchId, "Batch must be derived from code");

    // Verify PIN is securely hashed and NOT plaintext
    assert.notStrictEqual(dbStudent.passwordHash, "987654", "PIN must never be plain text");
    const isPinMatch = await bcrypt.compare("987654", dbStudent.passwordHash);
    assert.strictEqual(isPinMatch, true, "Bcrypt hash must match the 6-digit PIN");

    // Verify activation count incremented
    const [dbCode] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, classCode));
    assert.strictEqual(dbCode?.usedCount, 1, "Class code activations must increment by 1");
  });

  test("6. Deduplication: Reusing code with an already-enrolled registration number or email is rejected", async () => {
    // Duplicate registration number
    const dupRegRes = await registerStudentWithClassCode({
      code: classCode,
      email: "another.email@srmist.edu.in",
      registerNumber: testStudentReg, // Already enrolled!
      pin: "112233",
      confirmPin: "112233",
      name: "Duplicate Attempt",
    });
    assert.strictEqual(dupRegRes.success, false);
    assert.ok(dupRegRes.error?.includes("already exists"));

    // Duplicate email
    const dupEmailRes = await registerStudentWithClassCode({
      code: classCode,
      email: testStudentEmail, // Already enrolled!
      registerNumber: `${testStudentReg}_diff`,
      pin: "112233",
      confirmPin: "112233",
      name: "Duplicate Email Attempt",
    });
    assert.strictEqual(dupEmailRes.success, false);
    assert.ok(dupEmailRes.error?.includes("already exists"));

    // Ensure activation count did NOT increase
    const [dbCode] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, classCode));
    assert.strictEqual(dbCode?.usedCount, 1, "Failed duplicate attempts must not consume activations");
  });

  test("7. Student PIN login: Authenticates via Register Number or Email with 6-digit PIN", async () => {
    // A. Login via Register Number + 6-digit PIN
    const regLoginRes = await studentPinLogin({
      identifier: testStudentReg,
      pin: "987654",
    });
    assert.strictEqual(regLoginRes.success, true);
    assert.strictEqual(regLoginRes.role, "STUDENT");

    // B. Login via Email + 6-digit PIN
    const emailLoginRes = await studentPinLogin({
      identifier: testStudentEmail,
      pin: "987654",
    });
    assert.strictEqual(emailLoginRes.success, true);

    // C. Wrong PIN rejected
    const wrongPinRes = await studentPinLogin({
      identifier: testStudentReg,
      pin: "000000",
    });
    assert.strictEqual(wrongPinRes.success, false);
    assert.ok(wrongPinRes.error?.includes("Invalid"));
  });

  test("8. Rate limiting: Repeated wrong PIN attempts trigger temporary account lockout", async () => {
    const testIdentifier = testStudentReg;

    // Simulate 5 consecutive failed attempts
    for (let i = 0; i < 5; i++) {
      await studentPinLogin({ identifier: testIdentifier, pin: "111111" });
    }

    // 6th attempt should be blocked with lockout
    const lockedRes = await studentPinLogin({ identifier: testIdentifier, pin: "987654" });
    assert.strictEqual(lockedRes.success, false);
    assert.ok(
      lockedRes.error?.includes("Too many failed attempts") || lockedRes.error?.includes("locked"),
      "Should be locked out after repeated failed attempts"
    );

    // Reset attempts for subsequent tests
    await db.update(loginAttempts).set({ attempts: 0, lockoutUntil: null }).where(eq(loginAttempts.identifier, testIdentifier.toLowerCase()));
  });

  test("9. Hard server-side limit of activations: Reject enrollment once limit is reached", async () => {
    // Create a code with maxUses = 1
    setTestSession({
      userId: tutorUser.id,
      name: tutorUser.name,
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      sectionId,
    });

    const singleRes = await createClassSignupCode({
      sectionId,
      maxActivations: 1,
      expiryDays: 7,
    });

    // Enroll 1 student -> hits limit of 1
    const s1Res = await registerStudentWithClassCode({
      code: singleRes.code,
      email: `student1_${Date.now()}@srmist.edu.in`,
      registerNumber: `RA_${Date.now()}_1`,
      pin: "555555",
      confirmPin: "555555",
    });
    assert.strictEqual(s1Res.success, true);

    // Attempt to enroll 2nd student -> MUST be rejected
    const s2Res = await registerStudentWithClassCode({
      code: singleRes.code,
      email: `student2_${Date.now()}@srmist.edu.in`,
      registerNumber: `RA_${Date.now()}_2`,
      pin: "555555",
      confirmPin: "555555",
    });
    assert.strictEqual(s2Res.success, false);
    assert.ok(s2Res.error?.includes("maximum activation limit"), "Must reject when limit is reached");
  });

  test("10. Tutor-Authorized PIN Reset Lifecycle: Request -> Tutor Authorization -> PIN Completion", async () => {
    // Step 1: Student requests PIN reset
    const reqRes = await requestStudentPinReset(testStudentReg);
    assert.strictEqual(reqRes.success, true);

    // Verify request is PENDING in database
    const [pendingReq] = await db
      .select()
      .from(pinResetRequests)
      .where(eq(pinResetRequests.status, "PENDING"))
      .orderBy(pinResetRequests.createdAt);
    assert.ok(pendingReq, "PIN reset request must be in PENDING state");

    // Step 2: Tutor views pending requests
    setTestSession({
      userId: tutorUser.id,
      name: tutorUser.name,
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      sectionId,
    });

    const tutorQueue = await getPendingPinResetsForTutor(sectionId);
    assert.ok(tutorQueue.length > 0, "Tutor queue must show the pending request");
    const targetReq = tutorQueue.find((r) => r.id === pendingReq.id);
    assert.ok(targetReq, "Target request found in tutor queue");

    // Step 3: Tutor authorizes reset
    const authRes = await authorizeStudentPinReset(pendingReq.id);
    assert.strictEqual(authRes.success, true);
    assert.ok(authRes.resetToken?.startsWith("RST-"), "Authorization token must follow RST-XXXX format");

    // Step 4: Student completes PIN reset with the authorization code and sets new PIN
    const completeRes = await completeStudentPinReset({
      registerNumber: testStudentReg,
      resetToken: authRes.resetToken,
      newPin: "334455",
      confirmPin: "334455",
    });
    assert.strictEqual(completeRes.success, true);

    // Step 5: Verify new PIN logs in successfully
    const newLoginRes = await studentPinLogin({
      identifier: testStudentReg,
      pin: "334455",
    });
    assert.strictEqual(newLoginRes.success, true, "Student should log in with new PIN");

    // Old PIN should fail
    const oldLoginRes = await studentPinLogin({
      identifier: testStudentReg,
      pin: "987654",
    });
    assert.strictEqual(oldLoginRes.success, false, "Old PIN should no longer be valid");

    // Step 6: Authorization code cannot be reused
    const reuseRes = await completeStudentPinReset({
      registerNumber: testStudentReg,
      resetToken: authRes.resetToken,
      newPin: "778899",
      confirmPin: "778899",
    });
    assert.strictEqual(reuseRes.success, false, "Used authorization token cannot be reused");
  });

  test("11. Tutor can revoke class signup code", async () => {
    setTestSession({
      userId: tutorUser.id,
      name: tutorUser.name,
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      sectionId,
    });

    const [dbCode] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, classCode));
    assert.ok(dbCode);

    const revokeRes = await revokeClassSignupCode(dbCode.id);
    assert.strictEqual(revokeRes.success, true);

    // Subsequent validation returns revoked
    const checkRes = await validateClassSignupCode(classCode);
    assert.strictEqual(checkRes.valid, false);
    assert.ok(checkRes.error?.includes("revoked"));
  });
});
