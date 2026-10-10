"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

export const Tabs = TabsPrimitive.Root

type Variant = "underline" | "pill"
const VariantContext = React.createContext<Variant>("underline")

/**
 * Tab list with a sliding indicator. `pill` is a segmented control;
 * `underline` is page-level navigation within a view.
 */
export function TabsList({
  className,
  children,
  variant = "underline",
  ...props
}: TabsPrimitive.List.Props & { variant?: Variant }) {
  return (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.List
        className={cn(
          "relative flex items-center",
          variant === "underline"
            ? "gap-1 border-b border-border"
            : "gap-0.5 rounded-control border border-border bg-surface-2 p-0.5",
          "overflow-x-auto scrollbar-none",
          className
        )}
        {...props}
      >
        {children}
        <TabsPrimitive.Indicator
          className={cn(
            "absolute left-0 top-0 transition-[translate,width,height] duration-300 ease-gentle",
            "translate-x-(--active-tab-left) w-(--active-tab-width)",
            variant === "underline"
              ? "translate-y-[calc(var(--active-tab-top)+var(--active-tab-height)-2px)] h-0.5 rounded-full bg-primary"
              : "-z-0 translate-y-(--active-tab-top) h-(--active-tab-height) rounded-badge bg-surface shadow-1 ring-1 ring-border"
          )}
        />
      </TabsPrimitive.List>
    </VariantContext.Provider>
  )
}

export function TabsTrigger({ className, children, ...props }: TabsPrimitive.Tab.Props) {
  const variant = React.useContext(VariantContext)
  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative z-10 inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium outline-none",
        "text-fg-muted transition-colors duration-150 hover:text-fg data-active:text-fg data-disabled:opacity-40",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        variant === "underline" ? "h-10 px-3" : "h-8 rounded-badge px-3",
        className
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Tab>
  )
}

export function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel className={cn("outline-none", className)} {...props} />
}
