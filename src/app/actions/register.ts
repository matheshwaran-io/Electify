"use server";

import db from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RegisterResult {
  success: boolean;
  error?: string;
}

/**
 * Handles the registration of electives for the logged-in student.
 */
export async function registerElectives(
  electiveGroup1Id: string,
  electiveGroup2Id: string
): Promise<RegisterResult> {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Unauthorized. Please log in as a student." };
    }

    // 2. Fetch student and system settings
    const [student, settings] = await Promise.all([
      db.student.findUnique({
        where: { id: session.userId },
        include: { registration: true },
      }),
      db.settings.findUnique({
        where: { id: "system" },
      }),
    ]);

    if (!student) {
      return { success: false, error: "Student record not found." };
    }

    if (!student.isActive) {
      return { success: false, error: "Your account is deactivated." };
    }

    if (!student.isEligible) {
      return { success: false, error: "You are not eligible for registration. Please contact faculty." };
    }

    if (!settings) {
      return { success: false, error: "System settings not configured." };
    }

    if (settings.maintenanceMode) {
      return { success: false, error: "System is currently undergoing maintenance." };
    }

    // 3. Verify Registration Window
    const now = new Date();
    if (!settings.registrationEnabled || now < settings.registrationStart || now > settings.registrationEnd) {
      return { success: false, error: "Registration is currently closed." };
    }

    // 4. Verify Student Submission State
    if (student.hasSubmitted && !settings.allowRegistrationEdit) {
      return { success: false, error: "You have already submitted your registration and editing is disabled." };
    }

    // 5. Verify selected electives belong to correct groups and are active
    const [electiveG1, electiveG2] = await Promise.all([
      db.elective.findUnique({ where: { id: electiveGroup1Id } }),
      db.elective.findUnique({ where: { id: electiveGroup2Id } }),
    ]);

    if (!electiveG1 || electiveG1.groupNumber !== 1 || !electiveG1.isActive) {
      return { success: false, error: "Invalid selection for Group 1 elective." };
    }

    if (!electiveG2 || electiveG2.groupNumber !== 2 || !electiveG2.isActive) {
      return { success: false, error: "Invalid selection for Group 2 elective." };
    }

    // 6. Execute Transaction
    await db.$transaction(async (tx) => {
      const existingRegistration = await tx.registration.findUnique({
        where: { studentId: student.id },
      });

      // If updating, release old seats
      if (existingRegistration) {
        // Increment seat for old Group 1 elective
        const oldG1 = await tx.elective.update({
          where: { id: existingRegistration.electiveGroup1Id },
          data: {
            availableSeats: { increment: 1 },
          },
        });
        await tx.elective.update({
          where: { id: existingRegistration.electiveGroup1Id },
          data: {
            isFull: oldG1.availableSeats <= 0,
          },
        });

        // Increment seat for old Group 2 elective
        const oldG2 = await tx.elective.update({
          where: { id: existingRegistration.electiveGroup2Id },
          data: {
            availableSeats: { increment: 1 },
          },
        });
        await tx.elective.update({
          where: { id: existingRegistration.electiveGroup2Id },
          data: {
            isFull: oldG2.availableSeats <= 0,
          },
        });
      }

      // Decrement and check for new Group 1 elective
      const updatedG1 = await tx.elective.update({
        where: { id: electiveGroup1Id },
        data: {
          availableSeats: { decrement: 1 },
        },
      });

      if (updatedG1.availableSeats < 0) {
        throw new Error(`Seats are fully booked for Group 1 elective: ${electiveG1.name}`);
      }

      await tx.elective.update({
        where: { id: electiveGroup1Id },
        data: {
          isFull: updatedG1.availableSeats === 0,
        },
      });

      // Decrement and check for new Group 2 elective
      const updatedG2 = await tx.elective.update({
        where: { id: electiveGroup2Id },
        data: {
          availableSeats: { decrement: 1 },
        },
      });

      if (updatedG2.availableSeats < 0) {
        throw new Error(`Seats are fully booked for Group 2 elective: ${electiveG2.name}`);
      }

      await tx.elective.update({
        where: { id: electiveGroup2Id },
        data: {
          isFull: updatedG2.availableSeats === 0,
        },
      });

      // Create or update registration entry
      if (existingRegistration) {
        await tx.registration.update({
          where: { studentId: student.id },
          data: {
            electiveGroup1Id,
            electiveGroup2Id,
            submittedAt: new Date(),
          },
        });
      } else {
        await tx.registration.create({
          data: {
            studentId: student.id,
            electiveGroup1Id,
            electiveGroup2Id,
          },
        });
      }

      // Mark student as submitted
      await tx.student.update({
        where: { id: student.id },
        data: {
          hasSubmitted: true,
        },
      });
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to complete registration due to database error. Please try again.";
    console.error("Registration transaction error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
