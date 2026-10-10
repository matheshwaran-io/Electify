"use client"

import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { cn } from "@/lib/utils"
import { overlaySurface } from "@/components/ui/popover"

export const Menu = MenuPrimitive.Root
export const MenuTrigger = MenuPrimitive.Trigger
export const MenuGroup = MenuPrimitive.Group

export function MenuContent({
  className,
  children,
  side = "bottom",
  align = "start",
  sideOffset = 6,
  ...props
}: MenuPrimitive.Popup.Props & {
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  sideOffset?: number
}) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} className="z-60">
        <MenuPrimitive.Popup className={cn(overlaySurface, "min-w-48 p-1", className)} {...props}>
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

const itemClass = cn(
  "flex w-full cursor-default select-none items-center gap-2.5 rounded-badge px-2.5 py-2 text-sm text-fg outline-none",
  "data-highlighted:bg-surface-2 data-disabled:pointer-events-none data-disabled:opacity-50",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-subtle"
)

export function MenuItem({
  className,
  tone,
  ...props
}: MenuPrimitive.Item.Props & { tone?: "danger" }) {
  return (
    <MenuPrimitive.Item
      className={cn(itemClass, tone === "danger" && "text-danger-text [&_svg]:text-danger-text data-highlighted:bg-danger/10", className)}
      {...props}
    />
  )
}

export function MenuLinkItem({ className, ...props }: MenuPrimitive.LinkItem.Props) {
  return <MenuPrimitive.LinkItem className={cn(itemClass, className)} {...props} />
}

export function MenuLabel({ className, ...props }: MenuPrimitive.GroupLabel.Props) {
  return <MenuPrimitive.GroupLabel className={cn("px-2.5 pb-1 pt-2 text-xs font-medium text-fg-subtle", className)} {...props} />
}

export function MenuSeparator({ className }: { className?: string }) {
  return <div role="separator" aria-orientation="horizontal" className={cn("-mx-1 my-1 h-px bg-border", className)} />
}
