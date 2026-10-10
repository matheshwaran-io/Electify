"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"

/** Mount once near the root so neighbouring tooltips open instantly after the first. */
export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delay={350} closeDelay={80}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

type TooltipProps = {
  content: React.ReactNode
  /** Must be a single focusable element (button, link). */
  children: React.ReactElement
  side?: "top" | "bottom" | "left" | "right"
  shortcut?: React.ReactNode
  disabled?: boolean
}

export function Tooltip({ content, children, side = "top", shortcut, disabled }: TooltipProps) {
  if (disabled) return children
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} sideOffset={8} className="z-70">
          <TooltipPrimitive.Popup
            className={cn(
              "flex items-center gap-2 rounded-badge border border-border bg-surface px-2 py-1 text-xs font-medium text-fg shadow-2",
              "origin-(--transform-origin) transition-[opacity,transform] duration-150 ease-snappy",
              "data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0"
            )}
          >
            {content}
            {shortcut ? <span className="flex items-center gap-0.5 text-fg-subtle">{shortcut}</span> : null}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
