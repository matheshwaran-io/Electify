"use server";

import { db } from "@/lib/db";
import {
  studentRegistrations,
  electives,
  registrationEvents,
  electiveGroups,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, gte, sql } from "drizzle-orm";
import { z } from "zod";

async function assertStudent() {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }
  return session;
}

const registrationSchema = z.object({
  eventId: z.string().uuid("Invalid Event ID"),
  groupId: z.string().uuid("Invalid Group ID"),
  electiveId: z.string().uuid("Invalid Elective ID"),
});

export async function submitRegistration(formData: {
  eventId: string;
  groupId: string;
  electiveId: string;
}) {
  const session = await assertStudent();

  const parsed = registrationSchema.safeParse(formData);
  if (!parsed.success) {
    throw new Error("Invalid registration data provided.");
  }

  const { eventId, groupId, electiveId } = parsed.data;

  // Execute a secure transaction to ensure data integrity and prevent overselling
  return await db.transaction(async (tx) => {
    // 1. Verify Event is Active
    const [event] = await tx
      .select({ status: registrationEvents.status })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId))
      .limit(1);

    if (!event || event.status !== "ACTIVE") {
      throw new Error("Registration event is not active.");
    }

    // 2. Prevent Duplicate Registration in the same group
    const [existing] = await tx
      .select()
      .from(studentRegistrations)
      .where(
        and(
          eq(studentRegistrations.studentId, session.userId),
          eq(studentRegistrations.eventId, eventId),
          eq(studentRegistrations.groupId, groupId)
        )
      )
      .limit(1);

    if (existing) {
      throw new Error("You have already registered for an elective in this group.");
    }

    // 3. Atomically check and decrement seat availability
    // Using PostgreSQL UPDATE ... WHERE available_seats >= 1 Returning *
    const [updatedElective] = await tx
      .update(electives)
      .set({
        availableSeats: sql`${electives.availableSeats} - 1`,
        isFull: sql`${electives.availableSeats} - 1 <= 0`,
      })
      .where(
        and(
          eq(electives.id, electiveId),
          gte(electives.availableSeats, 1)
        )
      )
      .returning();

    if (!updatedElective) {
      throw new Error("Seats are no longer available for this elective.");
    }

    // 4. Create the registration record
    await tx.insert(studentRegistrations).values({
      studentId: session.userId,
      eventId,
      groupId,
      electiveId,
    });

    return { success: true };
  });
}
