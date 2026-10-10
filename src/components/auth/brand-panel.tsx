"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { FileCheck2, Lock, RadioTower } from "lucide-react"
import { Wordmark } from "@/components/brand"

const POINTS = [
  { icon: RadioTower, title: "Live seat counts", body: "Every card updates the moment a seat is taken." },
  { icon: Lock, title: "No double booking", body: "Each confirmation locks its seats before it commits." },
  { icon: FileCheck2, title: "A receipt that stays put", body: "Your choices are saved as a snapshot the moment you confirm." },
]

/**
 * Login brand panel. A hairline grid brightens around the cursor (CSS
 * variables, no re-render) while one soft glow drifts across the top.
 */
export function BrandPanel() {
  const ref = React.useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  React.useEffect(() => {
    const el = ref.current
    if (!el || reduce || !window.matchMedia("(hover: hover)").matches) return
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty("--mx", `${e.clientX - r.left}px`)
      el.style.setProperty("--my", `${e.clientY - r.top}px`)
    }
    el.addEventListener("pointermove", onMove)
    return () => el.removeEventListener("pointermove", onMove)
  }, [reduce])

  const grid =
    "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)"

  return (
    <div ref={ref} className="relative isolate hidden overflow-hidden border-r border-border bg-surface-2/60 lg:flex lg:flex-col">
      {/* base grid */}
      <div aria-hidden className="absolute inset-0 -z-10 opacity-70" style={{ backgroundImage: grid, backgroundSize: "40px 40px" }} />
      {/* grid lit by the cursor */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 transition-opacity duration-500"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in oklab, var(--primary) 55%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--primary) 55%, transparent) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(240px circle at var(--mx, 30%) var(--my, 40%), black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(240px circle at var(--mx, 30%) var(--my, 40%), black, transparent 75%)",
        }}
      />
      {/* drifting glow */}
      <motion.div
        aria-hidden
        className="absolute -top-40 left-1/2 -z-10 h-[34rem] w-[34rem] rounded-full"
        style={{ x: "-50%", background: "radial-gradient(circle, color-mix(in oklab, var(--primary) 22%, transparent), transparent 65%)" }}
        animate={reduce ? undefined : { x: ["-58%", "-42%", "-58%"], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* fade the grid into the edges */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--bg)_95%)] opacity-80" />

      <div className="flex flex-1 flex-col justify-between p-10 xl:p-14">
        <Wordmark />

        <div className="max-w-md space-y-10">
          <div className="space-y-4 animate-enter">
            <h1 className="text-4xl font-semibold tracking-tight text-fg xl:text-5xl">
              Elective registration, without the scramble.
            </h1>
            <p className="text-base text-fg-muted">
              Pick your electives as seats fill in real time, then walk away with a receipt.
            </p>
          </div>

          <ul className="space-y-5">
            {POINTS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex gap-4 animate-enter" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-primary-text shadow-1">
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-fg">{title}</span>
                  <span className="mt-0.5 block text-sm text-fg-muted">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-fg-subtle">Sign-ins are rate limited and recorded in the audit log.</p>
      </div>
    </div>
  )
}
