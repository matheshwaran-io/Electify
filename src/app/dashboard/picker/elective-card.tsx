"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, Columns2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { spring, transition } from "@/lib/motion";
import { AnimatedNumber, OccupancyRing, seatState } from "@/components/ui/data-display";
import type { Elective } from "./types";

type Props = {
  elective: Elective;
  groupId: string;
  multiple: boolean;
  selected: boolean;
  disabled: boolean;
  compared: boolean;
  compareFull: boolean;
  conflict?: string;
  suggestions?: Elective[];
  onSelect: (groupId: string, electiveId: string) => void;
  onDetails: (id: string) => void;
  onCompare: (id: string) => void;
  onPickSuggestion: (groupId: string, electiveId: string) => void;
};

/**
 * One elective. A native radio/checkbox drives selection (arrow keys, screen
 * readers and forms work for free); the card is its label. Seats animate in
 * place inside a fixed-size meter, so live updates never move the layout.
 */
export const ElectiveCard = React.memo(function ElectiveCard({
  elective,
  groupId,
  multiple,
  selected,
  disabled,
  compared,
  compareFull,
  conflict,
  suggestions,
  onSelect,
  onDetails,
  onCompare,
  onPickSuggestion,
}: Props) {
  const left = Math.max(0, elective.availableSeats);
  const state = seatState(left, elective.maxSeats);
  const filled = elective.maxSeats - left;
  const inputId = `elective-${elective.id}`;

  return (
    <motion.div
      layoutId={`card-${elective.id}`}
      transition={spring.gentle}
      className={cn(
        "group/card relative flex flex-col rounded-card border bg-surface shadow-1",
        "transition-[border-color,box-shadow,background-color] duration-200 ease-snappy",
        "has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-2 has-[input:focus-visible]:ring-offset-canvas",
        selected
          ? "border-primary bg-primary/[0.04] shadow-2 ring-1 ring-primary"
          : disabled
            ? "border-border bg-surface-2/50"
            : "border-border hover:border-border-strong hover:shadow-2",
        conflict && "border-danger/40 ring-1 ring-danger/30"
      )}
    >
      <label htmlFor={inputId} className={cn("flex flex-1 flex-col gap-3 p-4 sm:p-5", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <input
          id={inputId}
          type={multiple ? "checkbox" : "radio"}
          name={`group-${groupId}`}
          value={elective.id}
          checked={selected}
          disabled={disabled}
          onChange={() => onSelect(groupId, elective.id)}
          className="sr-only"
        />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {elective.courseCode ? (
                <span className="font-mono text-xs font-medium tracking-wide text-fg-muted">{elective.courseCode}</span>
              ) : null}
              {typeof elective.credits === "number" ? (
                <span className="rounded-badge border border-border px-1.5 py-px text-2xs font-medium text-fg-muted">
                  {elective.credits} credits
                </span>
              ) : null}
            </div>
            <h3 className={cn("mt-1.5 text-base font-semibold leading-snug tracking-tight", disabled && !selected ? "text-fg-muted" : "text-fg")}>
              {elective.name}
            </h3>
          </div>
          <span
            aria-hidden
            className={cn(
              "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center border transition-colors duration-150",
              multiple ? "rounded-badge" : "rounded-full",
              selected ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface"
            )}
          >
            <AnimatePresence initial={false}>
              {selected ? (
                <motion.span key="tick" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring.snappy}>
                  <Check className="size-3" strokeWidth={3.5} />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
        </div>

        {elective.description ? <p className="line-clamp-2 text-sm text-fg-muted">{elective.description}</p> : null}

        <div className="mt-auto flex items-center gap-3 pt-1">
          <OccupancyRing
            filled={filled}
            total={elective.maxSeats}
            state={state}
            size={40}
            stroke={3.5}
            label={`${filled} of ${elective.maxSeats} seats taken`}
          />
          <div className="min-w-0 leading-tight">
            {state === "full" ? (
              <p className="text-sm font-semibold text-danger-text">Full</p>
            ) : (
              <p className={cn("text-sm font-semibold", state === "low" ? "text-warning-text" : "text-fg")}>
                <AnimatedNumber value={left} tabular /> {state === "low" ? (left === 1 ? "seat left" : "seats left") : "seats left"}
              </p>
            )}
            <p className="text-xs text-fg-muted">
              of <span className="font-mono tabular-nums">{elective.maxSeats}</span>
            </p>
          </div>
        </div>
      </label>

      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => onDetails(elective.id)}
          className="inline-flex h-8 items-center gap-1.5 rounded-badge px-2 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Info className="size-3.5" /> Details
        </button>
        <button
          type="button"
          aria-pressed={compared}
          disabled={!compared && compareFull}
          title={!compared && compareFull ? "You can compare up to 3" : undefined}
          onClick={() => onCompare(elective.id)}
          className={cn(
            "ml-auto inline-flex h-8 items-center gap-1.5 rounded-badge px-2 text-xs font-medium transition-colors disabled:opacity-40",
            compared ? "bg-primary/10 text-primary-text" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
          )}
        >
          <Columns2 className="size-3.5" /> {compared ? "Comparing" : "Compare"}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {conflict ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition.fade}
            className="overflow-hidden"
          >
            <div role="status" className="border-t border-danger/20 bg-danger/[0.06] px-4 py-3 text-sm">
              <p className="flex items-start gap-2 font-medium text-danger-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {conflict}
              </p>
              {suggestions && suggestions.length > 0 ? (
                <div className="mt-2.5">
                  <p className="text-xs text-fg-muted">Still open in this group:</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onPickSuggestion(groupId, s.id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-badge border border-border bg-surface px-2.5 text-xs font-medium text-fg shadow-1 hover:border-primary/40"
                      >
                        {s.courseCode ?? s.name}
                        <span className="font-mono text-fg-muted tabular-nums">{s.availableSeats} left</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
});
