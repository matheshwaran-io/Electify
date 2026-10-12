"use server";

import { db } from "@/lib/db";
import { users, loginAttempts, inviteCodes, auditLogs, sections, faculties, departments, programmes, academicBatches, tutorSections, passwordResetRequests } from "@/lib/db/schema";
import * as bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import {
  signJWT,
  setSessionCookie,
  clearSessionCookie,
  getSession,
  signPasswordUpgradeTicket,
  verifyPasswordUpgradeTicket,
  type UserSession,
} from "@/lib/auth";
import { eq, and, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { cleanDisplayName } from "@/lib/format";
import { isAcceptablePassword, normalizeRegisterNumber, passwordProblem, REGISTER_NUMBER_PATTERN } from "@/lib/password-policy";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginResult {
  success: boolean;
  error?: string;
  role?: string;
  /** Set when a student signed in with a legacy PIN or default password and must choose a new one first. */
  requiresPasswordUpgrade?: boolean;
  upgradeTicket?: string;
}

const loginSchema = z.object({
  identifier: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});

/** bcrypt cost for every password this module sets. */
const HASH_ROUNDS = 12;

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
// Shared session helpers
// ────────────────────────────────────────────────────────────────────

// Specific known columns, so login keeps working if non-critical columns are missing.
const authUserColumns = {
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
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
  employeeId: string | null;
  registerNumber: string | null;
  facultyId: string | null;
  departmentId: string | null;
  programmeId: string | null;
  sectionId: string | null;
};

const LOGIN_IP = "client-ip"; // In production, get from request headers

/** Starts a fresh session for an authenticated user (single active session per user). */
async function startSession(user: AuthUser) {
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
  try {
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
  } catch {
    // Handled in test or script execution
  }

  // Audit log
  try {
    await db.insert(auditLogs).values({
      action: "USER_LOGIN",
      userId: user.id,
      userEmail: user.email,
      userRole: user.role,
      ipAddress: LOGIN_IP,
    });
  } catch (auditErr) {
    console.warn("Audit log insert warning:", auditErr);
  }
}

/** Database problems get a specific message; everything else stays generic. */
function authErrorMessage(error: unknown) {
  const msg = (error as Error)?.message || String(error);
  if (msg.includes("SSL") || msg.includes("self-signed") || msg.includes("certificate")) {
    return "Database SSL error. Please verify database SSL settings.";
  }
  if (msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("timeout") || msg.includes("connect")) {
    return "Cannot reach database. Please check DATABASE_URL.";
  }
  if (msg.includes("password authentication failed")) {
    return "Database password authentication failed. Check DATABASE_URL.";
  }
  return "An unexpected error occurred. Please try again.";
}

/** Short fingerprint of the stored hash: an upgrade ticket is void once the password changes. */
function hashFingerprint(passwordHash: string) {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 24);
}

async function lockoutMessage(key: string): Promise<string | null> {
  let lockoutTime: Date | null = null;
  try {
    lockoutTime = await handleRateLimit(key, LOGIN_IP);
  } catch (rlErr) {
    console.warn("Rate limit check warning:", rlErr);
  }
  if (!lockoutTime) return null;
  const minutesRemaining = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
  return `Too many failed attempts. Account locked for ${minutesRemaining} minute(s).`;
}

async function recordFailure(key: string) {
  try {
    await registerFailedAttempt(key, LOGIN_IP);
  } catch {}
}

// ────────────────────────────────────────────────────────────────────
// Staff Login (email + password). Students use studentLogin below.
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
  const normalizedEmail = identifier.trim().toLowerCase();

  try {
    // Ensure any newly added schema columns exist in the database
    const { ensureDatabaseReady } = await import("@/lib/db");
    await ensureDatabaseReady();

    // Check lockout (gracefully handled if table is initializing)
    const locked = await lockoutMessage(normalizedEmail);
    if (locked) return { success: false, error: locked };

    const [foundUser] = await db.select(authUserColumns).from(users).where(eq(users.email, normalizedEmail)).limit(1);

    let user: AuthUser | undefined = foundUser;

    // Self-healing: if logging in with default master admin and no record exists, auto-provision it
    if (!user && normalizedEmail === "admin@electify.edu" && password === "Admin@12345") {
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
          const [existingAdmin] = await db.select(authUserColumns).from(users).where(eq(users.email, "admin@electify.edu")).limit(1);
          user = existingAdmin;
        }
      } catch (provisionErr) {
        console.error("Auto-provision default admin failed:", provisionErr);
      }
    }

    if (!user) {
      await recordFailure(normalizedEmail);
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
      await recordFailure(normalizedEmail);
      return { success: false, error: "Invalid credentials." };
    }

    // Students sign in with their register number only. Said only after a
    // correct password, so it reveals nothing to someone guessing.
    if (user.role === "STUDENT") {
      return { success: false, error: "Students sign in on the Student tab with their register number and password." };
    }

    // Reset lockout counter
    try {
      await resetAttempts(normalizedEmail);
    } catch (resetErr) {
      console.warn("Reset attempts warning:", resetErr);
    }

    await startSession(user);
    return { success: true, role: user.role };
  } catch (error: unknown) {
    console.error("Login error:", error);
    return { success: false, error: authErrorMessage(error) };
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
  ["public-hierarchy"],
  { tags: ["hierarchy"], revalidate: 60 }
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

// ────────────────────────────────────────────────────────────────────
// STUDENT CLASS CODE SELF-ONBOARDING & PASSWORD AUTH
// Students sign in with their register number and a password.
// ────────────────────────────────────────────────────────────────────

/**
 * Validates a class signup code and returns safe, read-only class metadata for student confirmation.
 */
export async function validateClassSignupCode(rawCode: string) {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code) {
    return { valid: false, error: "Please enter a class signup code." };
  }

  const { ensureDatabaseReady } = await import("@/lib/db");
  await ensureDatabaseReady();

  const [invite] = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      role: inviteCodes.role,
      status: inviteCodes.status,
      maxUses: inviteCodes.maxUses,
      usedCount: inviteCodes.usedCount,
      expiresAt: inviteCodes.expiresAt,
      sectionId: inviteCodes.sectionId,
      academicBatchId: inviteCodes.academicBatchId,
      programmeId: inviteCodes.programmeId,
      departmentId: inviteCodes.departmentId,
      facultyId: inviteCodes.facultyId,
      createdById: inviteCodes.createdById,
    })
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code))
    .limit(1);

  if (!invite || invite.role !== "STUDENT") {
    return { valid: false, error: "Invalid class signup code. Please check with your class tutor." };
  }

  if (invite.status === "REVOKED") {
    return { valid: false, error: "This class signup code has been revoked by the tutor." };
  }

  if (invite.expiresAt < new Date()) {
    if (invite.status !== "EXPIRED") {
      await db.update(inviteCodes).set({ status: "EXPIRED" }).where(eq(inviteCodes.id, invite.id));
    }
    return { valid: false, error: "This class signup code has expired." };
  }

  if (invite.usedCount >= invite.maxUses) {
    return { valid: false, error: `This class code has reached its maximum activation limit of ${invite.maxUses} students.` };
  }

  // Fetch contextual class details strictly from server-side records
  let sectionLabel = "";
  let batchYear = "";
  let programmeName = "";
  let programmeCode = "";
  let departmentName = "";
  let tutorName = "";

  if (invite.sectionId) {
    const [sec] = await db.select({ label: sections.label }).from(sections).where(eq(sections.id, invite.sectionId)).limit(1);
    if (sec) sectionLabel = sec.label;
  }
  if (invite.academicBatchId) {
    const [batch] = await db.select({ year: academicBatches.year }).from(academicBatches).where(eq(academicBatches.id, invite.academicBatchId)).limit(1);
    if (batch) batchYear = batch.year;
  }
  if (invite.programmeId) {
    const [prog] = await db.select({ name: programmes.name, code: programmes.code }).from(programmes).where(eq(programmes.id, invite.programmeId)).limit(1);
    if (prog) {
      programmeName = prog.name;
      programmeCode = prog.code;
    }
  }
  if (invite.departmentId) {
    const [dept] = await db.select({ name: departments.name }).from(departments).where(eq(departments.id, invite.departmentId)).limit(1);
    if (dept) departmentName = dept.name;
  }
  if (invite.createdById) {
    const [tutor] = await db.select({ name: users.name }).from(users).where(eq(users.id, invite.createdById)).limit(1);
    if (tutor) tutorName = tutor.name;
  }

  return {
    valid: true,
    data: {
      code: invite.code,
      sectionLabel: sectionLabel || "Default",
      className: `${programmeCode || "Class"} ${sectionLabel || ""}`.trim(),
      batchYear: batchYear || "2026",
      programmeName: programmeName || "Academic Programme",
      programmeCode: programmeCode || "PROG",
      departmentName: departmentName || "Academic Department",
      tutorName: tutorName || "Assigned Class Tutor",
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      spotsRemaining: Math.max(0, invite.maxUses - invite.usedCount),
    },
  };
}

/** Register number: trimmed, upper-cased, letters and digits only. */
const registerNumberField = z
  .string()
  .min(1, "Register number is required")
  .transform(normalizeRegisterNumber)
  .refine((v) => REGISTER_NUMBER_PATTERN.test(v), "Register number must be 5–20 letters and digits, e.g. RA2532241010001");

const studentClassSignupSchema = z
  .object({
    code: z.string().min(1, "Class signup code is required"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Invalid email format")
      .refine(
        (val) => val.toLowerCase().trim().endsWith("@srmist.edu.in"),
        "Only official @srmist.edu.in student emails are permitted"
      ),
    registerNumber: registerNumberField,
    password: z.string().min(1, "Password is required"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    name: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const problem = passwordProblem(data.password, { registerNumber: data.registerNumber });
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["password"] });
    else if (data.password !== data.confirmPassword) ctx.addIssue({ code: "custom", message: "Passwords do not match", path: ["confirmPassword"] });
  });

/**
 * Registers a student with their class code and a personal password.
 * Faculty, department, programme, and section are derived exclusively from the server-side code record.
 */
export async function registerStudentWithClassCode(formData: {
  code: string;
  email: string;
  registerNumber: string;
  password: string;
  confirmPassword: string;
  name?: string;
}): Promise<LoginResult> {
  const parsed = studentClassSignupSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { code, email, registerNumber, password, name } = parsed.data;
  const normalizedCode = code.trim().toUpperCase();
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const { ensureDatabaseReady } = await import("@/lib/db");
    await ensureDatabaseReady();

    // 1. Fetch and validate class code record
    const [invite] = await db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, normalizedCode))
      .limit(1);

    if (!invite || invite.role !== "STUDENT") {
      return { success: false, error: "Invalid class signup code. Please check with your class tutor." };
    }

    if (invite.status === "REVOKED") {
      return { success: false, error: "This class code has been revoked by the tutor." };
    }

    if (invite.expiresAt < new Date()) {
      await db.update(inviteCodes).set({ status: "EXPIRED" }).where(eq(inviteCodes.id, invite.id));
      return { success: false, error: "This class signup code has expired." };
    }

    // Server-side hard activation limit check
    if (invite.usedCount >= invite.maxUses) {
      return {
        success: false,
        error: `This class code has reached its maximum activation limit of ${invite.maxUses} students.`,
      };
    }

    // 2. Strict deduplication check
    const [existingReg] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.registerNumber, registerNumber))
      .limit(1);

    if (existingReg) {
      return {
        success: false,
        error: "A student account with this registration number already exists. Please sign in with your register number and password.",
      };
    }

    const [existingEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingEmail) {
      return {
        success: false,
        error: "An account with this student email already exists. Please sign in with your register number and password.",
      };
    }

    // 3. Hash the password with bcrypt
    const passwordHash = await bcrypt.hash(password, HASH_ROUNDS);
    const displayName = cleanDisplayName(name?.trim() || normalizedEmail.split("@")[0].toUpperCase());

    // 4. Create student strictly bound to code's server record
    const [newUser] = await db
      .insert(users)
      .values({
        name: displayName,
        email: normalizedEmail,
        passwordHash,
        role: "STUDENT",
        registerNumber,
        facultyId: invite.facultyId,
        departmentId: invite.departmentId,
        programmeId: invite.programmeId,
        academicBatchId: invite.academicBatchId,
        sectionId: invite.sectionId,
        isActive: true,
        isEligible: true,
      })
      .returning();

    // 5. Update activation counter
    const nextCount = invite.usedCount + 1;
    await db
      .update(inviteCodes)
      .set({
        usedCount: nextCount,
        status: nextCount >= invite.maxUses ? "USED" : "ACTIVE",
      })
      .where(eq(inviteCodes.id, invite.id));

    // 6. Audit log
    await db.insert(auditLogs).values({
      action: "STUDENT_CLASS_SIGNUP",
      userId: newUser.id,
      userEmail: newUser.email,
      userRole: "STUDENT",
      metadata: {
        registerNumber: newUser.registerNumber,
        code: invite.code,
        sectionId: invite.sectionId,
        activationNumber: nextCount,
      },
    });

    // 7. Establish session
    await startSession(newUser);

    return { success: true, role: "STUDENT" };
  } catch (error: unknown) {
    console.error("Student class registration error:", error);
    return { success: false, error: "An unexpected error occurred while creating your account. Please try again." };
  }
}

/**
 * Signs a student in with their register number and password. Email
 * addresses are not accepted here.
 *
 * Accounts that still have an old credential (a 6-digit PIN, the register
 * number as a default password, or a handed-out default) are not given a
 * session: the student gets a 10-minute ticket to choose a proper password
 * first (upgradeStudentPassword).
 */
export async function studentLogin(formData: { registerNumber: string; password: string }): Promise<LoginResult> {
  const raw = (formData.registerNumber || "").trim();
  const password = formData.password || "";

  if (!raw || !password) {
    return { success: false, error: "Enter your register number and password." };
  }
  if (raw.includes("@")) {
    return { success: false, error: "Students sign in with their register number, not an email address." };
  }

  const registerNumber = normalizeRegisterNumber(raw);
  if (!REGISTER_NUMBER_PATTERN.test(registerNumber)) {
    return { success: false, error: "Enter a valid register number, e.g. RA2532241010001." };
  }
  const rateKey = registerNumber.toLowerCase();

  try {
    const { ensureDatabaseReady } = await import("@/lib/db");
    await ensureDatabaseReady();

    const locked = await lockoutMessage(rateKey);
    if (locked) return { success: false, error: locked };

    const [user] = await db
      .select(authUserColumns)
      .from(users)
      .where(and(eq(users.registerNumber, registerNumber), eq(users.role, "STUDENT")))
      .limit(1);

    if (!user) {
      await recordFailure(rateKey);
      return { success: false, error: "Invalid credentials." };
    }

    if (!user.isActive) {
      return { success: false, error: "Your account has been suspended. Please contact the administrator." };
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) {
      await recordFailure(rateKey);
      return { success: false, error: "Invalid credentials." };
    }

    try {
      await resetAttempts(rateKey);
    } catch (resetErr) {
      console.warn("Reset attempts warning:", resetErr);
    }

    if (!isAcceptablePassword(password, { registerNumber })) {
      return {
        success: false,
        requiresPasswordUpgrade: true,
        upgradeTicket: await signPasswordUpgradeTicket(user.id, hashFingerprint(user.passwordHash)),
        error: "Choose a new password to continue.",
      };
    }

    await startSession(user);
    return { success: true, role: "STUDENT" };
  } catch (error: unknown) {
    console.error("Student login error:", error);
    return { success: false, error: authErrorMessage(error) };
  }
}

/**
 * Second step of studentLogin for accounts with an old credential: sets a
 * password that meets the policy and starts the session.
 */
export async function upgradeStudentPassword(formData: {
  ticket: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<LoginResult> {
  const expired = { success: false, error: "This step timed out. Sign in again to continue." };
  const claims = await verifyPasswordUpgradeTicket(formData.ticket || "");
  if (!claims) return expired;

  const newPassword = formData.newPassword || "";
  if (newPassword !== (formData.confirmPassword || "")) {
    return { success: false, error: "Passwords do not match." };
  }

  try {
    const [user] = await db
      .select(authUserColumns)
      .from(users)
      .where(and(eq(users.id, claims.userId), eq(users.role, "STUDENT")))
      .limit(1);

    // The ticket is tied to the hash it was issued for, so it is single-use.
    if (!user || hashFingerprint(user.passwordHash) !== claims.fingerprint) return expired;
    if (!user.isActive) {
      return { success: false, error: "Your account has been suspended. Please contact the administrator." };
    }

    const problem = passwordProblem(newPassword, { registerNumber: user.registerNumber ?? undefined });
    if (problem) return { success: false, error: problem };
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      return { success: false, error: "Choose a password that is different from your old one." };
    }

    const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    await db.insert(auditLogs).values({
      action: "PASSWORD_UPGRADED",
      userId: user.id,
      userEmail: user.email,
      userRole: "STUDENT",
      metadata: { registerNumber: user.registerNumber, reason: "legacy or default credential" },
    });

    await startSession({ ...user, passwordHash });
    return { success: true, role: "STUDENT" };
  } catch (error: unknown) {
    console.error("Password upgrade error:", error);
    return { success: false, error: authErrorMessage(error) };
  }
}

/**
 * Initiates a student password reset request requiring class tutor authorization.
 */
export async function requestStudentPasswordReset(
  rawRegisterNumber: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const registerNumber = normalizeRegisterNumber(rawRegisterNumber || "");
  if (!REGISTER_NUMBER_PATTERN.test(registerNumber)) {
    return { success: false, message: "Enter your university register number, e.g. RA2532241010001." };
  }

  // Same reply whether or not the account exists, to prevent account enumeration.
  const routed = {
    success: true,
    message: "If an active student account matches that register number, your class tutor has been asked to authorize a password reset.",
  };

  try {
    const { ensureDatabaseReady } = await import("@/lib/db");
    await ensureDatabaseReady();

    // Find student
    const [student] = await db
      .select({
        id: users.id,
        email: users.email,
        registerNumber: users.registerNumber,
        sectionId: users.sectionId,
        isActive: users.isActive,
      })
      .from(users)
      .where(and(eq(users.role, "STUDENT"), eq(users.registerNumber, registerNumber)))
      .limit(1);

    if (!student || !student.isActive) return routed;

    // Check if an existing PENDING request already exists
    const [existingPending] = await db
      .select({ id: passwordResetRequests.id })
      .from(passwordResetRequests)
      .where(and(eq(passwordResetRequests.studentId, student.id), eq(passwordResetRequests.status, "PENDING")))
      .orderBy(desc(passwordResetRequests.createdAt))
      .limit(1);

    if (existingPending) return routed;

    // Insert pending request
    await db.insert(passwordResetRequests).values({
      studentId: student.id,
      sectionId: student.sectionId,
      status: "PENDING",
    });

    // Audit log
    await db.insert(auditLogs).values({
      action: "PASSWORD_RESET_REQUESTED",
      userId: student.id,
      userEmail: student.email,
      userRole: "STUDENT",
      metadata: {
        registerNumber: student.registerNumber,
        sectionId: student.sectionId,
      },
    });

    return routed;
  } catch (error: unknown) {
    console.error("Password reset request error:", error);
    return { success: false, message: "Could not submit reset request. Please try again." };
  }
}

const completePasswordResetSchema = z
  .object({
    registerNumber: registerNumberField,
    resetToken: z.string().trim().min(1, "Authorization code is required"),
    newPassword: z.string().min(1, "New password is required"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .superRefine((data, ctx) => {
    const problem = passwordProblem(data.newPassword, { registerNumber: data.registerNumber });
    if (problem) ctx.addIssue({ code: "custom", message: problem, path: ["newPassword"] });
    else if (data.newPassword !== data.confirmPassword) ctx.addIssue({ code: "custom", message: "Passwords do not match", path: ["confirmPassword"] });
  });

/**
 * Completes a student password reset using the tutor-authorized expiring code.
 * Wrong codes count towards a lockout, so codes cannot be guessed.
 */
export async function completeStudentPasswordReset(formData: {
  registerNumber: string;
  resetToken: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const parsed = completePasswordResetSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { registerNumber, resetToken, newPassword } = parsed.data;
  const normalizedToken = resetToken.toUpperCase();
  const rateKey = `reset:${registerNumber.toLowerCase()}`;
  const invalid = { success: false, error: "Invalid register number or authorization code. Please check with your class tutor." };

  try {
    const { ensureDatabaseReady } = await import("@/lib/db");
    await ensureDatabaseReady();

    const locked = await lockoutMessage(rateKey);
    if (locked) return { success: false, error: locked };

    const [student] = await db
      .select({ id: users.id, email: users.email, registerNumber: users.registerNumber })
      .from(users)
      .where(and(eq(users.role, "STUDENT"), eq(users.registerNumber, registerNumber)))
      .limit(1);

    if (!student) {
      await recordFailure(rateKey);
      return invalid;
    }

    const [request] = await db
      .select()
      .from(passwordResetRequests)
      .where(
        and(
          eq(passwordResetRequests.studentId, student.id),
          eq(passwordResetRequests.resetToken, normalizedToken),
          eq(passwordResetRequests.status, "AUTHORIZED")
        )
      )
      .limit(1);

    if (!request) {
      await recordFailure(rateKey);
      return invalid;
    }

    if (request.tokenExpiresAt && request.tokenExpiresAt < new Date()) {
      await db.update(passwordResetRequests).set({ status: "EXPIRED" }).where(eq(passwordResetRequests.id, request.id));
      return { success: false, error: "This authorization code has expired. Please ask your class tutor for a new one." };
    }

    const passwordHash = await bcrypt.hash(newPassword, HASH_ROUNDS);

    // New password, and every existing session for this account is signed out.
    await db
      .update(users)
      .set({ passwordHash, currentSessionId: crypto.randomUUID(), updatedAt: new Date() })
      .where(eq(users.id, student.id));

    await db
      .update(passwordResetRequests)
      .set({
        status: "COMPLETED",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(passwordResetRequests.id, request.id));

    // Clear lockouts on both sign-in and reset
    try {
      await resetAttempts(registerNumber.toLowerCase());
      await resetAttempts(rateKey);
    } catch {}

    await db.insert(auditLogs).values({
      action: "PASSWORD_RESET_COMPLETED",
      userId: student.id,
      userEmail: student.email,
      userRole: "STUDENT",
      metadata: {
        registerNumber: student.registerNumber,
        requestId: request.id,
      },
    });

    return {
      success: true,
      message: "Password updated. Sign in with your register number and new password.",
    };
  } catch (error: unknown) {
    console.error("Complete password reset error:", error);
    return { success: false, error: "An unexpected error occurred while resetting your password." };
  }
}
