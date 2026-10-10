"use client"

import * as React from "react"
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion"
import { duration, ease, spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

/* ─── AnimatedNumber ───────────────────────────────────────────────────── */

type AnimatedNumberProps = {
  value: number
  format?: (n: number) => string
  className?: string
  /** Use for counts that update live in place, so digits never shift layout. */
  tabular?: boolean
  /**
   * Count up from 0 after mount. Off by default: the server-rendered value is
   * always the real one, so a slow phone never shows a misleading 0.
   */
  fromZero?: boolean
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString("en-IN")

/**
 * Number that rolls to its new value. Writes text straight to the DOM through
 * a motion value, so ticking never re-renders React. Reduced motion: instant.
 */
export function AnimatedNumber({ value, format = defaultFormat, className, tabular, fromZero = false }: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const ref = React.useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(fromZero && !reduce ? 0 : value)

  React.useEffect(() => {
    if (reduce) {
      mv.set(value)
      return
    }
    const controls = animate(mv, value, { duration: duration.value, ease: ease.gentle })
    return () => controls.stop()
  }, [value, reduce, mv])

  React.useEffect(
    () =>
      mv.on("change", (v) => {
        if (ref.current) ref.current.textContent = format(v)
      }),
    [mv, format]
  )

  return (
    <span ref={ref} className={cn(tabular && "font-mono tabular-nums", className)}>
      {format(fromZero && !reduce ? 0 : value)}
    </span>
  )
}

/* ─── Occupancy ring (meter) ───────────────────────────────────────────── */

export type SeatState = "available" | "low" | "full"

export function seatState(available: number, max: number, lowThreshold = 10): SeatState {
  if (available <= 0) return "full"
  if (available < lowThreshold || (max > 0 && available / max <= 0.1)) return "low"
  return "available"
}

const ringTone: Record<SeatState, string> = {
  available: "text-primary",
  low: "text-warning",
  full: "text-danger",
}

/**
 * Seats-filled meter. Fill carries severity; the track is a lighter step of
 * the same hue. The arc sweeps with a spring when seats change.
 */
export function OccupancyRing({
  filled,
  total,
  state,
  size = 44,
  stroke = 4,
  children,
  className,
  label,
}: {
  filled: number
  total: number
  state?: SeatState
  size?: number
  stroke?: number
  children?: React.ReactNode
  className?: string
  /** Accessible description, e.g. "32 of 40 seats filled". */
  label?: string
}) {
  const reduce = useReducedMotion()
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = total > 0 ? Math.min(1, Math.max(0, filled / total)) : 0
  const target = useMotionValue(ratio)
  const smooth = useSpring(target, spring.gentle)
  const dash = useTransform(reduce ? target : smooth, (v) => c * (1 - v))

  React.useEffect(() => {
    target.set(ratio)
  }, [ratio, target])

  const tone = ringTone[state ?? (filled >= total && total > 0 ? "full" : "available")]

  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={filled}
      aria-label={label ?? `${filled} of ${total} filled`}
      className={cn("relative inline-flex shrink-0 items-center justify-center", tone, className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          style={{ strokeDashoffset: dash }}
        />
      </svg>
      {children ? <div className="absolute inset-0 flex items-center justify-center text-fg">{children}</div> : null}
    </div>
  )
}

/* ─── Linear meter ─────────────────────────────────────────────────────── */

export function Meter({
  value,
  max,
  tone = "primary",
  className,
  label,
}: {
  value: number
  max: number
  tone?: "primary" | "success" | "warning" | "danger" | "live"
  className?: string
  label: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const tones = {
    primary: "bg-primary/15 [&>div]:bg-primary",
    success: "bg-success/15 [&>div]:bg-success",
    warning: "bg-warning/20 [&>div]:bg-warning",
    danger: "bg-danger/15 [&>div]:bg-danger",
    live: "bg-live/15 [&>div]:bg-live",
  }
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", tones[tone], className)}
    >
      <div
        className="h-full origin-left rounded-full transition-transform duration-500 ease-gentle"
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  )
}

/* ─── Live indicator ───────────────────────────────────────────────────── */

export type LiveState = "live" | "connecting" | "offline" | "idle"

const liveMeta: Record<LiveState, { dot: string; label: string }> = {
  live: { dot: "bg-live", label: "Live" },
  connecting: { dot: "bg-warning", label: "Reconnecting" },
  offline: { dot: "bg-danger", label: "Offline" },
  idle: { dot: "bg-fg-subtle", label: "Paused" },
}

/** Connection / liveness signal. The halo only breathes while live. */
export function LiveIndicator({
  state,
  label,
  className,
  hideLabel,
}: {
  state: LiveState
  label?: string
  className?: string
  hideLabel?: boolean
}) {
  const meta = liveMeta[state]
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs font-medium text-fg-muted", className)}>
      <span className="relative flex size-2">
        {state === "live" ? <span className={cn("absolute inset-0 rounded-full animate-halo", meta.dot)} /> : null}
        <span className={cn("relative size-2 rounded-full", meta.dot)} />
      </span>
      <span className={cn(hideLabel && "sr-only")}>{label ?? meta.label}</span>
    </span>
  )
}

/* ─── Stat card ────────────────────────────────────────────────────────── */

export function StatCard({
  label,
  value,
  format,
  suffix,
  hint,
  icon,
  meter,
  className,
}: {
  label: string
  value: number | string
  format?: (n: number) => string
  suffix?: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ReactNode
  meter?: { value: number; max: number; tone?: "primary" | "success" | "warning" | "danger" | "live" }
  className?: string
}) {
  return (
    <div className={cn("flex flex-col rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">{label}</p>
        {icon ? <span className="text-fg-subtle [&_svg]:size-4">{icon}</span> : null}
      </div>
      <p className="mt-3 flex items-baseline gap-1 text-3xl font-semibold tracking-tight text-fg">
        {typeof value === "number" ? <AnimatedNumber value={value} format={format} /> : value}
        {suffix ? <span className="text-base font-medium text-fg-muted">{suffix}</span> : null}
      </p>
      {meter ? <Meter className="mt-4" value={meter.value} max={meter.max} tone={meter.tone} label={label} /> : null}
      {hint ? <p className="mt-2 text-xs text-fg-muted">{hint}</p> : null}
    </div>
  )
}
