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

export type WindowContext = {
  /** Active class, e.g. "MCA F · 2025–2027"; null when the user has no class in this session. */
  classLabel: string | null;
  sessionLabel: string;
  semester: number | null;
};

export function WindowClient({ events, initialMetrics, context }: { events: WindowEvent[]; initialMetrics?: WindowMetrics | null; context: WindowContext }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSemester, setNewSemester] = useState(context.semester ? String(context.semester) : "");
  const [isSaving, setIsSaving] = useState(false);

  async function handleCreateWindow() {
    if (!newName) return;
    setIsSaving(true);
    try {
      await createRegistrationWindow({ name: newName, semester: newSemester ? Number(newSemester) : null });
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
        <PageHeader
          title="Live window"
          description={context.classLabel ? `${context.classLabel} · Academic session ${context.sessionLabel}` : `Academic session ${context.sessionLabel}`}
        />

        {!isCreating ? (
          <EmptyState
            icon={<Clock />}
            title="No registration window yet"
            description={
              context.classLabel
                ? `Create one for ${context.classLabel}, then set when it opens and closes.`
                : "You don't have a class in this academic session yet."
            }
            className="rounded-panel bg-surface-2"
            action={
              context.classLabel ? (
                <Button onClick={() => setIsCreating(true)}>
                  <Plus /> Create window
                </Button>
              ) : null
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
              <Field label="Semester">
                <select
                  value={newSemester}
                  onChange={(e) => setNewSemester(e.target.value)}
                  className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-sm text-fg sm:h-10"
                >
                  <option value="">Not set</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      Semester {i + 1}
                    </option>
                  ))}
                </select>
              </Field>
              <dl className="rounded-control border border-border bg-surface p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Class</dt>
                  <dd className="text-right font-medium text-fg">{context.classLabel}</dd>
                </div>
                <div className="mt-1 flex justify-between gap-3">
                  <dt className="text-fg-muted">Academic session</dt>
                  <dd className="font-medium tabular-nums text-fg">{context.sessionLabel}</dd>
                </div>
                <p className="mt-2 text-xs text-fg-muted">Only students of this class and cohort will see the window.</p>
              </dl>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving} loadingText="Creating" disabled={!newName}>
                Create window for {context.classLabel}
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
