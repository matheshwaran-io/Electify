"use client";

import * as React from "react";

/**
 * Returns a `now()` that follows the server's clock instead of the device's.
 * The offset is measured once at hydration from the server-rendered timestamp.
 * Network and render latency can only make it read slightly early, so a
 * countdown built on it finishes on time or a moment late, never before the
 * server agrees the window is open.
 */
export function useServerClock(serverNow: number) {
  const [offset] = React.useState(() => serverNow - Date.now());
  return React.useCallback(() => Date.now() + offset, [offset]);
}

/** Re-renders every `intervalMs` while `active`; pauses when the tab is hidden. */
export function useTicker(active: boolean, intervalMs = 1000) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      stop();
      // A page opened in a background tab starts paused; it ticks once shown.
      if (document.hidden) return;
      setTick((t) => t + 1);
      id = setInterval(() => setTick((t) => t + 1), intervalMs);
    };
    const stop = () => id && clearInterval(id);
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active, intervalMs]);
}
