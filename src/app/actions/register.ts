"use server";

import { db } from "@/lib/db";
import { users, registrationEvents, studentRegistrations, electives, systemSettings } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";

interface RegisterResult {
  success: boolean;
  error?: string;
}

/**
 * Handles the registration of electives for the logged-in student.
 */
export async function registerElectives(
  eventId: string,
  selections: { groupId: string; electiveId: string }[]
): Promise<RegisterResult> {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Unauthorized. Please log in as a student." };
    }

    const studentId = session.userId;

    // 2. Fetch system settings
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
    if (settings?.maintenanceMode) {
      return { success: false, error: "System is currently undergoing maintenance." };
    }

    // 3. Fetch student
    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    
    if (!student) {
      return { success: false, error: "Student record not found." };
    }

    if (!student.isActive) {
      return { success: false, error: "Your account is deactivated." };
    }

    if (!student.isEligible) {
      return { success: false, error: "You are not eligible for registration. Please contact faculty." };
    }

    // 4. Fetch Registration Event
    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    
    if (!event) {
      return { success: false, error: "Registration event not found." };
    }

    const now = new Date();
    if (!["OPEN", "PUBLISHED"].includes(event.status) || (event.openDate && now < event.openDate) || (event.closeDate && now > event.closeDate)) {
      return { success: false, error: "Registration is currently closed." };
    }

    // 5. Execute Transaction
    await db.transaction(async (tx) => {
      // Find existing registrations for this event
      const existing = await tx.select().from(studentRegistrations)
        .where(and(eq(studentRegistrations.studentId, studentId), eq(studentRegistrations.eventId, eventId)));

      if (existing.length > 0) {
        // Unregister existing: increment seats
        for (const reg of existing) {
          await tx.update(electives)
            .set({ 
              availableSeats: sql`${electives.availableSeats} + 1`,
              isFull: false
            })
            .where(eq(electives.id, reg.electiveId));
        }
        // Delete old registrations
        await tx.delete(studentRegistrations)
          .where(and(eq(studentRegistrations.studentId, studentId), eq(studentRegistrations.eventId, eventId)));
      }

      // Process new selections
      for (const sel of selections) {
        const [elective] = await tx.select().from(electives).where(eq(electives.id, sel.electiveId)).limit(1);
        
        if (!elective || !elective.isActive) {
          throw new Error("Selected elective is invalid or inactive.");
        }
        if (elective.groupId !== sel.groupId) {
          throw new Error("Elective does not belong to the correct group.");
        }
        if (elective.availableSeats <= 0) {
          throw new Error(`Seats are fully booked for elective: ${elective.name}`);
        }

        // Decrement seat
        const [updated] = await tx.update(electives)
          .set({ 
            availableSeats: sql`${electives.availableSeats} - 1`,
          })
          .where(eq(electives.id, sel.electiveId))
          .returning({ availableSeats: electives.availableSeats });

        if (updated.availableSeats <= 0) {
           await tx.update(electives).set({ isFull: true }).where(eq(electives.id, sel.electiveId));
        }

        // Insert new registration
        await tx.insert(studentRegistrations).values({
          studentId,
          eventId,
          groupId: sel.groupId,
          electiveId: sel.electiveId,
        });
      }
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
