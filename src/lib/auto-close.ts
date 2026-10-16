import { db } from "@/lib/db";
import { registrationEvents, auditLogs } from "@/lib/db/schema";
import { and, eq, gt, inArray, isNotNull, lte, or, isNull } from "drizzle-orm";
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
 * Automatically synchronizes registration event statuses with the clock:
 * 1. Closes any registration events whose closeDate has elapsed (and autoClose is enabled).
 * 2. Corrects any 'OPEN' events whose openDate is still in the future back to 'PUBLISHED'.
 * 3. Opens any 'PUBLISHED' events whose openDate has arrived and closeDate has not passed.
 */
export async function syncExpiredRegistrationEvents(): Promise<number> {
  try {
    const now = new Date();
    let updatedCount = 0;

    // 1. Auto-close elapsed events
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
      updatedCount++;
    }

    // 2. Correct premature 'OPEN' events whose scheduled openDate is still in the future
    const prematureEvents = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
      })
      .from(registrationEvents)
      .where(
        and(
          inArray(registrationEvents.status, ["OPEN", "ACTIVE"]),
          isNotNull(registrationEvents.openDate),
          gt(registrationEvents.openDate, now)
        )
      );

    for (const ev of prematureEvents) {
      await db
        .update(registrationEvents)
        .set({
          status: "PUBLISHED",
          updatedAt: now,
        })
        .where(eq(registrationEvents.id, ev.id));

      await db.insert(auditLogs).values({
        action: "AUTO_SCHEDULE_FUTURE_WINDOW",
        userId: null,
        userEmail: "system@electify.internal",
        userRole: "SYSTEM",
        metadata: {
          eventId: ev.id,
          eventName: ev.name,
          oldStatus: ev.status,
          newStatus: "PUBLISHED",
          openDate: ev.openDate?.toISOString(),
          correctedAt: now.toISOString(),
        },
      });
      updatedCount++;
    }

    // 3. Auto-open scheduled 'PUBLISHED' events whose openDate has arrived
    const readyToOpenEvents = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
      })
      .from(registrationEvents)
      .where(
        and(
          eq(registrationEvents.status, "PUBLISHED"),
          isNotNull(registrationEvents.openDate),
          lte(registrationEvents.openDate, now),
          or(isNull(registrationEvents.closeDate), gt(registrationEvents.closeDate, now))
        )
      );

    for (const ev of readyToOpenEvents) {
      await db
        .update(registrationEvents)
        .set({
          status: "OPEN",
          updatedAt: now,
        })
        .where(eq(registrationEvents.id, ev.id));

      await db.insert(auditLogs).values({
        action: "AUTO_OPEN_SCHEDULED_WINDOW",
        userId: null,
        userEmail: "system@electify.internal",
        userRole: "SYSTEM",
        metadata: {
          eventId: ev.id,
          eventName: ev.name,
          oldStatus: ev.status,
          newStatus: "OPEN",
          openDate: ev.openDate?.toISOString(),
          autoOpenedAt: now.toISOString(),
        },
      });
      updatedCount++;
    }

    if (updatedCount > 0) {
      safeRevalidatePath("/dashboard", "/dashboard/electives", "/countdown", "/faculty/monitor", "/faculty/events", "/faculty/window");
    }

    return updatedCount;
  } catch (err) {
    console.warn("Registration window sync warning:", err);
    return 0;
  }
}
