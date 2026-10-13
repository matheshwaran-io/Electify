"use client"

import { useSearchParams } from "next/navigation"
import { Info } from "lucide-react"

/** Shown on /login?expired=1 after a page found the session revoked. */
export function SessionEndedNotice() {
  const params = useSearchParams()
  if (params.get("expired") !== "1") return null
  return (
    <p role="status" className="mb-4 flex items-start gap-2 rounded-control border border-border bg-surface p-3 text-sm text-fg-muted">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>Your session ended. This happens when you sign in on another device or your account changes. Sign in again to continue.</span>
    </p>
  )
}
