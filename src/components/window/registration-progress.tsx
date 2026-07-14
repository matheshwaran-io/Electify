"use client";

import { motion } from "framer-motion";

export function RegistrationProgress({ metrics }: { metrics: any }) {
  if (!metrics) return null;

  const studentPct = metrics.totalStudents > 0 ? (metrics.registeredStudents / metrics.totalStudents) * 100 : 0;
  const seatPct = metrics.totalSeats > 0 ? (metrics.filledSeats / metrics.totalSeats) * 100 : 0;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm col-span-1 lg:col-span-12 space-y-6">
      
      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Registration Progress</span>
          <span className="text-sm font-bold text-[var(--foreground)]">{Math.round(studentPct)}%</span>
        </div>
        <div className="h-3 bg-[var(--accent)] rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${studentPct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-indigo-500 rounded-full"
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{metrics.registeredStudents} of {metrics.totalStudents} Students</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Seats Used</span>
          <span className="text-sm font-bold text-[var(--foreground)]">{Math.round(seatPct)}%</span>
        </div>
        <div className="h-3 bg-[var(--accent)] rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${seatPct}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
            className="h-full bg-blue-500 rounded-full"
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{metrics.filledSeats} of {metrics.totalSeats} Seats</span>
        </div>
      </div>

    </div>
  );
}
