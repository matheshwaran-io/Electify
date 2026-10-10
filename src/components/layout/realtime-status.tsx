"use client"

import * as React from "react"
import { LiveIndicator, type LiveState } from "@/components/ui/data-display"
import { Tooltip } from "@/components/ui/tooltip"

/**
 * Connection signal for the shell. It never opens a channel of its own: it
 * reads the shared Supabase client's socket and the browser's online state.
 * Returns null when the current page has no realtime subscription.
 */
export function useRealtimeStatus(): LiveState | null {
  const [state, setState] = React.useState<LiveState | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (!navigator.onLine) return setState("offline")
      const { supabase } = await import("@/lib/supabase")
      if (cancelled) return
      const channels = supabase.getChannels()
      if (channels.length === 0) return setState(null)
      setState(supabase.realtime.isConnected() ? "live" : "connecting")
    }

    check()
    const timer = setInterval(check, 2500)
    const onNet = () => check()
    window.addEventListener("online", onNet)
    window.addEventListener("offline", onNet)
    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener("online", onNet)
      window.removeEventListener("offline", onNet)
    }
  }, [])

  return state
}

const help: Record<LiveState, string> = {
  live: "Live updates are connected.",
  connecting: "Reconnecting. Counts refresh automatically once the connection is back.",
  offline: "You're offline. Changes you make now won't reach the server.",
  idle: "Live updates are paused.",
}

export function RealtimeStatus({ compact }: { compact?: boolean }) {
  const state = useRealtimeStatus()
  if (!state) return null
  return (
    <Tooltip content={help[state]} side="right">
      <span tabIndex={0} role="status" aria-live="polite" className="inline-flex rounded-badge px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <LiveIndicator state={state} hideLabel={compact} />
      </span>
    </Tooltip>
  )
}
