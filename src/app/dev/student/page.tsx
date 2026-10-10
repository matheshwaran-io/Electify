import { notFound } from "next/navigation"
import { StudentHeader } from "@/components/student/student-chrome"
import { RegistrationForm } from "@/app/dashboard/registration-form"
import { CountdownTimer } from "@/app/countdown/countdown-timer"

export const metadata = { title: "Student flow preview" }

/**
 * Development-only preview of the student picker and countdown with sample
 * data, for visual QA when no registration window is open locally.
 * Confirming here calls the real action, which rejects non-student sessions.
 */
export default async function DevStudentPreview({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { view } = await searchParams
  const now = Date.now()

  if (view === "countdown") {
    return (
      <div className="flex min-h-dvh flex-col">
        <StudentHeader />
        <main className="flex flex-1 items-center justify-center px-5">
          <CountdownTimer startDateStr={new Date(now + 3 * 3600_000 + 754_000).toISOString()} registrationEnabled serverNow={now} />
        </main>
      </div>
    )
  }

  const groups = [
    { id: "g1", name: "Professional Elective I", minChoices: 1, maxChoices: 1 },
    { id: "g2", name: "Open Elective", minChoices: 1, maxChoices: 1 },
  ]
  const e = (id: string, groupId: string, courseCode: string, name: string, max: number, left: number, description?: string) => ({
    id, groupId, courseCode, name, credits: 3, description: description ?? null, maxSeats: max, availableSeats: left, isActive: true, isFull: left <= 0,
  })
  const electives = [
    e("e1", "g1", "MCA-501", "Software Quality Assurance", 40, 23, "Test design, automation and quality metrics for production software."),
    e("e2", "g1", "MCA-502", "Applied Machine Learning", 40, 6, "Supervised and unsupervised learning with hands-on model evaluation."),
    e("e3", "g1", "MCA-503", "Cloud Native Systems", 40, 0, "Containers, orchestration and resilient service design."),
    e("e4", "g2", "OE-210", "Design Thinking", 60, 41),
    e("e5", "g2", "OE-214", "Financial Literacy", 60, 12, "Personal finance, markets and reading financial statements."),
    e("e6", "g2", "OE-220", "Technical Writing", 60, 3),
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <StudentHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-2 flex flex-col gap-1">
          <p className="text-sm text-fg-muted">Sample event (dev preview)</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Choose your electives</h1>
          <p className="text-sm text-fg-muted">
            Preview student <span aria-hidden className="mx-2 text-border-strong">/</span>
            <span className="font-mono">RA0000000000000</span>
          </p>
        </div>
        <RegistrationForm
          event={{ id: "dev-preview", name: "Sample event", status: "OPEN", openDate: new Date(now - 600_000), closeDate: new Date(now + 47 * 60_000) }}
          student={{ id: "dev", name: "Preview student", registerNumber: "RA0000000000000", isEligible: true, hasSubmitted: false }}
          groups={groups}
          electives={electives}
          initialRegistrations={[]}
          serverNow={now}
        />
      </main>
    </div>
  )
}
