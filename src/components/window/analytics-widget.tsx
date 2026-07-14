"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { motion } from "framer-motion";

export function AnalyticsWidget({ metrics }: { metrics: any }) {
  if (!metrics || !metrics.subjectCounts || metrics.subjectCounts.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm col-span-1 lg:col-span-8 flex items-center justify-center h-64 text-[var(--muted-foreground)]">
        Not enough data for analytics yet.
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm col-span-1 lg:col-span-8 flex flex-col h-72">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-4">Subject Distribution</h3>
      <div className="flex-1 min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={metrics.subjectCounts} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <Tooltip 
              cursor={{ fill: 'var(--accent)' }}
              contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '12px' }}
              itemStyle={{ color: 'var(--foreground)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {metrics.subjectCounts.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill="var(--indigo-500, #6366f1)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--border)]">
        <div>
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Peak Time</p>
          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{metrics.peakHour}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Most Popular</p>
          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{metrics.popularSubject}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">Least Selected</p>
          <p className="text-sm font-semibold text-[var(--foreground)] truncate">{metrics.leastSubject}</p>
        </div>
      </div>
    </div>
  );
}
