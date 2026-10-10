"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export const Sheet = DrawerPrimitive.Root
export const SheetTrigger = DrawerPrimitive.Trigger
export const SheetClose = DrawerPrimitive.Close

type Side = "right" | "left" | "bottom"

const popupBySide: Record<Side, string> = {
  right: cn(
    "inset-y-0 right-0 h-dvh w-[min(100vw,28rem)] border-l",
    "translate-x-(--drawer-swipe-movement-x) data-starting-style:translate-x-full data-ending-style:translate-x-full"
  ),
  left: cn(
    "inset-y-0 left-0 h-dvh w-[min(85vw,18rem)] border-r",
    "translate-x-(--drawer-swipe-movement-x) data-starting-style:-translate-x-full data-ending-style:-translate-x-full"
  ),
  bottom: cn(
    "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-card border-t pb-safe",
    "translate-y-(--drawer-swipe-movement-y) data-starting-style:translate-y-full data-ending-style:translate-y-full"
  ),
}

/** Side or bottom sheet with swipe-to-dismiss. */
export function SheetContent({
  side = "right",
  className,
  children,
  showClose = true,
  ...props
}: DrawerPrimitive.Popup.Props & { side?: Side; showClose?: boolean }) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop
        className="fixed inset-0 z-50 bg-overlay transition-opacity duration-300 ease-gentle data-starting-style:opacity-0 data-ending-style:opacity-0"
      />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 pointer-events-none">
        <DrawerPrimitive.Popup
          className={cn(
            "pointer-events-auto fixed flex flex-col border-border bg-surface text-fg shadow-3 outline-none",
            "transition-transform duration-300 ease-gentle data-swiping:duration-0",
            popupBySide[side],
            className
          )}
          {...props}
        >
          {side === "bottom" ? (
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong/40" />
          ) : null}
          {children}
          {showClose && (
            <DrawerPrimitive.Close
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-badge text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" />
            </DrawerPrimitive.Close>
          )}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-5 pb-3 pt-5 pr-12", className)} {...props} />
}

export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-5", className)} {...props} />
}

export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex gap-2 border-t border-border px-5 py-4", className)} {...props} />
}

export function SheetTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return <DrawerPrimitive.Title className={cn("text-lg font-semibold tracking-tight", className)} {...props} />
}

export function SheetDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return <DrawerPrimitive.Description className={cn("text-sm text-fg-muted", className)} {...props} />
}
