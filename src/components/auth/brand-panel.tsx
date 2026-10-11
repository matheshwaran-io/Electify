"use client"

import * as React from "react"
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion"
import { FileCheck2, Lock, RadioTower } from "lucide-react"
import { spring } from "@/lib/motion"
import { Sphere } from "@/components/sphere"

const POINTS = [
  { icon: RadioTower, title: "Live seat counts", body: "Every card updates the moment a seat is taken." },
  { icon: Lock, title: "No double booking", body: "Each confirmation locks its seats before it commits." },
  { icon: FileCheck2, title: "A receipt that stays put", body: "Your choices are saved the moment you confirm." },
]

/** Sphere that leans a few pixels toward the cursor (pointer devices only). */
function DriftingSphere({ size }: { size: number }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, spring.gentle)
  const sy = useSpring(y, spring.gentle)

  React.useEffect(() => {
    if (reduce || !window.matchMedia("(hover: hover)").matches) return
    const onMove = (e: PointerEvent) => {
      x.set((e.clientX / window.innerWidth - 0.5) * 18)
      y.set((e.clientY / window.innerHeight - 0.5) * 18)
    }
    window.addEventListener("pointermove", onMove)
    return () => window.removeEventListener("pointermove", onMove)
  }, [reduce, x, y])

  return (
    <motion.div style={{ x: sx, y: sy }}>
      <Sphere size={size} />
    </motion.div>
  )
}

/** Editorial hero for the sign-in screen. Compact on phones, full on desktop. */
export function BrandPanel() {
  return (
    <section aria-label="About Electify" className="flex flex-col">
      {/* Phone + tablet: compact */}
      <div className="flex items-end justify-between gap-6 lg:hidden">
        <h1 className="max-w-[16ch] text-4xl font-light tracking-display text-fg animate-enter">
          Elective registration, without the scramble.
        </h1>
        <div className="-mr-2 mb-1 shrink-0 animate-enter [animation-delay:120ms]">
          <Sphere size={84} halo={false} />
        </div>
      </div>

      {/* Desktop: editorial */}
      <div className="hidden lg:flex lg:flex-col">
        <h1 className="max-w-[17ch] text-5xl font-light tracking-display text-fg animate-enter xl:text-6xl">
          Elective registration, without the scramble.
        </h1>
        <p className="mt-6 max-w-md text-xl text-fg-muted animate-enter [animation-delay:80ms]">
          Pick your electives as seats fill in real time, then walk away with a receipt.
        </p>

        <div className="mt-14 flex items-center gap-12 animate-enter [animation-delay:160ms]">
          <DriftingSphere size={220} />
          <ul className="flex-1 divide-y divide-border border-y border-border">
            {POINTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 py-4">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-fg">
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
      </div>
    </section>
  )
}
