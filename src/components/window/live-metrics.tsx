"use client";

import { AnimatedNumber, Meter } from "@/components/ui/data-display";
import type { WindowMetrics } from "./types";

function pct(n: number, d: number) {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

/** Headline counts for the window. Every number comes from getRegistrationMetrics. */
export function LiveMetrics({ metrics }: { metrics: WindowMetrics | null }) {
  if (!metrics) return null;

  const tiles = [
    { label: "Students registered", value: metrics.registeredStudents, of: metrics.totalStudents },
    { label: "Seats filled", value: metrics.filledSeats, of: metrics.totalSeats },
  ];

  return (
    <div className="col-span-1 grid grid-cols-2 gap-3 lg:col-span-4 lg:grid-cols-1">
      {tiles.map((t) => (
        <div key={t.label} className="flex flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm text-fg-muted">{t.label}</p>
            <span className="font-mono text-xs tabular-nums text-fg-subtle">{pct(t.value, t.of)}%</span>
          </div>
          <p className="mt-2 flex items-baseline gap-1.5">
            <AnimatedNumber value={t.value} className="text-4xl font-light tracking-display text-fg" tabular />
            <span className="font-mono text-sm tabular-nums text-fg-subtle">/ {t.of}</span>
          </p>
          <Meter value={t.value} max={t.of} label={t.label} className="mt-3" />
        </div>
      ))}
      <div className="col-span-2 grid grid-cols-2 gap-3 lg:col-span-1">
        <div className="flex flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
          <p className="text-sm text-fg-muted">Subjects full</p>
          <div className="mt-2">
            <AnimatedNumber
              value={metrics.fullSubjects}
              className={metrics.fullSubjects > 0 ? "text-3xl font-light tabular-nums text-warning-text" : "text-3xl font-light tabular-nums text-fg"}
            />
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
          <p className="text-sm text-fg-muted">Waitlisted</p>
          <div className="mt-2">
            <AnimatedNumber
              value={metrics.waitlistedStudents ?? 0}
              className={(metrics.waitlistedStudents ?? 0) > 0 ? "text-3xl font-light tabular-nums text-warning-text" : "text-3xl font-light tabular-nums text-fg"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
