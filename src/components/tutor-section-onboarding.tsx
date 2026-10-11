"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LayoutGrid, LogOut, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { claimTutorSection, exitTutorSection, getAllAvailableSections, getMyAssignedSections } from "@/app/actions/tutor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type SectionData = { id: string; label: string; batch: string; programme: string; department?: string };

const MAX = 5;

export function TutorSectionOnboarding({ isManageMode = false }: { isManageMode?: boolean }) {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [mySections, setMySections] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = () => {
    setIsLoading(true);
    setLoadError(false);
    Promise.all([
      getAllAvailableSections(),
      getMyAssignedSections(),
    ])
      .then(([availableData, myData]) => {
        setSections(availableData);
        setMySections(myData);
        setIsLoading(false);
      })
      .catch(() => {
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
      toast.success(`${selectedIds.length} section${selectedIds.length > 1 ? "s" : ""} assigned to you`);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Couldn't assign those sections";
      toast.error(msg);
      setIsSaving(false);
    }
  };

  const handleExit = async (id: string, label: string) => {
    setExitingId(id);
    try {
      await exitTutorSection(id);
      toast.success(`Exited Section ${label} successfully`);
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to exit section";
      toast.error(msg);
      setExitingId(null);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const remainingSlots = MAX - mySections.length;
      if (prev.length >= remainingSlots) {
        toast.error(`You can manage up to ${MAX} sections total (${mySections.length} currently assigned).`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const remainingSlots = Math.max(0, MAX - mySections.length);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections
      .filter((s) => !q || `${s.programme} ${s.batch} ${s.label}`.toLowerCase().includes(q))
      .reduce((acc, sec) => {
        const key = `${sec.programme} · ${sec.batch}`;
        (acc[key] ??= []).push(sec);
        return acc;
      }, {} as Record<string, SectionData[]>);
  }, [sections, query]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <span className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-surface text-fg shadow-1">
          <LayoutGrid className="size-5" />
        </span>
        <h1 className="pt-2 text-3xl font-light tracking-display text-fg">
          {isManageMode ? "Manage your tutored classes" : "Pick the sections you tutor"}
        </h1>
        <p className="text-sm text-fg-muted">
          Manage your assigned classes or claim additional sections. You can tutor up to {MAX} classes in total.
        </p>
      </div>

      {/* ── SECTION 1: Currently Managed Classes (with Exit option) ── */}
      {mySections.length > 0 && (
        <div className="space-y-4 overflow-hidden rounded-panel bg-surface-2 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <div>
              <h2 className="text-base font-medium text-fg">
                Classes you tutor
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">
                Click &ldquo;Exit class&rdquo; to release your assignment from any section.
              </p>
            </div>
            <span className="inline-flex h-6 shrink-0 items-center rounded-full border border-border-strong px-2.5 text-xs font-medium text-fg-muted">
              {mySections.length} of {MAX} slots used
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mySections.map((sec) => (
              <div
                key={sec.id}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3.5 shadow-1"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-fg font-mono text-xs font-medium text-canvas">
                    {sec.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      Section {sec.label}
                    </p>
                    <p className="text-xs text-fg-muted truncate">
                      {sec.programme} · {sec.batch}
                    </p>
                  </div>
                </div>

                <Button
                  variant="destructive-soft"
                  size="sm"
                  onClick={() => handleExit(sec.id, sec.label)}
                  disabled={exitingId === sec.id}
                  className="shrink-0"
                  title={`Exit from Section ${sec.label}`}
                >
                  {exitingId === sec.id ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <LogOut className="size-3.5" />
                  )}
                  Exit class
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 2: Claim / Add Additional Sections ── */}
      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-1">
        <div className="border-b border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-base font-medium text-fg">
              <Plus className="size-4 text-fg-subtle" /> Add more classes
            </h2>
            <span className="text-xs text-fg-muted font-medium">
              {remainingSlots > 0
                ? `${remainingSlots} slot${remainingSlots > 1 ? "s" : ""} remaining`
                : "All slots filled"}
            </span>
          </div>

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by programme, year or section..."
            aria-label="Filter sections"
            leading={<Search />}
            inputSize="sm"
            className="h-9"
          />
        </div>

        <div className="max-h-[45dvh] min-h-40 overflow-y-auto px-4 py-3 scrollbar-thin">
          {isLoading ? (
            <div className="space-y-5 py-2">
              {[0, 1].map((g) => (
                <div key={g} className="space-y-2.5">
                  <Skeleton className="h-3.5 w-40" />
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-11 rounded-control" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <ErrorState title="Sections didn't load" onRetry={load} />
          ) : sections.length === 0 ? (
            <EmptyState
              compact
              icon={<LayoutGrid />}
              title="No unclaimed sections"
              description="Every section already has a tutor assigned."
            />
          ) : Object.keys(grouped).length === 0 ? (
            <EmptyState
              compact
              icon={<Search />}
              title="No sections match"
              description="Try a programme name or year."
            />
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([groupName, secs]) => (
                <section key={groupName} aria-label={groupName}>
                  <h3 className="sticky top-0 z-10 bg-surface py-1.5 text-xs font-medium text-fg-muted">
                    {groupName}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {secs.map((sec) => {
                      const selected = selectedIds.includes(sec.id);
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleSection(sec.id)}
                          className={cn(
                            "flex h-11 items-center justify-between gap-2 rounded-control border px-3 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-snappy active:scale-[0.97]",
                            selected
                              ? "border-primary bg-primary/10 text-primary-text"
                              : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
                          )}
                        >
                          Section {sec.label}
                          <span
                            className={cn(
                              "inline-flex size-4 items-center justify-center rounded-full transition-colors",
                              selected ? "bg-primary text-primary-fg" : "border border-border-strong"
                            )}
                          >
                            {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2/50 px-4 py-3">
          <p className="text-sm text-fg-muted" aria-live="polite">
            <span className="font-mono font-medium tabular-nums text-fg">{selectedIds.length}</span> of {remainingSlots} selected
          </p>
          <Button
            onClick={handleClaim}
            disabled={selectedIds.length === 0 || isLoading || remainingSlots === 0}
            loading={isSaving}
            loadingText="Assigning"
          >
            Assign to me
          </Button>
        </div>
      </div>
    </div>
  );
}
