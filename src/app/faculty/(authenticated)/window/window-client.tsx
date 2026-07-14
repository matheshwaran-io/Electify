"use client";

import { motion } from "framer-motion";
import { Clock, Calendar as CalendarIcon, CheckCircle2, CalendarDays } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { useEffect, useState } from "react";

type WindowEvent = {
  id: string;
  name: string;
  academicYear: string | null;
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
  description: string | null;
  groupCount: number;
};

function formatCountdown(closeDate: Date | null) {
  if (!closeDate) return "No deadline";
  const now = new Date();
  const diff = differenceInSeconds(closeDate, now);
  if (diff <= 0) return "Closed";
  
  const d = Math.floor(diff / (3600 * 24));
  const h = Math.floor((diff % (3600 * 24)) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  
  return `${d}d ${h}h ${m}m ${s}s`;
}

export function WindowClient({ events }: { events: WindowEvent[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Portal Window</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Active registration windows for your section.</p>
        </div>
        <div className="text-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No registration windows currently open for your section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {events.map((event, i) => {
        const isOpen = event.status === "PUBLISHED" || event.status === "ACTIVE"; // Adjust based on your actual statuses
        const countdown = formatCountdown(event.closeDate ? new Date(event.closeDate) : null);

        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="space-y-6"
          >
            {/* Hero Card */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-10">
                <div className="space-y-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isOpen ? "bg-emerald-500/10 text-emerald-500" : "bg-orange-500/10 text-orange-500"}`}>
                    {isOpen ? "Registration Live" : event.status}
                  </span>
                  <div>
                    <h2 className="text-3xl font-bold text-[var(--foreground)]">{event.name}</h2>
                    <p className="text-[var(--muted-foreground)] mt-2 max-w-xl">
                      {event.description || "The registration gate is currently open and students are submitting course selections."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 bg-[var(--background)]/50 border border-[var(--border)] p-4 rounded-2xl shrink-0">
                  <div>
                    <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">
                      {isOpen ? "Closing In" : "Status"}
                    </p>
                    <p className="text-2xl font-bold font-mono text-[var(--foreground)]">
                      {countdown}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-emerald-500" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8 border-t border-[var(--border)]">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Schedule Configured</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">Ready</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Opens At</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {event.openDate ? format(new Date(event.openDate), "MMM d, yyyy") : "TBD"}
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                    <CalendarDays className="w-6 h-6 text-purple-500" />
                  </div>
                  <p className="text-sm font-bold text-[var(--foreground)] uppercase tracking-wider">Closes At</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {event.closeDate ? format(new Date(event.closeDate), "MMM d, yyyy") : "TBD"}
                  </p>
                </div>
              </div>
            </div>

            {/* Timers Config Card (Read Only) */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 shadow-sm">
              <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2 mb-6">
                <CalendarIcon className="w-4 h-4" />
                Scheduled Window Timers
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Portal Opens At</label>
                  <div className="w-full px-4 py-3 bg-[var(--background)]/50 border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] flex justify-between items-center opacity-70">
                    <span>{event.openDate ? format(new Date(event.openDate), "dd/MM/yyyy, hh:mm a") : "Not Set"}</span>
                    <CalendarIcon className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Portal Closes At</label>
                  <div className="w-full px-4 py-3 bg-[var(--background)]/50 border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] flex justify-between items-center opacity-70">
                    <span>{event.closeDate ? format(new Date(event.closeDate), "dd/MM/yyyy, hh:mm a") : "Not Set"}</span>
                    <CalendarIcon className="w-4 h-4 text-[var(--muted-foreground)]" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
