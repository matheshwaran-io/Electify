import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The product sphere: a soft orb in the logo's Scholar Gold, Electify's
 * signature visual (login, countdown). Decorative only, never a control.
 * The colour field drifts slowly; static under reduced motion.
 */
export function Sphere({
  size = 220,
  className,
  children,
  halo = true,
  animated = true,
}: {
  size?: number | string
  className?: string
  children?: React.ReactNode
  halo?: boolean
  animated?: boolean
}) {
  const dim = typeof size === "number" ? `${size}px` : size
  return (
    <div aria-hidden={children ? undefined : true} className={cn("relative isolate shrink-0", className)} style={{ width: dim, height: dim }}>
      {halo ? <div className="absolute inset-[8%] -z-10 rounded-full bg-sphere opacity-45 blur-3xl" /> : null}
      <div className="absolute inset-0 overflow-hidden rounded-full shadow-[inset_0_0_0_0.5px_oklch(0%_0_0/0.1)]">
        <div className={cn("absolute -inset-[12%] bg-sphere", animated && "animate-sphere")} />
        {/* glass highlight + depth */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_24%,oklch(100%_0_0/0.55),transparent_38%)]" />
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_60%_110%,oklch(0%_0_0/0.22),transparent_55%)]" />
      </div>
      {children ? <div className="absolute inset-0 flex items-center justify-center">{children}</div> : null}
    </div>
  )
}
