"use server";

import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as bcrypt from "bcryptjs";

export interface ActionResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Fetch staff directory list based on roles
 */
export async function getStaffMembers(): Promise<ActionResponse> {
  try {
    const session = await getSession();

    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized access." };
    }

    let staff;
    if (session.role === "SUPER_ADMIN") {
      // Super Admin sees all staff (except themselves to prevent self-lockout actions)
      staff = await db.faculty.findMany({
        where: {
          id: { not: session.userId }
        },
        orderBy: { name: "asc" }
      });
    } else if (session.facultyType === "COURSE_COORDINATOR") {
      // Coordinator sees all CLASS_TUTOR accounts in MCA
      staff = await db.faculty.findMany({
        where: {
          role: "CLASS_TUTOR",
          degree: "MCA"
        },
        orderBy: { name: "asc" }
      });
    } else {
      return { success: false, error: "Unauthorized access." };
    }

    // Map Faculty records to remove password hashes before sending to client
    const safeStaff = staff.map(member => ({
      id: member.id,
      employeeId: member.employeeId,
      name: member.name,
      email: member.email,
      role: member.role,
      faculty: member.faculty,
      department: member.department,
      degree: member.degree,
      className: member.className,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString()
    }));

    return { success: true, data: safeStaff };
  } catch (error) {
    console.error("Get staff members error:", error);
    return { success: false, error: "Failed to fetch staff members list." };
  }
}

/**
 * Enable/Disable a staff member account (Disable Tutor / Suspend User)
 */
export async function toggleStaffStatus(id: string, active: boolean): Promise<ActionResponse> {
  try {
    const session = await getSession();

    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized access." };
    }

    const member = await db.faculty.findUnique({ where: { id } });
    if (!member) {
      return { success: false, error: "Staff member not found." };
    }

    // Role-based auth verification:
    // Course Coordinator can only disable MCA CLASS_TUTOR accounts
    if (session.role === "FACULTY" && session.facultyType === "COURSE_COORDINATOR") {
      if (member.role !== "CLASS_TUTOR" || member.degree !== "MCA") {
        return { success: false, error: "Unauthorized action." };
      }
    } else if (session.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized action." };
    }

    const updated = await db.faculty.update({
      where: { id },
      data: { isActive: active }
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: active ? "ENABLED_STAFF_ACCOUNT" : "DISABLED_STAFF_ACCOUNT",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          targetUserId: member.id,
          targetUserEmail: member.email,
          role: member.role
        }),
      },
    });

    revalidatePath("/faculty/invites");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Toggle staff status error:", error);
    return { success: false, error: "Failed to update staff status." };
  }
}

/**
 * Reset staff member password (Super Admin Only)
 */
export async function resetStaffPassword(id: string, newPasswordStr: string): Promise<ActionResponse> {
  try {
    const session = await getSession();

    // Guard: Only Super Admin can reset staff passwords
    if (!session || session.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized access. Super Admin permissions required." };
    }

    if (!newPasswordStr || newPasswordStr.trim().length < 6) {
      return { success: false, error: "Password must be at least 6 characters." };
    }

    const member = await db.faculty.findUnique({ where: { id } });
    if (!member) {
      return { success: false, error: "Staff member not found." };
    }

    const passwordHash = await bcrypt.hash(newPasswordStr, 10);
    await db.faculty.update({
      where: { id },
      data: { passwordHash }
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: "RESET_STAFF_PASSWORD",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          targetUserId: member.id,
          targetUserEmail: member.email,
        }),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Reset staff password error:", error);
    return { success: false, error: "Failed to reset password." };
  }
}
