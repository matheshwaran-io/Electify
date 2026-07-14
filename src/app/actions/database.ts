"use server";

import { db } from "@/lib/db";
import { 
  users, 
  electives, 
  electiveGroups, 
  registrations, 
  studentRegistrations, 
  eventSections,
  registrationEvents,
  replayEvents
} from "@/lib/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { getSession } from "@/lib/auth";

async function assertAdminOrCoordinator() {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function deleteAllRegistrations(eventId: string) {
  await assertAdminOrCoordinator();
  
  await db.transaction(async (tx) => {
    // 1. Delete all individual selections
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
    // 2. Delete all registration sessions
    await tx.delete(registrations).where(eq(registrations.eventId, eventId));
    // 3. Delete replay logs
    await tx.delete(replayEvents).where(eq(replayEvents.registrationEventId, eventId));
    
    // 4. Reset all seats for groups in this event
    const groups = await tx.select({ id: electiveGroups.id }).from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
    const groupIds = groups.map(g => g.id);
    
    if (groupIds.length > 0) {
      // Drizzle doesn't support complex SET a = b in update easily without sql``, so we'll fetch and update
      const allElectives = await tx.select({ id: electives.id, maxSeats: electives.maxSeats }).from(electives).where(inArray(electives.groupId, groupIds));
      for (const el of allElectives) {
        await tx.update(electives).set({ availableSeats: el.maxSeats, isFull: false }).where(eq(electives.id, el.id));
      }
    }
  });
}

export async function deleteAllStudents() {
  await assertAdminOrCoordinator();
  // Delete all students. Cascades to registrations.
  await db.delete(users).where(eq(users.role, "STUDENT"));
}

export async function deleteAllSubjects(eventId: string) {
  await assertAdminOrCoordinator();
  const groups = await db.select({ id: electiveGroups.id }).from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
  const groupIds = groups.map(g => g.id);
  
  if (groupIds.length > 0) {
    await db.delete(electives).where(inArray(electives.groupId, groupIds));
  }
}

export async function resetAllSeats(eventId: string) {
  await assertAdminOrCoordinator();
  
  await db.transaction(async (tx) => {
    // Drop all registrations for this event
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
    await tx.delete(registrations).where(eq(registrations.eventId, eventId));
    
    // Reset seats
    const groups = await tx.select({ id: electiveGroups.id }).from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
    const groupIds = groups.map(g => g.id);
    
    if (groupIds.length > 0) {
      const allElectives = await tx.select({ id: electives.id, maxSeats: electives.maxSeats }).from(electives).where(inArray(electives.groupId, groupIds));
      for (const el of allElectives) {
        await tx.update(electives).set({ availableSeats: el.maxSeats, isFull: false }).where(eq(electives.id, el.id));
      }
    }
  });
}

export async function archiveEvent(eventId: string) {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR" && session.role !== "CLASS_TUTOR")) {
    throw new Error("Unauthorized");
  }
  
  await db.update(registrationEvents).set({ status: "CLOSED" }).where(eq(registrationEvents.id, eventId));
}
