"use server";

import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import * as crypto from "crypto";

export interface ActionResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Generate a cryptographically secure staff invite code
 */
export async function createInviteCode(formData: {
  role: "COURSE_COORDINATOR" | "CLASS_TUTOR";
  faculty?: string;
  department?: string;
  degree?: string;
  section?: string;
  maxUses?: number;
}): Promise<ActionResponse> {
  try {
    const session = await getSession();

    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized access." };
    }

    // Role-based auth validation:
    // Super Admin can create COURSE_COORDINATOR or CLASS_TUTOR invites
    // Course Coordinator can ONLY create CLASS_TUTOR invites
    if (session.role === "FACULTY" && session.facultyType === "COURSE_COORDINATOR" && formData.role !== "CLASS_TUTOR") {
      return { success: false, error: "Course Coordinators are only authorized to create Class Tutor invites." };
    }

    if (session.role === "FACULTY" && session.facultyType === "CLASS_TUTOR") {
      return { success: false, error: "Class Tutors are not authorized to generate invite codes." };
    }




    // Generate code format: ELC-[CC|TU]-[SUFFIX]
    const rolePrefix = formData.role === "COURSE_COORDINATOR" ? "CC" : "TU";
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const code = `ELC-${rolePrefix}-${suffix}`;

    const expires = new Date();
    expires.setDate(expires.getDate() + 7); // Default expiry 7 Days

    const invite = await db.inviteCode.create({
      data: {
        code,
        role: formData.role,
        faculty: formData.faculty?.trim() || "ALL",
        department: formData.department?.trim() || "ALL",
        degree: formData.degree?.trim() || "ALL",
        section: null,
        createdBy: session.userId,
        expiresAt: expires,
        maxUses: formData.maxUses || 1,
        usedCount: 0,
        status: "ACTIVE",
      },
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: "CREATED_INVITE_CODE",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          inviteId: invite.id,
          inviteCode: invite.code,
          role: invite.role,
          section: invite.section,
        }),
      },
    });

    revalidatePath("/faculty/invites");
    return { success: true, data: invite };
  } catch (error) {
    console.error("Create invite code error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Fetch active invite codes
 */
export async function getInvites(): Promise<ActionResponse> {
  try {
    const session = await getSession();

    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized access." };
    }

    let invites;
    if (session.role === "SUPER_ADMIN") {
      // Super Admin sees all
      invites = await db.inviteCode.findMany({
        orderBy: { createdAt: "desc" },
      });
    } else if (session.facultyType === "COURSE_COORDINATOR") {
      // Coordinator sees all CLASS_TUTOR invites created by anyone in MCA degree
      invites = await db.inviteCode.findMany({
        where: {
          role: "CLASS_TUTOR",
          degree: "MCA",
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Class Tutor cannot view invite list
      return { success: false, error: "Unauthorized access." };
    }

    return { success: true, data: invites };
  } catch (error) {
    console.error("Get invites error:", error);
    return { success: false, error: "Failed to fetch invite records." };
  }
}

/**
 * Revoke an active invite code
 */
export async function revokeInviteCode(id: string): Promise<ActionResponse> {
  try {
    const session = await getSession();

    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized access." };
    }

    const invite = await db.inviteCode.findUnique({ where: { id } });
    if (!invite) {
      return { success: false, error: "Invite code record not found." };
    }

    // Role-based auth verification:
    // Course Coordinator can only revoke CLASS_TUTOR invites
    if (session.role === "FACULTY" && session.facultyType === "COURSE_COORDINATOR" && invite.role !== "CLASS_TUTOR") {
      return { success: false, error: "Unauthorized action." };
    }

    if (session.role === "FACULTY" && session.facultyType === "CLASS_TUTOR") {
      return { success: false, error: "Unauthorized action." };
    }

    const updated = await db.inviteCode.update({
      where: { id },
      data: { status: "REVOKED" },
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: "REVOKED_INVITE_CODE",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          inviteId: invite.id,
          inviteCode: invite.code,
        }),
      },
    });

    revalidatePath("/faculty/invites");
    return { success: true, data: updated };
  } catch (error) {
    console.error("Revoke invite error:", error);
    return { success: false, error: "Failed to revoke the invite code." };
  }
}
