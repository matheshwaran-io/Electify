"use server";

import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import * as bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

interface ActionResponse {
  success: boolean;
  error?: string;
}

/**
 * Toggles the registration status (Open/Close).
 * Available to both Faculty and Super Admin.
 */
export async function toggleRegistration(enabled: boolean): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    await db.settings.update({
      where: { id: "system" },
      data: { registrationEnabled: enabled },
    });

    revalidatePath("/faculty/dashboard");
    revalidatePath("/dashboard");
    revalidatePath("/countdown");

    return { success: true };
  } catch (error) {
    console.error("Failed to toggle registration:", error);
    return { success: false, error: "Failed to update registration status." };
  }
}

/**
 * Updates full system settings.
 * RESTRICTED to Super Admin only.
 */
export async function updateSystemSettings(data: {
  maintenanceMode: boolean;
  showLiveSeats: boolean;
  allowFacultyEditing: boolean;
  allowRegistrationEdit: boolean;
  registrationStart: Date;
  registrationEnd: Date;
}): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return { success: false, error: "Access Denied. Super Admin role required." };
    }

    await db.settings.update({
      where: { id: "system" },
      data: {
        maintenanceMode: data.maintenanceMode,
        showLiveSeats: data.showLiveSeats,
        allowFacultyEditing: data.allowFacultyEditing,
        allowRegistrationEdit: data.allowRegistrationEdit,
        registrationStart: data.registrationStart,
        registrationEnd: data.registrationEnd,
      },
    });

    revalidatePath("/faculty/dashboard");
    revalidatePath("/faculty/settings");
    revalidatePath("/dashboard");
    revalidatePath("/countdown");

    return { success: true };
  } catch (error) {
    console.error("Failed to update system settings:", error);
    return { success: false, error: "Failed to update system configurations." };
  }
}

/**
 * Creates a new faculty account.
 * RESTRICTED to Super Admin only.
 */
export async function createFacultyAccount(data: {
  name: string;
  email: string;
  passwordHash: string; // Plain password inputted by user, will hash it
  role: "FACULTY" | "SUPER_ADMIN";
}): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return { success: false, error: "Access Denied. Super Admin role required." };
    }

    // Check if email already exists
    const existingFaculty = await db.faculty.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    const existingStudent = await db.student.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existingFaculty || existingStudent) {
      return { success: false, error: "Email address is already in use." };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.passwordHash, 10);

    await db.faculty.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash: hashedPassword,
        role: data.role,
      },
    });

    revalidatePath("/faculty/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to create faculty account:", error);
    return { success: false, error: "Failed to create faculty account." };
  }
}

/**
 * Resets all student elective registrations.
 * RESTRICTED to Super Admin only.
 */
export async function resetAllRegistrations(): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || session.role !== "SUPER_ADMIN") {
      return { success: false, error: "Access Denied. Super Admin role required." };
    }

    await db.$transaction(async (tx) => {
      // 1. Delete all registration records
      await tx.registration.deleteMany({});

      // 2. Set all students' hasSubmitted to false
      await tx.student.updateMany({
        data: { hasSubmitted: false },
      });

      // 3. Reset available seats on all electives
      const electives = await tx.elective.findMany({});
      for (const elective of electives) {
        await tx.elective.update({
          where: { id: elective.id },
          data: {
            availableSeats: elective.totalSeats,
            isFull: false,
          },
        });
      }
    });

    revalidatePath("/faculty/dashboard");
    revalidatePath("/faculty/students");
    revalidatePath("/faculty/electives");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to reset registrations:", error);
    return { success: false, error: "Failed to reset registrations database." };
  }
}

/**
 * Sends a notification/reminder alert simulation to all pending students.
 * RESTRICTED to Faculty and Super Admin.
 */
export async function notifyPendingStudents(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    // Find all pending students
    const pendingStudents = await db.student.findMany({
      where: { hasSubmitted: false, isEligible: true, isActive: true },
      select: { email: true, name: true },
    });

    if (pendingStudents.length === 0) {
      return { success: true, count: 0 };
    }

    console.log(`[Alert Notification] Sent registration reminders to ${pendingStudents.length} pending students.`);

    return { success: true, count: pendingStudents.length };
  } catch (error) {
    console.error("Failed to send reminders:", error);
    return { success: false, error: "Failed to broadcast reminder notifications." };
  }
}

