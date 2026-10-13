"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LiveIndicator } from "@/components/ui/data-display";

const POLL_MS = 30_000;

/**
 * Keeps seat counts on the page current without reserving anything.
 *
 * - Listens to the same Supabase Realtime feed as the picker (UPDATEs on
 *   `electives`) and re-renders from the server when a shown elective changes.
 * - Falls back to re-fetching every 30s while the tab is visible, which also
 *   covers class quotas (not on the realtime feed) and environments without
 *   Realtime configured.
 *
 * Counts shown are informational; the registration transaction re-checks.
 */
export function LiveSeatRefresh({ electiveIds }: { electiveIds: string[] }) {
  const router = useRouter();
  const [state, setState] = React.useState<"live" | "connecting" | "idle">("connecting");
  const ids = React.useMemo(() => new Set(electiveIds), [electiveIds]);
  const pending = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshSoon = React.useCallback(() => {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      router.refresh();
    }, 800);
  }, [router]);

  React.useEffect(() => {
    let channel: { unsubscribe?: () => void } | null = null;
    let removed = false;
    import("@/lib/supabase").then(({ supabase, realtimeConfigured }) => {
      if (removed) return;
      if (!realtimeConfigured) return setState("idle");
      const ch = supabase
        .channel(`subject-explorer-${Math.random().toString(36).slice(2)}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "electives" }, (payload) => {
          const id = (payload.new as { id?: string } | null)?.id;
          if (id && ids.has(id)) refreshSoon();
        })
        .subscribe((status: string) => setState(status === "SUBSCRIBED" ? "live" : status === "CLOSED" ? "idle" : "connecting"));
      channel = ch;
      if (removed) supabase.removeChannel(ch);
    });
    return () => {
      removed = true;
      if (channel) import("@/lib/supabase").then(({ supabase }) => supabase.removeChannel(channel as never));
    };
  }, [ids, refreshSoon]);

  React.useEffect(() => {
    const tick = () => {
      if (!document.hidden) router.refresh();
    };
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => !document.hidden && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      if (pending.current) clearTimeout(pending.current);
    };
  }, [router]);

  return (
    <LiveIndicator
      state={state === "live" ? "live" : "idle"}
      label={state === "live" ? "Seats update live" : "Seats refresh every 30s"}
    />
  );
}
