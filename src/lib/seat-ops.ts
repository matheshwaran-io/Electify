/**
 * Seat accounting shared by student registration and staff manual
 * registration. Callers run these inside a transaction and must already hold
 * a row lock on the elective (SELECT ... FOR UPDATE, in id order), so every
 * seat change for one subject is serialised.
 *
 * Capacity is per subject offering (one `electives` row per event), so two
 * classes taking "the same" subject in different events never share a counter.
 *
 * Class quotas (elective_seat_allocations with a section): a student of a
 * class with a quota draws from that quota and the subject. A student of a
 * class without a quota may only use seats that are not still reserved for
 * classes that have one. Department-level rows (no section) are informational
 * and are not enforced here.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { electiveSeatAllocations, electives } from "@/lib/db/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ElectiveRow = typeof electives.$inferSelect;

/** Thrown when a seat ran out between the student opening the page and submitting. */
export class SeatTakenError extends Error {
  constructor(readonly electiveId: string, name: string) {
    super(`The last seat in ${name} was just taken. Please choose another elective.`);
  }
}

/** Takes one seat in `elective` (a row the caller has locked) for a student of `sectionId`. */
export async function takeSeat(tx: Tx, elective: ElectiveRow, sectionId: string | null) {
  if (elective.availableSeats <= 0) throw new SeatTakenError(elective.id, elective.name);

  const quotas = await tx
    .select()
    .from(electiveSeatAllocations)
    .where(and(eq(electiveSeatAllocations.electiveId, elective.id), isNotNull(electiveSeatAllocations.sectionId)))
    .for("update");

  const own = sectionId ? quotas.find((q) => q.sectionId === sectionId) : undefined;
  if (own) {
    if (own.availableSeats <= 0) throw new SeatTakenError(elective.id, elective.name);
  } else if (quotas.length > 0) {
    // Seats still held back for classes with a quota are not open to others.
    const reserved = quotas.reduce((sum, q) => sum + Math.max(0, q.availableSeats), 0);
    if (elective.availableSeats - reserved <= 0) throw new SeatTakenError(elective.id, elective.name);
  }

  await tx
    .update(electives)
    .set({
      availableSeats: sql`${electives.availableSeats} - 1`,
      isFull: sql`CASE WHEN ${electives.availableSeats} - 1 <= 0 THEN true ELSE false END`,
      updatedAt: new Date(),
    })
    .where(eq(electives.id, elective.id));

  if (own) {
    await tx
      .update(electiveSeatAllocations)
      .set({
        availableSeats: sql`${electiveSeatAllocations.availableSeats} - 1`,
        isFull: sql`CASE WHEN ${electiveSeatAllocations.availableSeats} - 1 <= 0 THEN true ELSE false END`,
        updatedAt: new Date(),
      })
      .where(eq(electiveSeatAllocations.id, own.id));
  }
}

/** Returns one confirmed seat to the subject and, if it has one, the student's class quota. Never above capacity. */
export async function releaseSeat(tx: Tx, electiveId: string, sectionId: string | null) {
  await tx
    .update(electives)
    .set({ availableSeats: sql`LEAST(${electives.availableSeats} + 1, ${electives.maxSeats})`, isFull: false, updatedAt: new Date() })
    .where(eq(electives.id, electiveId));

  if (sectionId) {
    await tx
      .update(electiveSeatAllocations)
      .set({
        availableSeats: sql`LEAST(${electiveSeatAllocations.availableSeats} + 1, ${electiveSeatAllocations.maxSeats})`,
        isFull: false,
        updatedAt: new Date(),
      })
      .where(and(eq(electiveSeatAllocations.electiveId, electiveId), eq(electiveSeatAllocations.sectionId, sectionId)));
  }
}
