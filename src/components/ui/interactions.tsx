"use client"

import * as React from "react"
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion"
import { spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * Pointer-tracked spotlight for `.spotlight` surfaces. Writes CSS variables
 * directly on the element, so moving the cursor never re-renders React.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = React.useRef<T>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia("(hover: hover)").matches) return
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      el.style.setProperty("--spot-x", `${e.clientX - r.left}px`)
      el.style.setProperty("--spot-y", `${e.clientY - r.top}px`)
    }
    el.addEventListener("pointermove", onMove)
    return () => el.removeEventListener("pointermove", onMove)
  }, [])
  return ref
}

/**
 * Magnetic wrapper for the one primary CTA on a screen: the control leans a
 * few pixels toward the cursor. Pointer devices only; static under reduced motion.
 */
export function Magnetic({
  children,
  strength = 0.18,
  className,
}: {
  children: React.ReactNode
  strength?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, spring.snappy)
  const sy = useSpring(y, spring.snappy)

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x: sx, y: sy }}
      className={cn("inline-flex", className)}
    >
      {children}
    </motion.div>
  )
}
