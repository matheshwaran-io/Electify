"use server";

import { db } from "@/lib/db";
import { replayEvents, registrationEvents, electives, electiveGroups } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function getReplayEvents(registrationEventId: string) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR" && session.role !== "CLASS_TUTOR")) {
      return { success: false, error: "Unauthorized access to replay events." };
    }

    const eventDetails = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.id, registrationEventId))
      .limit(1);

    if (!eventDetails.length) {
      return { success: false, error: "Registration event not found." };
    }

    const events = await db
      .select()
      .from(replayEvents)
      .where(eq(replayEvents.registrationEventId, registrationEventId))
      .orderBy(asc(replayEvents.timestamp));

    const allElectives = await db
      .select({
        id: electives.id,
        name: electives.name,
        courseCode: electives.courseCode,
        maxSeats: electives.maxSeats,
        groupId: electives.groupId,
      })
      .from(electives)
      .innerJoin(electiveGroups, eq(electives.groupId, electiveGroups.id))
      .where(eq(electiveGroups.eventId, registrationEventId));

    return {
      success: true,
      data: {
        eventDetails: eventDetails[0],
        events,
        electives: allElectives,
      },
    };
  } catch (error) {
    console.error("Error fetching replay events:", error);
    return { success: false, error: "Failed to fetch replay events." };
  }
}
