import { notFound } from "next/navigation"
import { StudentHeader } from "@/components/student/student-chrome"
import { SubjectCatalogView, SubjectDetailView } from "@/components/subjects/subject-views"
import { cloudComputingProfile } from "@/lib/subjects/catalog/cloud-computing"
import { readSubjectContent } from "@/lib/subjects/content-schema"
import { studentSeatAvailability } from "@/lib/seats"
import type { WindowState } from "@/lib/registration-window"
import type { SubjectDetail, SubjectSummary } from "@/lib/subjects/queries"

export const metadata = { title: "Subject explorer preview" }

const STATES: WindowState[] = ["UPCOMING", "OPEN", "PAUSED", "CLOSED", "UNSCHEDULED"]

/**
 * Development-only preview of the subject explorer with sample offerings, for
 * visual QA when no event with electives exists locally.
 *   /dev/subjects?state=upcoming|open|paused|closed|unscheduled
 *   /dev/subjects?view=detail[&subject=e2|e3]   (e1 has the Cloud Computing guide)
 *   /dev/subjects?view=empty
 * Sample offerings are invented for layout only; the Cloud Computing guide is
 * the real bundled profile from src/lib/subjects/catalog.
 */
export default async function DevSubjectsPreview({ searchParams }: { searchParams: Promise<{ view?: string; state?: string; subject?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound()
  const { view, state: rawState, subject: subjectId = "e1" } = await searchParams
  const now = Date.now()
  const state = STATES.find((s) => s === rawState?.toUpperCase()) ?? "UPCOMING"

  const content = readSubjectContent(cloudComputingProfile.content)
  const programme = { id: "p1", name: "MCA", code: "MCA" }
  const department = { id: "d1", name: "Computer Applications" }
  const offering = (
    id: string,
    category: { id: string; name: string },
    name: string,
    seats: [number, number],
    opts: { courseCode?: string; description?: string; guide?: boolean } = {}
  ): SubjectSummary => ({
    electiveId: id,
    name,
    courseCode: opts.courseCode ?? null,
    credits: 3,
    description: opts.description ?? null,
    category,
    programme,
    department,
    availability: studentSeatAvailability({ availableSeats: seats[1], maxSeats: seats[0] }),
    profile: opts.guide
      ? { slug: cloudComputingProfile.slug, title: cloudComputingProfile.title, summary: cloudComputingProfile.summary, tags: content.tags, difficulty: content.difficulty }
      : null,
    searchText: [name, opts.courseCode, opts.description, category.name, ...(opts.guide ? content.tags : [])].filter(Boolean).join(" ").toLowerCase(),
  })
  const pe = { id: "g1", name: "Professional Elective I" }
  const oe = { id: "g2", name: "Open Elective" }
  const subjects = [
    offering("e1", pe, "Cloud Computing", [40, 7], { guide: true }),
    offering("e2", pe, "Applied Machine Learning", [40, 23], { description: "Supervised and unsupervised learning with hands-on model evaluation." }),
    offering("e3", pe, "Software Quality Assurance", [40, 0], { description: "Test design, automation and quality metrics." }),
    offering("e4", oe, "Design Thinking", [60, 41]),
    offering("e5", oe, "Technical Writing", [60, 3]),
  ]

  const banner = {
    state,
    opensAt: state === "UNSCHEDULED" ? null : new Date(now + (state === "UPCOMING" ? 2 * 3600_000 + 754_000 : -3600_000)).toISOString(),
    closesAt: state === "UNSCHEDULED" ? null : new Date(now + (state === "CLOSED" ? -60_000 : 26 * 3600_000)).toISOString(),
    serverNow: now,
    registrationStatus: null,
    eligible: true,
  }

  if (view === "detail") {
    const base = subjects.find((s) => s.electiveId === subjectId) ?? subjects[0]
    const subject: SubjectDetail = {
      ...base,
      content: base.profile ? content : null,
      alternatives: subjects
        .filter((s) => s.category.id === base.category.id && s.electiveId !== base.electiveId)
        .map(({ electiveId, name, courseCode, availability }) => ({ electiveId, name, courseCode, availability })),
    }
    return (
      <div className="flex min-h-dvh flex-col">
        <StudentHeader />
        <SubjectDetailView subject={subject} banner={banner} live={false} />
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <StudentHeader />
      <SubjectCatalogView eventName="Sample event (dev preview)" subjects={view === "empty" ? [] : subjects} banner={banner} live={false} />
    </div>
  )
}
