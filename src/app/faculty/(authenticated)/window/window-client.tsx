"use client";

import { motion } from "framer-motion";
import { Plus, Clock } from "lucide-react";
import { useState } from "react";
import { createRegistrationWindow } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { HeroStatus } from "@/components/window/hero-status";
import { LiveMetrics } from "@/components/window/live-metrics";
import { RegistrationProgress } from "@/components/window/registration-progress";
import { RegistrationTimeline } from "@/components/window/registration-timeline";
import { ConfigurationCard } from "@/components/window/configuration-card";
import { AnalyticsWidget } from "@/components/window/analytics-widget";

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

export function WindowClient({ events, initialMetrics }: { events: WindowEvent[], initialMetrics?: any }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear() + "-" + (new Date().getFullYear() + 1));
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreateWindow() {
    if (!newName) return;
    setIsSaving(true);
    try {
      await createRegistrationWindow({ name: newName, academicYear: newYear });
      setIsCreating(false);
      router.refresh();
      toast.success("Registration window created successfully!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (events.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">Registration Control Center</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Active registration windows for your section.</p>
        </div>
        
        {!isCreating ? (
          <div className="text-center py-20 text-[var(--muted-foreground)] bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-sm">
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
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-8 max-w-lg shadow-sm">
            <h2 className="text-xl font-bold text-[var(--foreground)] mb-6">Create New Window</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">Window Name</label>
                <input 
                  value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Fall 2026 Registration"
                  className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase tracking-wider">Academic Year</label>
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

  // We only show the UI for the primary (first) event, but this could be extended to a selector if multiple exist
  const event = events[0];

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)] tracking-tight">Registration Control Center</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Monitor and configure the live registration session.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <HeroStatus event={event} />
        <LiveMetrics metrics={initialMetrics} />
        <RegistrationProgress metrics={initialMetrics} />
        <AnalyticsWidget metrics={initialMetrics} />
        <ConfigurationCard event={event} />
        <RegistrationTimeline event={event} />
      </div>
    </div>
  );
}
