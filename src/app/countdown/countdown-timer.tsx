"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { pad2, splitDuration } from "@/lib/format";
import { useServerClock, useTicker } from "@/lib/use-server-clock";
import { Spinner } from "@/components/ui/spinner";

interface CountdownTimerProps {
  startDateStr: string;
  registrationEnabled: boolean;
  /** Server time at render, so the countdown follows the server clock. */
  serverNow: number;
}

export function CountdownTimer({ startDateStr, registrationEnabled, serverNow }: CountdownTimerProps) {
  const router = useRouter();
  const now = useServerClock(serverNow);
  const target = React.useMemo(() => new Date(startDateStr).getTime(), [startDateStr]);
  const remaining = Math.max(0, target - now());
  const isOver = remaining <= 0;
  useTicker(!isOver, 1000);

  // Same behaviour as before: at zero, move into the portal if registration is
  // enabled; otherwise refresh. Polling every 5s only happens when the page
  // was loaded after the opening time, exactly as the previous timer did.
  const overAtMount = React.useRef(isOver);
  React.useEffect(() => {
    if (!isOver) return;
    if (registrationEnabled) {
      router.push("/dashboard");
      return;
    }
    router.refresh();
    if (!overAtMount.current) return;
    const poll = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(poll);
  }, [isOver, registrationEnabled, router]);

  const { days, hours, minutes, seconds } = splitDuration(remaining);

  if (isOver) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-center">
        <Spinner className="size-6 text-primary-text" />
        <p className="text-lg font-medium text-fg">{registrationEnabled ? "Opening registration" : "Waiting for your tutor to open registration"}</p>
        <p className="text-sm text-fg-muted">
          {registrationEnabled ? "Taking you to the electives now." : "This page checks again every few seconds. No need to refresh."}
        </p>
      </div>
    );
  }

  const units = [
    ...(days > 0 ? [{ label: days === 1 ? "day" : "days", value: pad2(days) }] : []),
    { label: "hours", value: pad2(hours) },
    { label: "minutes", value: pad2(minutes) },
    { label: "seconds", value: pad2(seconds) },
  ];

  return (
    <div>
      <div
        role="timer"
        aria-label={`Registration opens in ${days ? `${days} days, ` : ""}${hours} hours, ${minutes} minutes`}
        className="flex items-start justify-center gap-2 sm:gap-4"
      >
        {units.map((u, i) => (
          <React.Fragment key={u.label}>
            {i > 0 ? (
              <span aria-hidden className="pt-2 font-mono text-4xl font-light text-fg-subtle sm:pt-3 sm:text-6xl">
                :
              </span>
            ) : null}
            <div className="flex flex-col items-center">
              <span aria-hidden className="flex font-mono text-5xl font-medium tracking-tight text-fg tabular-nums sm:text-7xl" suppressHydrationWarning>
                {u.value.split("").map((digit, d) => (
                  <RollingDigit key={d} digit={digit} />
                ))}
              </span>
              <span className="mt-2 text-xs text-fg-muted">{u.label}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/** One digit that rolls up when it changes. Fixed width, so nothing shifts. */
function RollingDigit({ digit }: { digit: string }) {
  return (
    <span className="relative inline-flex h-[1.1em] w-[1ch] justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={digit}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={spring.snappy}
          className="inline-block"
          suppressHydrationWarning
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
