"use server";

import { db } from "@/lib/db";
import { users, loginAttempts, inviteCodes, auditLogs, sections, faculties, departments, programmes, academicBatches, tutorSections } from "@/lib/db/schema";
import * as bcrypt from "bcryptjs";
import { signJWT, setSessionCookie, clearSessionCookie, getSession, type UserSession } from "@/lib/auth";
import { eq, and, asc, or } from "drizzle-orm";
import { z } from "zod";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginResult {
  success: boolean;
  error?: string;
  role?: string;
}

const loginSchema = z.object({
  identifier: z.string().min(1, "Email or register number is required"),
  password: z.string().min(1, "Password is required"),
});

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
  identifier: string;
  password: string;
}): Promise<LoginResult> {
  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: "Invalid credentials format." };
  }
  const { identifier, password } = parsed.data;
  const normalizedIdentifier = identifier.trim();
  const ip = "client-ip"; // In production, get from request headers

  try {
    // Check lockout
    const lockoutTime = await handleRateLimit(normalizedIdentifier.toLowerCase(), ip);
    if (lockoutTime) {
      const minutesRemaining = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Too many failed attempts. Account locked for ${minutesRemaining} minute(s).`,
      };
    }

    // Find user by email (staff) OR register number (students)
    const [user] = await db
      .select()
      .from(users)
      .where(
        or(
          eq(users.email, normalizedIdentifier.toLowerCase()),
          eq(users.registerNumber, normalizedIdentifier.toUpperCase())
        )
      )
      .limit(1);

    if (!user) {
      await registerFailedAttempt(normalizedIdentifier.toLowerCase(), ip);
      return { success: false, error: "Invalid credentials." };
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
      await registerFailedAttempt(normalizedIdentifier.toLowerCase(), ip);
      return { success: false, error: "Invalid credentials." };
    }

    // Reset lockout counter
    await resetAttempts(normalizedIdentifier.toLowerCase());

    // For Class Tutors, fetch their mapped sections and default to the first one
    let activeSectionId = user.sectionId;
    if (user.role === "CLASS_TUTOR") {
      const assignedSections = await db
        .select({ sectionId: tutorSections.sectionId })
        .from(tutorSections)
        .where(eq(tutorSections.tutorId, user.id))
        .limit(1);
      
      if (assignedSections.length > 0) {
        activeSectionId = assignedSections[0].sectionId;
      } else {
        activeSectionId = null; // No sections assigned yet
      }
    }

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
      ...(activeSectionId && { sectionId: activeSectionId }),
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

const registerStaffSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
  // employeeId: z.string().min(1, "Employee ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  phone: z.string().optional(),
  facultyId: z.string().min(1, "Faculty is required"),
  departmentId: z.string().min(1, "Department is required"),
  programmeId: z.string().min(1, "Programme is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// ────────────────────────────────────────────────────────────────────
// Staff Registration (via Invite Code)
// ────────────────────────────────────────────────────────────────────

export async function registerStaff(formData: {
  inviteCode: string;
  name: string;
  email: string;
  phone?: string;
  facultyId: string;
  departmentId: string;
  programmeId: string;
  password: string;
}): Promise<LoginResult> {
  const parsed = registerStaffSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { inviteCode, name, email, phone, facultyId, departmentId, programmeId, password } = parsed.data;

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

    // 5. Hash password and create user
    const hashed = await bcrypt.hash(password, 12);
    const [newUser] = await db
      .insert(users)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: hashed,
        role: invite.role,
        phone: phone?.trim() || null,
        facultyId: facultyId,
        departmentId: departmentId,
        programmeId: programmeId,
        academicBatchId: null,
        sectionId: null,
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
      ...(newUser.employeeId && { employeeId: newUser.employeeId }),
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

import { unstable_cache } from "next/cache";

export const getPublicHierarchy = unstable_cache(
  async () => {
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
  },
  ["public-hierarchy"],
  { tags: ["hierarchy"], revalidate: 3600 }
);

// ────────────────────────────────────────────────────────────────────
// Tutor Context Switching
// ────────────────────────────────────────────────────────────────────

export async function switchTutorSection(sectionId: string) {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") {
    throw new Error("Unauthorized");
  }

  // Verify the tutor actually has access to this section
  const [assignment] = await db
    .select()
    .from(tutorSections)
    .where(and(eq(tutorSections.tutorId, session.userId), eq(tutorSections.sectionId, sectionId)))
    .limit(1);

  if (!assignment) {
    throw new Error("You are not assigned to this section.");
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set("electify_active_section", assignment.sectionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7200, // 2 hours
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
  return { success: true, newSectionId: assignment.sectionId };
}
