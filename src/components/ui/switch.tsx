"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border/70 bg-surface-3 p-0.5",
        "transition-colors duration-200 ease-snappy",
        "data-checked:bg-success data-checked:border-success/40 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-1 ring-black/10",
          "transition-transform duration-200 ease-snappy data-checked:translate-x-5",
          "dark:bg-white dark:ring-black/20"
        )}
      />
    </SwitchPrimitive.Root>
  )
}
