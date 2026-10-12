import Link from "next/link";
import { ArrowUpRight, BookOpenText, Briefcase, ChevronDown, ExternalLink, GraduationCap, Info, Lightbulb, ListChecks, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { safeExternalUrl, type Provenance, type SubjectContent } from "@/lib/subjects/content-schema";
import type { SubjectDetail } from "@/lib/subjects/queries";
import { Callout, EmptyState } from "@/components/ui/feedback";
import { SeatAvailability } from "./seat-availability";
import { DifficultyPill, ProvenanceBadge, ProvenanceNote } from "./subject-badges";

function Section({
  id,
  title,
  icon,
  provenance,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  provenance?: Provenance;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24 border-t border-border pt-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-surface-2 text-fg-muted [&_svg]:size-4">
          {icon}
        </span>
        <h2 id={id} className="text-xl font-light tracking-display text-fg">
          {title}
        </h2>
        {provenance ? <ProvenanceBadge provenance={provenance} /> : null}
      </div>
      <div className="mt-4">{children}</div>
      {provenance ? <ProvenanceNote provenance={provenance} /> : null}
    </section>
  );
}

function List({ items, className }: { items: string[]; className?: string }) {
  return (
    <ul className={cn("space-y-2", className)}>
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-sm text-fg">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-subtle" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Official facts about this offering, straight from the registration event. */
export function OfficialFacts({ subject }: { subject: SubjectDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["Course code", subject.courseCode ? <span className="font-mono">{subject.courseCode}</span> : <span className="text-fg-subtle">Not provided</span>],
    ["Credits", subject.credits],
    ["Elective category", subject.category.name],
    ["Programme", subject.programme ? subject.programme.name : <span className="text-fg-subtle">—</span>],
    ["Department", subject.department ? subject.department.name : <span className="text-fg-subtle">—</span>],
    ["Semester", <span key="sem" className="text-fg-subtle">Not recorded for electives</span>],
  ];
  return (
    <section aria-labelledby="official-facts" className="rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
      <div className="flex items-center gap-2">
        <h2 id="official-facts" className="text-sm font-medium text-fg">
          Official details
        </h2>
        <ProvenanceBadge provenance={{ status: "OFFICIAL" }} />
      </div>
      <p className="mt-1 text-xs text-fg-muted">From your registration event.</p>
      <dl className="mt-4 divide-y divide-border text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="text-fg-muted">{k}</dt>
            <dd className="text-right font-medium text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 border-t border-border pt-4">
        <SeatAvailability availability={subject.availability} size="md" />
      </div>
    </section>
  );
}

export function GuidanceSections({ content }: { content: SubjectContent }) {
  const { overview, syllabus, outcomes, prerequisites, difficulty, careers, resources, examples } = content;
  return (
    <div className="space-y-8">
      {overview ? (
        <Section id="overview" title="Overview" icon={<BookOpenText />} provenance={overview.provenance}>
          <div className="max-w-prose space-y-3 text-[0.9375rem] leading-relaxed text-fg">
            {overview.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {overview.learnPoints.length ? (
            <div className="mt-5 rounded-card bg-surface-2 p-4 sm:p-5">
              <h3 className="text-sm font-medium text-fg">What you can expect to learn</h3>
              <List items={overview.learnPoints} className="mt-3" />
            </div>
          ) : null}
        </Section>
      ) : null}

      {syllabus ? (
        <Section id="syllabus" title="Syllabus and topics" icon={<ListChecks />} provenance={syllabus.provenance}>
          {syllabus.note ? (
            <Callout tone={syllabus.provenance.status === "OFFICIAL" ? "neutral" : "warning"} icon={<Info />} className="mb-4">
              {syllabus.note}
            </Callout>
          ) : null}
          <ol className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
            {syllabus.units.map((unit, i) => (
              <li key={unit.title}>
                <details className="group" open={i === 0}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-xs text-fg-muted">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-fg">{unit.title}</span>
                    <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <div className="px-4 pb-4 pl-14 sm:px-5 sm:pl-15">
                    {unit.summary ? <p className="mb-2 text-sm text-fg-muted">{unit.summary}</p> : null}
                    <List items={unit.topics} />
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {outcomes ? (
        <Section id="outcomes" title="Learning outcomes" icon={<Target />} provenance={outcomes.provenance}>
          {outcomes.provenance.status !== "OFFICIAL" ? (
            <p className="mb-3 text-sm text-fg-muted">Proposed guidance on what you should be able to do afterwards. Not the approved course outcomes.</p>
          ) : null}
          <List items={outcomes.items} />
        </Section>
      ) : null}

      {prerequisites ? (
        <Section id="prerequisites" title="Prerequisites" icon={<GraduationCap />}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-fg">Official prerequisites</h3>
                {prerequisites.official ? <ProvenanceBadge provenance={prerequisites.official.provenance} /> : null}
              </div>
              {prerequisites.official ? (
                prerequisites.official.items.length ? (
                  <List items={prerequisites.official.items} className="mt-3" />
                ) : (
                  <p className="mt-3 text-sm text-fg-muted">None required.</p>
                )
              ) : (
                <p className="mt-3 text-sm text-fg-muted">
                  Not provided by the university yet. Your eligibility is checked by the system when you register, not by this page.
                </p>
              )}
            </div>
            <div className="rounded-card bg-surface-2 p-4">
              <h3 className="text-sm font-medium text-fg">Recommended background</h3>
              <p className="mt-0.5 text-xs text-fg-muted">Helpful, not required.</p>
              {prerequisites.recommended.length ? <List items={prerequisites.recommended} className="mt-3" /> : <p className="mt-3 text-sm text-fg-subtle">—</p>}
            </div>
            <div className="rounded-card bg-surface-2 p-4">
              <h3 className="text-sm font-medium text-fg">Helpful skills</h3>
              <p className="mt-0.5 text-xs text-fg-muted">Nice to have.</p>
              {prerequisites.helpfulSkills.length ? <List items={prerequisites.helpfulSkills} className="mt-3" /> : <p className="mt-3 text-sm text-fg-subtle">—</p>}
            </div>
          </div>
        </Section>
      ) : null}

      {difficulty ? (
        <Section id="difficulty" title="Difficulty" icon={<Lightbulb />} provenance={difficulty.provenance}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="rounded-card bg-surface-2 p-4 sm:w-56">
              <DifficultyPill difficulty={difficulty} className="text-sm text-fg" />
              <p className="mt-2 text-xs text-fg-muted">
                {difficulty.provenance.status === "OFFICIAL" ? "Rating provided by faculty." : "An indicative estimate, not an official university rating."}
              </p>
            </div>
            {difficulty.challenges.length ? (
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-fg">What students may find challenging</h3>
                <List items={difficulty.challenges} className="mt-3" />
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      {careers ? (
        <Section id="careers" title="Career relevance" icon={<Briefcase />} provenance={careers.provenance}>
          <p className="mb-4 text-sm text-fg-muted">
            Career guidance only. Taking this elective does not guarantee a job, salary, placement or certification.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {careers.roles.map((role) => (
              <li key={role.title} className="rounded-card border border-border bg-surface p-4">
                <h3 className="text-sm font-medium text-fg">{role.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{role.summary}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`Skills for ${role.title}`}>
                  {role.skills.map((s) => (
                    <li key={s} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-2xs font-medium text-fg-muted">
                      {s}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {resources.length ? (
        <Section id="resources" title="Learning resources" icon={<ArrowUpRight />}>
          <p className="mb-4 text-sm text-fg-muted">
            External material from recognised providers, separate from your official syllabus. Links open in a new tab.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {resources.map((r) => {
              const href = safeExternalUrl(r.url);
              return (
                <li key={r.url} className="flex flex-col rounded-card border border-border bg-surface p-4">
                  <p className="text-xs font-medium text-fg-muted">
                    {r.provider}
                    <span className="text-fg-subtle"> · {r.kind === "standard" ? "Standard" : r.kind === "course" ? "Course" : r.kind === "documentation" ? "Documentation" : "Reference"}</span>
                  </p>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer external"
                      referrerPolicy="no-referrer"
                      className="mt-1 inline-flex items-start gap-1.5 text-sm font-medium text-fg underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {r.title}
                      <ExternalLink aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-fg">{r.title}</p>
                  )}
                  <p className="mt-1.5 text-sm text-fg-muted">{r.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-xs text-fg-subtle">
                    {r.relevance ? <span>Relevant to: {r.relevance}</span> : null}
                    {r.lastCheckedAt ? (
                      <span>
                        Link {r.lastCheckStatus === "failed" ? "failed" : "checked"} {formatDate(r.lastCheckedAt)}
                      </span>
                    ) : (
                      <span>Link not yet checked</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {examples.length ? (
        <Section id="examples" title="Practical examples" icon={<Lightbulb />}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {examples.map((e) => (
              <li key={e.title} className="rounded-card bg-surface-2 p-4">
                <h3 className="text-sm font-medium text-fg">{e.title}</h3>
                <p className="mt-1 text-sm text-fg-muted">{e.description}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

/** Other subjects in the same basket, most seats first. Useful when this one is full. */
export function Alternatives({ subject }: { subject: SubjectDetail }) {
  if (subject.alternatives.length === 0) return null;
  const full = subject.availability.state === "full";
  return (
    <section aria-labelledby="alternatives" className="rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
      <h2 id="alternatives" className="text-sm font-medium text-fg">
        {full ? `${subject.name} is full. Other subjects in ${subject.category.name}` : `Also in ${subject.category.name}`}
      </h2>
      <ul className="mt-3 divide-y divide-border">
        {subject.alternatives.slice(0, 6).map((a) => (
          <li key={a.electiveId}>
            <Link
              href={`/dashboard/subjects/${a.electiveId}`}
              className="flex items-center justify-between gap-3 rounded-control py-2.5 text-sm hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="min-w-0 truncate text-fg">
                {a.courseCode ? <span className="mr-1.5 font-mono text-xs text-fg-subtle">{a.courseCode}</span> : null}
                {a.name}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  a.availability.state === "full" ? "text-danger-text" : a.availability.state === "low" ? "text-warning-text" : "text-fg-muted"
                )}
              >
                {a.availability.state === "full" ? "Full" : `${a.availability.available} left`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function NoGuide() {
  return (
    <EmptyState
      compact
      icon={<BookOpenText />}
      title="No detailed guide for this subject yet"
      description="The official details on this page come from your registration event. Ask your class tutor or coordinator for the syllabus."
      className="rounded-panel bg-surface-2"
    />
  );
}
