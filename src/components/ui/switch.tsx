"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-surface-3 p-0.5",
        "inset-shadow-[0_1px_2px_oklch(0%_0_0/0.12)] transition-colors duration-200 ease-snappy",
        "data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-4.5 rounded-full bg-surface shadow-1 ring-1 ring-border",
          "transition-transform duration-200 ease-snappy data-checked:translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  )
}
