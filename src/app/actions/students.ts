"use server";

import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import * as bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

interface ActionResponse {
  success: boolean;
  inserted?: number;
  updated?: number;
  error?: string;
}

/**
 * Imports students list parsed from a CSV file.
 * Automatically hashes their register number as the initial password.
 */
export async function importStudents(
  studentsList: Array<{
    registerNumber: string;
    name: string;
    email: string;
    className?: string;
  }>
): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }
    
    // Students should be added by Class Tutor, Course Coordinator, or Super Admin
    if (
      session.role !== "SUPER_ADMIN" &&
      session.facultyType !== "CLASS_TUTOR" &&
      session.facultyType !== "COURSE_COORDINATOR"
    ) {
      return { success: false, error: "Only authorized Faculty or Admins can import students." };
    }

    if (!studentsList || studentsList.length === 0) {
      return { success: false, error: "Empty students list." };
    }

    let inserted = 0;
    let updated = 0;

    // Hash passwords and upsert in DB
    // To speed up, we hash passwords concurrently
    const tutorClassName = session.role !== "SUPER_ADMIN" && session.facultyType === "CLASS_TUTOR" ? session.className : null;

    // Validate sections (Phase 1: A, B, C, D, E, F)
    for (const st of studentsList) {
      const cls = tutorClassName || st.className;
      if (cls && !["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].includes(cls.toUpperCase().trim())) {
        return { success: false, error: `Student "${st.name}" has invalid section: "${cls}". Must be between A and J.` };
      }
    }

    const hashedStudents = await Promise.all(
      studentsList.map(async (st) => {
        const regNum = st.registerNumber.toUpperCase().trim();
        const hash = await bcrypt.hash(regNum, 10);
        const cls = tutorClassName || st.className?.trim().toUpperCase() || null;
        return {
          registerNumber: regNum,
          name: st.name.trim(),
          email: st.email.toLowerCase().trim(),
          passwordHash: hash,
          className: cls,
        };
      })
    );

    // Upsert students in database
    for (const st of hashedStudents) {
      // Find if student exists by email or registerNumber
      const existing = await db.student.findFirst({
        where: {
          OR: [{ email: st.email }, { registerNumber: st.registerNumber }],
        },
      });

      if (existing) {
        // Update details (keep registration status, update name)
        await db.student.update({
          where: { id: existing.id },
          data: {
            name: st.name,
            email: st.email,
            registerNumber: st.registerNumber,
            className: st.className,
          },
        });
        updated++;
      } else {
        // Create new
        await db.student.create({
          data: {
            name: st.name,
            email: st.email,
            registerNumber: st.registerNumber,
            passwordHash: st.passwordHash,
            className: st.className,
            isActive: true,
            isEligible: true,
            hasSubmitted: false,
          },
        });
        inserted++;
      }
    }

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: "IMPORTED_STUDENTS",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          count: studentsList.length,
          inserted,
          updated
        }),
      },
    });

    revalidatePath("/faculty/students");
    revalidatePath("/faculty/dashboard");

    return { success: true, inserted, updated };
  } catch (error) {
    console.error("Failed to import students:", error);
    return { success: false, error: "Failed to import students. Please check CSV format." };
  }
}

/**
 * Toggles a student's active status (isActive).
 */
export async function toggleStudentActive(id: string, active: boolean): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const updated = await db.student.update({
      where: { id },
      data: { isActive: active },
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: active ? "ENABLED_STUDENT" : "SUSPENDED_STUDENT",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          studentId: id,
          studentName: updated.name,
          registerNumber: updated.registerNumber
        }),
      },
    });

    revalidatePath("/faculty/students");
    revalidatePath("/faculty/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to toggle active status:", error);
    return { success: false, error: "Failed to update active status." };
  }
}

/**
 * Toggles a student's eligibility status (isEligible).
 */
export async function toggleStudentEligibility(id: string, eligible: boolean): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const updated = await db.student.update({
      where: { id },
      data: { isEligible: eligible },
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: eligible ? "GRANTED_STUDENT_ELIGIBILITY" : "REVOKED_STUDENT_ELIGIBILITY",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          studentId: id,
          studentName: updated.name,
          registerNumber: updated.registerNumber
        }),
      },
    });

    revalidatePath("/faculty/students");
    revalidatePath("/dashboard"); // Reflect immediately on student page if logged in
    return { success: true };
  } catch (error) {
    console.error("Failed to toggle eligibility status:", error);
    return { success: false, error: "Failed to update eligibility status." };
  }
}

/**
 * Resets a student's password to their Register Number.
 */
export async function resetStudentPassword(id: string): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const student = await db.student.findUnique({
      where: { id },
    });

    if (!student) {
      return { success: false, error: "Student not found." };
    }

    const newHash = await bcrypt.hash(student.registerNumber, 10);

    await db.student.update({
      where: { id },
      data: { passwordHash: newHash },
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: "RESET_STUDENT_PASSWORD",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          studentId: id,
          studentName: student.name,
          registerNumber: student.registerNumber
        }),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to reset student password:", error);
    return { success: false, error: "Failed to reset password." };
  }
}

/**
 * Deletes a student account.
 */
export async function deleteStudent(id: string): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const student = await db.student.findUnique({
      where: { id },
    });

    if (student) {
      await db.student.delete({
        where: { id },
      });

      // Write action to Audit Log
      await db.auditLog.create({
        data: {
          action: "DELETED_STUDENT",
          userId: session.userId,
          userEmail: session.email,
          metadata: JSON.stringify({
            studentId: id,
            studentName: student.name,
            registerNumber: student.registerNumber
          }),
        },
      });
    }

    revalidatePath("/faculty/students");
    revalidatePath("/faculty/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete student:", error);
    return { success: false, error: "Failed to delete student." };
  }
}

/**
 * Creates a single student record manually.
 * Automatically hashes their register number as the initial password.
 */
export async function createStudent(data: {
  registerNumber: string;
  name: string;
  email: string;
  isEligible?: boolean;
  isActive?: boolean;
  className?: string;
}): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    // Students should be added by Class Tutor, Course Coordinator, or Super Admin
    if (
      session.role !== "SUPER_ADMIN" &&
      session.facultyType !== "CLASS_TUTOR" &&
      session.facultyType !== "COURSE_COORDINATOR"
    ) {
      return { success: false, error: "Only authorized Faculty or Admins can add students manually." };
    }

    const regNum = data.registerNumber.toUpperCase().trim();
    const emailStr = data.email.toLowerCase().trim();
    const nameStr = data.name.trim();

    // Check if email or register number already exists in database
    const existing = await db.student.findFirst({
      where: {
        OR: [{ email: emailStr }, { registerNumber: regNum }],
      },
    });

    if (existing) {
      return { success: false, error: "A student with this Register Number or Email already exists." };
    }

    const tutorClassName = session.role !== "SUPER_ADMIN" && session.facultyType === "CLASS_TUTOR" ? session.className : data.className;

    if (tutorClassName && !["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].includes(tutorClassName.toUpperCase().trim())) {
      return { success: false, error: `Invalid section: "${tutorClassName}". Section must be between A and J.` };
    }

    const hash = await bcrypt.hash(regNum, 10);

    const created = await db.student.create({
      data: {
        name: nameStr,
        email: emailStr,
        registerNumber: regNum,
        passwordHash: hash,
        className: tutorClassName || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        isEligible: data.isEligible !== undefined ? data.isEligible : true,
        hasSubmitted: false,
      },
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: "CREATED_STUDENT",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          studentId: created.id,
          registerNumber: created.registerNumber,
          className: created.className
        }),
      },
    });

    revalidatePath("/faculty/students");
    revalidatePath("/faculty/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to create student:", error);
    return { success: false, error: "Failed to create student record." };
  }
}

/**
 * Updates an existing student record manually.
 */
export async function updateStudent(
  id: string,
  data: {
    registerNumber: string;
    name: string;
    email: string;
    isEligible: boolean;
    isActive: boolean;
    className?: string;
  }
): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const regNum = data.registerNumber.toUpperCase().trim();
    const emailStr = data.email.toLowerCase().trim();
    const nameStr = data.name.trim();

    // Check if email or register number already exists in database for OTHER students
    const existing = await db.student.findFirst({
      where: {
        OR: [{ email: emailStr }, { registerNumber: regNum }],
        NOT: { id },
      },
    });

    if (existing) {
      return { success: false, error: "Another student with this Register Number or Email already exists." };
    }

    const tutorClassName = session.role !== "SUPER_ADMIN" && session.facultyType === "CLASS_TUTOR" ? session.className : data.className;

    if (tutorClassName && !["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].includes(tutorClassName.toUpperCase().trim())) {
      return { success: false, error: `Invalid section: "${tutorClassName}". Section must be between A and J.` };
    }

    const updated = await db.student.update({
      where: { id },
      data: {
        name: nameStr,
        email: emailStr,
        registerNumber: regNum,
        isEligible: data.isEligible,
        isActive: data.isActive,
        className: tutorClassName || null,
      },
    });

    // Write action to Audit Log
    await db.auditLog.create({
      data: {
        action: "UPDATED_STUDENT",
        userId: session.userId,
        userEmail: session.email,
        metadata: JSON.stringify({
          studentId: updated.id,
          registerNumber: updated.registerNumber,
          className: updated.className
        }),
      },
    });

    revalidatePath("/faculty/students");
    revalidatePath("/faculty/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to update student:", error);
    return { success: false, error: "Failed to update student record." };
  }
}

