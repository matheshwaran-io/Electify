/**
 * Seat availability rules shared by server and client code, so the picker,
 * the subject explorer and the server all agree on "low" and "full".
 */

export type SeatState = "available" | "low" | "full"

export function seatState(available: number, max: number, lowThreshold = 10): SeatState {
  if (available <= 0) return "full"
  if (available < lowThreshold || (max > 0 && available / max <= 0.1)) return "low"
  return "available"
}

export type StudentSeatAvailability = {
  /** Seats this student could take right now; never negative. */
  available: number
  /** Size of the pool that applies to this student (their class quota when one is set). */
  max: number
  state: SeatState
  /** True when a class/section quota limits this student. */
  sectionLimited: boolean
}

/**
 * What one student can actually get: the elective's general pool, further
 * limited by their section's quota when the coordinator has set one. This is
 * the same rule the registration transaction enforces.
 */
export function studentSeatAvailability(
  elective: { availableSeats: number; maxSeats: number; isActive?: boolean },
  sectionQuota?: { availableSeats: number; maxSeats: number } | null
): StudentSeatAvailability {
  const rawAvailable = sectionQuota ? Math.min(elective.availableSeats, sectionQuota.availableSeats) : elective.availableSeats
  const available = elective.isActive === false ? 0 : Math.max(0, rawAvailable)
  const max = Math.max(0, sectionQuota ? Math.min(elective.maxSeats, sectionQuota.maxSeats) : elective.maxSeats)
  return { available, max, state: seatState(available, max), sectionLimited: Boolean(sectionQuota) }
}

/** Short student-facing label, e.g. "32 seats available", "3 seats left", "Full". */
export function seatLabel(a: { available: number; state: SeatState }) {
  if (a.state === "full") return "Full"
  if (a.state === "low") return `${a.available} ${a.available === 1 ? "seat" : "seats"} left`
  return `${a.available} seats available`
}
