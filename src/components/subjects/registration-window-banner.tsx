"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleCheck, CirclePause, Clock3, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, pad2, splitDuration } from "@/lib/format";
import { useServerClock, useTicker } from "@/lib/use-server-clock";
import { buttonVariants } from "@/components/ui/button";
import type { WindowState } from "@/lib/registration-window";

export type WindowBannerProps = {
  state: WindowState;
  opensAt: string | null;
  closesAt: string | null;
  serverNow: number;
  registrationStatus: string | null;
  eligible: boolean;
  /** Where "Choose electives" goes; on a subject page this targets that subject's card. */
  chooseHref?: string;
  /** The event shown, so links stay on it when a class has several. */
  eventId?: string;
  className?: string;
};

function Clock({ ms }: { ms: number }) {
  const { days, hours, minutes, seconds } = splitDuration(ms);
  return (
    <span className="font-mono tabular-nums" aria-hidden suppressHydrationWarning>
      {days > 0 ? `${days}d ` : ""}
      {pad2(hours)}:{pad2(minutes)}:{pad2(seconds)}
    </span>
  );
}

/**
 * Registration status for the subject explorer, derived from the event's own
 * open/close times and the server clock. The page is the source of truth: when
 * the countdown reaches zero it asks the server again instead of assuming.
 */
export function RegistrationWindowBanner({
  state,
  opensAt,
  closesAt,
  serverNow,
  registrationStatus,
  eligible,
  chooseHref,
  eventId,
  className,
}: WindowBannerProps) {
  const router = useRouter();
  const q = eventId ? `?event=${encodeURIComponent(eventId)}` : "";
  const choose = chooseHref ?? `/dashboard/electives${q}`;
  const now = useServerClock(serverNow);
  const target = state === "UPCOMING" ? opensAt : state === "OPEN" ? closesAt : null;
  useTicker(Boolean(target));

  const remaining = target ? Math.max(0, new Date(target).getTime() - now()) : 0;
  const refreshed = React.useRef(false);
  React.useEffect(() => {
    if (target && remaining === 0 && !refreshed.current) {
      refreshed.current = true;
      router.refresh();
    }
  }, [target, remaining, router]);

  const registered = registrationStatus === "CONFIRMED";

  let icon = <CalendarClock />;
  let title: React.ReactNode;
  let detail: React.ReactNode = null;
  let srLine = "";
  let action: React.ReactNode = null;

  if (state === "UPCOMING" && opensAt) {
    title = (
      <>
        Registration opens in <Clock ms={remaining} />
      </>
    );
    srLine = `Registration opens ${formatDateTime(opensAt)}.`;
    detail = `Opens ${formatDateTime(opensAt)}. Explore every subject now; choices open when the countdown ends.`;
  } else if (state === "OPEN") {
    icon = <CircleCheck />;
    title = "Registration is open";
    srLine = closesAt ? `Registration is open until ${formatDateTime(closesAt)}.` : "Registration is open.";
    detail = closesAt ? (
      <>
        Closes in <Clock ms={remaining} /> ({formatDateTime(closesAt)}).
      </>
    ) : null;
    if (registered) {
      action = (
        <Link href={`/dashboard/my-registration${q}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          View my registration
        </Link>
      );
    } else if (eligible) {
      action = (
        <Link href={choose} className={buttonVariants({ size: "sm" })}>
          Choose electives
        </Link>
      );
    }
  } else if (state === "PAUSED") {
    icon = <CirclePause />;
    title = "Registration is paused";
    srLine = "Registration is paused by faculty.";
    detail = "Faculty have paused registration. You can keep exploring; choices will open again when it resumes.";
  } else if (state === "CLOSED") {
    icon = <Lock />;
    title = "Registration has closed";
    srLine = "Registration has closed.";
    detail = registered
      ? "Your confirmed choices are saved."
      : "New choices can't be submitted. Contact your class tutor if you missed the window.";
    if (registered) {
      action = (
        <Link href={`/dashboard/my-registration${q}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
          View my registration
        </Link>
      );
    }
  } else {
    icon = <Clock3 />;
    title = "Opening time not announced yet";
    srLine = "Registration has not been scheduled yet.";
    detail = "Your class tutor will set the opening time. You can explore subjects in the meantime.";
  }

  return (
    <section
      aria-label="Registration status"
      className={cn(
        "flex flex-col gap-3 rounded-card border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
        state === "OPEN" ? "border-success/30 bg-success/[0.06]" : "border-border bg-surface-2",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
            state === "OPEN" ? "bg-success/15 text-success-text" : "bg-surface text-fg-muted shadow-1"
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-base font-medium text-fg">{title}</p>
          {detail ? <p className="mt-0.5 text-sm text-fg-muted">{detail}</p> : null}
          {!eligible && state !== "CLOSED" ? (
            <p className="mt-1 text-sm font-medium text-warning-text">
              Your account isn&apos;t marked eligible for registration. You can browse, but ask your class tutor before the window opens.
            </p>
          ) : null}
          <p className="sr-only" role="status">
            {srLine}
          </p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </section>
  );
}
