import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { SubjectDetail, SubjectSummary } from "@/lib/subjects/queries";
import { Badge } from "@/components/ui/badge";
import { RegistrationWindowBanner, type WindowBannerProps } from "./registration-window-banner";
import { LiveSeatRefresh } from "./live-seat-refresh";
import { SubjectExplorer } from "./subject-explorer";
import { SubjectIllustration } from "./subject-illustration";
import { DifficultyPill } from "./subject-badges";
import { Alternatives, GuidanceSections, NoGuide, OfficialFacts } from "./subject-detail";

type Banner = Omit<WindowBannerProps, "className" | "chooseHref">;

/**
 * Page bodies for the subject explorer. The routes under /dashboard/subjects
 * pass authorised server data; the dev preview passes sample data. `live`
 * turns on realtime seat refresh (off in the preview, which has no real rows).
 */
export function SubjectCatalogView({
  eventName,
  classLabel,
  subjects,
  banner,
  live = true,
}: {
  eventName: string;
  /** "MCA F · 2025–2027 · Academic session 2026–2027" */
  classLabel?: string;
  subjects: SubjectSummary[];
  banner: Banner;
  live?: boolean;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <header className="flex flex-col gap-2 animate-enter">
        <p className="text-sm text-fg-muted">
          {eventName}
          {classLabel ? (
            <>
              <span aria-hidden className="mx-2 text-border-strong">/</span>
              {classLabel}
            </>
          ) : null}
        </p>
        <h1 className="text-4xl font-light tracking-display text-fg">Explore subjects</h1>
        <p className="max-w-2xl text-fg-muted">
          Read what each elective covers, how demanding it is and where it can lead, then pick with confidence when registration opens.
        </p>
      </header>

      <RegistrationWindowBanner className="mt-6" {...banner} />

      <div className="mb-4 mt-8 flex items-center justify-between gap-3">
        <h2 className="text-base font-medium text-fg">All subjects</h2>
        {live ? <LiveSeatRefresh electiveIds={subjects.map((s) => s.electiveId)} /> : null}
      </div>

      <SubjectExplorer subjects={subjects} />

      <p className="mt-10 max-w-2xl text-xs text-fg-subtle">
        Seat counts come from the live registration data and update automatically. They are not a reservation: a seat is only yours once your
        registration is confirmed.
      </p>
    </main>
  );
}

export function SubjectDetailView({ subject, banner, live = true }: { subject: SubjectDetail; banner: Banner; live?: boolean }) {
  const summary = subject.profile?.summary || subject.description;
  const content = subject.content;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-5 sm:px-6 sm:pt-8">
      <nav aria-label="Breadcrumb" className="mb-5">
        <Link href="/dashboard/subjects" className="inline-flex h-10 items-center gap-1 rounded-full pr-3 text-sm font-medium text-fg-muted hover:text-fg">
          <ChevronLeft className="size-4" /> All subjects
        </Link>
      </nav>

      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0 animate-enter">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
            <span>{subject.category.name}</span>
            {subject.courseCode ? <span className="font-mono text-fg-subtle">{subject.courseCode}</span> : null}
          </p>
          <h1 className="mt-2 text-4xl font-light tracking-display text-fg sm:text-5xl">{subject.name}</h1>
          {summary ? <p className="mt-4 max-w-2xl text-lg text-fg-muted">{summary}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge size="sm" tone="outline">
              {subject.credits} credits
            </Badge>
            {subject.programme ? <Badge size="sm">{subject.programme.name}</Badge> : null}
            {content?.difficulty ? <DifficultyPill difficulty={content.difficulty} className="ml-1" /> : null}
          </div>
          {content?.tags.length ? (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Topics">
              {content.tags.map((t) => (
                <li key={t} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-fg-muted">
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <SubjectIllustration slug={subject.profile?.slug} className="hidden w-full lg:block" />
      </header>

      <RegistrationWindowBanner
        className="mt-8"
        {...banner}
        chooseHref={`/dashboard/electives${banner.eventId ? `?event=${encodeURIComponent(banner.eventId)}` : ""}#elective-${subject.electiveId}`}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="order-2 min-w-0 lg:order-1">
          {content ? (
            <>
              <p className="mb-6 rounded-card bg-surface-2 px-4 py-3 text-sm text-fg-muted">
                The sections below are supplementary guidance to help you choose. Each one says whether it is official. Where it differs from your
                faculty-approved syllabus, the syllabus wins.
              </p>
              <GuidanceSections content={content} />
            </>
          ) : (
            <NoGuide />
          )}
        </div>

        <aside className="order-1 space-y-4 lg:sticky lg:top-20 lg:order-2" aria-label="Subject facts">
          {live ? (
            <div className="flex justify-end">
              <LiveSeatRefresh electiveIds={[subject.electiveId]} />
            </div>
          ) : null}
          <OfficialFacts subject={subject} />
          <Alternatives subject={subject} />
        </aside>
      </div>
    </main>
  );
}
