"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, Check, Columns2, Search, WifiOff } from "lucide-react";
import { registerElectives } from "@/app/actions/register";
import { cn } from "@/lib/utils";
import { spring, transition } from "@/lib/motion";
import { formatRemaining } from "@/lib/format";
import { useServerClock, useTicker } from "@/lib/use-server-clock";
import { Button } from "@/components/ui/button";
import { LiveIndicator, type LiveState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";
import { Magnetic } from "@/components/ui/interactions";
import { Select } from "@/components/ui/select";
import { ElectiveCard } from "./picker/elective-card";
import { CompareDialog, ElectiveDetail, ReviewDialog } from "./picker/picker-dialogs";
import { groupComplete, ruleText, type Elective, type Group, type Selections } from "./picker/types";

interface Student {
  id: string;
  name: string;
  registerNumber: string;
  isEligible: boolean;
  hasSubmitted: boolean;
}

interface Event {
  id: string;
  name: string;
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
}

interface RegistrationFormProps {
  event: Event;
  student: Student;
  groups: Group[];
  electives: Elective[];
  initialRegistrations: { electiveId: string; groupId: string }[];
  serverNow: number;
}

type SubmitError = { kind: "conflict" | "closed" | "offline" | "network" | "other"; message: string } | null;

const SEARCH_THRESHOLD = 6;
const MAX_COMPARE = 3;

export function RegistrationForm({ event, student, groups, electives, initialRegistrations, serverNow }: RegistrationFormProps) {
  const router = useRouter();

  // Live seat counts state
  const [localElectives, setLocalElectives] = React.useState<Elective[]>(electives);
  const [live, setLive] = React.useState<LiveState>("connecting");

  // Supabase Realtime subscription (same channel, table and event as before).
  React.useEffect(() => {
    let channel: any;
    import("@/lib/supabase").then((mod) => {
      channel = mod.supabase
        .channel("table-db-changes")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "electives",
          },
          (payload) => {
            const newRow = payload.new as any;
            if (newRow && newRow.id) {
              setLocalElectives((prev) =>
                prev.map((e) =>
                  e.id === newRow.id
                    ? {
                        ...e,
                        availableSeats: Number(newRow.available_seats),
                        isFull: Number(newRow.available_seats) <= 0,
                        isActive: newRow.is_active,
                      }
                    : e
                )
              );
            }
          }
        )
        .subscribe((status: string) => {
          setLive(status === "SUBSCRIBED" ? "live" : status === "CLOSED" ? "idle" : "connecting");
        });
    });

    return () => {
      if (channel) {
        import("@/lib/supabase").then((mod) => {
          mod.supabase.removeChannel(channel);
        });
      }
    };
  }, []);

  // State: mapping from groupId to an array of selected electiveIds
  const [selections, setSelections] = React.useState<Selections>(() => {
    const initial: Selections = {};
    for (const group of groups) {
      initial[group.id] = initialRegistrations.filter((r) => r.groupId === group.id).map((r) => r.electiveId);
    }
    return initial;
  });

  // Keep picks across an accidental reload (this tab only).
  const draftKey = `electify:picks:${event.id}`;
  React.useEffect(() => {
    if (initialRegistrations.length > 0) return;
    try {
      const raw = sessionStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Selections;
      const valid: Selections = {};
      for (const g of groups) {
        valid[g.id] = (draft[g.id] ?? []).filter((id) => electives.some((e) => e.id === id && e.groupId === g.id && e.availableSeats > 0)).slice(0, g.maxChoices);
      }
      setSelections(valid);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  React.useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(selections));
    } catch {}
  }, [draftKey, selections]);

  const [conflicts, setConflicts] = React.useState<Record<string, string>>({});
  const [compare, setCompare] = React.useState<string[]>([]);
  const [compareOpen, setCompareOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<SubmitError>(null);
  const [announcement, setAnnouncement] = React.useState("");
  const [online, setOnline] = React.useState(true);
  const submittingRef = React.useRef(false);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Close-time awareness on the server clock. The ticking lives in <CloseTimer>
  // so the picker itself doesn't re-render every second.
  const closeAt = event.closeDate ? new Date(event.closeDate).getTime() : null;
  const [closed, setClosed] = React.useState(() => closeAt !== null && closeAt <= serverNow);
  const onClosed = React.useCallback(() => {
    setClosed(true);
    router.refresh();
  }, [router]);

  const byId = React.useMemo(() => new Map(localElectives.map((e) => [e.id, e])), [localElectives]);
  const initiallySelected = React.useMemo(() => new Set(initialRegistrations.map((r) => r.electiveId)), [initialRegistrations]);

  // Announce only changes that affect this student's own picks.
  const prevSeats = React.useRef(new Map(electives.map((e) => [e.id, e.availableSeats])));
  React.useEffect(() => {
    // While a submit is in flight our own seats drop too; that isn't a conflict.
    if (submittingRef.current) return;
    const picked = new Set(Object.values(selections).flat());
    for (const e of localElectives) {
      const before = prevSeats.current.get(e.id);
      prevSeats.current.set(e.id, e.availableSeats);
      if (before === undefined || before === e.availableSeats || !picked.has(e.id)) continue;
      const group = groups.find((g) => g.id === e.groupId);
      if (e.availableSeats <= 0 && !initiallySelected.has(e.id)) {
        setSelections((prev) => ({ ...prev, [e.groupId]: (prev[e.groupId] ?? []).filter((id) => id !== e.id) }));
        setConflicts((c) => ({ ...c, [e.id]: "This filled up while you were choosing. Your other picks are safe." }));
        setAnnouncement(`${e.name} just filled up and was removed from your picks. Choose another in ${group?.name ?? "this group"}.`);
      } else if (e.availableSeats < 10 && before >= 10) {
        setAnnouncement(`Only ${e.availableSeats} seats left in ${e.name}, one of your picks.`);
      }
    }
  }, [localElectives, selections, groups, initiallySelected]);

  const canSubmit = React.useMemo(() => {
    return groups.every((g) => groupComplete(g, selections[g.id]?.length || 0)) && student.isEligible;
  }, [groups, selections, student.isEligible]);

  const handleSelect = React.useCallback(
    (groupId: string, electiveId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group) return;
      setConflicts((c) => {
        if (!Object.keys(c).length) return c;
        const next = { ...c };
        for (const id of Object.keys(next)) if (byId.get(id)?.groupId === groupId) delete next[id];
        return next;
      });
      setSubmitError(null);

      setSelections((prev) => {
        const current = prev[groupId] || [];

        // If already selected, deselect it
        if (current.includes(electiveId)) {
          return { ...prev, [groupId]: current.filter((id) => id !== electiveId) };
        }

        // If maxChoices is 1, just replace
        if (group.maxChoices === 1) {
          return { ...prev, [groupId]: [electiveId] };
        }

        // If we haven't reached maxChoices, add it
        if (current.length < group.maxChoices) {
          return { ...prev, [groupId]: [...current, electiveId] };
        }

        // Otherwise do nothing
        return prev;
      });
    },
    [groups, byId]
  );

  const toggleCompare = React.useCallback((id: string) => {
    setCompare((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_COMPARE ? prev : [...prev, id]));
  }, []);

  const handleRegister = async () => {
    if (submittingRef.current) return; // double-submit guard
    if (!navigator.onLine) {
      setSubmitError({ kind: "offline", message: "You're offline. Your picks are still here; confirm again once you're connected." });
      setIsConfirmOpen(false);
      return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = groups.flatMap((g) =>
        (selections[g.id] || []).map((eid) => ({
          groupId: g.id,
          electiveId: eid,
        }))
      );

      const response = await registerElectives(event.id, payload);

      if (response.success) {
        try {
          sessionStorage.removeItem(draftKey);
        } catch {}
        router.push("/dashboard/success");
        return; // keep the loading state while we navigate
      }
      handleFailure(response);
    } catch {
      setSubmitError({ kind: "network", message: "We couldn't reach the server, so nothing was submitted. Your picks are still here. Try again." });
      setIsConfirmOpen(false);
    }
    submittingRef.current = false;
    setIsSubmitting(false);
  };

  function handleFailure(result: { error?: string; code?: string; electiveId?: string }) {
    const msg = result.error || "Registration didn't go through. Please try again.";
    if (result.code === "SEAT_TAKEN") {
      const hit = result.electiveId ? localElectives.find((e) => e.id === result.electiveId) : undefined;
      if (hit) {
        setSelections((prev) => ({ ...prev, [hit.groupId]: (prev[hit.groupId] ?? []).filter((id) => id !== hit.id) }));
        setLocalElectives((prev) => prev.map((e) => (e.id === hit.id ? { ...e, availableSeats: 0, isFull: true } : e)));
        setConflicts((c) => ({ ...c, [hit.id]: "Someone took the last seat just before you confirmed. Nothing was registered; your other picks are kept." }));
        setAnnouncement(`${hit.name} filled up before you confirmed. Pick another elective in that group, then confirm again.`);
        setIsConfirmOpen(false);
        requestAnimationFrame(() => document.getElementById(`group-${hit.groupId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
        return;
      }
    }
    if (result.code === "ALREADY_REGISTERED") {
      router.replace("/dashboard/success");
      return;
    }
    setIsConfirmOpen(false);
    setSubmitError({ kind: result.code === "WINDOW_CLOSED" ? "closed" : "other", message: msg });
  }

  const suggestionsFor = React.useCallback(
    (e: Elective) =>
      localElectives
        .filter((x) => x.groupId === e.groupId && x.id !== e.id && x.availableSeats > 0 && x.isActive)
        .sort((a, b) => b.availableSeats - a.availableSeats)
        .slice(0, 3),
    [localElectives]
  );

  const completeCount = groups.filter((g) => groupComplete(g, selections[g.id]?.length || 0)).length;
  const firstIncomplete = groups.find((g) => !groupComplete(g, selections[g.id]?.length || 0));
  const detail = detailId ? byId.get(detailId) ?? null : null;
  const detailGroup = detail ? groups.find((g) => g.id === detail.groupId) ?? null : null;

  const scrollToGroup = (id: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`group-${id}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="pb-40">
      <p aria-live="polite" role="status" className="sr-only">
        {announcement}
      </p>

      {/* Stepper + live status */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-canvas/90 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3">
          <ol className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 scrollbar-none">
            {groups.map((g, i) => {
              const count = selections[g.id]?.length || 0;
              const done = groupComplete(g, count);
              return (
                <li key={g.id} className="flex shrink-0 items-center gap-1.5">
                  {i > 0 ? <span aria-hidden className="h-px w-3 bg-border-strong/50" /> : null}
                  <button
                    type="button"
                    onClick={() => scrollToGroup(g.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
                      done ? "border-success/30 bg-success/10 text-success-text" : "border-border bg-surface text-fg-muted hover:text-fg"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-4 items-center justify-center rounded-full text-2xs",
                        done ? "bg-success text-on-accent" : "border border-border-strong"
                      )}
                    >
                      {done ? <Check className="size-2.5" strokeWidth={4} /> : null}
                    </span>
                    <span className="max-w-[12rem] truncate">{g.name}</span>
                    <span className="font-mono tabular-nums">
                      {count}/{g.maxChoices}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            {closeAt !== null && !closed ? <CloseTimer closeAt={closeAt} serverNow={serverNow} onClosed={onClosed} /> : null}
            <LiveIndicator state={online ? live : "offline"} label={online ? (live === "live" ? "Seats live" : undefined) : undefined} />
          </div>
        </div>
      </div>

      {/* Status banners */}
      <div className="mt-5 space-y-3">
        {!student.isEligible ? (
          <Banner tone="warning" icon={<AlertCircle />} title="You can browse, but you can't register yet">
            Your account isn&apos;t marked eligible for this registration. Contact your class tutor.
          </Banner>
        ) : null}
        {!online ? (
          <Banner tone="warning" icon={<WifiOff />} title="You're offline">
            Your picks stay on this screen. Seat counts resume and you can confirm once you&apos;re back online.
          </Banner>
        ) : null}
        {closed ? (
          <Banner tone="danger" icon={<AlertCircle />} title="The registration window has closed">
            Checking with the server now. If you weren&apos;t registered, contact your class tutor.
          </Banner>
        ) : null}
        {submitError ? (
          <Banner tone={submitError.kind === "offline" ? "warning" : "danger"} icon={<AlertCircle />} title={submitError.kind === "closed" ? "Registration is closed" : "Not registered yet"}>
            {submitError.message}
          </Banner>
        ) : null}
        {closeAt !== null && !closed ? (
          <p className="sm:hidden">
            <CloseTimer closeAt={closeAt} serverNow={serverNow} onClosed={onClosed} />
          </p>
        ) : null}
      </div>

      {/* Groups */}
      <div className="mt-6 space-y-12">
        {groups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            electives={localElectives.filter((e) => e.groupId === group.id)}
            selected={selections[group.id] || []}
            eligible={student.isEligible}
            initiallySelected={initiallySelected}
            compare={compare}
            conflicts={conflicts}
            suggestionsFor={suggestionsFor}
            onSelect={handleSelect}
            onDetails={setDetailId}
            onCompare={toggleCompare}
          />
        ))}
      </div>

      {/* Dock */}
      <div className="fixed inset-x-0 bottom-0 z-30 pb-safe">
        <div className="mx-auto max-w-6xl px-3 pb-3 sm:px-6 sm:pb-5">
          <motion.div
            className="flex flex-col gap-3 rounded-panel border border-border bg-surface/90 p-3 shadow-3 backdrop-blur-xl animate-enter [animation-delay:200ms] sm:flex-row sm:items-center sm:rounded-full sm:py-2.5 sm:pl-6 sm:pr-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-fg">
                  {canSubmit ? "Ready to confirm" : `${completeCount} of ${groups.length} groups done`}
                </p>
                {compare.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCompareOpen(true)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 text-xs font-medium text-primary-text"
                  >
                    <Columns2 className="size-3.5" /> Compare {compare.length}
                  </button>
                ) : null}
              </div>
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-x-auto scrollbar-none">
                <AnimatePresence initial={false} mode="popLayout">
                  {groups.flatMap((g) =>
                    (selections[g.id] || []).map((id) => {
                      const e = byId.get(id);
                      return e ? (
                        <motion.span
                          key={id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={spring.snappy}
                          className="inline-flex shrink-0 items-center gap-1 rounded-badge border border-border bg-surface-2 px-2 py-0.5 text-xs text-fg"
                        >
                          <span className="font-mono text-fg-muted">{e.courseCode ?? ""}</span>
                          <span className="max-w-[10rem] truncate">{e.name}</span>
                        </motion.span>
                      ) : null;
                    })
                  )}
                </AnimatePresence>
                {!canSubmit && firstIncomplete ? (
                  <button type="button" onClick={() => scrollToGroup(firstIncomplete.id)} className="shrink-0 text-xs text-fg-muted underline-offset-2 hover:text-fg hover:underline">
                    Next: {firstIncomplete.name} ({ruleText(firstIncomplete).toLowerCase()})
                  </button>
                ) : null}
              </div>
            </div>
            <Magnetic className="w-full sm:w-auto">
              <Button
                variant="brand"
                size="lg"
                className="w-full sm:w-auto"
                onClick={() => setIsConfirmOpen(true)}
                disabled={!canSubmit || isSubmitting || !student.isEligible || !online || closed}
              >
                Review and confirm <ArrowRight className="transition-transform duration-150 group-hover/button:translate-x-0.5" />
              </Button>
            </Magnetic>
          </motion.div>
        </div>
      </div>

      <ElectiveDetail
        elective={detail}
        group={detailGroup}
        selected={detail ? (selections[detail.groupId] ?? []).includes(detail.id) : false}
        disabled={detail ? (detail.availableSeats <= 0 && !initiallySelected.has(detail.id)) || !student.isEligible : true}
        onClose={() => setDetailId(null)}
        onToggle={() => detail && handleSelect(detail.groupId, detail.id)}
      />
      <CompareDialog
        open={compareOpen && compare.length > 0}
        onOpenChange={setCompareOpen}
        electives={compare.map((id) => byId.get(id)).filter(Boolean) as Elective[]}
        groups={groups}
        isSelected={(e) => (selections[e.groupId] ?? []).includes(e.id)}
        onToggle={(e) => handleSelect(e.groupId, e.id)}
        onRemove={(id) => toggleCompare(id)}
      />
      <ReviewDialog
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        groups={groups}
        selections={selections}
        electives={localElectives}
        submitting={isSubmitting}
        onConfirm={handleRegister}
      />
    </div>
  );
}

/** "Closes in 42m 10s", on the server clock. Turns amber in the last ten minutes. */
function CloseTimer({ closeAt, serverNow, onClosed }: { closeAt: number; serverNow: number; onClosed: () => void }) {
  const now = useServerClock(serverNow);
  const remaining = closeAt - now();
  useTicker(remaining > 0, 1000);
  React.useEffect(() => {
    if (remaining <= 0) onClosed();
  }, [remaining <= 0, onClosed]); // eslint-disable-line react-hooks/exhaustive-deps
  if (remaining <= 0) return null;
  return (
    <span className={cn("text-xs", remaining < 10 * 60_000 ? "font-medium text-warning-text" : "text-fg-muted")}>
      Closes in <span className="font-mono tabular-nums" suppressHydrationWarning>{formatRemaining(remaining)}</span>
    </span>
  );
}

function Banner({ tone, icon, title, children }: { tone: "warning" | "danger"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.fade}
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-control border px-4 py-3 text-sm",
        tone === "warning" ? "border-warning/30 bg-warning/10" : "border-danger/25 bg-danger/[0.07]"
      )}
    >
      <span className={cn("mt-0.5 shrink-0 [&_svg]:size-4", tone === "warning" ? "text-warning-text" : "text-danger-text")}>{icon}</span>
      <div>
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-fg-muted">{children}</p>
      </div>
    </motion.div>
  );
}

type SortKey = "seats" | "name" | "code";

function GroupSection({
  group,
  electives,
  selected,
  eligible,
  initiallySelected,
  compare,
  conflicts,
  suggestionsFor,
  onSelect,
  onDetails,
  onCompare,
}: {
  group: Group;
  electives: Elective[];
  selected: string[];
  eligible: boolean;
  initiallySelected: Set<string>;
  compare: string[];
  conflicts: Record<string, string>;
  suggestionsFor: (e: Elective) => Elective[];
  onSelect: (groupId: string, electiveId: string) => void;
  onDetails: (id: string) => void;
  onCompare: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortKey>("seats");
  const [hideFull, setHideFull] = React.useState(false);
  const searchable = electives.length > SEARCH_THRESHOLD;
  const done = groupComplete(group, selected.length);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = electives;
    if (q) list = list.filter((e) => `${e.courseCode ?? ""} ${e.name} ${e.description ?? ""}`.toLowerCase().includes(q));
    if (hideFull) list = list.filter((e) => e.availableSeats > 0 || selected.includes(e.id));
    if (!searchable) return list;
    return [...list].sort((a, b) =>
      sort === "seats" ? b.availableSeats - a.availableSeats : sort === "name" ? a.name.localeCompare(b.name) : (a.courseCode ?? "").localeCompare(b.courseCode ?? "")
    );
    // Order is stable for small groups so live seat changes never reshuffle cards.
  }, [electives, query, hideFull, sort, searchable, selected]);

  return (
    <section id={`group-${group.id}`} aria-labelledby={`group-title-${group.id}`} className="scroll-mt-32">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id={`group-title-${group.id}`} className="text-xl font-medium tracking-tight text-fg">
            {group.name}
          </h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
            {ruleText(group)}
            <span aria-hidden className="text-border-strong">/</span>
            <span className={cn(done ? "font-medium text-success-text" : "")}>
              {done ? "Done" : `${selected.length} picked`}
            </span>
          </p>
        </div>
        {searchable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this group"
              aria-label={`Search ${group.name}`}
              leading={<Search />}
              inputSize="sm"
              className="h-9 w-full sm:w-56"
            />
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as SortKey)}
              size="sm"
              aria-label="Sort electives"
              className="h-9 w-40"
              options={[
                { value: "seats", label: "Most seats left" },
                { value: "name", label: "Name" },
                { value: "code", label: "Course code" },
              ]}
            />
            <button
              type="button"
              aria-pressed={hideFull}
              onClick={() => setHideFull((h) => !h)}
              className={cn(
                "inline-flex h-9 items-center rounded-control border px-3 text-xs font-medium transition-colors",
                hideFull ? "border-primary/30 bg-primary/10 text-primary-text" : "border-border bg-surface text-fg-muted hover:text-fg"
              )}
            >
              Hide full
            </button>
          </div>
        ) : null}
      </div>

      <div
        role={group.maxChoices === 1 ? "radiogroup" : "group"}
        aria-labelledby={`group-title-${group.id}`}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {visible.map((elective) => {
          const isSelected = selected.includes(elective.id);
          const isFull = elective.availableSeats <= 0;
          return (
            <ElectiveCard
              key={elective.id}
              elective={elective}
              groupId={group.id}
              multiple={group.maxChoices > 1}
              selected={isSelected}
              disabled={(isFull && !initiallySelected.has(elective.id)) || !eligible || (!isSelected && group.maxChoices > 1 && selected.length >= group.maxChoices)}
              compared={compare.includes(elective.id)}
              compareFull={compare.length >= MAX_COMPARE}
              conflict={conflicts[elective.id]}
              suggestions={conflicts[elective.id] ? suggestionsFor(elective) : undefined}
              onSelect={onSelect}
              onDetails={onDetails}
              onCompare={onCompare}
              onPickSuggestion={onSelect}
            />
          );
        })}
      </div>
      {visible.length === 0 ? <p className="rounded-card border border-dashed border-border py-10 text-center text-sm text-fg-muted">No electives match.</p> : null}
    </section>
  );
}
