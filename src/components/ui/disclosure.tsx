import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Collapsible region. Animates height with CSS grid rows (no JS measuring),
 * and closed content is inert so it drops out of the tab order.
 */
export function Disclosure({ open, children, className }: { open: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-gentle motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className
      )}
      inert={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
