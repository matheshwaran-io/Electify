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
import { electiveSeatAllocations, electives, studentRegistrations, users } from "@/lib/db/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ElectiveRow = typeof electives.$inferSelect;

/** Thrown when a seat ran out between the student opening the page and submitting. */
export class SeatTakenError extends Error {
  constructor(readonly electiveId: string, name: string) {
    super(`The last seat in ${name} was just taken. Please choose another elective.`);
  }
}

/**
 * Takes one seat in `elective` (a row the caller has locked) for a student of `sectionId`.
 *
 * The counters (`available_seats`) are checked against the real number of
 * confirmed choices, counted under the same row lock: every writer of a choice
 * for this subject holds that lock, so the count cannot change underneath us.
 * A counter that has drifted above the truth (for example after a direct
 * database edit) can therefore never let a subject or class quota be overbooked,
 * and each successful take rewrites the counter from the real count.
 */
export async function takeSeat(tx: Tx, elective: ElectiveRow, sectionId: string | null) {
  const taken = await confirmedBySection(tx, elective.id);
  const remaining = Math.min(elective.availableSeats, elective.maxSeats - taken.total);
  if (remaining <= 0) throw new SeatTakenError(elective.id, elective.name);

  const quotas = await tx
    .select()
    .from(electiveSeatAllocations)
    .where(and(eq(electiveSeatAllocations.electiveId, elective.id), isNotNull(electiveSeatAllocations.sectionId)))
    .for("update");
  const quotaRemaining = (q: (typeof quotas)[number]) => Math.max(0, Math.min(q.availableSeats, q.maxSeats - (taken.bySection.get(q.sectionId!) ?? 0)));

  const own = sectionId ? quotas.find((q) => q.sectionId === sectionId) : undefined;
  if (own) {
    if (quotaRemaining(own) <= 0) throw new SeatTakenError(elective.id, elective.name);
  } else if (quotas.length > 0) {
    // Seats still held back for classes with a quota are not open to others.
    const reserved = quotas.reduce((sum, q) => sum + quotaRemaining(q), 0);
    if (remaining - reserved <= 0) throw new SeatTakenError(elective.id, elective.name);
  }

  await tx
    .update(electives)
    .set({ availableSeats: remaining - 1, isFull: remaining - 1 <= 0, updatedAt: new Date() })
    .where(eq(electives.id, elective.id));

  if (own) {
    const left = quotaRemaining(own) - 1;
    await tx
      .update(electiveSeatAllocations)
      .set({ availableSeats: left, isFull: left <= 0, updatedAt: new Date() })
      .where(eq(electiveSeatAllocations.id, own.id));
  }
}

/** Number of confirmed choices for a subject (the truth the seat counter must match). */
export async function confirmedCount(tx: Tx | typeof db, electiveId: string) {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(studentRegistrations)
    .where(and(eq(studentRegistrations.electiveId, electiveId), eq(studentRegistrations.status, "CONFIRMED")));
  return Number(row?.n ?? 0);
}

/** Confirmed choices for one subject, in total and per class. Call with the subject row locked. */
async function confirmedBySection(tx: Tx, electiveId: string) {
  const rows = await tx
    .select({ sectionId: users.sectionId, n: sql<number>`count(*)::int` })
    .from(studentRegistrations)
    .innerJoin(users, eq(users.id, studentRegistrations.studentId))
    .where(and(eq(studentRegistrations.electiveId, electiveId), eq(studentRegistrations.status, "CONFIRMED")))
    .groupBy(users.sectionId);
  const bySection = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    total += Number(r.n);
    if (r.sectionId) bySection.set(r.sectionId, Number(r.n));
  }
  return { total, bySection };
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
