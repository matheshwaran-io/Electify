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
      return { success: false, error: "Invalid email or credentials." };
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
      role: faculty.role as "FACULTY" | "SUPER_ADMIN",
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
