import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { db, pool } from "@/lib/db";
import {
  users,
  eventTemplates,
  templateGroups,
  templateElectives,
  programmes,
  departments,
  faculties,
  auditLogs,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { setTestSession } from "@/lib/auth";
import {
  deleteTemplate,
  getTemplatesWithDetails,
} from "@/app/actions/templates";

describe("Role-Based Event Template Deletion & Access Controls", () => {
  let facultyId: string;
  let departmentId: string;
  let progAId: string;
  let progBId: string;

  let adminUser: { id: string; email: string };
  let coordinatorA: { id: string; email: string };
  let coordinatorB: { id: string; email: string };
  let tutorUser: { id: string; email: string };
  let studentUser: { id: string; email: string };

  let templateProgAByAdmin: string;
  let templateProgAByCoordA: string;
  let templateProgBByCoordB: string;
  let templateProgBByCoordA: string; // Created by Coord A, but assigned to Prog B

  before(async () => {
    // 1. Setup faculties, departments, programmes
    const [fac] = await db
      .insert(faculties)
      .values({
        name: `Test Faculty Role Templates ${Date.now()}`,
        code: `TFRT_${Date.now()}`,
      })
      .returning();
    facultyId = fac.id;

    const [dept] = await db
      .insert(departments)
      .values({
        name: `Test Dept Role Templates ${Date.now()}`,
        code: `TDRT_${Date.now()}`,
        facultyId,
      })
      .returning();
    departmentId = dept.id;

    const [progA] = await db
      .insert(programmes)
      .values({
        name: `Programme Alpha ${Date.now()}`,
        code: `PA_${Date.now().toString().slice(-4)}`,
        departmentId,
      })
      .returning();
    progAId = progA.id;

    const [progB] = await db
      .insert(programmes)
      .values({
        name: `Programme Beta ${Date.now()}`,
        code: `PB_${Date.now().toString().slice(-4)}`,
        departmentId,
      })
      .returning();
    progBId = progB.id;

    // 2. Setup users for each role
    const [uAdmin] = await db
      .insert(users)
      .values({
        name: "Admin User",
        email: `admin_${Date.now()}@srmist.edu.in`,
        role: "SYSTEM_ADMIN",
        passwordHash: "mock-hash",
      })
      .returning();
    adminUser = { id: uAdmin.id, email: uAdmin.email };

    const [uCoordA] = await db
      .insert(users)
      .values({
        name: "Coordinator Prog A",
        email: `coorda_${Date.now()}@srmist.edu.in`,
        role: "COURSE_COORDINATOR",
        departmentId,
        passwordHash: "mock-hash",
      })
      .returning();
    coordinatorA = { id: uCoordA.id, email: uCoordA.email };

    const [uCoordB] = await db
      .insert(users)
      .values({
        name: "Coordinator Prog B",
        email: `coordb_${Date.now()}@srmist.edu.in`,
        role: "COURSE_COORDINATOR",
        departmentId,
        passwordHash: "mock-hash",
      })
      .returning();
    coordinatorB = { id: uCoordB.id, email: uCoordB.email };

    const [uTutor] = await db
      .insert(users)
      .values({
        name: "Tutor User",
        email: `tutor_${Date.now()}@srmist.edu.in`,
        role: "CLASS_TUTOR",
        departmentId,
        passwordHash: "mock-hash",
      })
      .returning();
    tutorUser = { id: uTutor.id, email: uTutor.email };

    const [uStudent] = await db
      .insert(users)
      .values({
        name: "Student User",
        email: `student_${Date.now()}@srmist.edu.in`,
        role: "STUDENT",
        passwordHash: "mock-hash",
      })
      .returning();
    studentUser = { id: uStudent.id, email: uStudent.email };

    // Helper to create a template with a group and an elective
    async function createTestTemplate(name: string, programmeId: string, createdById: string) {
      const [tpl] = await db
        .insert(eventTemplates)
        .values({
          name,
          programmeId,
          createdById,
          description: `Test template description for ${name}`,
        })
        .returning();

      const [grp] = await db
        .insert(templateGroups)
        .values({
          templateId: tpl.id,
          name: "Basket 1",
          minChoices: 1,
          maxChoices: 1,
          sortOrder: 1,
        })
        .returning();

      await db.insert(templateElectives).values({
        groupId: grp.id,
        name: "Advanced Distributed Systems",
        courseCode: "CS901",
        credits: 3,
        defaultMaxSeats: 30,
      });

      return tpl.id;
    }

    templateProgAByAdmin = await createTestTemplate(
      "Prog A Template by Admin",
      progAId,
      adminUser.id
    );
    templateProgAByCoordA = await createTestTemplate(
      "Prog A Template by Coord A",
      progAId,
      coordinatorA.id
    );
    templateProgBByCoordB = await createTestTemplate(
      "Prog B Template by Coord B",
      progBId,
      coordinatorB.id
    );
    templateProgBByCoordA = await createTestTemplate(
      "Prog B Template created by Coord A",
      progBId,
      coordinatorA.id
    );
  });

  after(async () => {
    setTestSession(null);
    setTimeout(() => process.exit(0), 100);
  });

  test("1. Unauthenticated user cannot delete templates", async () => {
    setTestSession(null);
    const res = await deleteTemplate(templateProgAByAdmin);
    assert.strictEqual(res.success, false);
    assert.match(res.error || "", /Unauthorized/i);
  });

  test("2. STUDENT cannot delete templates", async () => {
    setTestSession({
      userId: studentUser.id,
      name: "Student User",
      email: studentUser.email,
      role: "STUDENT",
    });

    const res = await deleteTemplate(templateProgAByAdmin);
    assert.strictEqual(res.success, false);
    assert.match(res.error || "", /Permission denied/i);
  });

  test("3. CLASS_TUTOR cannot delete templates", async () => {
    setTestSession({
      userId: tutorUser.id,
      name: "Tutor User",
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      departmentId,
    });

    const res = await deleteTemplate(templateProgAByAdmin);
    assert.strictEqual(res.success, false);
    assert.match(res.error || "", /Permission denied/i);
  });

  test("4. COURSE_COORDINATOR cannot delete a template belonging to another programme and created by someone else", async () => {
    // Coordinator A has programmeId = progAId
    // Template Prog B By Coord B belongs to progBId and was created by Coord B
    setTestSession({
      userId: coordinatorA.id,
      name: "Coordinator Prog A",
      email: coordinatorA.email,
      role: "COURSE_COORDINATOR",
      departmentId,
      programmeId: progAId,
    });

    const res = await deleteTemplate(templateProgBByCoordB);
    assert.strictEqual(res.success, false);
    assert.match(res.error || "", /Permission denied: Course coordinators can only delete/i);

    // Verify template still exists in DB
    const [exists] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, templateProgBByCoordB));
    assert.ok(exists, "Template should not have been deleted");
  });

  test("5. COURSE_COORDINATOR can delete a template belonging to their assigned programme even if created by Admin", async () => {
    setTestSession({
      userId: coordinatorA.id,
      name: "Coordinator Prog A",
      email: coordinatorA.email,
      role: "COURSE_COORDINATOR",
      departmentId,
      programmeId: progAId,
    });

    const res = await deleteTemplate(templateProgAByAdmin);
    assert.strictEqual(res.success, true);

    // Verify template and children are deleted in DB
    const [exists] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, templateProgAByAdmin));
    assert.strictEqual(exists, undefined, "Template should be deleted");

    const orphanedGroups = await db
      .select()
      .from(templateGroups)
      .where(eq(templateGroups.templateId, templateProgAByAdmin));
    assert.strictEqual(orphanedGroups.length, 0, "Template groups should be deleted");
  });

  test("6. COURSE_COORDINATOR can delete a template created by themselves even if assigned to a different programme", async () => {
    // Coordinator A created templateProgBByCoordA for progBId
    setTestSession({
      userId: coordinatorA.id,
      name: "Coordinator Prog A",
      email: coordinatorA.email,
      role: "COURSE_COORDINATOR",
      departmentId,
      programmeId: progAId, // Assigned to Prog A
    });

    const res = await deleteTemplate(templateProgBByCoordA);
    assert.strictEqual(res.success, true);

    const [exists] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, templateProgBByCoordA));
    assert.strictEqual(exists, undefined, "Template created by user should be deleted");
  });

  test("7. SYSTEM_ADMIN has universal permission to delete any template across any programme", async () => {
    setTestSession({
      userId: adminUser.id,
      name: "Admin User",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    // Delete templateProgAByCoordA
    const resA = await deleteTemplate(templateProgAByCoordA);
    assert.strictEqual(resA.success, true);

    // Delete templateProgBByCoordB
    const resB = await deleteTemplate(templateProgBByCoordB);
    assert.strictEqual(resB.success, true);

    // Verify both are deleted
    const [existsA] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, templateProgAByCoordA));
    assert.strictEqual(existsA, undefined);

    const [existsB] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, templateProgBByCoordB));
    assert.strictEqual(existsB, undefined);

    // Verify audit logs were written
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.action, "DELETE_EVENT_TEMPLATE"));
    assert.ok(logs.length >= 3, "Audit logs must record template deletions");
  });

  test("8. getTemplatesWithDetails populates canDelete flag accurately per role", async () => {
    // Create two new templates: one in Prog A, one in Prog B
    const [tA] = await db
      .insert(eventTemplates)
      .values({
        name: "Permission Test Template A",
        programmeId: progAId,
        createdById: adminUser.id,
      })
      .returning();

    const [tB] = await db
      .insert(eventTemplates)
      .values({
        name: "Permission Test Template B",
        programmeId: progBId,
        createdById: coordinatorB.id,
      })
      .returning();

    // As Admin: canDelete must be true for both
    setTestSession({
      userId: adminUser.id,
      name: "Admin User",
      email: adminUser.email,
      role: "SYSTEM_ADMIN",
    });

    const adminDetails = await getTemplatesWithDetails();
    assert.strictEqual(adminDetails.success, true);
    const adminTplA = adminDetails.data?.find((t) => t.id === tA.id);
    const adminTplB = adminDetails.data?.find((t) => t.id === tB.id);
    assert.strictEqual(adminTplA?.canDelete, true);
    assert.strictEqual(adminTplB?.canDelete, true);

    // As Coordinator A (assigned to Prog A): canDelete = true for tA, false for tB
    setTestSession({
      userId: coordinatorA.id,
      name: "Coordinator Prog A",
      email: coordinatorA.email,
      role: "COURSE_COORDINATOR",
      departmentId,
      programmeId: progAId,
    });

    const coordDetails = await getTemplatesWithDetails();
    assert.strictEqual(coordDetails.success, true);
    const coordTplA = coordDetails.data?.find((t) => t.id === tA.id);
    const coordTplB = coordDetails.data?.find((t) => t.id === tB.id);
    assert.strictEqual(coordTplA?.canDelete, true);
    assert.strictEqual(coordTplB?.canDelete, false);
    assert.ok(coordTplB?.deleteRestrictionReason, "Must provide delete restriction reason");

    // As Class Tutor: canDelete = false for all
    setTestSession({
      userId: tutorUser.id,
      name: "Tutor User",
      email: tutorUser.email,
      role: "CLASS_TUTOR",
      departmentId,
    });

    const tutorDetails = await getTemplatesWithDetails();
    assert.strictEqual(tutorDetails.success, true);
    const tutorTplA = tutorDetails.data?.find((t) => t.id === tA.id);
    assert.strictEqual(tutorTplA?.canDelete, false);
    assert.ok(tutorTplA?.deleteRestrictionReason);

    // Cleanup test templates
    await db.delete(eventTemplates).where(inArray(eventTemplates.id, [tA.id, tB.id]));
  });
});
