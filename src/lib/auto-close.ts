import { db } from "@/lib/db";
import { registrationEvents, auditLogs } from "@/lib/db/schema";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(...paths: string[]) {
  try {
    for (const p of paths) {
      revalidatePath(p);
    }
  } catch {
    // Non-fatal if called outside of request context (e.g., test suites)
  }
}

/**
 * Automatically checks and closes any registration events whose closeDate has elapsed
 * and autoClose is enabled.
 *
 * Ensures the database row status is synchronized to 'CLOSED' so that:
 * 1. Queries filtering on status = 'OPEN' accurately exclude elapsed events.
 * 2. Real-time monitors and faculty portals immediately observe the closed state.
 * 3. Student submissions and choice mutations are cleanly rejected at the root.
 */
export async function syncExpiredRegistrationEvents(): Promise<number> {
  try {
    const now = new Date();
    const expiredEvents = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        closeDate: registrationEvents.closeDate,
      })
      .from(registrationEvents)
      .where(
        and(
          inArray(registrationEvents.status, ["OPEN", "ACTIVE", "PAUSED", "PUBLISHED"]),
          eq(registrationEvents.autoClose, true),
          isNotNull(registrationEvents.closeDate),
          lte(registrationEvents.closeDate, now)
        )
      );

    if (expiredEvents.length === 0) return 0;

    for (const ev of expiredEvents) {
      await db
        .update(registrationEvents)
        .set({
          status: "CLOSED",
          updatedAt: now,
        })
        .where(eq(registrationEvents.id, ev.id));

      await db.insert(auditLogs).values({
        action: "AUTO_CLOSE_DEADLINE_ELAPSED",
        userId: null,
        userEmail: "system@electify.internal",
        userRole: "SYSTEM",
        metadata: {
          eventId: ev.id,
          eventName: ev.name,
          oldStatus: ev.status,
          newStatus: "CLOSED",
          closeDate: ev.closeDate?.toISOString(),
          autoClosedAt: now.toISOString(),
        },
      });
    }

    safeRevalidatePath("/dashboard", "/faculty/monitor", "/faculty/events", "/faculty/window");
    return expiredEvents.length;
  } catch (err) {
    console.warn("Auto-close sync warning:", err);
    return 0;
  }
}
