"use server";

import { db } from "@/lib/db";
import { releaseSeat } from "@/lib/seat-ops";
import {
  users, registrationEvents, faculties, departments,
  programmes, academicBatches, sections, auditLogs, eventTemplates,
  templateGroups, inviteCodes, systemSettings, tutorSections,
  studentRegistrations, registrations, electives, eventStudents, eventSections
} from "@/lib/db/schema";
import { getSession, isRootAdmin, ROOT_ADMIN_EMAIL } from "@/lib/auth";
import { eq, desc, count, asc, or, inArray, sql, and, ne } from "drizzle-orm";
import * as bcrypt from "bcryptjs";
import { generateRoleBasedCode, type InviteRole } from "@/lib/invites";
import { requireStaffWorkspace, workspaceEventIds } from "@/lib/workspace";

async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") throw new Error("Unauthorized");
  return session;
}

async function assertAdminOrCoordinator() {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Events ──────────────────────────────────────────────────────────────────

/**
 * Registration events of the selected academic session that target classes the
 * user manages (coordinators: their programme; admins: every class in the
 * session), with the full identity of each targeted class.
 */
export async function getEvents() {
  await assertAdminOrCoordinator();
  const ws = await requireStaffWorkspace();
  const eventIds = await workspaceEventIds(ws);
  if (eventIds.length === 0) return [];

  const events = await db
    .select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      description: registrationEvents.description,
      academicYear: registrationEvents.academicYear,
      academicBatchId: registrationEvents.academicBatchId,
      semester: registrationEvents.semester,
      status: registrationEvents.status,
      openDate: registrationEvents.openDate,
      closeDate: registrationEvents.closeDate,
      createdAt: registrationEvents.createdAt,
      programmeName: programmes.name,
      programmeCode: programmes.code,
    })
    .from(registrationEvents)
    .leftJoin(academicBatches, eq(registrationEvents.academicBatchId, academicBatches.id))
    .leftJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .where(inArray(registrationEvents.id, eventIds))
    .orderBy(desc(registrationEvents.createdAt));

  const targets = await db
    .select({ eventId: eventSections.eventId, sectionId: eventSections.sectionId })
    .from(eventSections)
    .where(inArray(eventSections.eventId, eventIds));
  const labelOf = new Map(ws.classes.map((c) => [c.sectionId, c.label]));

  return events.map((e) => ({
    ...e,
    classLabels: targets
      .filter((t) => t.eventId === e.id)
      .map((t) => labelOf.get(t.sectionId))
      .filter((l): l is string => Boolean(l)),
  }));
}

export async function getBatchesForEvents() {
  await assertAdminOrCoordinator();
  return db
    .select({
      id: academicBatches.id,
      year: academicBatches.year,
      programmeId: programmes.id,
      programmeName: programmes.name,
      programmeCode: programmes.code,
    })
    .from(academicBatches)
    .leftJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .where(eq(academicBatches.isActive, true))
    .orderBy(asc(programmes.name), asc(academicBatches.year));
}


// ── Academic Hierarchy ──────────────────────────────────────────────────────

import { unstable_cache } from "next/cache";

const getCachedDepartmentsTree = unstable_cache(
  async () => {
    // Only cache the database fetch and shaping part
    const allFaculties = await db.select().from(faculties).where(eq(faculties.isActive, true)).orderBy(asc(faculties.name));
    const allDepts = await db.select().from(departments).where(eq(departments.isActive, true)).orderBy(asc(departments.name));
    const allProgs = await db.select().from(programmes).where(eq(programmes.isActive, true)).orderBy(asc(programmes.name));
    const allBatches = await db.select().from(academicBatches).where(eq(academicBatches.isActive, true)).orderBy(asc(academicBatches.year));
    const allSections = await db.select().from(sections).where(eq(sections.isActive, true)).orderBy(asc(sections.label));

    return {
      faculties: allFaculties.map((f) => ({
        ...f,
        departments: allDepts
          .filter((d) => d.facultyId === f.id)
          .map((d) => ({
            ...d,
            programmes: allProgs
              .filter((p) => p.departmentId === d.id)
              .map((p) => ({
                ...p,
                batches: allBatches
                  .filter((b) => b.programmeId === p.id)
                  .map((b) => ({
                    ...b,
                    sections: allSections.filter((s) => s.academicBatchId === b.id),
                  })),
              })),
          })),
      })),
    };
  },
  ["admin-hierarchy"],
  { tags: ["hierarchy"], revalidate: 3600 }
);

export async function getDepartmentsTree() {
  await assertAdminOrCoordinator();
  return getCachedDepartmentsTree();
}

// ── Templates ───────────────────────────────────────────────────────────────

export async function getTemplates() {
  await assertAdmin();
  const templates = await db
    .select({
      id: eventTemplates.id,
      name: eventTemplates.name,
      description: eventTemplates.description,
      createdAt: eventTemplates.createdAt,
      programmeName: programmes.name,
      creatorName: users.name,
    })
    .from(eventTemplates)
    .leftJoin(programmes, eq(eventTemplates.programmeId, programmes.id))
    .leftJoin(users, eq(eventTemplates.createdById, users.id))
    .orderBy(desc(eventTemplates.createdAt));

  const groups = await db
    .select({ count: count(), templateId: templateGroups.templateId })
    .from(templateGroups)
    .groupBy(templateGroups.templateId);

  return templates.map((t) => ({
    ...t,
    groupCount: groups.find((g) => g.templateId === t.id)?.count ?? 0,
  }));
}

// ── Users ───────────────────────────────────────────────────────────────────

export async function getStaffUsers() {
  await assertAdmin();
  const staff = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      employeeId: users.employeeId,
      phone: users.phone,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      or(
        eq(users.role, "SYSTEM_ADMIN"),
        eq(users.role, "COURSE_COORDINATOR"),
        eq(users.role, "CLASS_TUTOR")
      )
    )
    .orderBy(asc(users.name));

  // Fetch tutor sections
  const tutorIds = staff.filter((s) => s.role === "CLASS_TUTOR").map((s) => s.id);
  let assignments: { tutorId: string; sectionId: string }[] = [];
  if (tutorIds.length > 0) {
    assignments = await db.select().from(tutorSections).where(inArray(tutorSections.tutorId, tutorIds));
  }

  return staff.map((s) => ({
    ...s,
    managedSectionIds: s.role === "CLASS_TUTOR" 
      ? assignments.filter((a) => a.tutorId === s.id).map((a) => a.sectionId)
      : [],
  }));
}

export async function getStudentUsers() {
  await assertAdmin();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      registerNumber: users.registerNumber,
      phone: users.phone,
      programmeId: users.programmeId,
      academicBatchId: users.academicBatchId,
      sectionId: users.sectionId,
      isActive: users.isActive,
      isEligible: users.isEligible,
      createdAt: users.createdAt,
      programmeName: programmes.name,
    })
    .from(users)
    .where(eq(users.role, "STUDENT"))
    .leftJoin(programmes, eq(users.programmeId, programmes.id))
    .orderBy(asc(users.name));
}


// ── Invite Codes ─────────────────────────────────────────────────────────────

export async function getInviteCodes() {
  const session = await assertAdminOrCoordinator();
  if (session.role === "SYSTEM_ADMIN") {
    return db
      .select({
        id: inviteCodes.id,
        code: inviteCodes.code,
        role: inviteCodes.role,
        status: inviteCodes.status,
        maxUses: inviteCodes.maxUses,
        usedCount: inviteCodes.usedCount,
        expiresAt: inviteCodes.expiresAt,
        createdAt: inviteCodes.createdAt,
      })
      .from(inviteCodes)
      .where(ne(inviteCodes.role, "STUDENT"))
      .orderBy(desc(inviteCodes.createdAt));
  }

  // Course Coordinator: see invite codes created by them or for Class Tutors in their department
  return db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      role: inviteCodes.role,
      status: inviteCodes.status,
      maxUses: inviteCodes.maxUses,
      usedCount: inviteCodes.usedCount,
      expiresAt: inviteCodes.expiresAt,
      createdAt: inviteCodes.createdAt,
    })
    .from(inviteCodes)
    .where(
      and(
        eq(inviteCodes.role, "CLASS_TUTOR"),
        or(
          eq(inviteCodes.createdById, session.userId),
          session.departmentId ? eq(inviteCodes.departmentId, session.departmentId) : undefined
        )
      )
    )
    .orderBy(desc(inviteCodes.createdAt));
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export async function getAuditLogs(page = 1, limit = 25) {
  await assertAdmin();
  const offset = (page - 1) * limit;

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db.select({ total: count() }).from(auditLogs);

  return { logs, total, pages: Math.ceil(total / limit), page };
}

// ── System Settings ──────────────────────────────────────────────────────────

export async function getSystemSettings() {
  await assertAdmin();
  const [setting] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system"));
  return setting ?? null;
}

export async function toggleMaintenanceMode(enabled: boolean) {
  await assertAdmin();
  // Upsert so the switch works before the settings row has ever been created.
  await db
    .insert(systemSettings)
    .values({ id: "system", maintenanceMode: enabled })
    .onConflictDoUpdate({ target: systemSettings.id, set: { maintenanceMode: enabled, updatedAt: new Date() } });
}

// ── Invite Codes (Create / Revoke / Delete) ───────────────────────────────────────────

export async function createInviteCode(formData: {
  role: InviteRole;
  customCode?: string;
  facultyId?: string;
  departmentId?: string;
  programmeId?: string;
  sectionId?: string;
  maxUses: number;
  expiresInDays: number;
}) {
  const session = await assertAdminOrCoordinator();

  if (session.role === "SYSTEM_ADMIN") {
    if (formData.role === "STUDENT") {
      throw new Error("Students must onboard through their Class Tutor's class code, not staff invite codes.");
    }
  } else if (session.role === "COURSE_COORDINATOR") {
    if (formData.role !== "CLASS_TUTOR") {
      throw new Error("Course Coordinators can only generate invite codes for Class Tutors.");
    }
    const [coord] = await db
      .select({ facultyId: users.facultyId, departmentId: users.departmentId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    if (coord?.departmentId) {
      formData.departmentId = coord.departmentId;
    }
    if (coord?.facultyId) {
      formData.facultyId = coord.facultyId;
    }
  }

  let code = formData.customCode?.trim().toUpperCase();

  if (code) {
    // Sanitize custom code: ensure alphanumeric and hyphens only
    code = code.replace(/[^A-Z0-9-]/g, "");
    if (code.length < 4) {
      throw new Error("Custom invite code must be at least 4 characters long.");
    }

    const [existing] = await db
      .select({ id: inviteCodes.id })
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code))
      .limit(1);

    if (existing) {
      throw new Error(`Invite code "${code}" already exists.`);
    }
  } else {
    // Generate unique role-based code: e.g. FAC-2026-XXXX, COORD-2026-XXXX, ADM-2026-XXXX
    let uniqueFound = false;
    let attempts = 0;
    while (!uniqueFound && attempts < 15) {
      attempts++;
      const candidate = generateRoleBasedCode(formData.role);
      const [existing] = await db
        .select({ id: inviteCodes.id })
        .from(inviteCodes)
        .where(eq(inviteCodes.code, candidate))
        .limit(1);

      if (!existing) {
        code = candidate;
        uniqueFound = true;
      }
    }

    if (!code) {
      throw new Error("Failed to generate unique invite code. Please try again.");
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + formData.expiresInDays);

  await db.insert(inviteCodes).values({
    code,
    role: formData.role,
    facultyId: formData.facultyId || null,
    departmentId: formData.departmentId || null,
    programmeId: formData.programmeId || null,
    sectionId: formData.sectionId || null,
    createdById: session.userId,
    expiresAt,
    maxUses: formData.maxUses,
  });

  // Audit log
  await db.insert(auditLogs).values({
    action: "INVITE_CODE_CREATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    newValue: { code, role: formData.role },
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/invites");
  } catch {
    // Non-HTTP / test context safe
  }

  return { code };
}

export async function revokeInviteCode(id: string) {
  const session = await assertAdminOrCoordinator();

  const [invite] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.id, id))
    .limit(1);

  if (!invite) throw new Error("Invite code not found.");
  if (session.role !== "SYSTEM_ADMIN" && invite.createdById !== session.userId) {
    throw new Error("Unauthorized to revoke this invite code.");
  }

  await db
    .update(inviteCodes)
    .set({ status: "REVOKED" })
    .where(eq(inviteCodes.id, id));

  await db.insert(auditLogs).values({
    action: "INVITE_CODE_REVOKED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { inviteCodeId: id },
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/invites");
  } catch {
    // Non-HTTP / test context safe
  }
}

export async function deleteInviteCode(id: string) {
  const session = await assertAdminOrCoordinator();

  const [invite] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.id, id))
    .limit(1);

  if (!invite) throw new Error("Invite code not found.");
  if (session.role !== "SYSTEM_ADMIN" && invite.createdById !== session.userId) {
    throw new Error("Unauthorized to delete this invite code.");
  }

  await db.delete(inviteCodes).where(eq(inviteCodes.id, id));

  await db.insert(auditLogs).values({
    action: "INVITE_CODE_DELETED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { inviteCodeId: id, code: invite.code, role: invite.role },
  });

  try {
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/faculty/invites");
  } catch {
    // Non-HTTP / test context safe
  }

  return { success: true };
}

// ── Tutor Section Management ────────────────────────────────────────────────

export async function assignTutorSections(tutorId: string, sectionIds: string[]) {
  await assertAdmin();

  const [tutor] = await db.select().from(users).where(eq(users.id, tutorId));
  if (!tutor || tutor.role !== "CLASS_TUTOR") {
    throw new Error("Invalid tutor.");
  }

  await db.transaction(async (tx) => {
    // Remove existing assignments
    await tx.delete(tutorSections).where(eq(tutorSections.tutorId, tutorId));

    // Insert new assignments
    if (sectionIds.length > 0) {
      await tx.insert(tutorSections).values(
        sectionIds.map((secId) => ({ tutorId, sectionId: secId }))
      );
    }
  });

  return { success: true };
}

// ── Faculty & Department Management ─────────────────────────────────────────

export async function createFaculty(data: {
  name: string;
  code: string;
  initialDepartment?: {
    name: string;
    code: string;
  };
}) {
  const session = await assertAdminOrCoordinator();

  const name = data.name?.trim();
  const code = data.code?.trim().toUpperCase();

  if (!name || !code) {
    throw new Error("Faculty name and code are required.");
  }

  // Check if faculty with same code or name exists
  const existingFaculty = await db
    .select({ id: faculties.id, code: faculties.code, name: faculties.name })
    .from(faculties)
    .where(
      or(
        eq(sql`lower(${faculties.code})`, code.toLowerCase()),
        eq(sql`lower(${faculties.name})`, name.toLowerCase())
      )
    )
    .limit(1);

  if (existingFaculty.length > 0) {
    if (existingFaculty[0].code.toUpperCase() === code) {
      throw new Error(`Faculty code "${code}" already exists.`);
    }
    throw new Error(`Faculty name "${name}" already exists.`);
  }

  let initialDeptData = data.initialDepartment;
  if (initialDeptData && (!initialDeptData.name?.trim() || !initialDeptData.code?.trim())) {
    initialDeptData = undefined;
  }

  if (initialDeptData) {
    const deptName = initialDeptData.name.trim();
    const deptCode = initialDeptData.code.trim().toUpperCase();

    const existingDept = await db
      .select({ id: departments.id, code: departments.code, name: departments.name })
      .from(departments)
      .where(
        or(
          eq(sql`lower(${departments.code})`, deptCode.toLowerCase()),
          eq(sql`lower(${departments.name})`, deptName.toLowerCase())
        )
      )
      .limit(1);

    if (existingDept.length > 0) {
      if (existingDept[0].code.toUpperCase() === deptCode) {
        throw new Error(`Department code "${deptCode}" already exists.`);
      }
      throw new Error(`Department name "${deptName}" already exists.`);
    }
  }

  const result = await db.transaction(async (tx) => {
    const [newFaculty] = await tx
      .insert(faculties)
      .values({
        name,
        code,
      })
      .returning();

    let newDept = null;
    if (initialDeptData) {
      const deptName = initialDeptData.name.trim();
      const deptCode = initialDeptData.code.trim().toUpperCase();
      const [insertedDept] = await tx
        .insert(departments)
        .values({
          name: deptName,
          code: deptCode,
          facultyId: newFaculty.id,
        })
        .returning();
      newDept = insertedDept;

      await tx.insert(auditLogs).values({
        action: "DEPARTMENT_CREATED",
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        newValue: { id: insertedDept.id, name: deptName, code: deptCode, facultyId: newFaculty.id },
      });
    }

    await tx.insert(auditLogs).values({
      action: "FACULTY_CREATED",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      newValue: { id: newFaculty.id, name, code },
    });

    return { faculty: newFaculty, department: newDept };
  });

  try {
    const cache = await import("next/cache") as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/departments");
      cache.revalidatePath("/faculty/invites");
      cache.revalidatePath("/", "layout");
    }
    if (typeof cache.updateTag === "function") {
      cache.updateTag("hierarchy");
    }
    if (typeof cache.revalidateTag === "function") {
      cache.revalidateTag("hierarchy", "max");
    }
  } catch (err) {
    console.warn("Revalidation warning:", err);
  }

  return { success: true, ...result };
}

export async function createDepartment(data: {
  facultyId: string;
  name: string;
  code: string;
}) {
  const session = await assertAdminOrCoordinator();

  const facultyId = data.facultyId?.trim();
  const name = data.name?.trim();
  const code = data.code?.trim().toUpperCase();

  if (!facultyId) {
    throw new Error("Faculty is required.");
  }
  if (!name || !code) {
    throw new Error("Department name and code are required.");
  }

  const [faculty] = await db
    .select({ id: faculties.id, name: faculties.name })
    .from(faculties)
    .where(eq(faculties.id, facultyId));

  if (!faculty) {
    throw new Error("Selected faculty not found.");
  }

  const existingDept = await db
    .select({ id: departments.id, code: departments.code, name: departments.name })
    .from(departments)
    .where(
      or(
        eq(sql`lower(${departments.code})`, code.toLowerCase()),
        eq(sql`lower(${departments.name})`, name.toLowerCase())
      )
    )
    .limit(1);

  if (existingDept.length > 0) {
    if (existingDept[0].code.toUpperCase() === code) {
      throw new Error(`Department code "${code}" already exists.`);
    }
    throw new Error(`Department name "${name}" already exists.`);
  }

  const [newDepartment] = await db
    .insert(departments)
    .values({
      name,
      code,
      facultyId,
    })
    .returning();

  await db.insert(auditLogs).values({
    action: "DEPARTMENT_CREATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    newValue: { id: newDepartment.id, name, code, facultyId },
  });

  try {
    const cache = await import("next/cache") as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/departments");
      cache.revalidatePath("/faculty/invites");
      cache.revalidatePath("/", "layout");
    }
    if (typeof cache.updateTag === "function") {
      cache.updateTag("hierarchy");
    }
    if (typeof cache.revalidateTag === "function") {
      cache.revalidateTag("hierarchy", "max");
    }
  } catch (err) {
    console.warn("Revalidation warning:", err);
  }

  return { success: true, department: newDepartment };
}

export async function createProgramme(data: {
  departmentId: string;
  name: string;
  code: string;
  degreeType?: string | null;
  durationYears?: number | null;
  semesters?: number | null;
}) {
  const session = await assertAdminOrCoordinator();

  const departmentId = data.departmentId?.trim();
  const name = data.name?.trim();
  const code = data.code?.trim().toUpperCase();
  const degreeType = data.degreeType?.trim() || null;
  const durationYears = data.durationYears ?? 4;
  const semesters = data.semesters ?? (durationYears * 2);

  if (!departmentId) {
    throw new Error("Department is required.");
  }
  if (!name || !code) {
    throw new Error("Programme name and code are required.");
  }
  if (durationYears < 1 || durationYears > 10) {
    throw new Error("Duration must be between 1 and 10 years.");
  }
  if (semesters < 1 || semesters > 20) {
    throw new Error("Semesters must be between 1 and 20.");
  }

  const [dept] = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.id, departmentId));

  if (!dept) {
    throw new Error("Selected department not found.");
  }

  const existingProg = await db
    .select({ id: programmes.id, code: programmes.code, name: programmes.name })
    .from(programmes)
    .where(
      or(
        eq(sql`lower(${programmes.code})`, code.toLowerCase()),
        and(
          eq(sql`lower(${programmes.name})`, name.toLowerCase()),
          eq(programmes.departmentId, departmentId)
        )
      )
    )
    .limit(1);

  if (existingProg.length > 0) {
    if (existingProg[0].code.toUpperCase() === code) {
      throw new Error(`Programme code "${code}" already exists.`);
    }
    throw new Error(`Programme name "${name}" already exists in this department.`);
  }

  const [newProgramme] = await db
    .insert(programmes)
    .values({
      name,
      code,
      degreeType,
      durationYears,
      semesters,
      departmentId,
    })
    .returning();

  await db.insert(auditLogs).values({
    action: "PROGRAMME_CREATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    newValue: { id: newProgramme.id, name, code, degreeType, durationYears, semesters, departmentId },
  });

  try {
    const cache = await import("next/cache") as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/departments");
      cache.revalidatePath("/faculty/invites");
      cache.revalidatePath("/", "layout");
    }
    if (typeof cache.updateTag === "function") {
      cache.updateTag("hierarchy");
    }
    if (typeof cache.revalidateTag === "function") {
      cache.revalidateTag("hierarchy", "max");
    }
  } catch (err) {
    console.warn("Revalidation warning:", err);
  }

  return { success: true, programme: newProgramme };
}

export async function deleteFaculty(facultyId: string) {
  const session = await assertAdminOrCoordinator();

  const [faculty] = await db
    .select()
    .from(faculties)
    .where(eq(faculties.id, facultyId));

  if (!faculty) throw new Error("Faculty not found.");

  // Check if any users are linked directly to this faculty or to any child entity
  // (departments, programmes, academic batches, sections, or tutor assignments)
  const [usersCount] = await db
    .select({ count: count() })
    .from(users)
    .where(
      or(
        eq(users.facultyId, facultyId),
        sql`${users.departmentId} IN (
          SELECT id FROM departments WHERE faculty_id = ${facultyId}
        )`,
        sql`${users.programmeId} IN (
          SELECT p.id FROM programmes p
          JOIN departments d ON p.department_id = d.id
          WHERE d.faculty_id = ${facultyId}
        )`,
        sql`${users.academicBatchId} IN (
          SELECT b.id FROM academic_batches b
          JOIN programmes p ON b.programme_id = p.id
          JOIN departments d ON p.department_id = d.id
          WHERE d.faculty_id = ${facultyId}
        )`,
        sql`${users.sectionId} IN (
          SELECT s.id FROM sections s
          JOIN academic_batches b ON s.academic_batch_id = b.id
          JOIN programmes p ON b.programme_id = p.id
          JOIN departments d ON p.department_id = d.id
          WHERE d.faculty_id = ${facultyId}
        )`,
        sql`${users.id} IN (
          SELECT ts.tutor_id FROM tutor_sections ts
          JOIN sections s ON ts.section_id = s.id
          JOIN academic_batches b ON s.academic_batch_id = b.id
          JOIN programmes p ON b.programme_id = p.id
          JOIN departments d ON p.department_id = d.id
          WHERE d.faculty_id = ${facultyId}
        )`
      )
    );

  if (Number(usersCount?.count || 0) > 0) {
    throw new Error(`Cannot delete "${faculty.name}" because ${usersCount.count} user(s) are assigned to it or its child departments/classes.`);
  }

  // Check if any registration events are linked to batches under this faculty
  const [eventsCount] = await db
    .select({ count: count() })
    .from(registrationEvents)
    .where(
      sql`${registrationEvents.academicBatchId} IN (
        SELECT b.id FROM academic_batches b
        JOIN programmes p ON b.programme_id = p.id
        JOIN departments d ON p.department_id = d.id
        WHERE d.faculty_id = ${facultyId}
      )`
    );

  if (Number(eventsCount?.count || 0) > 0) {
    throw new Error(`Cannot delete "${faculty.name}" because ${eventsCount.count} registration event(s) are associated with it.`);
  }

  // Check if any event templates are linked to programmes under this faculty
  const [templatesCount] = await db
    .select({ count: count() })
    .from(eventTemplates)
    .where(
      sql`${eventTemplates.programmeId} IN (
        SELECT p.id FROM programmes p
        JOIN departments d ON p.department_id = d.id
        WHERE d.faculty_id = ${facultyId}
      )`
    );

  if (Number(templatesCount?.count || 0) > 0) {
    throw new Error(`Cannot delete "${faculty.name}" because ${templatesCount.count} event template(s) are associated with it.`);
  }

  await db.transaction(async (tx) => {
    // Clean up any invite codes linked to this faculty or its child hierarchy
    await tx.delete(inviteCodes).where(
      or(
        eq(inviteCodes.facultyId, facultyId),
        sql`${inviteCodes.departmentId} IN (
          SELECT id FROM departments WHERE faculty_id = ${facultyId}
        )`,
        sql`${inviteCodes.programmeId} IN (
          SELECT p.id FROM programmes p
          JOIN departments d ON p.department_id = d.id
          WHERE d.faculty_id = ${facultyId}
        )`,
        sql`${inviteCodes.academicBatchId} IN (
          SELECT b.id FROM academic_batches b
          JOIN programmes p ON b.programme_id = p.id
          JOIN departments d ON p.department_id = d.id
          WHERE d.faculty_id = ${facultyId}
        )`,
        sql`${inviteCodes.sectionId} IN (
          SELECT s.id FROM sections s
          JOIN academic_batches b ON s.academic_batch_id = b.id
          JOIN programmes p ON b.programme_id = p.id
          JOIN departments d ON p.department_id = d.id
          WHERE d.faculty_id = ${facultyId}
        )`
      )
    );

    // Delete faculty - cascade deletes departments, programmes, batches, sections
    await tx.delete(faculties).where(eq(faculties.id, facultyId));

    await tx.insert(auditLogs).values({
      action: "FACULTY_DELETED",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: { id: facultyId, name: faculty.name, code: faculty.code },
    });
  });

  try {
    const cache = await import("next/cache") as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/departments");
      cache.revalidatePath("/faculty/invites");
      cache.revalidatePath("/", "layout");
    }
    if (typeof cache.updateTag === "function") {
      cache.updateTag("hierarchy");
    }
    if (typeof cache.revalidateTag === "function") {
      cache.revalidateTag("hierarchy", "max");
    }
  } catch (err) {
    console.warn("Revalidation warning:", err);
  }

  return { success: true };
}

export async function deleteDepartment(departmentId: string) {
  const session = await assertAdminOrCoordinator();

  const [department] = await db
    .select()
    .from(departments)
    .where(eq(departments.id, departmentId));

  if (!department) throw new Error("Department not found.");

  // Check if any users are linked directly to this department or child entities
  const [usersCount] = await db
    .select({ count: count() })
    .from(users)
    .where(
      or(
        eq(users.departmentId, departmentId),
        sql`${users.programmeId} IN (
          SELECT id FROM programmes WHERE department_id = ${departmentId}
        )`,
        sql`${users.academicBatchId} IN (
          SELECT b.id FROM academic_batches b
          JOIN programmes p ON b.programme_id = p.id
          WHERE p.department_id = ${departmentId}
        )`,
        sql`${users.sectionId} IN (
          SELECT s.id FROM sections s
          JOIN academic_batches b ON s.academic_batch_id = b.id
          JOIN programmes p ON b.programme_id = p.id
          WHERE p.department_id = ${departmentId}
        )`,
        sql`${users.id} IN (
          SELECT ts.tutor_id FROM tutor_sections ts
          JOIN sections s ON ts.section_id = s.id
          JOIN academic_batches b ON s.academic_batch_id = b.id
          JOIN programmes p ON b.programme_id = p.id
          WHERE p.department_id = ${departmentId}
        )`
      )
    );

  if (Number(usersCount?.count || 0) > 0) {
    throw new Error(`Cannot delete "${department.name}" because ${usersCount.count} user(s) are assigned to it or its programmes/classes.`);
  }

  // Check if any registration events are linked to batches under this department
  const [eventsCount] = await db
    .select({ count: count() })
    .from(registrationEvents)
    .where(
      sql`${registrationEvents.academicBatchId} IN (
        SELECT b.id FROM academic_batches b
        JOIN programmes p ON b.programme_id = p.id
        WHERE p.department_id = ${departmentId}
      )`
    );

  if (Number(eventsCount?.count || 0) > 0) {
    throw new Error(`Cannot delete "${department.name}" because ${eventsCount.count} registration event(s) are associated with it.`);
  }

  // Check if any event templates are linked to programmes under this department
  const [templatesCount] = await db
    .select({ count: count() })
    .from(eventTemplates)
    .where(
      sql`${eventTemplates.programmeId} IN (
        SELECT id FROM programmes WHERE department_id = ${departmentId}
      )`
    );

  if (Number(templatesCount?.count || 0) > 0) {
    throw new Error(`Cannot delete "${department.name}" because ${templatesCount.count} event template(s) are associated with it.`);
  }

  await db.transaction(async (tx) => {
    // Clean up any invite codes linked to this department or child hierarchy
    await tx.delete(inviteCodes).where(
      or(
        eq(inviteCodes.departmentId, departmentId),
        sql`${inviteCodes.programmeId} IN (
          SELECT id FROM programmes WHERE department_id = ${departmentId}
        )`,
        sql`${inviteCodes.academicBatchId} IN (
          SELECT b.id FROM academic_batches b
          JOIN programmes p ON b.programme_id = p.id
          WHERE p.department_id = ${departmentId}
        )`,
        sql`${inviteCodes.sectionId} IN (
          SELECT s.id FROM sections s
          JOIN academic_batches b ON s.academic_batch_id = b.id
          JOIN programmes p ON b.programme_id = p.id
          WHERE p.department_id = ${departmentId}
        )`
      )
    );

    // Delete department - cascade deletes programmes, batches, sections
    await tx.delete(departments).where(eq(departments.id, departmentId));

    await tx.insert(auditLogs).values({
      action: "DEPARTMENT_DELETED",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: { id: departmentId, name: department.name, code: department.code, facultyId: department.facultyId },
    });
  });

  try {
    const cache = await import("next/cache") as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/departments");
      cache.revalidatePath("/faculty/invites");
      cache.revalidatePath("/", "layout");
    }
    if (typeof cache.updateTag === "function") {
      cache.updateTag("hierarchy");
    }
    if (typeof cache.revalidateTag === "function") {
      cache.revalidateTag("hierarchy", "max");
    }
  } catch (err) {
    console.warn("Revalidation warning:", err);
  }

  return { success: true };
}

// ── User Management (Create, Update, Delete, Password Reset, Status Toggle) ──

export async function createUser(data: {
  name: string;
  email: string;
  password?: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
  employeeId?: string;
  registerNumber?: string;
  phone?: string;
  programmeId?: string;
  academicBatchId?: string;
  sectionId?: string;
  isEligible?: boolean;
}) {
  const session = await assertAdmin();

  const name = data.name?.trim();
  const email = data.email?.trim().toLowerCase();
  if (!name) throw new Error("Name is required.");
  if (!email) throw new Error("Email is required.");

  // Check email uniqueness
  const [existingEmail] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email));
  if (existingEmail) throw new Error(`User with email "${email}" already exists.`);

  // Check employeeId if staff
  const employeeId = data.employeeId?.trim() || null;
  if (employeeId) {
    const [existingEmp] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.employeeId})`, employeeId.toLowerCase()));
    if (existingEmp) throw new Error(`Employee ID "${employeeId}" already exists.`);
  }

  // Check registerNumber if student
  const registerNumber = data.registerNumber?.trim().toUpperCase() || null;
  if (registerNumber) {
    const [existingReg] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.registerNumber})`, registerNumber.toLowerCase()));
    if (existingReg) throw new Error(`Register number "${registerNumber}" already exists.`);
  }

  const rawPassword = data.password?.trim() || (data.role === "STUDENT" ? (registerNumber || "Student@123") : "Welcome@123");
  const passwordHash = await bcrypt.hash(rawPassword, 12);

  const [newUser] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash,
      role: data.role,
      employeeId,
      registerNumber,
      phone: data.phone?.trim() || null,
      programmeId: data.programmeId || null,
      academicBatchId: data.academicBatchId || null,
      sectionId: data.sectionId || null,
      isEligible: data.isEligible !== undefined ? data.isEligible : true,
      isActive: true,
    })
    .returning();

  await db.insert(auditLogs).values({
    action: "USER_CREATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    newValue: { id: newUser.id, name, email, role: data.role },
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/faculty/users");

  return { success: true, user: newUser };
}

export async function updateUser(
  userId: string,
  data: {
    name?: string;
    email?: string;
    role?: string;
    employeeId?: string | null;
    registerNumber?: string | null;
    phone?: string | null;
    isActive?: boolean;
    isEligible?: boolean;
  }
) {
  const session = await assertAdmin();

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found.");

  if (isRootAdmin(user.email)) {
    if (data.email && !isRootAdmin(data.email)) {
      throw new Error(`The root administrator email cannot be changed from ${ROOT_ADMIN_EMAIL}.`);
    }
    if (data.role && data.role !== "SYSTEM_ADMIN") {
      throw new Error("The root administrator role cannot be changed.");
    }
    if (data.isActive === false) {
      throw new Error("The root administrator account cannot be deactivated.");
    }
  }

  const updates: Record<string, any> = { updatedAt: new Date() };

  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error("Name cannot be empty.");
    updates.name = name;
  }

  if (data.email !== undefined) {
    const email = data.email.trim().toLowerCase();
    if (!email) throw new Error("Email cannot be empty.");
    if (email !== user.email.toLowerCase()) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.email})`, email), sql`${users.id} != ${userId}`));
      if (existing) throw new Error(`Email "${email}" is already in use.`);
    }
    updates.email = email;
  }

  if (data.employeeId !== undefined) {
    const emp = data.employeeId?.trim() || null;
    if (emp && emp !== user.employeeId) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.employeeId})`, emp.toLowerCase()), sql`${users.id} != ${userId}`));
      if (existing) throw new Error(`Employee ID "${emp}" is already in use.`);
    }
    updates.employeeId = emp;
  }

  if (data.registerNumber !== undefined) {
    const reg = data.registerNumber?.trim().toUpperCase() || null;
    if (reg && reg !== user.registerNumber) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.registerNumber})`, reg.toLowerCase()), sql`${users.id} != ${userId}`));
      if (existing) throw new Error(`Register number "${reg}" is already in use.`);
    }
    updates.registerNumber = reg;
  }

  if (data.phone !== undefined) updates.phone = data.phone?.trim() || null;
  if (data.role !== undefined && ["SYSTEM_ADMIN", "COURSE_COORDINATOR", "CLASS_TUTOR", "STUDENT"].includes(data.role)) {
    updates.role = data.role;
  }
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.isEligible !== undefined) updates.isEligible = data.isEligible;

  await db.update(users).set(updates).where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    action: "USER_UPDATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    oldValue: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    newValue: updates,
    metadata: { targetUserId: userId },
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/faculty/users");

  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const session = await assertAdmin();
  if (session.userId === userId && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }

  const [targetUser] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  if (targetUser && isRootAdmin(targetUser.email) && !isActive) {
    throw new Error(`The root administrator (${ROOT_ADMIN_EMAIL}) cannot be deactivated.`);
  }

  await db
    .update(users)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { targetUserId: userId, newStatus: isActive },
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/faculty/users");

  return { success: true };
}

export async function toggleStudentEligibility(studentId: string, isEligible: boolean) {
  const session = await assertAdmin();

  await db
    .update(users)
    .set({ isEligible, updatedAt: new Date() })
    .where(eq(users.id, studentId));

  await db.insert(auditLogs).values({
    action: isEligible ? "STUDENT_MARKED_ELIGIBLE" : "STUDENT_MARKED_INELIGIBLE",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { targetStudentId: studentId, isEligible },
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/faculty/users");

  return { success: true };
}

export async function adminResetPassword(userId: string, newPassword: string) {
  const session = await assertAdmin();

  if (!newPassword || newPassword.trim().length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const passwordHash = await bcrypt.hash(newPassword.trim(), 12);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId));

  await db.insert(auditLogs).values({
    action: "PASSWORD_RESET_BY_ADMIN",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { targetUserId: userId },
  });

  return { success: true };
}

export async function deleteUser(userId: string) {
  const session = await assertAdmin();
  if (session.userId === userId) {
    throw new Error("You cannot delete your own account.");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error("User not found.");

  if (isRootAdmin(user.email)) {
    throw new Error(`The root system administrator (${ROOT_ADMIN_EMAIL}) is protected and cannot be deleted.`);
  }

  await db.transaction(async (tx) => {
    // 1. If user is a student, refund seats and clean up student records
    if (user.role === "STUDENT") {
      const studentRegs = await tx
        .select()
        .from(studentRegistrations)
        .where(eq(studentRegistrations.studentId, userId));

      // Only confirmed choices hold a seat; cancelled ones already gave theirs back.
      for (const reg of studentRegs) {
        if (reg.status !== "CONFIRMED") continue;
        await tx.select({ id: electives.id }).from(electives).where(eq(electives.id, reg.electiveId)).for("update");
        await releaseSeat(tx, reg.electiveId, user.sectionId);
      }

      await tx.delete(studentRegistrations).where(eq(studentRegistrations.studentId, userId));
      await tx.delete(registrations).where(eq(registrations.studentId, userId));
      await tx.delete(eventStudents).where(eq(eventStudents.studentId, userId));
    }

    // 2. If tutor, delete tutor section mappings
    if (user.role === "CLASS_TUTOR") {
      await tx.delete(tutorSections).where(eq(tutorSections.tutorId, userId));
    }

    // 3. Reassign references on items created by this user to current admin
    await tx.update(inviteCodes).set({ createdById: session.userId }).where(eq(inviteCodes.createdById, userId));
    await tx.update(eventTemplates).set({ createdById: session.userId }).where(eq(eventTemplates.createdById, userId));
    await tx.update(registrationEvents).set({ createdById: session.userId }).where(eq(registrationEvents.createdById, userId));

    // 4. Delete the user
    await tx.delete(users).where(eq(users.id, userId));

    // 5. Audit log
    await tx.insert(auditLogs).values({
      action: "USER_DELETED",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: { deletedUserId: userId, name: user.name, email: user.email, role: user.role },
    });
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/faculty/users");

  return { success: true };
}



