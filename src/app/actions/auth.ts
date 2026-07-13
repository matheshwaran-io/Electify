"use server";

import db from "@/lib/db";
import * as bcrypt from "bcryptjs";
import { signJWT, setSessionCookie, clearSessionCookie } from "@/lib/auth";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginResult {
  success: boolean;
  error?: string;
  role?: string;
}

/**
 * Checks and updates rate limits for a given identifier (email or register number).
 * Returns lock time remaining if locked out, or null if allowed.
 */
async function handleRateLimit(identifier: string, ip: string): Promise<Date | null> {
  const now = new Date();
  
  // Find or create attempt record
  const attempt = await db.loginAttempt.findUnique({
    where: { identifier },
  });

  if (!attempt) {
    await db.loginAttempt.create({
      data: {
        identifier,
        ip,
        attempts: 0,
      },
    });
    return null;
  }

  // Check if locked out
  if (attempt.lockoutUntil && attempt.lockoutUntil > now) {
    return attempt.lockoutUntil;
  }

  // If lockout expired, reset attempts
  if (attempt.lockoutUntil && attempt.lockoutUntil <= now) {
    await db.loginAttempt.update({
      where: { identifier },
      data: {
        attempts: 0,
        lockoutUntil: null,
      },
    });
  }

  return null;
}

/**
 * Increments failed attempts and sets lockout if threshold is reached.
 */
async function registerFailedAttempt(identifier: string, ip: string) {
  const attempt = await db.loginAttempt.findUnique({
    where: { identifier },
  });

  if (!attempt) return;

  const newAttempts = attempt.attempts + 1;
  const isLockout = newAttempts >= MAX_ATTEMPTS;
  const lockoutUntil = isLockout ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

  await db.loginAttempt.update({
    where: { identifier },
    data: {
      attempts: newAttempts,
      lockoutUntil,
      ip,
    },
  });
}

/**
 * Resets failed attempts after successful login.
 */
async function resetAttempts(identifier: string) {
  await db.loginAttempt.upsert({
    where: { identifier },
    update: {
      attempts: 0,
      lockoutUntil: null,
    },
    create: {
      identifier,
      ip: "local",
      attempts: 0,
    },
  });
}

/**
 * Log in student action
 */
export async function studentLogin(formData: {
  email: string;
  registerNumber: string; // Used as password
}): Promise<LoginResult> {
  const { email, registerNumber } = formData;
  const ip = "client-ip"; // In production, get from request headers

  try {
    // Check lockout
    const lockoutTime = await handleRateLimit(email, ip);
    if (lockoutTime) {
      const minutesRemaining = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Too many failed attempts. Account locked. Try again in ${minutesRemaining} minute(s).`,
      };
    }

    // Find student
    const student = await db.student.findUnique({
      where: { email },
    });

    if (!student) {
      await registerFailedAttempt(email, ip);
      return { success: false, error: "Your account has not been created yet. Please contact your Class Tutor or Course Coordinator." };
    }

    if (!student.isActive) {
      return { success: false, error: "Your login access is disabled. Please contact the administrator." };
    }

    // Compare Register Number as the password
    const isPasswordValid = await bcrypt.compare(registerNumber, student.passwordHash);

    if (!isPasswordValid) {
      await registerFailedAttempt(email, ip);
      return { success: false, error: "Invalid credentials." };
    }

    // Reset lockout counter on success
    await resetAttempts(email);

    // Create session
    const token = await signJWT({
      userId: student.id,
      name: student.name,
      email: student.email,
      role: "STUDENT",
      registerNumber: student.registerNumber,
    });

    // Set cookie
    await setSessionCookie(token);

    return { success: true, role: "STUDENT" };
  } catch (error) {
    console.error("Student login error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Log in faculty/admin action
 */
export async function facultyLogin(formData: {
  email: string;
  passwordHash: string; // User input password
}): Promise<LoginResult> {
  const { email, passwordHash: password } = formData;
  const ip = "client-ip";

  try {
    // Check lockout
    const lockoutTime = await handleRateLimit(email, ip);
    if (lockoutTime) {
      const minutesRemaining = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
      return {
        success: false,
        error: `Too many failed attempts. Locked out for ${minutesRemaining} minutes.`,
      };
    }

    // Find faculty
    const faculty = await db.faculty.findUnique({
      where: { email },
    });

    if (!faculty) {
      await registerFailedAttempt(email, ip);
      return { success: false, error: "Invalid email or password." };
    }

    if (!faculty.isActive) {
      return { success: false, error: "Your account has been suspended. Please contact the system administrator." };
    }

    // Compare passwords
    const isPasswordValid = await bcrypt.compare(password, faculty.passwordHash);

    if (!isPasswordValid) {
      await registerFailedAttempt(email, ip);
      return { success: false, error: "Invalid email or password." };
    }

    // Reset attempts on success
    await resetAttempts(email);

    // Create session
    const token = await signJWT({
      userId: faculty.id,
      name: faculty.name,
      email: faculty.email,
      role: faculty.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "FACULTY",
      facultyType: faculty.role === "SUPER_ADMIN" ? undefined : (faculty.role as "COURSE_COORDINATOR" | "CLASS_TUTOR"),
      className: faculty.className || undefined,
    });

    // Set cookie
    await setSessionCookie(token);

    return { success: true, role: faculty.role };
  } catch (error) {
    console.error("Faculty login error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Logout action
 */
export async function logout() {
  await clearSessionCookie();
}

/**
 * Register new staff action
 */
export async function registerStaff(formData: {
  inviteCode: string;
  employeeId: string;
  name: string;
  email: string;
  faculty: string;
  department: string;
  degree: string;
  section?: string;
  passwordHash: string;
}): Promise<LoginResult> {
  const { inviteCode, employeeId, name, email, faculty, department, degree, section, passwordHash } = formData;

  try {
    // 1. Fetch & Validate Invite Code
    const invite = await db.inviteCode.findUnique({
      where: { code: inviteCode },
    });

    if (!invite) {
      return { success: false, error: "Invalid invite code. Please request a new code." };
    }

    if (invite.status !== "ACTIVE") {
      return { success: false, error: "This invite code has already been used or revoked." };
    }

    if (invite.expiresAt < new Date()) {
      // Mark as expired in db if active
      await db.inviteCode.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      });
      return { success: false, error: "This invite code has expired. Please request a new code." };
    }



    if (invite.role === "CLASS_TUTOR") {
      if (!section || !["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].includes(section.toUpperCase().trim())) {
        return { success: false, error: "Please select a valid section (A - J)." };
      }
    }

    // 3. SRM Email Domain Check
    if (!email.toLowerCase().trim().endsWith("@srmist.edu.in")) {
      return { success: false, error: "Registration is restricted to official '@srmist.edu.in' email addresses." };
    }

    // 4. Duplicate Checks (Email and Employee ID)
    const existingEmail = await db.faculty.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (existingEmail) {
      return { success: false, error: "An account with this email address already exists." };
    }

    const existingEmp = await db.faculty.findUnique({
      where: { employeeId: employeeId.trim() },
    });
    if (existingEmp) {
      return { success: false, error: "An account with this Employee ID already exists." };
    }

    // 5. Hash Password & Create Faculty Entry
    const hashed = await bcrypt.hash(passwordHash, 10);
    const newFaculty = await db.faculty.create({
      data: {
        employeeId: employeeId.trim(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: hashed,
        role: invite.role, // Inherit role directly from the verified invite code
        faculty: invite.faculty,
        department: invite.department,
        degree: invite.degree,
        className: invite.role === "CLASS_TUTOR" ? invite.section : null,
      },
    });

    // 6. Update Invite Code Usage Count
    const updatedCount = invite.usedCount + 1;
    await db.inviteCode.update({
      where: { id: invite.id },
      data: {
        usedCount: updatedCount,
        status: updatedCount >= invite.maxUses ? "USED" : "ACTIVE",
      },
    });

    // 7. Write Action to Audit Log
    await db.auditLog.create({
      data: {
        action: "STAFF_REGISTERED",
        userId: newFaculty.id,
        userEmail: newFaculty.email,
        metadata: JSON.stringify({
          employeeId: newFaculty.employeeId,
          role: newFaculty.role,
          inviteCode: invite.code,
        }),
      },
    });

    // 8. Generate Session
    const token = await signJWT({
      userId: newFaculty.id,
      name: newFaculty.name,
      email: newFaculty.email,
      role: "FACULTY",
      facultyType: newFaculty.role as "COURSE_COORDINATOR" | "CLASS_TUTOR",
      className: newFaculty.className || undefined,
    });

    // Set cookie
    await setSessionCookie(token);

    return { success: true, role: newFaculty.role };
  } catch (error) {
    console.error("Staff registration error:", error);
    return { success: false, error: "An unexpected error occurred during registration. Please try again." };
  }
}
