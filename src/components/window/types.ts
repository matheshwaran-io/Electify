/** Shape returned by getRegistrationMetrics (app/actions/tutor.ts). */
export type WindowMetrics = {
  totalStudents: number
  registeredStudents: number
  waitlistedStudents?: number
  totalSeats: number
  filledSeats: number
  fullSubjects: number
  peakHour: string
  popularSubject: string
  leastSubject: string
  subjectCounts: { name: string; value: number }[]
}

export type WindowEvent = {
  id: string
  name: string
  academicYear: string | null
  status: string
  openDate: Date | string | null
  closeDate: Date | string | null
  description: string | null
  allowEditing?: boolean
  autoClose?: boolean
  enableWaitlist?: boolean
  groupCount: number
}

export type WindowPhase = "live" | "paused" | "scheduled" | "closed" | "configured"

/** Same rules the page has always used to label the window's state. */
export function windowPhase(event: WindowEvent, now: Date): { phase: WindowPhase; target: Date | null } {
  if (event.status === "PAUSED") return { phase: "paused", target: null }
  if (event.status === "CLOSED") return { phase: "closed", target: null }
  const open = event.openDate ? new Date(event.openDate) : null
  const close = event.closeDate ? new Date(event.closeDate) : null
  if (event.status === "OPEN" || (open && now >= open && (!close || now < close))) return { phase: "live", target: close }
  if (open && now < open) return { phase: "scheduled", target: open }
  if (close && now >= close) return { phase: "closed", target: null }
  return { phase: "configured", target: null }
}
