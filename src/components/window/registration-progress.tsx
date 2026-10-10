"use client";

import { motion } from "framer-motion";
import { transition } from "@/lib/motion";

export function RegistrationProgress({ metrics }: { metrics: any }) {
  if (!metrics) return null;

  const studentPct = metrics.totalStudents > 0 ? (metrics.registeredStudents / metrics.totalStudents) * 100 : 0;
  const seatPct = metrics.totalSeats > 0 ? (metrics.filledSeats / metrics.totalSeats) * 100 : 0;

  return (
    <div className="bg-surface border border-border rounded-panel p-6 shadow-1 col-span-1 lg:col-span-12 space-y-6">
      
      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">Registration Progress</span>
          <span className="text-sm font-bold text-fg">{Math.round(studentPct)}%</span>
        </div>
        <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${studentPct}%` }}
            transition={transition.value}
            className="h-full bg-primary rounded-full"
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-2xs text-fg-muted font-mono">{metrics.registeredStudents} of {metrics.totalStudents} Students</span>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-fg-muted">Seats Used</span>
          <span className="text-sm font-bold text-fg">{Math.round(seatPct)}%</span>
        </div>
        <div className="h-3 bg-surface-2 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${seatPct}%` }}
            transition={{ ...transition.value, delay: 0.2 }}
            className="h-full bg-primary rounded-full"
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-2xs text-fg-muted font-mono">{metrics.filledSeats} of {metrics.totalSeats} Seats</span>
        </div>
      </div>

    </div>
  );
}
