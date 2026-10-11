"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WindowEvent } from "./types";

const STAGES = ["Configured", "Published", "Portal open", "Closing soon", "Closed"];

export function RegistrationTimeline({ event }: { event: WindowEvent }) {
  const now = new Date();
  const open = event.openDate ? new Date(event.openDate) : null;
  const close = event.closeDate ? new Date(event.closeDate) : null;

  let currentStage = 0; // 0: Configured, 1: Published, 2: Open, 3: Closing Soon, 4: Closed

  if (event.status === "CLOSED" || (close && now > close)) {
    currentStage = 4;
  } else if (open && close && now >= open && now <= close) {
    const totalDuration = close.getTime() - open.getTime();
    const elapsed = now.getTime() - open.getTime();
    currentStage = elapsed / totalDuration > 0.8 ? 3 : 2; // 80% through
  } else if (open && now < open) {
    currentStage = 1;
  }

  return (
    <section aria-label="Window timeline" className="col-span-1 rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5 lg:col-span-12">
      <h2 className="sr-only">Timeline</h2>
      <ol className="flex flex-col gap-0 md:flex-row md:items-start">
        {STAGES.map((label, idx) => {
          const done = idx < currentStage;
          const current = idx === currentStage;
          const last = idx === STAGES.length - 1;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className="relative flex gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:items-center md:gap-2.5 md:pb-0 md:text-center"
            >
              {!last ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute bg-border",
                    "left-[0.9375rem] top-8 bottom-0 w-px md:left-[calc(50%+1.25rem)] md:right-[calc(-50%+1.25rem)] md:top-4 md:bottom-auto md:h-px md:w-auto",
                    done && "bg-fg"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-500",
                  done ? "border-fg bg-fg text-canvas" : current ? "border-fg bg-canvas text-fg" : "border-border bg-canvas text-fg-subtle"
                )}
              >
                {done ? <Check className="size-4" /> : current ? <span className="size-2 rounded-full bg-fg motion-safe:animate-pulse" /> : <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <span className={cn("pt-1.5 text-sm md:pt-0 md:text-xs", current ? "font-medium text-fg" : done ? "text-fg" : "text-fg-subtle")}>{label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
