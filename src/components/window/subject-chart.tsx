"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Split out so recharts loads lazily (see analytics-widget). */
export function SubjectChart({ data }: { data: { name: string; value: number }[] }) {
  // Older receipts can lack a subject name; label them rather than print "undefined".
  const rows = data.map((d) => ({ ...d, name: d.name || "Unnamed subject" }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: "var(--surface-2)" }}
          contentStyle={{
            backgroundColor: "var(--surface-1)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-control)",
            boxShadow: "var(--elevation-2)",
            fontSize: 12,
          }}
          itemStyle={{ color: "var(--text)" }}
          labelStyle={{ color: "var(--text-muted)" }}
        />
        <Bar dataKey="value" name="Students" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
