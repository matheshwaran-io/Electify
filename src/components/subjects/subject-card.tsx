import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubjectSummary } from "@/lib/subjects/queries";
import { SeatAvailability } from "./seat-availability";
import { DifficultyPill } from "./subject-badges";

/** One subject in the catalogue. The whole card is a single link to the detail page. */
export function SubjectCard({ subject }: { subject: SubjectSummary }) {
  const summary = subject.profile?.summary || subject.description;
  const full = subject.availability.state === "full";
  return (
    <li className="min-w-0">
      <Link
        href={`/dashboard/subjects/${subject.electiveId}`}
        className={cn(
          "group flex h-full flex-col gap-4 rounded-card border bg-surface p-4 shadow-1 transition-[border-color,box-shadow] duration-200 sm:p-5",
          "hover:border-border-strong hover:shadow-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          full ? "border-border bg-surface-2/40" : "border-border"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
              <span>{subject.category.name}</span>
              {subject.courseCode ? <span className="font-mono text-fg-subtle">{subject.courseCode}</span> : null}
              <span className="text-fg-subtle">{subject.credits} credits</span>
            </p>
            <h3 className="mt-1.5 text-base font-medium leading-snug text-fg">{subject.name}</h3>
          </div>
          <ArrowUpRight
            aria-hidden
            className="size-4 shrink-0 text-fg-subtle transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </div>

        {summary ? <p className="line-clamp-3 text-sm text-fg-muted">{summary}</p> : null}

        {subject.profile?.tags.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
            {subject.profile.tags.slice(0, 4).map((t) => (
              <li key={t} className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-2xs font-medium text-fg-muted">
                {t}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-4 border-t border-border pt-3">
          <SeatAvailability availability={subject.availability} className="min-w-0 flex-1" />
          {subject.profile?.difficulty ? <DifficultyPill difficulty={subject.profile.difficulty} className="shrink-0 pb-0.5" /> : null}
        </div>
      </Link>
    </li>
  );
}
