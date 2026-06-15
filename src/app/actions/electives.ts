"use server";

import db from "@/lib/db";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

interface ActionResponse {
  success: boolean;
  error?: string;
}

/**
 * Creates a new elective.
 */
export async function createElective(data: {
  name: string;
  groupNumber: number;
  totalSeats: number;
}): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const settings = await db.settings.findUnique({ where: { id: "system" } });
    if (settings && !settings.allowFacultyEditing) {
      return { success: false, error: "Faculty editing is currently disabled." };
    }

    if (data.groupNumber !== 1 && data.groupNumber !== 2) {
      return { success: false, error: "Group number must be 1 or 2." };
    }

    if (data.totalSeats <= 0) {
      return { success: false, error: "Total seats must be a positive integer." };
    }

    await db.elective.create({
      data: {
        name: data.name.trim(),
        groupNumber: data.groupNumber,
        totalSeats: data.totalSeats,
        availableSeats: data.totalSeats,
        isActive: true,
        isFull: false,
      },
    });

    revalidatePath("/faculty/electives");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to create elective:", error);
    return { success: false, error: "Failed to create elective." };
  }
}

/**
 * Updates an existing elective.
 */
export async function updateElective(data: {
  id: string;
  name: string;
  totalSeats: number;
  isActive: boolean;
}): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const settings = await db.settings.findUnique({ where: { id: "system" } });
    if (settings && !settings.allowFacultyEditing) {
      return { success: false, error: "Faculty editing is currently disabled." };
    }

    // Get current elective to check seat count changes
    const elective = await db.elective.findUnique({
      where: { id: data.id },
      include: {
        _count: {
          select: {
            registrationsAsG1: true,
            registrationsAsG2: true,
          },
        },
      },
    });

    if (!elective) {
      return { success: false, error: "Elective not found." };
    }

    // Calculate booked seats
    const booked = elective.groupNumber === 1 ? elective._count.registrationsAsG1 : elective._count.registrationsAsG2;

    if (data.totalSeats < booked) {
      return {
        success: false,
        error: `Cannot decrease total seats to ${data.totalSeats}. There are already ${booked} students registered.`,
      };
    }

    const newAvailableSeats = data.totalSeats - booked;

    await db.elective.update({
      where: { id: data.id },
      data: {
        name: data.name.trim(),
        totalSeats: data.totalSeats,
        availableSeats: newAvailableSeats,
        isActive: data.isActive,
        isFull: newAvailableSeats === 0,
      },
    });

    revalidatePath("/faculty/electives");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to update elective:", error);
    return { success: false, error: "Failed to update elective." };
  }
}

/**
 * Deletes an elective. Blocks delete if registrations exist.
 */
export async function deleteElective(id: string): Promise<ActionResponse> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
      return { success: false, error: "Unauthorized." };
    }

    const settings = await db.settings.findUnique({ where: { id: "system" } });
    if (settings && !settings.allowFacultyEditing) {
      return { success: false, error: "Faculty editing is currently disabled." };
    }

    // Check if registrations exist
    const elective = await db.elective.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrationsAsG1: true,
            registrationsAsG2: true,
          },
        },
      },
    });

    if (!elective) {
      return { success: false, error: "Elective not found." };
    }

    const booked = elective.groupNumber === 1 ? elective._count.registrationsAsG1 : elective._count.registrationsAsG2;

    if (booked > 0) {
      return {
        success: false,
        error: `Cannot delete elective. There are ${booked} student registrations depending on it.`,
      };
    }

    await db.elective.delete({
      where: { id },
    });

    revalidatePath("/faculty/electives");
    revalidatePath("/faculty/dashboard");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete elective:", error);
    return { success: false, error: "Failed to delete elective." };
  }
}
