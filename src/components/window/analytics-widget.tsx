"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function AnalyticsWidget({ metrics }: { metrics: any }) {
  if (!metrics || !metrics.subjectCounts || metrics.subjectCounts.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-panel p-6 shadow-1 col-span-1 lg:col-span-8 flex items-center justify-center h-64 text-fg-muted">
        Not enough data for analytics yet.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-panel p-6 shadow-1 col-span-1 lg:col-span-8 flex flex-col h-72">
      <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-4">Subject Distribution</h3>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics.subjectCounts} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: 'var(--surface-2)' }}
              contentStyle={{ backgroundColor: 'var(--surface-1)', borderColor: 'var(--border)', borderRadius: 'var(--radius-control)' }}
              itemStyle={{ color: 'var(--text)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {metrics.subjectCounts.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill="var(--primary)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
        <div>
          <p className="text-2xs font-bold text-fg-muted uppercase tracking-wider mb-1">Peak Time</p>
          <p className="text-sm font-semibold text-fg truncate">{metrics.peakHour}</p>
        </div>
        <div>
          <p className="text-2xs font-bold text-fg-muted uppercase tracking-wider mb-1">Most Popular</p>
          <p className="text-sm font-semibold text-fg truncate">{metrics.popularSubject}</p>
        </div>
        <div>
          <p className="text-2xs font-bold text-fg-muted uppercase tracking-wider mb-1">Least Selected</p>
          <p className="text-sm font-semibold text-fg truncate">{metrics.leastSubject}</p>
        </div>
      </div>
    </div>
  );
}
