"use client";

import * as React from "react";
import { pingStudentPresence, leaveStudentPresence } from "@/app/actions/presence";
import type { StudentPresenceStage } from "@/lib/student-presence";

interface StudentPresencePingProps {
  eventId: string;
  stage: StudentPresenceStage;
  intervalMs?: number;
}

/**
 * Lightweight client component that reports student presence to the server.
 * Enables live surveillance of active students before the event (COUNTDOWN)
 * and during the event (IN_SELECTION / SUBMITTED).
 */
export function StudentPresencePing({
  eventId,
  stage,
  intervalMs = 10_000,
}: StudentPresencePingProps) {
  React.useEffect(() => {
    if (!eventId) return;

    let active = true;

    // Send immediate ping
    pingStudentPresence(eventId, stage).catch(() => {});

    // Periodic heartbeat
    const timer = setInterval(() => {
      if (!active) return;
      if (typeof document !== "undefined" && document.hidden) return; // Pause when tab is hidden
      pingStudentPresence(eventId, stage).catch(() => {});
    }, intervalMs);

    const onVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden && active) {
        pingStudentPresence(eventId, stage).catch(() => {});
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      active = false;
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      leaveStudentPresence(eventId).catch(() => {});
    };
  }, [eventId, stage, intervalMs]);

  return null;
}
