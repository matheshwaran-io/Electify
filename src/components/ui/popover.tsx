"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { cn } from "@/lib/utils"

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger
export const PopoverClose = PopoverPrimitive.Close
export const PopoverTitle = PopoverPrimitive.Title
export const PopoverDescription = PopoverPrimitive.Description

export const overlaySurface = cn(
  "rounded-control border border-border bg-surface text-fg shadow-2 outline-none",
  "origin-(--transform-origin) transition-[opacity,transform] duration-150 ease-snappy",
  "data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0"
)

export function PopoverContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 8,
  ...props
}: PopoverPrimitive.Popup.Props & {
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} className="z-60">
        <PopoverPrimitive.Popup className={cn(overlaySurface, "p-1", className)} {...props}>
          {children}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}
