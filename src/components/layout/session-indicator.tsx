"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarDays, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip } from "@/components/ui/tooltip"
import { getActiveWorkspaceStamp } from "@/app/actions/workspace"

export type ShellAcademicSession = {
  id: string
  label: string
  startYear?: number
  endYear?: number
  status: string
  /** Chosen automatically because it is the only one available. */
  implicit: boolean
  /** More than one session is available, so switching makes sense. */
  switchable: boolean
}

const SWITCH_HREF = "/faculty/session-select?choose=1"

/** Always-visible Academic Year label with a way to switch academic years. */
export function SessionIndicator({ session, collapsed, className }: { session: ShellAcademicSession; collapsed?: boolean; className?: string }) {
  const displayLabel = session.startYear && session.endYear
    ? `AY ${session.startYear}–${session.endYear}`
    : session.startYear
    ? `AY ${session.startYear}–${session.startYear + 1}`
    : session.label

  const body = (
    <>
      <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
      {!collapsed ? (
        <span className="min-w-0 flex-1">
          <span className="block text-2xs uppercase tracking-wider text-fg-subtle">Academic Year</span>
          <span className="block truncate text-sm font-medium tabular-nums text-fg">{displayLabel}</span>
        </span>
      ) : null}
      {!collapsed && session.switchable ? (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-fg-muted group-hover:text-fg">
          Switch <ChevronRight className="size-3.5" aria-hidden />
        </span>
      ) : null}
    </>
  )

  const classes = cn(
    "group flex items-center gap-2.5 rounded-control border border-border bg-surface-2/60 text-left transition-colors",
    collapsed ? "size-10 justify-center p-0" : "px-2.5 py-2",
    session.switchable && "hover:border-border-strong hover:bg-surface-2",
    className
  )

  const content = session.switchable ? (
    <Link href={SWITCH_HREF} className={classes} aria-label={`${displayLabel}. Switch Academic Year`}>
      {body}
    </Link>
  ) : (
    <div className={classes} aria-label={displayLabel} role="note">
      {body}
    </div>
  )

  return collapsed ? (
    <Tooltip content={displayLabel} side="right">
      {content}
    </Tooltip>
  ) : (
    content
  )
}

/**
 * Notices when the session or class was switched in another tab and refreshes
 * this one, so a page never keeps showing data from the previous session.
 */
export function useWorkspaceStaleCheck(stamp: string | null) {
  const router = useRouter()
  React.useEffect(() => {
    if (!stamp) return
    let checking = false
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return
      checking = true
      try {
        const current = await getActiveWorkspaceStamp()
        if (current && current !== stamp) {
          toast.info("Your academic session or class changed in another tab. Showing the current one.")
          router.refresh()
        }
      } catch {
        // offline: try again on the next focus
      } finally {
        checking = false
      }
    }
    window.addEventListener("focus", check)
    document.addEventListener("visibilitychange", check)
    return () => {
      window.removeEventListener("focus", check)
      document.removeEventListener("visibilitychange", check)
    }
  }, [stamp, router])
}
