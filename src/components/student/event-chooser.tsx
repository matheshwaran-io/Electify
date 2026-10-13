import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StudentHeader } from "@/components/student/student-chrome";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { withEvent, type StudentEvent } from "@/lib/student-events";

const STATE_TEXT: Record<StudentEvent["window"]["state"], { label: string; tone: "success" | "warning" | "neutral" | "outline" }> = {
  OPEN: { label: "Open now", tone: "success" },
  PAUSED: { label: "Paused", tone: "warning" },
  UPCOMING: { label: "Opens soon", tone: "neutral" },
  UNSCHEDULED: { label: "Not scheduled", tone: "outline" },
  CLOSED: { label: "Closed", tone: "outline" },
};

/** Shown when a class has more than one current registration event. */
export function EventChooser({ classLabel, events }: { classLabel: string; events: StudentEvent[] }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <StudentHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <p className="text-sm text-fg-muted">{classLabel}</p>
        <h1 className="mt-1 text-4xl font-light tracking-display text-fg">Your registrations</h1>
        <p className="mt-2 text-fg-muted">Your class has more than one registration this term. Pick the one you want to open.</p>

        <ul className="mt-8 space-y-3">
          {events.map((e) => {
            const state = STATE_TEXT[e.window.state];
            const when =
              e.window.state === "UPCOMING" && e.openDate
                ? `Opens ${formatDateTime(e.openDate)}`
                : e.window.state === "OPEN" && e.closeDate
                  ? `Closes ${formatDateTime(e.closeDate)}`
                  : null;
            return (
              <li key={e.id}>
                <Link
                  href={withEvent("/dashboard", e.id)}
                  className="group flex items-center gap-4 rounded-card border border-border bg-surface p-4 shadow-1 transition-colors hover:border-border-strong sm:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge size="sm" tone={state.tone}>
                        {state.label}
                      </Badge>
                      {e.registrationStatus === "CONFIRMED" ? (
                        <Badge size="sm" tone="primary">
                          Registered
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 font-medium text-fg">{e.name}</p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {[e.sessionLabel ? `Academic session ${e.sessionLabel}` : null, e.semester ? `Semester ${e.semester}` : null, when]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
