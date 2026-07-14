"use client";

import { motion } from "framer-motion";
import { Clock, Calendar as CalendarIcon, Info } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";

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

export function WindowClient({ events }: { events: WindowEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Portal Window</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Active registration windows for your section.</p>
        </div>
        <div className="text-center py-20 text-[var(--muted-foreground)]">
          <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No registration windows currently open for your section.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Portal Window</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Active registration windows for your section.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {events.map((event, i) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[var(--card)] border border-[var(--border)] rounded-3xl overflow-hidden shadow-sm"
          >
            <div className="px-6 py-5 border-b border-[var(--border)] flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--foreground)]">{event.name}</h2>
                <div className="flex items-center gap-2 mt-1.5 text-sm text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">{event.academicYear ?? "Current Year"}</span>
                  <span>•</span>
                  <span>{event.groupCount} elective group(s)</span>
                </div>
              </div>
              <StatusBadge status={event.status} />
            </div>

            <div className="p-6 space-y-6">
              {event.description && (
                <div className="flex gap-3 text-sm text-[var(--muted-foreground)] bg-[var(--accent)]/30 p-4 rounded-2xl border border-[var(--border)]">
                  <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{event.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-4 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CalendarIcon className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">Opens</p>
                    <p className="font-semibold text-[var(--foreground)] text-sm">
                      {event.openDate ? format(new Date(event.openDate), "MMM d, yyyy") : "Not set"}
                    </p>
                    {event.openDate && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {format(new Date(event.openDate), "h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-4 flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-0.5">Closes</p>
                    <p className="font-semibold text-[var(--foreground)] text-sm">
                      {event.closeDate ? format(new Date(event.closeDate), "MMM d, yyyy") : "Not set"}
                    </p>
                    {event.closeDate && (
                      <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                        {format(new Date(event.closeDate), "h:mm a")}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
