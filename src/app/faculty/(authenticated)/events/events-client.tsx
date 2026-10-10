"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { resetRegistrationEvent } from "@/app/actions/coordinator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { listDelay, transition } from "@/lib/motion";

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
  const router = useRouter();
  const [isResetting, setIsResetting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const filtered = events.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.programmeName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleResetEvent = async (eventId: string, eventName: string) => {
    if (!confirm(`DANGER: Are you sure want to completely reset '${eventName}'? This will permanently wipe ALL student registrations for this event and cannot be undone.`)) return;
    
    setIsResetting(eventId);
    try {
      await resetRegistrationEvent(eventId);
      router.refresh();
      toast.success(`Successfully reset ${eventName}. All students must re-register.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset event");
    } finally {
      setIsResetting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-fg">Global Events</h1>
        <p className="text-fg-muted mt-1">All registration events across all programmes.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events or programmes…"
          className="w-full pl-11 pr-4 py-3 bg-surface border border-border-strong rounded-control text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Table */}
      <div className="bg-surface rounded-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Event Name</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Programme</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Academic Year</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Open Date</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Close Date</th>
                <th className="text-right px-6 py-4 font-semibold text-fg-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-fg-muted">
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
                    transition={{ ...transition.fade, delay: listDelay(i, 0.03) }}
                    className="hover:bg-surface-2/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-fg">{event.name}</td>
                    <td className="px-6 py-4 text-fg-muted">
                      {event.programmeName ?? "—"}
                      {event.programmeCode && (
                        <span className="ml-1 text-xs opacity-60">({event.programmeCode})</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-fg-muted">{event.academicYear ?? "—"}</td>
                    <td className="px-6 py-4"><StatusBadge status={event.status} /></td>
                    <td className="px-6 py-4 text-fg-muted">
                      {event.openDate ? format(new Date(event.openDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-6 py-4 text-fg-muted">
                      {event.closeDate ? format(new Date(event.closeDate), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleResetEvent(event.id, event.name)}
                        disabled={isResetting === event.id}
                        className="px-3 py-1.5 text-xs font-semibold text-danger-text bg-danger/10 hover:bg-danger/10 rounded-badge transition-colors disabled:opacity-50"
                      >
                        {isResetting === event.id ? "Resetting..." : "Reset Data"}
                      </button>
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
