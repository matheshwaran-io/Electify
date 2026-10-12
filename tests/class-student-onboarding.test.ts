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
  passwordResetRequests,
  loginAttempts,
  auditLogs,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { setTestSession, verifyJWT } from "@/lib/auth";
import * as bcrypt from "bcryptjs";
import {
  validateClassSignupCode,
  registerStudentWithClassCode,
  studentLogin,
  upgradeStudentPassword,
  login,
  requestStudentPasswordReset,
  completeStudentPasswordReset,
} from "@/app/actions/auth";
import {
  createClassSignupCode,
  revokeClassSignupCode,
  getPendingPasswordResetsForTutor,
  authorizeStudentPasswordReset,
  rejectStudentPasswordReset,
} from "@/app/actions/tutor";
import { generateClassSignupCode } from "@/lib/invites";

describe("Class-Based Student Self-Onboarding and Password Security", () => {
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

  const PASSWORD = "Rohan@2026";
  const NEW_PASSWORD = "Campus#Reset9";

  test("4. Student signup enforces @srmist.edu.in email domain and the password policy", async () => {
    const attempt = (overrides: Record<string, string>) =>
      registerStudentWithClassCode({
        code: classCode,
        email: `rohan_${Date.now()}@srmist.edu.in`,
        registerNumber: `${testStudentReg}B`,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        name: "Rohan Patel",
        ...overrides,
      });

    // A. Non-SRM email rejected
    const badEmailRes = await attempt({ email: "student@gmail.com" });
    assert.strictEqual(badEmailRes.success, false);
    assert.ok(badEmailRes.error?.includes("@srmist.edu.in"));

    // B. Too short
    const shortRes = await attempt({ password: "Ab1", confirmPassword: "Ab1" });
    assert.strictEqual(shortRes.success, false);
    assert.ok(shortRes.error?.includes("at least 8"), shortRes.error);

    // C. A 6-digit PIN is no longer accepted
    const pinRes = await attempt({ password: "123456", confirmPassword: "123456" });
    assert.strictEqual(pinRes.success, false);

    // D. Letters only / digits only
    assert.ok((await attempt({ password: "onlyletters", confirmPassword: "onlyletters" })).error?.includes("number"));
    assert.ok((await attempt({ password: "1234567890", confirmPassword: "1234567890" })).error?.includes("letter"));

    // E. Contains the register number, or a handed-out default
    const regRes = await attempt({ password: `${testStudentReg}B`, confirmPassword: `${testStudentReg}B` });
    assert.strictEqual(regRes.success, false);
    assert.ok(regRes.error?.includes("register number"));
    assert.strictEqual((await attempt({ password: "Student@123", confirmPassword: "Student@123" })).success, false);

    // F. Mismatched confirmation
    const mismatchRes = await attempt({ confirmPassword: "Different#2026" });
    assert.strictEqual(mismatchRes.success, false);
    assert.ok(mismatchRes.error?.includes("do not match"));

    // G. Register numbers must be letters and digits
    const badRegRes = await attempt({ registerNumber: "RA_12345" });
    assert.strictEqual(badRegRes.success, false);
    assert.ok(badRegRes.error?.includes("letters and digits"));

    const [dbCode] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, classCode));
    assert.strictEqual(dbCode?.usedCount, 0, "Rejected signups must not consume activations");
  });

  test("5. Successful student onboarding securely hashes the password and assigns class server-side", async () => {
    const signupRes = await registerStudentWithClassCode({
      code: classCode,
      email: testStudentEmail,
      registerNumber: testStudentReg.toLowerCase(), // normalised to upper case
      password: PASSWORD,
      confirmPassword: PASSWORD,
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

    assert.ok(dbStudent, "Student record must exist (register number stored upper-case)");
    assert.strictEqual(dbStudent.role, "STUDENT");
    assert.strictEqual(dbStudent.sectionId, sectionId, "Section must be derived from code");
    assert.strictEqual(dbStudent.programmeId, programmeId, "Programme must be derived from code");
    assert.strictEqual(dbStudent.departmentId, departmentId, "Department must be derived from code");
    assert.strictEqual(dbStudent.academicBatchId, batchId, "Batch must be derived from code");

    // Verify password is securely hashed and NOT plaintext
    assert.notStrictEqual(dbStudent.passwordHash, PASSWORD, "Password must never be stored in plain text");
    assert.strictEqual(await bcrypt.compare(PASSWORD, dbStudent.passwordHash), true, "Bcrypt hash must match the password");

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
      password: "Another#2026",
      confirmPassword: "Another#2026",
      name: "Duplicate Attempt",
    });
    assert.strictEqual(dupRegRes.success, false);
    assert.ok(dupRegRes.error?.includes("already exists"));

    // Duplicate email
    const dupEmailRes = await registerStudentWithClassCode({
      code: classCode,
      email: testStudentEmail, // Already enrolled!
      registerNumber: `${testStudentReg}D`,
      password: "Another#2026",
      confirmPassword: "Another#2026",
      name: "Duplicate Email Attempt",
    });
    assert.strictEqual(dupEmailRes.success, false);
    assert.ok(dupEmailRes.error?.includes("already exists"));

    // Ensure activation count did NOT increase
    const [dbCode] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, classCode));
    assert.strictEqual(dbCode?.usedCount, 1, "Failed duplicate attempts must not consume activations");
  });

  test("7. Student login: register number and password only", async () => {
    // A. Register number + password (case and spaces don't matter)
    const regLoginRes = await studentLogin({ registerNumber: ` ${testStudentReg.toLowerCase()} `, password: PASSWORD });
    assert.strictEqual(regLoginRes.success, true, regLoginRes.error);
    assert.strictEqual(regLoginRes.role, "STUDENT");
    assert.strictEqual(regLoginRes.requiresPasswordUpgrade, undefined, "A policy-compliant password needs no upgrade");

    // B. Email is not accepted on the student form
    const emailLoginRes = await studentLogin({ registerNumber: testStudentEmail, password: PASSWORD });
    assert.strictEqual(emailLoginRes.success, false);
    assert.ok(emailLoginRes.error?.includes("register number"));

    // C. ...nor on the staff form, even with the right password
    const staffFormRes = await login({ identifier: testStudentEmail, password: PASSWORD });
    assert.strictEqual(staffFormRes.success, false);
    assert.ok(staffFormRes.error?.includes("Student tab"));
    const staffFormByReg = await login({ identifier: testStudentReg, password: PASSWORD });
    assert.strictEqual(staffFormByReg.success, false, "The staff form no longer looks up register numbers");

    // D. Wrong password rejected
    const wrongRes = await studentLogin({ registerNumber: testStudentReg, password: "Wrong#Pass1" });
    assert.strictEqual(wrongRes.success, false);
    assert.ok(wrongRes.error?.includes("Invalid"));
  });

  test("8. Rate limiting: Repeated wrong passwords trigger temporary account lockout", async () => {
    // Simulate 5 consecutive failed attempts
    for (let i = 0; i < 5; i++) {
      await studentLogin({ registerNumber: testStudentReg, password: "Wrong#Pass1" });
    }

    // 6th attempt should be blocked even with the right password
    const lockedRes = await studentLogin({ registerNumber: testStudentReg, password: PASSWORD });
    assert.strictEqual(lockedRes.success, false);
    assert.ok(
      lockedRes.error?.includes("Too many failed attempts") || lockedRes.error?.includes("locked"),
      "Should be locked out after repeated failed attempts"
    );

    // Reset attempts for subsequent tests
    await db.update(loginAttempts).set({ attempts: 0, lockoutUntil: null }).where(eq(loginAttempts.identifier, testStudentReg.toLowerCase()));
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
      registerNumber: `RA${Date.now()}1`,
      password: "Limit#Test1",
      confirmPassword: "Limit#Test1",
    });
    assert.strictEqual(s1Res.success, true, s1Res.error);

    // Attempt to enroll 2nd student -> MUST be rejected
    const s2Res = await registerStudentWithClassCode({
      code: singleRes.code,
      email: `student2_${Date.now()}@srmist.edu.in`,
      registerNumber: `RA${Date.now()}2`,
      password: "Limit#Test2",
      confirmPassword: "Limit#Test2",
    });
    assert.strictEqual(s2Res.success, false);
    assert.ok(s2Res.error?.includes("maximum activation limit"), "Must reject when limit is reached");
  });

  test("10. Tutor-authorized password reset: Request -> Tutor Authorization -> New Password", async () => {
    // Step 1: Student requests a reset (register number only)
    const reqRes = await requestStudentPasswordReset(testStudentReg);
    assert.strictEqual(reqRes.success, true);
    const emailReq = await requestStudentPasswordReset(testStudentEmail);
    assert.strictEqual(emailReq.success, false, "Reset requests take a register number, not an email");

    const [student] = await db.select({ id: users.id }).from(users).where(eq(users.registerNumber, testStudentReg));
    const [pendingReq] = await db
      .select()
      .from(passwordResetRequests)
      .where(and(eq(passwordResetRequests.studentId, student.id), eq(passwordResetRequests.status, "PENDING")));
    assert.ok(pendingReq, "Reset request must be in PENDING state");

    // Step 2: Tutor views pending requests
    setTestSession({
      userId: tutorUser.id,
      name: tutorUser.name,
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      sectionId,
    });

    const tutorQueue = await getPendingPasswordResetsForTutor(sectionId);
    assert.ok(tutorQueue.some((r) => r.id === pendingReq.id), "Tutor queue must show the pending request");

    // Step 3: Tutor authorizes reset
    const authRes = await authorizeStudentPasswordReset(pendingReq.id);
    assert.strictEqual(authRes.success, true);
    assert.match(authRes.resetToken, /^RST-[2-9A-HJ-NP-Z]{6}$/, "Authorization code must follow RST-XXXXXX format");

    const [authAudit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.userId, tutorUser.id), eq(auditLogs.action, "PASSWORD_RESET_AUTHORIZED")));
    assert.ok(authAudit, "Authorization is audited");
    assert.ok(!JSON.stringify(authAudit.metadata).includes(authRes.resetToken), "The code itself is not written to the audit log");

    // Step 4: A weak new password is refused, then a good one is accepted
    const weakRes = await completeStudentPasswordReset({
      registerNumber: testStudentReg,
      resetToken: authRes.resetToken,
      newPassword: "445566",
      confirmPassword: "445566",
    });
    assert.strictEqual(weakRes.success, false);

    const completeRes = await completeStudentPasswordReset({
      registerNumber: testStudentReg,
      resetToken: authRes.resetToken.toLowerCase(),
      newPassword: NEW_PASSWORD,
      confirmPassword: NEW_PASSWORD,
    });
    assert.strictEqual(completeRes.success, true, completeRes.error);

    // Step 5: New password works, old one doesn't
    const newLoginRes = await studentLogin({ registerNumber: testStudentReg, password: NEW_PASSWORD });
    assert.strictEqual(newLoginRes.success, true, "Student should log in with the new password");
    const oldLoginRes = await studentLogin({ registerNumber: testStudentReg, password: PASSWORD });
    assert.strictEqual(oldLoginRes.success, false, "Old password should no longer be valid");

    // Step 6: Authorization code cannot be reused
    const reuseRes = await completeStudentPasswordReset({
      registerNumber: testStudentReg,
      resetToken: authRes.resetToken,
      newPassword: "Another#Reset2",
      confirmPassword: "Another#Reset2",
    });
    assert.strictEqual(reuseRes.success, false, "Used authorization code cannot be reused");
    await db.delete(loginAttempts).where(inArray(loginAttempts.identifier, [testStudentReg.toLowerCase(), `reset:${testStudentReg.toLowerCase()}`]));
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

  /** A student created outside class onboarding, e.g. before passwords or by a tutor. */
  const legacyStudents: string[] = [];
  let otherSectionId: string | undefined;
  async function createLegacyStudent(credential: (reg: string) => string, inSection = sectionId) {
    const reg = `RA9${Date.now()}${legacyStudents.length}`;
    const [row] = await db
      .insert(users)
      .values({
        name: "Legacy Student",
        email: `legacy_${reg.toLowerCase()}@srmist.edu.in`,
        passwordHash: await bcrypt.hash(credential(reg), 10),
        role: "STUDENT",
        registerNumber: reg,
        sectionId: inSection,
        academicBatchId: batchId,
        programmeId,
        departmentId,
      })
      .returning();
    legacyStudents.push(row.id);
    return { id: row.id, reg };
  }

  test("12. A legacy 6-digit PIN signs in only to choose a new password", async () => {
    const { reg } = await createLegacyStudent(() => "482915");

    const first = await studentLogin({ registerNumber: reg, password: "482915" });
    assert.strictEqual(first.success, false, "No session for a legacy PIN");
    assert.strictEqual(first.requiresPasswordUpgrade, true);
    assert.ok(first.upgradeTicket);
    assert.strictEqual(await verifyJWT(first.upgradeTicket!), null, "The upgrade ticket can never be used as a session token");

    const weak = await upgradeStudentPassword({ ticket: first.upgradeTicket!, newPassword: "123456", confirmPassword: "123456" });
    assert.strictEqual(weak.success, false);
    const mismatch = await upgradeStudentPassword({ ticket: first.upgradeTicket!, newPassword: "Fresh#Pass1", confirmPassword: "Fresh#Pass2" });
    assert.strictEqual(mismatch.success, false);
    const forged = await upgradeStudentPassword({ ticket: "not-a-ticket", newPassword: "Fresh#Pass1", confirmPassword: "Fresh#Pass1" });
    assert.strictEqual(forged.success, false);

    const done = await upgradeStudentPassword({ ticket: first.upgradeTicket!, newPassword: "Fresh#Pass1", confirmPassword: "Fresh#Pass1" });
    assert.strictEqual(done.success, true, done.error);
    assert.strictEqual(done.role, "STUDENT");

    const reused = await upgradeStudentPassword({ ticket: first.upgradeTicket!, newPassword: "Other#Pass2", confirmPassword: "Other#Pass2" });
    assert.strictEqual(reused.success, false, "A ticket stops working once the password has changed");

    assert.strictEqual((await studentLogin({ registerNumber: reg, password: "482915" })).success, false, "Old PIN no longer works");
    const upgraded = await studentLogin({ registerNumber: reg, password: "Fresh#Pass1" });
    assert.strictEqual(upgraded.success, true);
    assert.strictEqual(upgraded.requiresPasswordUpgrade, undefined);
  });

  test("13. Tutor-created accounts (register number as password) must also choose a password", async () => {
    const { reg } = await createLegacyStudent((r) => r);
    const res = await studentLogin({ registerNumber: reg, password: reg });
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.requiresPasswordUpgrade, true);
    const sameAsReg = await upgradeStudentPassword({ ticket: res.upgradeTicket!, newPassword: `${reg}x`, confirmPassword: `${reg}x` });
    assert.strictEqual(sameAsReg.success, false, "New password may not contain the register number");
  });

  test("14. A tutor cannot see, authorize or reject resets for another section", async () => {
    const [otherSection] = await db.insert(sections).values({ label: `Z${Date.now().toString().slice(-4)}`, academicBatchId: batchId }).returning();
    otherSectionId = otherSection.id;
    const outsider = await createLegacyStudent(() => "Outsider#2026", otherSection.id);
    const [foreignReq] = await db
      .insert(passwordResetRequests)
      .values({ studentId: outsider.id, sectionId: otherSection.id, status: "PENDING" })
      .returning();

    setTestSession({ userId: tutorUser.id, name: tutorUser.name, email: tutorUser.email, role: "CLASS_TUTOR", sectionId });
    const queue = await getPendingPasswordResetsForTutor(sectionId);
    assert.ok(!queue.some((r) => r.id === foreignReq.id), "Other sections' requests are not listed");
    await assert.rejects(authorizeStudentPasswordReset(foreignReq.id), /not found/);
    await assert.rejects(rejectStudentPasswordReset(foreignReq.id), /not found/);

    const [unchanged] = await db.select().from(passwordResetRequests).where(eq(passwordResetRequests.id, foreignReq.id));
    assert.strictEqual(unchanged.status, "PENDING");
    assert.strictEqual(unchanged.resetToken, null, "No code was issued");

    setTestSession({ userId: tutorUser.id, name: "Student", email: "s@test.local", role: "STUDENT" });
    await assert.rejects(getPendingPasswordResetsForTutor(sectionId), /Unauthorized/);
  });

  test("15. Guessing reset codes locks the reset form", async () => {
    const { id, reg } = await createLegacyStudent(() => "Guess#Target1");
    const [req] = await db.insert(passwordResetRequests).values({ studentId: id, sectionId, status: "PENDING" }).returning();
    setTestSession({ userId: tutorUser.id, name: tutorUser.name, email: tutorUser.email, role: "CLASS_TUTOR", sectionId });
    const { resetToken } = await authorizeStudentPasswordReset(req.id);

    for (let i = 0; i < 5; i++) {
      const wrong = await completeStudentPasswordReset({ registerNumber: reg, resetToken: "RST-AAAAAA", newPassword: "Guess#New12", confirmPassword: "Guess#New12" });
      assert.strictEqual(wrong.success, false);
    }
    const locked = await completeStudentPasswordReset({ registerNumber: reg, resetToken, newPassword: "Guess#New12", confirmPassword: "Guess#New12" });
    assert.strictEqual(locked.success, false);
    assert.ok(locked.error?.includes("Too many failed attempts"), locked.error);
    await db.delete(loginAttempts).where(eq(loginAttempts.identifier, `reset:${reg.toLowerCase()}`));
  });

  after(async () => {
    setTestSession(null);
    if (legacyStudents.length) {
      const regs = (await db.select({ reg: users.registerNumber }).from(users).where(inArray(users.id, legacyStudents))).map((r) => r.reg!.toLowerCase());
      await db.delete(loginAttempts).where(inArray(loginAttempts.identifier, [...regs, ...regs.map((r) => `reset:${r}`)]));
      await db.delete(passwordResetRequests).where(inArray(passwordResetRequests.studentId, legacyStudents));
      await db.delete(auditLogs).where(inArray(auditLogs.userId, legacyStudents));
      await db.delete(users).where(inArray(users.id, legacyStudents));
    }
    if (otherSectionId) await db.delete(sections).where(eq(sections.id, otherSectionId));
    if (testStudentReg) {
      const keys = [testStudentReg.toLowerCase(), `reset:${testStudentReg.toLowerCase()}`, testStudentEmail.toLowerCase()];
      await db.delete(loginAttempts).where(inArray(loginAttempts.identifier, keys));
    }
  });

  after(async () => {
    setTestSession(null);
    if (classCode) {
      await db.delete(inviteCodes).where(eq(inviteCodes.code, classCode));
    }
    if (tutorUser?.id) {
      await db.delete(inviteCodes).where(eq(inviteCodes.createdById, tutorUser.id));
      await db.delete(tutorSections).where(eq(tutorSections.tutorId, tutorUser.id));
    }
    if (sectionId) {
      await db.delete(inviteCodes).where(eq(inviteCodes.sectionId, sectionId));
      await db.delete(passwordResetRequests).where(eq(passwordResetRequests.sectionId, sectionId));
      await db.delete(users).where(eq(users.sectionId, sectionId));
    }
    if (testStudentReg) {
      const studs = await db.select({ id: users.id }).from(users).where(eq(users.registerNumber, testStudentReg));
      for (const s of studs) {
        await db.delete(passwordResetRequests).where(eq(passwordResetRequests.studentId, s.id));
        await db.delete(auditLogs).where(eq(auditLogs.userId, s.id));
        await db.delete(users).where(eq(users.id, s.id));
      }
    }
    if (tutorUser?.id) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, tutorUser.id));
      await db.delete(users).where(eq(users.id, tutorUser.id));
    }
    if (sectionId) await db.delete(sections).where(eq(sections.id, sectionId));
    if (batchId) await db.delete(academicBatches).where(eq(academicBatches.id, batchId));
    if (programmeId) await db.delete(programmes).where(eq(programmes.id, programmeId));
    if (departmentId) await db.delete(departments).where(eq(departments.id, departmentId));
    if (facultyId) await db.delete(faculties).where(eq(faculties.id, facultyId));
  });
});
