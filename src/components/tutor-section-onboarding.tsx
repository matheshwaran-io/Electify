"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LayoutGrid, Search } from "lucide-react";
import { toast } from "sonner";
import { claimTutorSection, getAllAvailableSections } from "@/app/actions/tutor";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";

type SectionData = { id: string; label: string; batch: string; programme: string };

const MAX = 5;

export function TutorSectionOnboarding({ isManageMode = false }: { isManageMode?: boolean }) {
  const [sections, setSections] = useState<SectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState("");

  const load = () => {
    setIsLoading(true);
    setLoadError(false);
    getAllAvailableSections()
      .then((data) => {
        setSections(data);
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
      window.location.reload(); // refresh the session cookie and every server component
    } catch (err: any) {
      toast.error(err.message || "Couldn't assign those sections");
      setIsSaving(false);
    }
  };

  const toggleSection = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) {
        toast.error(`You can manage up to ${MAX} sections.`);
        return prev;
      }
      return [...prev, id];
    });
  };

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
    <div className="mx-auto flex w-full max-w-xl flex-col py-6 sm:py-10">
      <div className="mb-6 space-y-2">
        <span className="inline-flex size-11 items-center justify-center rounded-control border border-border bg-surface text-primary-text shadow-1">
          <LayoutGrid className="size-5" />
        </span>
        <h1 className="pt-2 text-2xl font-semibold tracking-tight text-fg">
          {isManageMode ? "Add the sections you tutor" : "Pick the sections you tutor"}
        </h1>
        <p className="text-fg-muted">
          {isManageMode
            ? `Sections already claimed by another tutor aren't listed. You can manage up to ${MAX} in total.`
            : `You don't have a section yet. Choose up to ${MAX} to get started; only unclaimed sections are listed.`}
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-2">
        <div className="border-b border-border p-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by programme, year or section" aria-label="Filter sections" leading={<Search />} inputSize="sm" className="h-9" />
        </div>

        <div className="max-h-[50dvh] min-h-48 overflow-y-auto px-4 py-3 scrollbar-thin">
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
            <EmptyState compact icon={<LayoutGrid />} title="No unclaimed sections" description="Every section already has a tutor. Ask your administrator if one should be reassigned." />
          ) : Object.keys(grouped).length === 0 ? (
            <EmptyState compact icon={<Search />} title="No sections match" description="Try a programme name or year." />
          ) : (
            <div className="space-y-5">
              {Object.entries(grouped).map(([groupName, secs]) => (
                <section key={groupName} aria-label={groupName}>
                  <h2 className="sticky top-0 z-10 bg-surface py-1.5 text-xs font-medium text-fg-muted">{groupName}</h2>
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
            <span className="font-mono font-medium tabular-nums text-fg">{selectedIds.length}</span> of {MAX} selected
          </p>
          <Button onClick={handleClaim} disabled={selectedIds.length === 0 || isLoading} loading={isSaving} loadingText="Assigning">
            Assign to me
          </Button>
        </div>
      </div>
    </div>
  );
}
