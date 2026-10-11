"use client"

import * as React from "react"
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion"
import { spring } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { SEAT_CHECK, SEAT_DOT, seatLayout } from "@/lib/seat-logo"

/**
 * The Electify mark (lib/seat-logo.ts), alive: a 10 × 10 grid of seats where
 * the taken seats spell the E and the logo's gold dot is the confirmed seat.
 *
 * It acts out the product: seats fill in as it appears, an open seat is taken
 * now and then (live counts), clicking an open seat claims it and redraws the
 * check (your receipt), and clicking a taken seat refuses with a shake (no
 * double booking). Clicking the gold dot replays it. Decorative: hidden from
 * assistive tech and never focusable. Under reduced motion it renders the
 * finished mark and only reacts to clicks.
 */

const PAD = 6 // room for seats to grow under the pointer
const VIEW = 100 + PAD * 2

// A stable pseudo-random stagger, so the fill looks like people arriving rather than a wipe.
const SEATS = seatLayout("fine").map((s) => ({ ...s, delay: 240 + s.col * 46 + s.row * 22 + ((s.col * 7 + s.row * 13) % 11) * 14 }))

const LAST_FILL = Math.max(...SEATS.filter((s) => s.taken).map((s) => s.delay))

export function SeatMark({ size = 236, interactive = true, className }: { size?: number; interactive?: boolean; className?: string }) {
  const reduce = useReducedMotion()
  const live = interactive && !reduce
  const seatRefs = React.useRef<(SVGRectElement | null)[]>([])
  const [run, setRun] = React.useState(0) // remounts the SVG to replay the entrance
  const [receipt, setReceipt] = React.useState(0) // redraws the check
  const [claimed, setClaimed] = React.useState<Set<number>>(() => new Set())

  // A gentle 3D lean toward the pointer.
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const rotateX = useSpring(rx, spring.gentle)
  const rotateY = useSpring(ry, spring.gentle)

  // Live counts: every couple of seconds someone takes an open seat, then lets it go.
  React.useEffect(() => {
    if (!live) return
    const timers: number[] = []
    const tick = window.setInterval(() => {
      if (document.hidden) return
      const open = SEATS.filter((s) => !s.taken && !claimed.has(s.i))
      const seat = open[Math.floor(Math.random() * open.length)]
      const el = seat && seatRefs.current[seat.i]
      if (!el) return
      el.classList.add("seat-live")
      timers.push(window.setTimeout(() => el.classList.remove("seat-live"), 1700))
    }, 2100)
    return () => {
      window.clearInterval(tick)
      timers.forEach(window.clearTimeout)
    }
  }, [live, claimed, run])

  // Seats near the pointer rise a little; written straight to the DOM, once per frame.
  const frame = React.useRef(0)
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!live) return
    const box = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - box.left) / box.width
    const py = (e.clientY - box.top) / box.height
    ry.set((px - 0.5) * 14)
    rx.set(-(py - 0.5) * 12)
    const vx = px * VIEW - PAD
    const vy = py * VIEW - PAD
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      for (const s of SEATS) {
        const el = seatRefs.current[s.i]
        if (!el) continue
        const lift = Math.max(0, 1 - Math.hypot(s.cx - vx, s.cy - vy) / 24)
        el.style.scale = lift > 0 ? String(1 + lift * 0.26) : ""
      }
    })
  }
  const onPointerLeave = () => {
    cancelAnimationFrame(frame.current)
    rx.set(0)
    ry.set(0)
    seatRefs.current.forEach((el) => el && (el.style.scale = ""))
  }

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!interactive) return
    const target = e.target as Element
    if (target.closest?.(".seat-dot")) {
      // The gold dot: replay the whole mark.
      setClaimed(new Set())
      setRun((n) => n + 1)
      return
    }
    const index = target.getAttribute?.("data-seat")
    if (index === null || index === undefined) return
    const seat = SEATS[Number(index)]
    const el = seatRefs.current[seat.i]
    if (seat.taken || claimed.has(seat.i)) {
      // Already taken: no double booking.
      el?.classList.remove("seat-nope")
      void el?.getBoundingClientRect()
      el?.classList.add("seat-nope")
      return
    }
    el?.classList.remove("seat-live")
    setClaimed((prev) => new Set(prev).add(seat.i))
    setReceipt((n) => n + 1)
  }

  React.useEffect(() => () => cancelAnimationFrame(frame.current), [])

  return (
    <div aria-hidden className={cn("seat-mark relative isolate shrink-0 [perspective:900px]", className)} style={{ width: size, height: size }}>
      {/* Warm light from the gold dot, like the sphere it replaces. */}
      <div className="pointer-events-none absolute left-[78.6%] top-1/2 -z-10 size-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sphere opacity-30 blur-3xl dark:opacity-20" />
      <motion.div className="size-full" style={live ? { rotateX, rotateY } : undefined}>
        <svg
          key={run}
          viewBox={`${-PAD} ${-PAD} ${VIEW} ${VIEW}`}
          className={cn("block size-full touch-manipulation", interactive && "cursor-pointer select-none")}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
        >
          {SEATS.map((s) => (
            <rect
              key={s.i}
              ref={(el) => {
                seatRefs.current[s.i] = el
              }}
              data-seat={s.i}
              x={s.x}
              y={s.y}
              width={s.size}
              height={s.size}
              rx={s.rx}
              className={cn("seat", s.taken ? "seat-taken" : claimed.has(s.i) ? "seat-claimed" : "seat-open")}
              style={s.taken && !reduce ? { animationDelay: `${s.delay}ms` } : undefined}
            />
          ))}
          <g className="seat-dot" style={reduce ? undefined : { animationDelay: `${LAST_FILL + 180}ms` }}>
            <circle cx={SEAT_DOT.cx} cy={SEAT_DOT.cy} r={SEAT_DOT.r} fill="var(--brand-gold)" />
            <path
              key={receipt}
              d={SEAT_CHECK.d}
              pathLength={1}
              className="seat-check"
              style={reduce ? undefined : { animationDelay: receipt === 0 ? `${LAST_FILL + 520}ms` : "60ms" }}
              fill="none"
              stroke="var(--brand-midnight)"
              strokeWidth={SEAT_CHECK.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </motion.div>
    </div>
  )
}
