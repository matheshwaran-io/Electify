import { getRegistrationWindow } from "@/lib/registration-window"

/** Shape returned by getRegistrationMetrics (app/actions/tutor.ts). */
export type WindowMetrics = {
  totalStudents: number
  registeredStudents: number
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
  groupCount: number
}

export type WindowPhase = "live" | "paused" | "scheduled" | "closed" | "configured"

/**
 * Window phase for staff screens, derived from the same rule the server uses
 * for students (lib/registration-window.ts), so the status banner, the
 * pause/resume controls and what students can actually do always agree.
 */
export function windowPhase(event: WindowEvent, now: Date): { phase: WindowPhase; target: Date | null } {
  const w = getRegistrationWindow(event, now)
  switch (w.state) {
    case "PAUSED":
      return { phase: "paused", target: null }
    case "CLOSED":
      return { phase: "closed", target: null }
    case "OPEN":
      return { phase: "live", target: w.closesAt }
    case "UPCOMING":
      return { phase: "scheduled", target: w.opensAt }
    default:
      return { phase: "configured", target: null }
  }
}
