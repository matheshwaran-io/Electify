/**
 * The single definition of "is this registration window open?".
 *
 * Every student page and every server action uses this, so what a student sees
 * always matches what the server will accept. The server remains authoritative:
 * actions call it with their own clock at request time, never a client value.
 *
 * Time strategy: open/close are stored as Postgres `timestamp` values and read
 * back as JS Dates by node-postgres in the server's time zone, then compared as
 * instants here. Displays format them in APP_TIME_ZONE (Asia/Kolkata). Keep the
 * server's TZ fixed (UTC on Vercel) so writes and reads agree.
 */

/** Event statuses a student can see on their dashboard and in the subject explorer. */
export const STUDENT_VISIBLE_EVENT_STATUSES = [
  "PUBLISHED",
  "OPEN",
  "ACTIVE",
  "PAUSED",
  "CLOSED",
  "VERIFICATION",
  "FINALIZED",
] as const

export type WindowState = "UNSCHEDULED" | "UPCOMING" | "OPEN" | "PAUSED" | "CLOSED"

export type WindowEventFields = {
  openDate: Date | string | null
  closeDate: Date | string | null
  status: string
  autoClose?: boolean | null
}

export type RegistrationWindow = {
  state: WindowState
  isOpen: boolean
  opensAt: Date | null
  closesAt: Date | null
  /** Student-facing reason when the window is not open. */
  reason?: string
}

const CLOSED_STATUSES = new Set(["CLOSED", "VERIFICATION", "FINALIZED", "ARCHIVED"])

export function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "number") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === "string") {
    const s = value.trim()
    if (!s) return null
    // If ISO-like string without timezone indicator (e.g. "2026-10-15 21:36:00" or "2026-10-15T21:36:00"),
    // Postgres timestamp without time zone stores UTC, so append Z so it parses identically everywhere.
    if (!s.endsWith("Z") && !s.includes("+") && !s.slice(10).includes("-")) {
      const d = new Date(s.replace(" ", "T") + "Z")
      if (!Number.isNaN(d.getTime())) return d
    }
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function getRegistrationWindow(event: WindowEventFields, now: Date = new Date()): RegistrationWindow {
  const opensAt = toDate(event.openDate)
  const closesAt = toDate(event.closeDate)
  const base = { opensAt, closesAt }

  if (event.status === "PAUSED") {
    return { ...base, state: "PAUSED", isOpen: false, reason: "Registration is currently paused by faculty." }
  }

  if (CLOSED_STATUSES.has(event.status)) {
    return { ...base, state: "CLOSED", isOpen: false, reason: "Registration has closed." }
  }

  // A scheduled opening time always wins: nothing opens early, whatever the
  // stored status says. A status of OPEN only opens a window that has no opening
  // time (opening one manually moves openDate to that moment; see openNowPatch).
  const started = opensAt !== null ? now.getTime() >= opensAt.getTime() : event.status === "OPEN" || event.status === "ACTIVE"

  if (!started) {
    return opensAt
      ? { ...base, state: "UPCOMING", isOpen: false, reason: "Registration has not opened yet." }
      : { ...base, state: "UNSCHEDULED", isOpen: false, reason: "Registration has not been scheduled yet." }
  }

  const autoClose = event.autoClose ?? true
  if (closesAt !== null && now.getTime() > closesAt.getTime() && autoClose) {
    return { ...base, state: "CLOSED", isOpen: false, reason: "The registration deadline has passed. Modifications are closed." }
  }

  return { ...base, state: "OPEN", isOpen: true }
}

/**
 * Fields to write when staff open a window by hand ("Open now", "Resume",
 * "Re-open"). A future or missing opening time is moved to now, so the stored
 * schedule and the window state never disagree.
 */
export function openNowPatch(event: { openDate: Date | string | null }, now: Date = new Date()): { status: "OPEN"; openDate?: Date } {
  const opensAt = toDate(event.openDate)
  return opensAt === null || opensAt.getTime() > now.getTime() ? { status: "OPEN", openDate: now } : { status: "OPEN" }
}
