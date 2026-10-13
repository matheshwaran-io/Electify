"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { selectAcademicSession } from "@/app/actions/workspace";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SessionCard = {
  id: string;
  year?: number;
  label: string;
  status: string;
  classCount: number;
  programmes: string[];
  classes: { label: string; stage: string }[];
  moreClasses: number;
};

const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "outline" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  PLANNED: { label: "Planned", tone: "neutral" },
  ARCHIVED: { label: "Archived", tone: "outline" },
};

export function SessionSelectClient({
  sessions,
  currentId,
  destination,
  isAdmin,
  canManage,
}: {
  sessions: SessionCard[];
  currentId: string | null;
  destination: string;
  isAdmin: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Default listing: only last 1 year and upcoming 1 year (e.g. 2025, 2026, 2027)
  const currentYear = new Date().getFullYear();
  const minDefaultYear = currentYear - 1;
  const maxDefaultYear = currentYear + 1;

  // Check if any available sessions fall outside the default window
  const hasHistoricalSessions = React.useMemo(() => {
    return sessions.some(
      (s) => (s.year ?? 0) < minDefaultYear || (s.year ?? 0) > maxDefaultYear
    );
  }, [sessions, minDefaultYear, maxDefaultYear]);

  // Tab mode: DEFAULT_WINDOW or ALL
  const [viewMode, setViewMode] = React.useState<"DEFAULT" | "ALL">("DEFAULT");

  const filteredSessions = React.useMemo(() => {
    return sessions
      .filter((s) => {
        // Tab filtering (unless user is searching)
        if (!searchQuery.trim() && hasHistoricalSessions && viewMode === "DEFAULT") {
          const yr = s.year ?? 0;
          if (yr < minDefaultYear || yr > maxDefaultYear) return false;
        }

        // Search query filtering
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesYear = String(s.year ?? "").includes(q);
          const matchesLabel = s.label.toLowerCase().includes(q);
          const matchesProgramme = s.programmes.some((p) => p.toLowerCase().includes(q));
          const matchesClass = s.classes.some((c) => c.label.toLowerCase().includes(q));
          return matchesYear || matchesLabel || matchesProgramme || matchesClass;
        }

        return true;
      })
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
  }, [sessions, searchQuery, hasHistoricalSessions, viewMode, minDefaultYear, maxDefaultYear]);

  const defaultWindowCount = React.useMemo(() => {
    return sessions.filter((s) => {
      const yr = s.year ?? 0;
      return yr >= minDefaultYear && yr <= maxDefaultYear;
    }).length;
  }, [sessions, minDefaultYear, maxDefaultYear]);

  const choose = async (s: SessionCard) => {
    setPending(s.id);
    try {
      const res = await selectAcademicSession(s.id);
      if (!res.success) throw new Error(res.error);
      toast.success(`Switched to Year ${s.year}`);
      router.push(destination);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open that Year Server");
      setPending(null);
    }
  };

  return (
    <div className="w-full max-w-4xl space-y-6">
      {/* ── Page Header ── */}
      <div className="text-center animate-enter">
        <span className="mx-auto inline-flex size-12 items-center justify-center rounded-control border border-border bg-surface text-primary shadow-1">
          <CalendarDays className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-xs font-mono font-medium uppercase tracking-wider text-primary">
          Welcome to Electify
        </p>
        <h1 className="mt-1 text-3xl font-light tracking-display text-fg sm:text-4xl">
          Select Year Server
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-fg-muted text-sm sm:text-base">
          Choose the academic Year Server you want to manage. Each server is an isolated workspace containing its own programmes, classes, students and registrations.
        </p>
      </div>

      {/* ── Controls Bar: Filters, Search & Admin Links ── */}
      {sessions.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            {hasHistoricalSessions && (
              <div className="inline-flex rounded-control border border-border bg-surface-2/50 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setViewMode("DEFAULT")}
                  className={cn(
                    "rounded-control px-3 py-1.5 transition-colors cursor-pointer",
                    viewMode === "DEFAULT"
                      ? "bg-surface text-fg shadow-xs border border-border"
                      : "text-fg-muted hover:text-fg"
                  )}
                >
                  Active Window ({minDefaultYear}–{maxDefaultYear})
                  <span className="ml-1.5 font-mono text-2xs opacity-75">
                    ({defaultWindowCount})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("ALL")}
                  className={cn(
                    "rounded-control px-3 py-1.5 transition-colors cursor-pointer",
                    viewMode === "ALL"
                      ? "bg-surface text-fg shadow-xs border border-border"
                      : "text-fg-muted hover:text-fg"
                  )}
                >
                  All Servers
                  <span className="ml-1.5 font-mono text-2xs opacity-75">
                    ({sessions.length})
                  </span>
                </button>
              </div>
            )}

            {canManage && (
              <Link
                href="/faculty/academic-sessions"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "text-xs gap-1.5"
                )}
              >
                <Settings2 className="size-3.5" />
                <span>Manage Timelines</span>
              </Link>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              placeholder="Search year or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 pr-8 text-xs font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Empty State: No sessions configured in database ── */}
      {sessions.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-card border border-border bg-surface p-8 text-center shadow-1">
          <p className="text-base font-medium text-fg">No Year Servers available</p>
          <p className="mt-1.5 text-sm text-fg-muted">
            {isAdmin
              ? "Create your first Year Server workspace to begin managing programmes, cohorts, and classes."
              : "An administrator needs to configure your classes in an Academic Year Server. You can still manage your class assignments."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            {canManage ? (
              <Link href="/faculty/academic-sessions" className={buttonVariants({ size: "sm" })}>
                <Settings2 className="size-4" /> Manage Year Servers
              </Link>
            ) : (
              <Link href="/faculty/assign-sections" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Manage my classes
              </Link>
            )}
          </div>
        </div>
      ) : filteredSessions.length === 0 ? (
        /* ── Empty State: Search / Filter yielded no results ── */
        <div className="mx-auto max-w-lg rounded-card border border-border bg-surface p-8 text-center shadow-1 space-y-4">
          <div>
            <p className="text-base font-medium text-fg">No Year Servers match your criteria</p>
            <p className="mt-1 text-sm text-fg-muted">
              Try clearing your search query or switching to view all Year Servers.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setViewMode("ALL");
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        /* ── Responsive Year Server Cards Grid (Ascending Order) ── */
        <ul className="grid gap-4 sm:grid-cols-2" aria-label="Year Servers">
          {filteredSessions.map((s) => {
            const status = STATUS[s.status] ?? STATUS.ACTIVE;
            const archived = s.status === "ARCHIVED";
            const isCurrent = s.id === currentId;

            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={archived || pending !== null}
                  onClick={() => choose(s)}
                  aria-label={`Year ${s.year}, ${s.label}, ${status.label}${isCurrent ? ", current" : ""}`}
                  className={cn(
                    "group flex h-full w-full flex-col rounded-card border bg-surface p-6 text-left shadow-1 transition-all duration-200 cursor-pointer",
                    isCurrent
                      ? "border-primary/50 ring-1 ring-primary/30"
                      : "border-border hover:border-border-strong hover:shadow-2",
                    archived && "cursor-not-allowed opacity-60 hover:shadow-none hover:border-border"
                  )}
                >
                  {/* Top: Eyebrow, Year Title & Status Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-fg-subtle font-mono">
                        <span>Year Server</span>
                        <span>·</span>
                        <span>{s.year}</span>
                      </div>
                      <h2 className="mt-1 text-2xl font-light tabular-nums tracking-display text-fg sm:text-3xl">
                        Year {s.year}
                      </h2>
                      <p className="text-xs text-fg-muted mt-0.5 font-mono">
                        {s.label}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 rounded-badge bg-primary/15 px-2 py-0.5 text-2xs font-medium text-primary border border-primary/25">
                          <Check className="size-3" />
                          Current
                        </span>
                      )}
                      <Badge size="sm" tone={status.tone}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>

                  {/* Middle: Content summary */}
                  <div className="mt-5 space-y-2">
                    {archived ? (
                      <p className="text-xs text-fg-muted">
                        Archived server for historical reference. Ask an administrator if reactivation is needed.
                      </p>
                    ) : s.classCount === 0 ? (
                      <p className="text-xs text-fg-muted">
                        No classes have been assigned in this Year Server yet.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-fg-muted">
                          <span className="font-mono text-fg">{s.classCount}</span> {s.classCount === 1 ? "class" : "classes"}
                          {s.programmes.length ? ` · ${s.programmes.join(", ")}` : ""}
                        </p>
                        <ul className="space-y-1">
                          {s.classes.map((c) => (
                            <li key={c.label} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                              <span className="font-medium text-fg">{c.label}</span>
                              <span className="text-2xs text-fg-subtle font-mono">{c.stage}</span>
                            </li>
                          ))}
                          {s.moreClasses > 0 && (
                            <li className="text-2xs text-fg-subtle font-mono">
                              and {s.moreClasses} more
                            </li>
                          )}
                        </ul>
                      </>
                    )}
                  </div>

                  {/* Bottom: Action Trigger */}
                  <div className="mt-auto pt-6 border-t border-border/40">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
                        archived
                          ? "text-fg-subtle"
                          : "text-primary group-hover:underline"
                      )}
                    >
                      {pending === s.id ? (
                        <>
                          <Spinner className="size-3.5" /> Opening workspace…
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                        </>
                      )}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
