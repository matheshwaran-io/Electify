import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
import { users, inviteCodes, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setTestSession } from "@/lib/auth";
import { createInviteCode, revokeInviteCode, deleteInviteCode } from "@/app/actions/admin";
import { generateRoleBasedCode } from "@/lib/invites";

describe("Role-Based Unique Invite Codes", () => {
  let adminUser: { id: string; email: string };

  before(async () => {
    const [uAdmin] = await db
      .insert(users)
      .values({
        name: "Admin Invite Test",
        email: `admin_inv_${Date.now()}@srmist.edu.in`,
        role: "SYSTEM_ADMIN",
        passwordHash: "hash",
      })
      .returning();
    adminUser = { id: uAdmin.id, email: uAdmin.email };
  });

  after(async () => {
    setTestSession(null);
    if (adminUser?.id) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, adminUser.id));
      await db.delete(inviteCodes).where(eq(inviteCodes.createdById, adminUser.id));
      await db.delete(users).where(eq(users.id, adminUser.id));
    }
  });

  test("1. generateRoleBasedCode produces role-specific prefixes", () => {
    const year = new Date().getFullYear().toString();

    const facCode = generateRoleBasedCode("CLASS_TUTOR");
    assert.match(facCode, new RegExp(`^EFCT${year}-[2-9A-Z]{6}$`), "Class Tutor code must follow EFCTYEAR-XXXXXX");

    const coordCode = generateRoleBasedCode("COURSE_COORDINATOR");
    assert.match(coordCode, new RegExp(`^EFCC${year}-[2-9A-Z]{5}$`), "Coordinator code must follow EFCCYEAR-XXXXX");

    const admCode = generateRoleBasedCode("SYSTEM_ADMIN");
    assert.match(admCode, new RegExp(`^EFSA${year}-[2-9A-Z]{5}$`), "Admin code must follow EFSAYEAR-XXXXX");

    const stuCode = generateRoleBasedCode("STUDENT");
    assert.match(stuCode, new RegExp(`^EFST${year}-[2-9A-Z]{5}$`), "Student code must follow EFSTYEAR-XXXXX");
  });

  test("2. Admin can create unique role-based invite codes for Faculty, Coordinator, and Admin", async () => {
    setTestSession({
      userId: adminUser.id,
      name: "Admin Invite Test",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    // Faculty code
    const facRes = await createInviteCode({
      role: "CLASS_TUTOR",
      maxUses: 1,
      expiresInDays: 7,
    });
    assert.ok(facRes.code.startsWith("EFCT"), "Faculty code must start with EFCT");

    // Course Coordinator code
    const coordRes = await createInviteCode({
      role: "COURSE_COORDINATOR",
      maxUses: 5,
      expiresInDays: 14,
    });
    assert.ok(coordRes.code.startsWith("EFCC"), "Coordinator code must start with EFCC");

    // System Admin code
    const admRes = await createInviteCode({
      role: "SYSTEM_ADMIN",
      maxUses: 1,
      expiresInDays: 3,
    });
    assert.ok(admRes.code.startsWith("EFSA"), "Admin code must start with EFSA");

    // Verify in database
    const [facDb] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, facRes.code));
    assert.strictEqual(facDb.role, "CLASS_TUTOR");
    assert.strictEqual(facDb.status, "ACTIVE");

    const [coordDb] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, coordRes.code));
    assert.strictEqual(coordDb.role, "COURSE_COORDINATOR");
    assert.strictEqual(coordDb.maxUses, 5);

    const [admDb] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, admRes.code));
    assert.strictEqual(admDb.role, "SYSTEM_ADMIN");
  });

  test("3. Custom invite code creation with uniqueness validation", async () => {
    setTestSession({
      userId: adminUser.id,
      name: "Admin Invite Test",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    const custom = `SRM-TEST-${Date.now().toString().slice(-4)}`;
    const res = await createInviteCode({
      role: "CLASS_TUTOR",
      customCode: custom,
      maxUses: 10,
      expiresInDays: 30,
    });
    assert.strictEqual(res.code, custom);

    // Duplicate attempt must be rejected
    await assert.rejects(async () => {
      await createInviteCode({
        role: "CLASS_TUTOR",
        customCode: custom,
        maxUses: 1,
        expiresInDays: 7,
      });
    }, new RegExp(`Invite code "${custom}" already exists`, "i"));
  });

  test("4. Admin can revoke and permanently delete invite codes", async () => {
    setTestSession({
      userId: adminUser.id,
      name: "Admin Invite Test",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    const res = await createInviteCode({
      role: "CLASS_TUTOR",
      maxUses: 1,
      expiresInDays: 1,
    });

    const [codeRow] = await db.select().from(inviteCodes).where(eq(inviteCodes.code, res.code));

    // Revoke
    await revokeInviteCode(codeRow.id);
    const [revokedRow] = await db.select().from(inviteCodes).where(eq(inviteCodes.id, codeRow.id));
    assert.strictEqual(revokedRow.status, "REVOKED");

    // Delete
    const delRes = await deleteInviteCode(codeRow.id);
    assert.strictEqual(delRes.success, true);

    const [deletedRow] = await db.select().from(inviteCodes).where(eq(inviteCodes.id, codeRow.id));
    assert.strictEqual(deletedRow, undefined, "Invite code must be permanently removed from DB");
  });

  test("5. Course Coordinator can generate invite codes for Class Tutors", async () => {
    const [coordUser] = await db
      .insert(users)
      .values({
        name: "Coord Invite Test",
        email: `coord_inv_${Date.now()}@srmist.edu.in`,
        role: "COURSE_COORDINATOR",
        passwordHash: "hash",
      })
      .returning();

    setTestSession({
      userId: coordUser.id,
      name: "Coord Invite Test",
      email: coordUser.email,
      role: "COURSE_COORDINATOR",
    });

    const tutorCodeRes = await createInviteCode({
      role: "CLASS_TUTOR",
      maxUses: 1,
      expiresInDays: 7,
    });

    assert.ok(tutorCodeRes.code.startsWith(`EFCT${new Date().getFullYear()}-`), "Course Coordinator generates EFCT code");

    // Course Coordinator cannot generate invite code for Admin
    await assert.rejects(async () => {
      await createInviteCode({
        role: "SYSTEM_ADMIN",
        maxUses: 1,
        expiresInDays: 7,
      });
    }, /Course Coordinators can only generate invite codes for Class Tutors/i);

    // Clean up
    await db.delete(inviteCodes).where(eq(inviteCodes.code, tutorCodeRes.code));
    await db.delete(auditLogs).where(eq(auditLogs.userId, coordUser.id));
    await db.delete(users).where(eq(users.id, coordUser.id));
  });
});
