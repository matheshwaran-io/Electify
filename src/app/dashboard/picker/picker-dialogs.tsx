"use client";

import * as React from "react";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { OccupancyRing, seatState } from "@/components/ui/data-display";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Magnetic } from "@/components/ui/interactions";
import { ruleText, type Elective, type Group, type Selections } from "./types";

/* ─── Detail: morphs out of its card ───────────────────────────────────── */

export function ElectiveDetail({
  elective,
  group,
  selected,
  disabled,
  onClose,
  onToggle,
}: {
  elective: Elective | null;
  group: Group | null;
  selected: boolean;
  disabled: boolean;
  onClose: () => void;
  onToggle: () => void;
}) {
  const open = Boolean(elective && group);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup className="fixed inset-x-0 bottom-0 z-50 outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(36rem,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2">
          {elective && group ? (
            <motion.div
              layoutId={`card-${elective.id}`}
              transition={spring.gentle}
              className="relative max-h-[88dvh] overflow-y-auto rounded-t-card border border-border bg-surface shadow-3 pb-safe sm:rounded-card"
            >
              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div>
                    <p className="text-xs text-fg-muted">
                      {group.name} · {ruleText(group)}
                    </p>
                    <DialogPrimitive.Title className="mt-1.5 text-xl font-medium tracking-tight text-fg">{elective.name}</DialogPrimitive.Title>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                      {elective.courseCode ? <span className="font-mono">{elective.courseCode}</span> : null}
                      {typeof elective.credits === "number" ? <span>{elective.credits} credits</span> : null}
                    </div>
                  </div>
                </div>
                <DialogPrimitive.Close
                  aria-label="Close details"
                  className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-badge text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <X className="size-4" />
                </DialogPrimitive.Close>

                <div className="mt-5 flex items-center gap-4 rounded-control border border-border bg-surface-2/50 p-4">
                  <OccupancyRing
                    filled={elective.maxSeats - Math.max(0, elective.availableSeats)}
                    total={elective.maxSeats}
                    state={seatState(elective.availableSeats, elective.maxSeats)}
                    size={52}
                  />
                  <div>
                    <p className="text-sm font-medium text-fg">
                      {elective.availableSeats <= 0 ? "No seats left" : `${elective.availableSeats} of ${elective.maxSeats} seats left`}
                    </p>
                    <p className="text-xs text-fg-muted">Updates live while this is open.</p>
                  </div>
                </div>

                <DialogPrimitive.Description render={<div />} className="mt-5 space-y-2">
                  <p className="text-xs font-medium text-fg-subtle">About this course</p>
                  {elective.description ? (
                    <p className="whitespace-pre-line text-sm leading-relaxed text-fg">{elective.description}</p>
                  ) : (
                    <p className="text-sm text-fg-muted">Your department hasn&apos;t added a description for this course yet.</p>
                  )}
                </DialogPrimitive.Description>
                <Link
                  href={`/dashboard/subjects/${elective.id}`}
                  className="mt-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-fg underline-offset-4 hover:underline"
                >
                  Read the full subject guide <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="flex gap-2 border-t border-border bg-surface-2/50 p-4">
                <Button variant="secondary" className="flex-1 sm:flex-none" onClick={onClose}>
                  Close
                </Button>
                <Button
                  className="flex-1"
                  variant={selected ? "secondary" : "primary"}
                  disabled={disabled && !selected}
                  onClick={() => {
                    onToggle();
                    onClose();
                  }}
                >
                  {selected ? "Remove from my picks" : disabled ? "Full" : "Pick this elective"}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ─── Compare ──────────────────────────────────────────────────────────── */

export function CompareDialog({
  open,
  onOpenChange,
  electives,
  groups,
  isSelected,
  onToggle,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  electives: Elective[];
  groups: Group[];
  isSelected: (e: Elective) => boolean;
  onToggle: (e: Elective) => void;
  onRemove: (id: string) => void;
}) {
  const rows: { label: string; render: (e: Elective) => React.ReactNode }[] = [
    { label: "Group", render: (e) => groups.find((g) => g.id === e.groupId)?.name ?? "" },
    { label: "Code", render: (e) => <span className="font-mono">{e.courseCode ?? "Not set"}</span> },
    { label: "Credits", render: (e) => (typeof e.credits === "number" ? e.credits : "Not set") },
    {
      label: "Seats left",
      render: (e) => (
        <span className={cn("font-mono tabular-nums", e.availableSeats <= 0 ? "text-danger-text" : e.availableSeats < 10 ? "text-warning-text" : "")}>
          {Math.max(0, e.availableSeats)} / {e.maxSeats}
        </span>
      ),
    },
    { label: "About", render: (e) => <span className="text-fg-muted">{e.description || "No description yet."}</span> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Compare electives</DialogTitle>
          <DialogDescription>Seat counts stay live while you compare.</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-5">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, electives.length)}, minmax(0, 1fr))` }}>
            {electives.map((e) => (
              <div key={e.id} className="flex flex-col rounded-control border border-border">
                <div className="flex items-start justify-between gap-2 border-b border-border p-3">
                  <p className="text-sm font-medium leading-snug text-fg">{e.name}</p>
                  <button type="button" aria-label={`Remove ${e.name} from comparison`} onClick={() => onRemove(e.id)} className="inline-flex size-7 shrink-0 items-center justify-center rounded-badge text-fg-subtle hover:bg-surface-2 hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                </div>
                <dl className="flex-1 divide-y divide-border text-sm">
                  {rows.map((r) => (
                    <div key={r.label} className="px-3 py-2.5">
                      <dt className="text-xs text-fg-subtle">{r.label}</dt>
                      <dd className="mt-0.5 text-fg">{r.render(e)}</dd>
                    </div>
                  ))}
                </dl>
                <div className="p-3">
                  <Button
                    size="sm"
                    className="w-full"
                    variant={isSelected(e) ? "secondary" : "primary"}
                    disabled={!isSelected(e) && e.availableSeats <= 0}
                    onClick={() => onToggle(e)}
                  >
                    {isSelected(e) ? (
                      <>
                        <Check /> Picked
                      </>
                    ) : e.availableSeats <= 0 ? (
                      "Full"
                    ) : (
                      "Pick"
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Review & confirm ─────────────────────────────────────────────────── */

export function ReviewDialog({
  open,
  onOpenChange,
  groups,
  selections,
  electives,
  submitting,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: Group[];
  selections: Selections;
  electives: Elective[];
  submitting: boolean;
  onConfirm: () => void;
}) {
  const picked = groups.flatMap((g) => (selections[g.id] ?? []).map((id) => electives.find((e) => e.id === id)).filter(Boolean)) as Elective[];
  const credits = picked.reduce((sum, e) => sum + (e.credits ?? 0), 0);
  const hasCredits = picked.some((e) => typeof e.credits === "number");

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent size="md" showClose={!submitting}>
        <DialogHeader>
          <DialogTitle>Confirm your electives</DialogTitle>
          <DialogDescription>Check these once more. You can&apos;t change them after you confirm.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <ul className="divide-y divide-border overflow-hidden rounded-control border border-border">
            {groups.map((g) =>
              (selections[g.id] ?? []).map((id) => {
                const e = electives.find((x) => x.id === id);
                if (!e) return null;
                const full = e.availableSeats <= 0;
                return (
                  <li key={id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg">
                      <Check className="size-3" strokeWidth={3.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-fg-muted">{g.name}</p>
                      <p className="text-sm font-medium text-fg">
                        {e.courseCode ? <span className="font-mono text-fg-muted">{e.courseCode} </span> : null}
                        {e.name}
                      </p>
                      {full ? (
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-danger-text">
                          <AlertTriangle className="size-3.5" /> This just filled up. Go back and pick another.
                        </p>
                      ) : null}
                    </div>
                    {typeof e.credits === "number" ? <span className="shrink-0 text-xs text-fg-muted">{e.credits} cr</span> : null}
                  </li>
                );
              })
            )}
          </ul>
          {hasCredits ? (
            <p className="flex justify-between text-sm text-fg-muted">
              <span>Total credits</span>
              <span className="font-mono font-medium tabular-nums text-fg">{credits}</span>
            </p>
          ) : null}
          <p className="flex items-start gap-2 rounded-control border border-border bg-surface-2/50 px-3.5 py-3 text-sm text-fg-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-text" />
            Seats are held the moment you confirm. You&apos;ll get a receipt right after.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            Go back
          </Button>
          <Magnetic className="w-full sm:w-auto">
            <Button
              variant="brand"
              size="lg"
              className="w-full sm:w-auto"
              onClick={onConfirm}
              loading={submitting}
              loadingText="Confirming"
              disabled={picked.some((e) => e.availableSeats <= 0)}
            >
              Confirm registration
            </Button>
          </Magnetic>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
