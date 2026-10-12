"use client";

import { formatDateTime, splitDuration, pad2 } from "@/lib/format";
import { useTicker } from "@/lib/use-server-clock";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { windowPhase, type WindowEvent, type WindowPhase } from "./types";

const PHASE: Record<WindowPhase, { label: string; tone: "live" | "primary" | "neutral" | "outline" | "warning"; dot?: boolean; line: string }> = {
  live: { label: "Live", tone: "live", dot: true, line: "Students are submitting their elective choices right now." },
  paused: { label: "Paused", tone: "warning", dot: false, line: "Registration is temporarily paused. Students cannot submit choices." },
  scheduled: { label: "Scheduled", tone: "primary", line: "The portal opens automatically at the time below." },
  closed: { label: "Closed", tone: "neutral", line: "The portal is not accepting registrations." },
  configured: { label: "Not scheduled", tone: "outline", line: "Set an opening and closing time to schedule the window." },
};

export function HeroStatus({ event }: { event: WindowEvent }) {
  useTicker(true);
  const now = new Date();
  const { phase, target } = windowPhase(event, now);
  const meta = PHASE[phase];

  const remaining = target ? Math.max(0, new Date(target).getTime() - now.getTime()) : 0;
  const { days, hours, minutes, seconds } = splitDuration(remaining);
  const totalHours = days * 24 + hours;

  return (
    <section
      aria-label="Window status"
      className="relative col-span-1 overflow-hidden rounded-panel bg-surface-2 p-5 sm:p-7 lg:col-span-8"
    >
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone} dot={meta.dot}>
              {meta.label}
            </Badge>
            {event.allowEditing ? (
              <Badge tone="neutral">
                Edits allowed
              </Badge>
            ) : null}
          </div>
          <div>
            <h2 className="text-3xl font-light tracking-display text-fg lg:text-4xl">{event.name}</h2>
            <p className="mt-2 max-w-md text-fg-muted">{meta.line}</p>
          </div>
        </div>

        {target ? (
          <div className="md:text-right">
            <p className="text-xs font-medium text-fg-muted">{phase === "live" ? "Closes in" : "Opens in"}</p>
            <p
              className="mt-1 font-light tabular-nums tracking-display text-fg text-5xl lg:text-6xl"
              role="timer"
              suppressHydrationWarning
              aria-label={`${totalHours} hours ${minutes} minutes ${seconds} seconds`}
            >
              {pad2(totalHours)}
              <span className="text-fg-subtle">:</span>
              {pad2(minutes)}
              <span className="text-fg-subtle">:</span>
              {pad2(seconds)}
            </p>
          </div>
        ) : null}
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:max-w-md md:ml-auto">
        {[
          { label: "Opens", value: event.openDate },
          { label: "Closes", value: event.closeDate },
        ].map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-fg-muted">{row.label}</dt>
            <dd className={cn("mt-0.5 text-sm font-medium", row.value ? "text-fg" : "text-fg-subtle")}>
              {row.value ? formatDateTime(row.value) : "Not set"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
