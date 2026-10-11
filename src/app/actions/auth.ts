"use server";

import { db } from "@/lib/db";
import { users, loginAttempts, inviteCodes, auditLogs, sections, faculties, departments, programmes, academicBatches, tutorSections } from "@/lib/db/schema";
import * as bcrypt from "bcryptjs";
import { signJWT, setSessionCookie, clearSessionCookie, getSession, type UserSession } from "@/lib/auth";
import { eq, and, asc, or } from "drizzle-orm";
import { z } from "zod";
import { cleanDisplayName } from "@/lib/format";

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
    // Ensure any newly added schema columns exist in the database
    const { ensureDatabaseReady } = await import("@/lib/db");
    await ensureDatabaseReady();

    // Check lockout (gracefully handled if table is initializing)
    let lockoutTime: Date | null = null;
    try {
      lockoutTime = await handleRateLimit(normalizedIdentifier.toLowerCase(), ip);
    } catch (rlErr) {
      console.warn("Rate limit check warning:", rlErr);
    }

    if (lockoutTime) {
      const minutesRemaining = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Too many failed attempts. Account locked for ${minutesRemaining} minute(s).`,
      };
    }

    // Find user by email (staff) OR register number (students)
    // Select specific known columns to prevent failures if non-critical columns are missing
    const [foundUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        passwordHash: users.passwordHash,
        role: users.role,
        isActive: users.isActive,
        isEligible: users.isEligible,
        employeeId: users.employeeId,
        registerNumber: users.registerNumber,
        facultyId: users.facultyId,
        departmentId: users.departmentId,
        programmeId: users.programmeId,
        academicBatchId: users.academicBatchId,
        sectionId: users.sectionId,
      })
      .from(users)
      .where(
        or(
          eq(users.email, normalizedIdentifier.toLowerCase()),
          eq(users.registerNumber, normalizedIdentifier.toUpperCase())
        )
      )
      .limit(1);

    let user = foundUser;

    // Self-healing: if logging in with default master admin and no record exists, auto-provision it
    if (!user && normalizedIdentifier.toLowerCase() === "admin@electify.edu" && password === "Admin@12345") {
      try {
        const adminHash = await bcrypt.hash("Admin@12345", 12);
        const [seededAdmin] = await db
          .insert(users)
          .values({
            name: "System Administrator",
            email: "admin@electify.edu",
            passwordHash: adminHash,
            role: "SYSTEM_ADMIN",
            employeeId: "EMP-ADMIN",
            isActive: true,
            isEligible: true,
          })
          .onConflictDoNothing({ target: users.email })
          .returning();

        if (seededAdmin) {
          user = seededAdmin;
        } else {
          const [existingAdmin] = await db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              passwordHash: users.passwordHash,
              role: users.role,
              isActive: users.isActive,
              isEligible: users.isEligible,
              employeeId: users.employeeId,
              registerNumber: users.registerNumber,
              facultyId: users.facultyId,
              departmentId: users.departmentId,
              programmeId: users.programmeId,
              academicBatchId: users.academicBatchId,
              sectionId: users.sectionId,
            })
            .from(users)
            .where(eq(users.email, "admin@electify.edu"))
            .limit(1);
          user = existingAdmin;
        }
      } catch (provisionErr) {
        console.error("Auto-provision default admin failed:", provisionErr);
      }
    }

    if (!user) {
      try {
        await registerFailedAttempt(normalizedIdentifier.toLowerCase(), ip);
      } catch {}
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
      try {
        await registerFailedAttempt(normalizedIdentifier.toLowerCase(), ip);
      } catch {}
      return { success: false, error: "Invalid credentials." };
    }

    // Reset lockout counter
    try {
      await resetAttempts(normalizedIdentifier.toLowerCase());
    } catch (resetErr) {
      console.warn("Reset attempts warning:", resetErr);
    }

    // For Class Tutors and Coordinators, fetch their mapped sections and default to the first one
    let activeSectionId = user.sectionId;
    if (user.role === "CLASS_TUTOR" || user.role === "COURSE_COORDINATOR") {
      try {
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
      } catch (tutorSecErr) {
        console.warn("Tutor sections lookup warning:", tutorSecErr);
      }
    }

    // Enforce 1 session per login: Generate new unique session ID
    const sessionId = crypto.randomUUID();
    try {
      await db
        .update(users)
        .set({ currentSessionId: sessionId, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    } catch (sessionErr) {
      console.warn("Could not save currentSessionId (column may be pending):", sessionErr);
      try {
        await db
          .update(users)
          .set({ updatedAt: new Date() })
          .where(eq(users.id, user.id));
      } catch {}
    }

    // Create JWT session
    const token = await signJWT({
      userId: user.id,
      name: cleanDisplayName(user.name),
      email: user.email,
      role: user.role as UserSession["role"],
      sessionId,
      ...(user.employeeId && { employeeId: user.employeeId }),
      ...(user.registerNumber && { registerNumber: user.registerNumber }),
      ...(user.facultyId && { facultyId: user.facultyId }),
      ...(user.departmentId && { departmentId: user.departmentId }),
      ...(user.programmeId && { programmeId: user.programmeId }),
      ...(activeSectionId && { sectionId: activeSectionId }),
    });

    await setSessionCookie(token);

    // Sync active section cookie
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    if (activeSectionId) {
      cookieStore.set("electify_active_section", activeSectionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7200,
      });
    } else {
      cookieStore.delete("electify_active_section");
    }

    // Audit log
    try {
      await db.insert(auditLogs).values({
        action: "USER_LOGIN",
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        ipAddress: ip,
      });
    } catch (auditErr) {
      console.warn("Audit log insert warning:", auditErr);
    }

    return { success: true, role: user.role };
  } catch (error: any) {
    console.error("Login error:", error);
    const msg = error?.message || String(error);
    if (msg.includes("SSL") || msg.includes("self-signed") || msg.includes("certificate")) {
      return { success: false, error: "Database SSL error. Please verify database SSL settings." };
    }
    if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("timeout") || msg.includes("connect")) {
      return { success: false, error: "Cannot reach database. Please check DATABASE_URL." };
    }
    if (msg.includes("password authentication failed")) {
      return { success: false, error: "Database password authentication failed. Check DATABASE_URL." };
    }
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

// ────────────────────────────────────────────────────────────────────
// Logout
// ────────────────────────────────────────────────────────────────────

export async function logout() {
  const session = await getSession();
  if (session?.userId) {
    try {
      await db.update(users).set({ currentSessionId: null }).where(eq(users.id, session.userId));
    } catch {}
  }
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
    const allFaculties = await db.select().from(faculties).where(eq(faculties.isActive, true)).orderBy(asc(faculties.name));
    const allDepts = await db.select().from(departments).where(eq(departments.isActive, true)).orderBy(asc(departments.name));
    const allProgs = await db.select().from(programmes).where(eq(programmes.isActive, true)).orderBy(asc(programmes.name));
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
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) {
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

export async function setWorkspacePortal(workspace: "COORDINATOR" | "TUTOR") {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") {
    throw new Error("Unauthorized");
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set("electify_active_workspace", workspace, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7200, // 2 hours
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/", "layout");
  return { success: true };
}
