"use server";

import { db } from "@/lib/db";
import {
  users, registrationEvents, faculties, departments,
  programmes, sections, auditLogs, eventTemplates,
  templateGroups, templateElectives, inviteCodes, systemSettings
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, desc, count, asc, ilike, or } from "drizzle-orm";

async function assertAdmin() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") throw new Error("Unauthorized");
  return session;
}

// ── Events ──────────────────────────────────────────────────────────────────

export async function getEvents() {
  await assertAdmin();
  const events = await db
    .select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      academicYear: registrationEvents.academicYear,
      status: registrationEvents.status,
      openDate: registrationEvents.openDate,
      closeDate: registrationEvents.closeDate,
      createdAt: registrationEvents.createdAt,
      programmeName: programmes.name,
      programmeCode: programmes.code,
    })
    .from(registrationEvents)
    .leftJoin(programmes, eq(registrationEvents.programmeId, programmes.id))
    .orderBy(desc(registrationEvents.createdAt));
  return events;
}

// ── Academic Hierarchy ──────────────────────────────────────────────────────

export async function getDepartmentsTree() {
  await assertAdmin();

  const allFaculties = await db.select().from(faculties).orderBy(asc(faculties.name));
  const allDepts = await db.select().from(departments).orderBy(asc(departments.name));
  const allProgs = await db.select().from(programmes).orderBy(asc(programmes.name));
  const allSections = await db.select().from(sections).orderBy(asc(sections.label));

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
              sections: allSections.filter((s) => s.programmeId === p.id),
            })),
        })),
    })),
  };
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
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      employeeId: users.employeeId,
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
}

export async function getStudentUsers() {
  await assertAdmin();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      registerNumber: users.registerNumber,
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
  await assertAdmin();
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
  await db
    .update(systemSettings)
    .set({ maintenanceMode: enabled })
    .where(eq(systemSettings.id, "system"));
}

// ── Invite Codes (Create / Revoke) ───────────────────────────────────────────

export async function createInviteCode(formData: {
  role: "COURSE_COORDINATOR" | "CLASS_TUTOR";
  facultyId?: string;
  departmentId?: string;
  programmeId?: string;
  sectionId?: string;
  maxUses: number;
  expiresInDays: number;
}) {
  const session = await assertAdmin();

  // Generate a random 8-char alphanumeric code
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();

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

  return { code };
}

export async function revokeInviteCode(id: string) {
  const session = await assertAdmin();

  await db
    .update(inviteCodes)
    .set({ status: "REVOKED" })
    .where(eq(inviteCodes.id, id));

  await db.insert(auditLogs).values({
    action: "INVITE_CODE_REVOKED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { id },
  });
}

