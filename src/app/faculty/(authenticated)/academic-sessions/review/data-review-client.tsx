"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  History,
  Link2,
} from "lucide-react";
import {
  linkHistoricalEventToYearServer,
} from "@/app/actions/year-servers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export type UnlinkedEvent = {
  id: string;
  name: string;
  academicYear: string | null;
  status: string;
  batchYear: string | null;
  programmeName: string | null;
  createdAt: Date;
};

export function DataReviewClient({
  unlinkedEvents,
  availableYearServers,
}: {
  unlinkedEvents: UnlinkedEvent[];
  availableYearServers: { id: string; year: number; label: string }[];
}) {
  const router = useRouter();
  const [selectedServers, setSelectedServers] = React.useState<Record<string, string>>({});
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const handleLink = async (eventId: string) => {
    const targetSessionId = selectedServers[eventId] || availableYearServers[0]?.id;
    if (!targetSessionId) {
      toast.error("Please choose a Year Server to link to.");
      return;
    }

    setPendingId(eventId);
    try {
      const res = await linkHistoricalEventToYearServer(eventId, targetSessionId);
      if (!res.success) {
        throw new Error(res.error);
      }
      toast.success("Event successfully linked to Year Server!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to link event");
    } finally {
      setPendingId(null);
    }
  };

  const serverOptions = availableYearServers.map((s) => ({
    value: s.id,
    label: s.label,
  }));

  return (
    <div className="space-y-8 animate-enter">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2 text-xs text-fg-muted font-mono">
        <Link
          href="/faculty/academic-sessions"
          className="hover:text-fg transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="size-3" />
          <span>Year Servers</span>
        </Link>
        <span>/</span>
        <span className="text-fg font-medium">Historical Data Review</span>
      </div>

      {/* ── Header ── */}
      <div className="rounded-panel border border-border bg-surface p-6 shadow-1 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="flex size-11 items-center justify-center rounded-badge bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <History className="size-5" />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-light tracking-display text-fg sm:text-3xl">
              Historical Data Review & Reconciliation
            </h1>
            <p className="text-sm text-fg-muted max-w-2xl leading-relaxed">
              This administrator-only screen tracks historical and legacy records from earlier migrations.
              Events that lack a confirmed Year Server can be linked here safely without guessing or data loss.
            </p>
          </div>
        </div>
      </div>

      {/* ── Unlinked Events Section ── */}
      <div className="rounded-panel border border-border bg-surface p-6 shadow-1 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div>
            <h2 className="text-base font-medium text-fg">
              Unlinked Registration Events
            </h2>
            <p className="text-xs text-fg-muted">
              Legacy events with non-standard academic year labels (e.g. multi-year ranges).
            </p>
          </div>
          <span className="text-xs font-mono text-fg-subtle">
            {unlinkedEvents.length} unresolved
          </span>
        </div>

        {unlinkedEvents.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="size-8 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-medium text-fg">All events resolved</h3>
            <p className="text-xs text-fg-muted max-w-sm mx-auto">
              Every registration event in the database is currently mapped to an active Year Server.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {unlinkedEvents.map((event) => {
              const currentChoice = selectedServers[event.id] || availableYearServers[0]?.id || "";
              const isPending = pendingId === event.id;

              return (
                <div
                  key={event.id}
                  className="rounded-card border border-border bg-surface-2/40 p-4 shadow-1 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium text-fg">{event.name}</h4>
                      <Badge size="sm" tone="neutral">
                        {event.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted font-mono">
                      <span>Stored Year: {event.academicYear || "None"}</span>
                      {event.programmeName && <span>Programme: {event.programmeName}</span>}
                      {event.batchYear && <span>Cohort Batch: {event.batchYear}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="w-48">
                      <Select
                        value={currentChoice}
                        onValueChange={(val) =>
                          setSelectedServers((prev) => ({ ...prev, [event.id]: val }))
                        }
                        options={serverOptions}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleLink(event.id)}
                      disabled={isPending || !currentChoice}
                    >
                      <Link2 className="size-3.5 mr-1" />
                      <span>{isPending ? "Linking..." : "Link to Server"}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
