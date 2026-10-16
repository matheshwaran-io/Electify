"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  Filter,
  Layers,
  LayoutGrid,
  Lock,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  claimTutorSection,
  exitTutorSection,
  getAllAvailableSections,
  getMyAssignedSections,
  type AssignedSectionCard,
  type AvailableSectionCard,
} from "@/app/actions/tutor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function TutorSectionOnboarding({ isManageMode = false }: { isManageMode?: boolean }) {
  const [sections, setSections] = useState<AvailableSectionCard[]>([]);
  const [mySections, setMySections] = useState<AssignedSectionCard[]>([]);
  const [maxAllowed, setMaxAllowed] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [exitingId, setExitingId] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [filterTimeline, setFilterTimeline] = useState<string>("ALL");
  const [filterProgramme, setFilterProgramme] = useState<string>("ALL");
  const [filterBatch, setFilterBatch] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const load = () => {
    setIsLoading(true);
    setLoadError(false);
    Promise.all([getAllAvailableSections(), getMyAssignedSections()])
      .then(([availableRes, myData]) => {
        if ("sections" in availableRes) {
          setSections(availableRes.sections);
          setMaxAllowed(availableRes.maxAllowed);
        } else {
          setSections(availableRes as any);
        }
        setMySections(myData);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load sections", err);
        setLoadError(true);
        setIsLoading(false);
      });
  };

  useEffect(load, []);

  const handleClaim = async () => {
    if (selectedIds.length === 0) return;
    setIsSaving(true);
    try {
      await claimTutorSection(selectedIds);
      toast.success(`${selectedIds.length} class${selectedIds.length > 1 ? "es" : ""} assigned to you`);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't assign those classes";
      toast.error(msg);
      setIsSaving(false);
    }
  };

  const handleExit = async (id: string, classLabel: string) => {
    if (!confirm(`Are you sure you want to exit and release management for ${classLabel}?`)) {
      return;
    }
    setExitingId(id);
    try {
      await exitTutorSection(id);
      toast.success(`Exited ${classLabel} successfully`);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to exit class";
      toast.error(msg);
      setExitingId(null);
    }
  };

  const remainingSlots = Math.max(0, maxAllowed - mySections.length);

  const toggleSection = (sec: AvailableSectionCard) => {
    if (sec.status === "ASSIGNED_TO_ME" || sec.status === "CLAIMED_BY_OTHER") {
      return;
    }
    setSelectedIds((prev) => {
      if (prev.includes(sec.id)) {
        return prev.filter((x) => x !== sec.id);
      }
      if (prev.length >= remainingSlots) {
        toast.error(
          `You can manage up to ${maxAllowed} classes total (${mySections.length} currently assigned).`
        );
        return prev;
      }
      return [...prev, sec.id];
    });
  };

  // Unique timelines, programmes and batches for filter pills
  const availableTimelines = useMemo(() => {
    const map = new Map<string, string>();
    sections.forEach((s) => {
      s.activeSessions.forEach((sess) => map.set(sess.id, sess.label));
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sections]);

  const availableProgrammes = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((s) => set.add(s.programmeName));
    return Array.from(set).sort();
  }, [sections]);

  const availableBatches = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((s) => set.add(s.batchYear));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [sections]);

  // Grouped Assigned Classes by Programme & Batch
  const groupedMySections = useMemo(() => {
    const groups: Record<string, AssignedSectionCard[]> = {};
    for (const sec of mySections) {
      const key = `${sec.programmeName} — ${sec.batchYear} Batch`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sec);
    }
    return groups;
  }, [mySections]);

  // Filtered available sections
  const filteredAvailable = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections.filter((s) => {
      if (filterTimeline !== "ALL" && !s.activeSessions.some((sess) => sess.id === filterTimeline)) return false;
      if (filterProgramme !== "ALL" && s.programmeName !== filterProgramme) return false;
      if (filterBatch !== "ALL" && s.batchYear !== filterBatch) return false;
      if (filterStatus === "AVAILABLE" && s.status !== "AVAILABLE") return false;
      if (filterStatus === "ASSIGNED_TO_ME" && s.status !== "ASSIGNED_TO_ME") return false;
      if (filterStatus === "CLAIMED_BY_OTHER" && s.status !== "CLAIMED_BY_OTHER") return false;

      if (!q) return true;
      const haystack = `${s.programmeName} ${s.programmeCode} ${s.batchYear} ${s.label} ${s.departmentName} ${s.classLabel} ${s.cohortYears}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [sections, query, filterTimeline, filterProgramme, filterBatch, filterStatus]);

  // Grouped available sections by Programme & Batch
  const groupedAvailable = useMemo(() => {
    const groups: Record<string, AvailableSectionCard[]> = {};
    for (const sec of filteredAvailable) {
      const key = `${sec.programmeName} · ${sec.cohortYears}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sec);
    }
    return groups;
  }, [filteredAvailable]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col py-6 sm:py-10 space-y-8">
      {/* ── Page Header & Slot Quota ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-fg shadow-1">
              <LayoutGrid className="size-5 text-primary-text" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-light tracking-display text-fg">
                {isManageMode ? "Manage your tutored classes" : "Class Tutor Workspaces"}
              </h1>
              {sections[0]?.departmentName ? (
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mt-0.5">
                  {sections[0].departmentName}
                </p>
              ) : null}
            </div>
          </div>
          <p className="text-sm text-fg-muted max-w-2xl">
            Classes are chosen by class tutors and coordinators by department. Select a timeline and department classes below to claim and manage.
          </p>
        </div>

        {/* Quota Badge */}
        <div className="flex items-center gap-3 shrink-0 rounded-card border border-border bg-surface-2/60 px-4 py-2.5 shadow-1">
          <div className="flex flex-col text-right">
            <span className="text-xs text-fg-muted uppercase tracking-wider font-medium">Assignment Slots</span>
            <span className="text-sm font-semibold text-fg">
              <span className="font-mono text-primary-text">{mySections.length}</span> / {maxAllowed} Used
            </span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col">
            <span className="text-xs text-fg-muted uppercase tracking-wider font-medium">Remaining</span>
            <span className="text-sm font-mono font-medium text-fg-muted">
              {remainingSlots} available
            </span>
          </div>
        </div>
      </div>

      {/* ── SECTION 1: Assigned Classes (Grouped by Programme & Batch) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-fg flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-500" />
              Classes you currently tutor
            </h2>
            <p className="text-xs text-fg-muted mt-0.5">
              Authorized classes under your staff account. Switching classes updates all rosters, events, and reports.
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-fg-muted">
            {mySections.length} {mySections.length === 1 ? "class" : "classes"} active
          </span>
        </div>

        {mySections.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-surface/50 p-8 text-center">
            <LayoutGrid className="mx-auto size-8 text-fg-subtle mb-2" />
            <p className="text-sm font-medium text-fg">No classes assigned yet</p>
            <p className="text-xs text-fg-muted mt-1">
              Select eligible sections below to start managing registrations and signup codes.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedMySections).map(([groupTitle, classList]) => (
              <div key={groupTitle} className="rounded-panel border border-border bg-surface p-4 sm:p-5 shadow-1 space-y-3">
                <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
                  <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                    <Layers className="size-4 text-primary-text" />
                    {groupTitle}
                  </h3>
                  <span className="text-xs text-fg-muted font-medium">
                    {classList.length} {classList.length === 1 ? "section" : "sections"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {classList.map((sec) => (
                    <div
                      key={sec.id}
                      className="group flex flex-col justify-between rounded-card border border-border bg-surface-2/40 p-4 hover:border-border-strong transition-colors shadow-sm"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-fg font-mono text-sm font-semibold text-canvas shadow-sm">
                              {sec.label}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-fg">
                                Section {sec.label}
                              </p>
                              <p className="text-xs font-mono text-fg-muted">
                                {sec.classLabel}
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Active Tutor
                          </span>
                        </div>

                        {/* Metadata tags */}
                        <div className="grid grid-cols-2 gap-2 text-xs text-fg-muted pt-1">
                          <div className="flex items-center gap-1.5 truncate" title={`Department: ${sec.departmentName}`}>
                            <Building2 className="size-3.5 shrink-0 text-fg-subtle" />
                            <span className="truncate">{sec.departmentName}</span>
                          </div>
                          <div className="flex items-center gap-1.5" title={`Cohort Duration: ${sec.cohortYears}`}>
                            <Calendar className="size-3.5 shrink-0 text-fg-subtle" />
                            <span>{sec.cohortYears}</span>
                          </div>
                          <div className="flex items-center gap-1.5" title={`${sec.studentCount} Students Enrolled`}>
                            <Users className="size-3.5 shrink-0 text-fg-subtle" />
                            <span>{sec.studentCount} student{sec.studentCount === 1 ? "" : "s"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 truncate" title={sec.activeSessions.map((s) => s.label).join(", ")}>
                            <Layers className="size-3.5 shrink-0 text-fg-subtle" />
                            <span className="truncate">
                              {sec.activeSessions.length > 0
                                ? sec.activeSessions.map((s) => s.label).join(", ")
                                : "No active session"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end border-t border-border/60 pt-3 mt-3">
                        <Button
                          variant="destructive-soft"
                          size="sm"
                          onClick={() => handleExit(sec.id, sec.classLabel)}
                          disabled={exitingId === sec.id}
                          className="h-8 text-xs gap-1.5"
                          title={`Release authorization for Section ${sec.label}`}
                        >
                          {exitingId === sec.id ? (
                            <Spinner className="size-3.5" />
                          ) : (
                            <LogOut className="size-3.5" />
                          )}
                          Exit class
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 2: Add More Classes (Department Scoped Discovery) ── */}
      <div className="rounded-panel border border-border bg-surface shadow-1 overflow-hidden space-y-0">
        <div className="p-4 sm:p-5 border-b border-border bg-surface-2/30 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-medium text-fg">
                <Plus className="size-4.5 text-primary-text" /> Add more classes
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">
                Browse and claim additional sections across all authorized programmes in your department.
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-fg-muted">
              {remainingSlots > 0 ? `${remainingSlots} slot${remainingSlots > 1 ? "s" : ""} remaining` : "Limit reached"}
            </span>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
            {/* Search Input */}
            <div className="sm:col-span-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search programme, batch, or section..."
                aria-label="Filter sections"
                leading={<Search />}
                inputSize="sm"
                className="h-9"
              />
            </div>

            {/* Academic Timeline Filter */}
            <div>
              <select
                aria-label="Filter by Academic Timeline"
                value={filterTimeline}
                onChange={(e) => setFilterTimeline(e.target.value)}
                className="h-9 w-full rounded-control border border-border bg-surface px-2.5 text-xs text-fg font-medium focus:border-border-strong focus:outline-none"
              >
                <option value="ALL">All Timelines</option>
                {availableTimelines.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Programme Filter */}
            <div>
              <select
                aria-label="Filter by Programme"
                value={filterProgramme}
                onChange={(e) => setFilterProgramme(e.target.value)}
                className="h-9 w-full rounded-control border border-border bg-surface px-2.5 text-xs text-fg font-medium focus:border-border-strong focus:outline-none"
              >
                <option value="ALL">All Programmes</option>
                {availableProgrammes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {/* Batch / Year Server Filter */}
            <div>
              <select
                aria-label="Filter by Batch Year"
                value={filterBatch}
                onChange={(e) => setFilterBatch(e.target.value)}
                className="h-9 w-full rounded-control border border-border bg-surface px-2.5 text-xs text-fg font-medium focus:border-border-strong focus:outline-none"
              >
                <option value="ALL">All Batches</option>
                {availableBatches.map((b) => (
                  <option key={b} value={b}>
                    {b} Batch
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-fg-muted mr-1 flex items-center gap-1">
              <Filter className="size-3" /> Status:
            </span>
            {[
              { id: "ALL", label: "All Classes" },
              { id: "AVAILABLE", label: "Available to claim" },
              { id: "ASSIGNED_TO_ME", label: "Assigned to you" },
              { id: "CLAIMED_BY_OTHER", label: "Claimed by others" },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFilterStatus(chip.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium transition-colors",
                  filterStatus === chip.id
                    ? "bg-primary text-primary-fg"
                    : "bg-surface border border-border text-fg-muted hover:border-border-strong hover:text-fg"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section List Body */}
        <div className="max-h-[50dvh] min-h-48 overflow-y-auto p-4 sm:p-5 scrollbar-thin">
          {isLoading ? (
            <div className="space-y-6 py-2">
              {[0, 1].map((g) => (
                <div key={g} className="space-y-3">
                  <Skeleton className="h-4 w-48" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-20 rounded-control" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <ErrorState title="Failed to load sections" onRetry={load} />
          ) : sections.length === 0 ? (
            <EmptyState
              compact
              icon={<LayoutGrid />}
              title="No eligible classes found"
              description="No classes were found for your authorized department."
            />
          ) : Object.keys(groupedAvailable).length === 0 ? (
            <EmptyState
              compact
              icon={<Search />}
              title="No sections match your filters"
              description="Try adjusting your search query, programme, or batch filters."
            />
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAvailable).map(([groupTitle, secs]) => (
                <section key={groupTitle} aria-label={groupTitle} className="space-y-2.5">
                  <h3 className="sticky top-0 z-10 bg-surface/95 backdrop-blur py-1.5 text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center justify-between border-b border-border/60">
                    <span>{groupTitle}</span>
                    <span className="font-mono text-[11px] lowercase font-normal">
                      {secs.length} {secs.length === 1 ? "class" : "classes"}
                    </span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {secs.map((sec) => {
                      const isSelected = selectedIds.includes(sec.id);
                      const isMine = sec.status === "ASSIGNED_TO_ME";
                      const isClaimedByOther = sec.status === "CLAIMED_BY_OTHER";
                      const isSelectable = sec.status === "AVAILABLE";

                      return (
                        <div
                          key={sec.id}
                          onClick={() => isSelectable && toggleSection(sec)}
                          className={cn(
                            "relative flex flex-col justify-between rounded-card border p-3 transition-all",
                            isSelectable &&
                              "cursor-pointer hover:border-border-strong hover:shadow-sm active:scale-[0.99]",
                            isSelected && "border-primary bg-primary/5 ring-1 ring-primary",
                            isMine && "border-emerald-500/40 bg-emerald-500/5 cursor-default",
                            isClaimedByOther && "border-border/60 bg-surface-2/30 opacity-75 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={cn(
                                  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold",
                                  isSelected
                                    ? "bg-primary text-primary-fg"
                                    : isMine
                                    ? "bg-emerald-600 text-white"
                                    : "bg-surface-2 text-fg border border-border"
                                )}
                              >
                                {sec.label}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-fg truncate">
                                  Section {sec.label}
                                </p>
                                <p className="text-xs font-mono text-fg-muted truncate">
                                  {sec.cohortYears}
                                </p>
                              </div>
                            </div>

                            {/* Badge */}
                            {isMine ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                <Check className="size-3" /> Assigned
                              </span>
                            ) : isClaimedByOther ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-fg-muted truncate max-w-[110px]"
                                title={`Claimed by ${sec.claimedByTutorName || "another tutor"}`}
                              >
                                <Lock className="size-2.5 shrink-0" />
                                <span className="truncate">{sec.claimedByTutorName || "Claimed"}</span>
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-fg"
                                    : "border-border-strong bg-surface text-transparent"
                                )}
                              >
                                <Check className="size-3 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          {/* Extra info row */}
                          <div className="flex items-center justify-between text-[11px] text-fg-muted pt-2.5 mt-2 border-t border-border/40">
                            <span>{sec.studentCount} students</span>
                            <span className="truncate max-w-[130px]">
                              {sec.activeSessions[0]?.label || "Annual cohort"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Action Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/60 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <p className="text-sm text-fg-muted" aria-live="polite">
              <span className="font-mono font-medium tabular-nums text-fg">{selectedIds.length}</span> of{" "}
              {remainingSlots} available slots selected
            </p>
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-fg-subtle hover:text-fg underline ml-1"
              >
                Clear
              </button>
            )}
          </div>

          <Button
            onClick={handleClaim}
            disabled={selectedIds.length === 0 || isLoading || remainingSlots === 0}
            loading={isSaving}
            loadingText="Assigning classes"
          >
            Assign {selectedIds.length > 0 ? `(${selectedIds.length})` : ""} to me
          </Button>
        </div>
      </div>
    </div>
  );
}
