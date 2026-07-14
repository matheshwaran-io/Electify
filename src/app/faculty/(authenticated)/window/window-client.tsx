"use client";

import { motion } from "framer-motion";
import { Clock, Calendar as CalendarIcon, CheckCircle2, CalendarDays, Plus, Save } from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { useEffect, useState } from "react";
import { createRegistrationWindow, updateWindowTimers } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear() + "-" + (new Date().getFullYear() + 1));
  const [isSaving, setIsSaving] = useState(false);

  // Form states for the first event
  const firstEvent = events[0];
  const [openDate, setOpenDate] = useState(firstEvent?.openDate ? new Date(firstEvent.openDate).toISOString().slice(0, 16) : "");
  const [closeDate, setCloseDate] = useState(firstEvent?.closeDate ? new Date(firstEvent.closeDate).toISOString().slice(0, 16) : "");

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleCreateWindow() {
    if (!newName) return;
    setIsSaving(true);
    try {
      await createRegistrationWindow({ name: newName, academicYear: newYear });
      setIsCreating(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateTimers(eventId: string) {
    setIsSaving(true);
    try {
      await updateWindowTimers(
        eventId, 
        openDate ? new Date(openDate) : null,
        closeDate ? new Date(closeDate) : null
      );
      alert("Window timers updated successfully!");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Portal Window</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Active registration windows for your section.</p>
        </div>
        
        {!isCreating ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-2xl border border-[var(--border)]">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="mb-6">No registration windows currently open for your section.</p>
            <button 
              onClick={() => setIsCreating(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Registration Window
            </button>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-8 max-w-lg shadow-sm">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Create New Window</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Window Name</label>
                <input 
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Fall 2026 Registration"
                  className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Academic Year</label>
                <input 
                  value={newYear} onChange={e => setNewYear(e.target.value)}
                  className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={handleCreateWindow} disabled={isSaving}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium shadow-md hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Create"}
                </button>
                <button 
                  onClick={() => setIsCreating(false)}
                  className="bg-[var(--accent)] text-[var(--foreground)] px-6 py-2 rounded-xl font-medium hover:bg-black/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {events.map((event, i) => {
        const isOpen = event.status === "PUBLISHED" || event.status === "ACTIVE"; 
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

            {/* Timers Config Card */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 shadow-sm">
              <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider flex items-center gap-2 mb-6">
                <CalendarIcon className="w-4 h-4" />
                Scheduled Window Timers
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Portal Opens At</label>
                  <input
                    type="datetime-local"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">Portal Closes At</label>
                  <input
                    type="datetime-local"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)]"
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => handleUpdateTimers(event.id)}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium shadow-md shadow-indigo-500/20 hover:bg-indigo-500 transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save System Properties"}
                </button>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
