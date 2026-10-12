import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db } from "@/lib/db";
import { users, inviteCodes, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setTestSession } from "@/lib/auth";
import { createInviteCode, revokeInviteCode, deleteInviteCode } from "@/app/actions/admin";
import { generateRoleBasedCode, ROLE_CONFIGS } from "@/lib/invites";

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
    assert.match(facCode, new RegExp(`^FAC-${year}-[2-9A-Z]{4}$`), "Faculty code must follow FAC-YEAR-XXXX");

    const coordCode = generateRoleBasedCode("COURSE_COORDINATOR");
    assert.match(coordCode, new RegExp(`^COORD-${year}-[2-9A-Z]{4}$`), "Coordinator code must follow COORD-YEAR-XXXX");

    const admCode = generateRoleBasedCode("SYSTEM_ADMIN");
    assert.match(admCode, new RegExp(`^ADM-${year}-[2-9A-Z]{4}$`), "Admin code must follow ADM-YEAR-XXXX");

    const stuCode = generateRoleBasedCode("STUDENT");
    assert.match(stuCode, new RegExp(`^STU-${year}-[2-9A-Z]{4}$`), "Student code must follow STU-YEAR-XXXX");
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
    assert.ok(facRes.code.startsWith("FAC-"), "Faculty code must start with FAC-");

    // Course Coordinator code
    const coordRes = await createInviteCode({
      role: "COURSE_COORDINATOR",
      maxUses: 5,
      expiresInDays: 14,
    });
    assert.ok(coordRes.code.startsWith("COORD-"), "Coordinator code must start with COORD-");

    // System Admin code
    const admRes = await createInviteCode({
      role: "SYSTEM_ADMIN",
      maxUses: 1,
      expiresInDays: 3,
    });
    assert.ok(admRes.code.startsWith("ADM-"), "Admin code must start with ADM-");

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
});
