"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

export function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-tight border border-border-strong bg-surface",
        "transition-[background-color,border-color,transform] duration-150 ease-snappy active:scale-90",
        "data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        // expand the hit area to 44px on touch without changing layout
        "before:absolute before:-inset-3 before:content-[''] pointer-fine:before:-inset-1.5",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        keepMounted
        className="flex text-primary-fg transition-[opacity,transform] duration-150 ease-snappy data-unchecked:scale-50 data-unchecked:opacity-0"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}
