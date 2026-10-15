"use server";

import { getSession } from "@/lib/auth";
import { recordStudentPresence, removeStudentPresence, type StudentPresenceStage } from "@/lib/student-presence";
import { db } from "@/lib/db";
import { users, sections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Pings current student presence for real-time surveillance and monitoring.
 * Called automatically from student pages:
 * - /countdown: stage = "COUNTDOWN"
 * - /dashboard/electives or /dashboard: stage = "IN_SELECTION"
 * - /dashboard/my-registration: stage = "SUBMITTED"
 */
export async function pingStudentPresence(
  eventId: string,
  stage: StudentPresenceStage
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Only students report presence" };
    }

    if (!eventId) {
      return { success: false, error: "Missing eventId" };
    }

    let sectionName = "Section";
    if (session.sectionId) {
      try {
        const [sec] = await db
          .select({ label: sections.label })
          .from(sections)
          .where(eq(sections.id, session.sectionId))
          .limit(1);
        if (sec?.label) sectionName = sec.label;
      } catch {
        // Fallback to default
      }
    }

    recordStudentPresence({
      studentId: session.userId,
      name: session.name,
      registerNumber: session.registerNumber || "Pending",
      sectionId: session.sectionId,
      sectionName,
      eventId,
      stage,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Presence failed" };
  }
}

/**
 * Student disconnect / page unload ping.
 */
export async function leaveStudentPresence(eventId: string): Promise<void> {
  try {
    const session = await getSession();
    if (session?.userId) {
      removeStudentPresence(session.userId, eventId);
    }
  } catch {
    // Ignore errors on disconnect
  }
}
