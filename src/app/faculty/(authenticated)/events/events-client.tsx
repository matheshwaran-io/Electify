"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";

type Event = {
  id: string;
  name: string;
  academicYear: string | null;
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
  createdAt: Date;
  programmeName: string | null;
  programmeCode: string | null;
};

export function EventsClient({ events }: { events: Event[] }) {
  const [search, setSearch] = useState("");
  const filtered = events.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.programmeName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Global Events</h1>
        <p className="text-[var(--muted-foreground)] mt-1">All registration events across all programmes.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events or programmes…"
          className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--accent)]/30">
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Event Name</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Programme</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Academic Year</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Open Date</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Close Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[var(--muted-foreground)]">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No events found.
                  </td>
                </tr>
              ) : (
                filtered.map((event, i) => (
                  <motion.tr
                    key={event.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-[var(--accent)]/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-[var(--foreground)]">{event.name}</td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">
                      {event.programmeName ?? "—"}
                      {event.programmeCode && (
                        <span className="ml-1 text-xs opacity-60">({event.programmeCode})</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">{event.academicYear ?? "—"}</td>
                    <td className="px-6 py-4"><StatusBadge status={event.status} /></td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">
                      {event.openDate ? format(new Date(event.openDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">
                      {event.closeDate ? format(new Date(event.closeDate), "MMM d, yyyy") : "—"}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
