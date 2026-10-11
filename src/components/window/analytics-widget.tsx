"use client";

import dynamic from "next/dynamic";
import { BarChart3 } from "lucide-react";
import { Skeleton, EmptyState } from "@/components/ui/feedback";
import type { WindowMetrics } from "./types";

// recharts is ~100KB; load it only when there is something to chart.
const SubjectChart = dynamic(() => import("./subject-chart").then((m) => m.SubjectChart), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-control" />,
});

export function AnalyticsWidget({ metrics }: { metrics: WindowMetrics | null }) {
  const hasData = Boolean(metrics?.subjectCounts?.length);

  return (
    <section aria-label="Subject distribution" className="col-span-1 flex flex-col rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5 lg:col-span-8">
      <h2 className="text-sm font-medium text-fg">Subject distribution</h2>

      {!hasData || !metrics ? (
        <EmptyState compact icon={<BarChart3 />} title="Not enough data yet" description="The chart fills in as students confirm." className="flex-1" />
      ) : (
        <>
          <div className="mt-4 h-56 min-h-0 w-full sm:h-64">
            <SubjectChart data={metrics.subjectCounts} />
          </div>
          <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
            {[
              { label: "Peak hour", value: metrics.peakHour },
              { label: "Most popular", value: metrics.popularSubject },
              { label: "Least selected", value: metrics.leastSubject },
            ].map((row) => (
              <div key={row.label} className="flex min-w-0 items-baseline justify-between gap-3 sm:block">
                <dt className="shrink-0 whitespace-nowrap text-xs text-fg-muted">{row.label}</dt>
                <dd className="min-w-0 truncate text-sm font-medium text-fg sm:mt-0.5">{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
