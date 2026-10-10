"use client";

import { format, differenceInSeconds } from "date-fns";
import { useEffect, useState } from "react";

export function HeroStatus({ 
  event 
}: { 
  event: any 
}) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();
  
  let statusText = "CONFIGURED";
  let statusColor = "text-fg-muted";
  let statusDot = "bg-fg-subtle";
  let countdownTarget = null;

  if (event.status === "OPEN" || (event.openDate && now >= event.openDate && (!event.closeDate || now < event.closeDate))) {
    statusText = "LIVE";
    statusColor = "text-success-text";
    statusDot = "bg-success";
    countdownTarget = event.closeDate;
  } else if (event.openDate && now < event.openDate) {
    statusText = "SCHEDULED";
    statusColor = "text-primary-text";
    statusDot = "bg-primary";
    countdownTarget = event.openDate;
  } else if (event.closeDate && now >= event.closeDate || event.status === "CLOSED") {
    statusText = "CLOSED";
    statusColor = "text-danger-text";
    statusDot = "bg-danger";
  }

  let timeString = "00h 00m 00s";
  if (countdownTarget) {
    const diff = Math.max(0, differenceInSeconds(new Date(countdownTarget), now));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    timeString = `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }

  return (
    <div className="col-span-1 lg:col-span-8 bg-surface border border-border rounded-panel p-8 shadow-2 relative overflow-hidden flex flex-col justify-between">
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end h-full">
        <div className="space-y-6 flex-1">
          <div className="flex items-center gap-3">
            <div aria-hidden className={`w-3 h-3 rounded-full ${statusDot}`} />
            <span className={`text-xs font-bold uppercase tracking-widest ${statusColor}`}>
              REGISTRATION {statusText}
            </span>
          </div>

          <div>
            <h2 className="text-3xl lg:text-4xl font-bold text-fg tracking-tight">
              {event.name}
            </h2>
            <p className="text-fg-muted mt-2 max-w-lg">
              {statusText === "LIVE" ? "Students are currently submitting their elective preferences." : "Portal is currently not accepting registrations."}
            </p>
          </div>
        </div>

        <div className="mt-8 md:mt-0 flex flex-col items-start md:items-end space-y-4">
          <div className="text-left md:text-right">
            <p className="text-xs font-bold text-fg-muted uppercase tracking-wider mb-2">Countdown</p>
            <div className="font-mono text-4xl lg:text-5xl font-bold text-fg">
              {timeString}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border w-full justify-start md:justify-end">
            <div className="text-left">
              <p className="text-2xs text-fg-muted uppercase font-bold tracking-wider mb-1">Opens</p>
              <p className="text-sm font-semibold text-fg">
                {event.openDate ? format(new Date(event.openDate), "dd MMM yyyy, hh:mm a") : "Not Set"}
              </p>
            </div>
            <div className="text-left">
              <p className="text-2xs text-fg-muted uppercase font-bold tracking-wider mb-1">Closes</p>
              <p className="text-sm font-semibold text-fg">
                {event.closeDate ? format(new Date(event.closeDate), "dd MMM yyyy, hh:mm a") : "Not Set"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
