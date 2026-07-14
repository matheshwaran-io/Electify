"use client";

import { motion } from "framer-motion";
import { Users, UserCheck, BookOpen, HeartPulse } from "lucide-react";

export function LiveMetrics({ metrics }: { metrics: any }) {
  if (!metrics) return null;

  const cards = [
    {
      title: "Students Registered",
      icon: Users,
      value: `${metrics.registeredStudents} / ${metrics.totalStudents}`,
      percentage: metrics.totalStudents > 0 ? Math.round((metrics.registeredStudents / metrics.totalStudents) * 100) : 0,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      title: "Seats Filled",
      icon: UserCheck,
      value: `${metrics.filledSeats} / ${metrics.totalSeats}`,
      percentage: metrics.totalSeats > 0 ? Math.round((metrics.filledSeats / metrics.totalSeats) * 100) : 0,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Subjects Full",
      icon: BookOpen,
      value: metrics.fullSubjects.toString(),
      percentage: null,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      title: "Portal Health",
      icon: HeartPulse,
      value: "Healthy",
      percentage: null,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    }
  ];

  return (
    <div className="col-span-1 lg:col-span-4 grid grid-cols-2 gap-4 h-full">
      {cards.map((c, i) => (
        <motion.div 
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between shadow-sm hover:border-indigo-500/30 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg}`}>
              <c.icon className={`w-4 h-4 ${c.color}`} />
            </div>
            {c.percentage !== null && (
              <span className="text-xs font-bold text-[var(--muted-foreground)]">
                {c.percentage}%
              </span>
            )}
          </div>
          
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-[var(--foreground)]">{c.value}</h3>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] mt-1">{c.title}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
