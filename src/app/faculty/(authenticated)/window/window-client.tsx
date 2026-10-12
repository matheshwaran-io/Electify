"use client";

import { Clock, Plus, Radio } from "lucide-react";
import { useState } from "react";
import { createRegistrationWindow } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";

import { HeroStatus } from "@/components/window/hero-status";
import { LiveMetrics } from "@/components/window/live-metrics";
import { RegistrationTimeline } from "@/components/window/registration-timeline";
import { ConfigurationCard } from "@/components/window/configuration-card";
import { AnalyticsWidget } from "@/components/window/analytics-widget";
import type { WindowEvent, WindowMetrics } from "@/components/window/types";

export function WindowClient({ events, initialMetrics }: { events: WindowEvent[]; initialMetrics?: WindowMetrics | null }) {
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
      <div>
        <PageHeader title="Live window" description="The registration window for your section." />

        {!isCreating ? (
          <EmptyState
            icon={<Clock />}
            title="No registration window yet"
            description="Create one, then set when it opens and closes."
            className="rounded-panel bg-surface-2"
            action={
              <Button onClick={() => setIsCreating(true)}>
                <Plus /> Create window
              </Button>
            }
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateWindow();
            }}
            className="max-w-lg rounded-panel bg-surface-2 p-5 sm:p-7 animate-enter"
          >
            <h2 className="text-2xl font-light tracking-display text-fg">New registration window</h2>
            <div className="mt-6 space-y-4">
              <Field label="Window name">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Fall 2026 Registration" autoFocus />
              </Field>
              <Field label="Academic year">
                <Input value={newYear} onChange={(e) => setNewYear(e.target.value)} className="font-mono" />
              </Field>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving} loadingText="Creating" disabled={!newName}>
                Create window
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // We only show the UI for the primary (first) event, but this could be extended to a selector if multiple exist
  const event = events[0];

  return (
    <div>
      <PageHeader
        title="Live window"
        description="Watch the session as it happens and adjust its settings."
        actions={
          <Button
            size="sm"
            onClick={() => router.push(`/faculty/monitor?eventId=${event.id}`)}
            className="bg-primary text-canvas hover:bg-primary/90"
          >
            <Radio className="w-3.5 h-3.5 mr-1.5" />
            Live Registration Monitor
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-4">
        <HeroStatus event={event} />
        <LiveMetrics metrics={initialMetrics ?? null} />
        <RegistrationTimeline event={event} />
        <AnalyticsWidget metrics={initialMetrics ?? null} />
        <ConfigurationCard event={event} />
      </div>
    </div>
  );
}
