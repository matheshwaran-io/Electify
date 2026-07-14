"use server";

import { db } from "@/lib/db";
import { users, loginAttempts, inviteCodes, auditLogs, sections, faculties, departments, programmes, academicBatches } from "@/lib/db/schema";
import * as bcrypt from "bcryptjs";
import { signJWT, setSessionCookie, clearSessionCookie, type UserSession } from "@/lib/auth";
import { eq, and, asc } from "drizzle-orm";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginResult {
  success: boolean;
  error?: string;
  role?: string;
}

// ────────────────────────────────────────────────────────────────────
// Rate Limiting
// ────────────────────────────────────────────────────────────────────

async function handleRateLimit(identifier: string, ip: string): Promise<Date | null> {
  const now = new Date();

  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .limit(1);

  if (!attempt) {
    await db.insert(loginAttempts).values({ identifier, ip, attempts: 0 });
    return null;
  }

  // Check if locked out
  if (attempt.lockoutUntil && attempt.lockoutUntil > now) {
    return attempt.lockoutUntil;
  }

  // If lockout expired, reset
  if (attempt.lockoutUntil && attempt.lockoutUntil <= now) {
    await db
      .update(loginAttempts)
      .set({ attempts: 0, lockoutUntil: null })
      .where(eq(loginAttempts.identifier, identifier));
  }

  return null;
}

async function registerFailedAttempt(identifier: string, ip: string) {
  const [attempt] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .limit(1);

  if (!attempt) return;

  const newAttempts = attempt.attempts + 1;
  const isLockout = newAttempts >= MAX_ATTEMPTS;
  const lockoutUntil = isLockout ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

  await db
    .update(loginAttempts)
    .set({ attempts: newAttempts, lockoutUntil, ip })
    .where(eq(loginAttempts.identifier, identifier));
}

async function resetAttempts(identifier: string) {
  const [existing] = await db
    .select()
    .from(loginAttempts)
    .where(eq(loginAttempts.identifier, identifier))
    .limit(1);

  if (existing) {
    await db
      .update(loginAttempts)
      .set({ attempts: 0, lockoutUntil: null })
      .where(eq(loginAttempts.identifier, identifier));
  } else {
    await db.insert(loginAttempts).values({ identifier, ip: "local", attempts: 0 });
  }
}

// ────────────────────────────────────────────────────────────────────
// Unified Login (all roles use single `users` table)
// ────────────────────────────────────────────────────────────────────

export async function login(formData: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const { email, password } = formData;
  const ip = "client-ip"; // In production, get from request headers

  try {
    // Check lockout
    const lockoutTime = await handleRateLimit(email.toLowerCase().trim(), ip);
    if (lockoutTime) {
      const minutesRemaining = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Too many failed attempts. Account locked for ${minutesRemaining} minute(s).`,
      };
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      await registerFailedAttempt(email.toLowerCase().trim(), ip);
      return { success: false, error: "Invalid email or password." };
    }

    if (!user.isActive) {
      return {
        success: false,
        error: "Your account has been suspended. Please contact the administrator.",
      };
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await registerFailedAttempt(email.toLowerCase().trim(), ip);
      return { success: false, error: "Invalid email or password." };
    }

    // Reset lockout counter
    await resetAttempts(email.toLowerCase().trim());

    // Create JWT session
    const token = await signJWT({
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserSession["role"],
      ...(user.employeeId && { employeeId: user.employeeId }),
      ...(user.registerNumber && { registerNumber: user.registerNumber }),
      ...(user.facultyId && { facultyId: user.facultyId }),
      ...(user.departmentId && { departmentId: user.departmentId }),
      ...(user.programmeId && { programmeId: user.programmeId }),
      ...(user.sectionId && { sectionId: user.sectionId }),
    });

    await setSessionCookie(token);

    // Audit log
    await db.insert(auditLogs).values({
      action: "USER_LOGIN",
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      ipAddress: ip,
    });

    return { success: true, role: user.role };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ────────────────────────────────────────────────────────────────────
// Logout
// ────────────────────────────────────────────────────────────────────

export async function logout() {
  await clearSessionCookie();
}

// ────────────────────────────────────────────────────────────────────
// Staff Registration (via Invite Code)
// ────────────────────────────────────────────────────────────────────

export async function registerStaff(formData: {
  inviteCode: string;
  employeeId: string;
  name: string;
  email: string;
  phone?: string;
  section?: string; // Only for CLASS_TUTOR
  password: string;
}): Promise<LoginResult> {
  const { inviteCode, employeeId, name, email, phone, section, password } = formData;

  try {
    // 1. Validate invite code
    const [invite] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, inviteCode.trim()))
      .limit(1);

    if (!invite) {
      return { success: false, error: "Invalid invite code." };
    }

    if (invite.status !== "ACTIVE") {
      return { success: false, error: "This invite code has already been used or revoked." };
    }

    if (invite.expiresAt < new Date()) {
      await db
        .update(inviteCodes)
        .set({ status: "EXPIRED" })
        .where(eq(inviteCodes.id, invite.id));
      return { success: false, error: "This invite code has expired." };
    }

    // 2. Section validation for CLASS_TUTOR
    let resolvedSectionId: string | null = invite.sectionId || null;
    
    if (invite.role === "CLASS_TUTOR" && !resolvedSectionId) {
      if (!section) {
        return { success: false, error: "Class Tutors must select a section." };
      }
      // Look up section by label + academicBatchId from the invite
      if (invite.academicBatchId) {
        const [sec] = await db
          .select()
          .from(sections)
          .where(
            and(
              eq(sections.label, section.toUpperCase().trim()),
              eq(sections.academicBatchId, invite.academicBatchId)
            )
          )
          .limit(1);
        if (!sec) {
          return { success: false, error: "Invalid section. Please select A–J." };
        }
        resolvedSectionId = sec.id;
      } else {
        return { success: false, error: "Cannot assign section without a programme in the invite code. Contact Admin." };
      }
    }

    // 3. Email domain check
    if (!email.toLowerCase().trim().endsWith("@srmist.edu.in")) {
      return {
        success: false,
        error: "Registration requires an '@srmist.edu.in' email.",
      };
    }

    // 4. Duplicate checks
    const [existingEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    if (existingEmail) {
      return { success: false, error: "An account with this email already exists." };
    }

    const [existingEmp] = await db
      .select()
      .from(users)
      .where(eq(users.employeeId, employeeId.trim()))
      .limit(1);
    if (existingEmp) {
      return { success: false, error: "An account with this Employee ID already exists." };
    }

    // 5. Hash password and create user
    const hashed = await bcrypt.hash(password, 12);
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: hashed,
        role: invite.role,
        employeeId: employeeId.trim(),
        phone: phone?.trim() || null,
        facultyId: invite.facultyId,
        departmentId: invite.departmentId,
        programmeId: invite.programmeId,
        sectionId: resolvedSectionId,
      })
      .returning();

    // 6. Update invite code usage
    const updatedCount = invite.usedCount + 1;
    await db
      .update(inviteCodes)
      .set({
        usedCount: updatedCount,
        status: updatedCount >= invite.maxUses ? "USED" : "ACTIVE",
      })
      .where(eq(inviteCodes.id, invite.id));

    // 7. Audit log
    await db.insert(auditLogs).values({
      action: "STAFF_REGISTERED",
      userId: newUser.id,
      userEmail: newUser.email,
      userRole: newUser.role,
      metadata: {
        employeeId: newUser.employeeId,
        role: newUser.role,
        inviteCode: invite.code,
      },
    });

    // 8. Create session
    const token = await signJWT({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role as UserSession["role"],
      employeeId: newUser.employeeId!,
      ...(newUser.facultyId && { facultyId: newUser.facultyId }),
      ...(newUser.departmentId && { departmentId: newUser.departmentId }),
      ...(newUser.programmeId && { programmeId: newUser.programmeId }),
      ...(newUser.sectionId && { sectionId: newUser.sectionId }),
    });

    await setSessionCookie(token);

    return { success: true, role: newUser.role };
  } catch (error) {
    console.error("Staff registration error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ────────────────────────────────────────────────────────────────────
// Public Hierarchy (For Registration)
// ────────────────────────────────────────────────────────────────────

export async function getPublicHierarchy() {
  const allFaculties = await db.select().from(faculties).orderBy(asc(faculties.name));
  const allDepts = await db.select().from(departments).orderBy(asc(departments.name));
  const allProgs = await db.select().from(programmes).orderBy(asc(programmes.name));
  const allBatches = await db.select().from(academicBatches).orderBy(asc(academicBatches.year));
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
}
