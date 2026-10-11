"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogPortal = DialogPrimitive.Portal

export function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-overlay supports-backdrop-filter:backdrop-blur-[2px]",
        "transition-opacity duration-200 ease-gentle data-starting-style:opacity-0 data-ending-style:opacity-0",
        className
      )}
      {...props}
    />
  )
}

const sizes = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg", xl: "sm:max-w-2xl", "2xl": "sm:max-w-4xl" }

/**
 * Bottom sheet on phones, centred card from `sm` up. Enter/exit run on CSS
 * transitions driven by Base UI's starting/ending style attributes.
 */
export function DialogContent({
  className,
  children,
  size = "md",
  showClose = true,
  ...props
}: DialogPrimitive.Popup.Props & { size?: keyof typeof sizes; showClose?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        className={cn(
          "fixed z-50 flex max-h-[92dvh] flex-col overflow-hidden border border-border bg-surface text-fg shadow-3 outline-none",
          // phone: bottom sheet
          "inset-x-0 bottom-0 rounded-t-card pb-safe",
          "transition-[transform,opacity] duration-300 ease-gentle data-starting-style:translate-y-full data-ending-style:translate-y-full",
          // sm+: centred card
          "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-card sm:pb-0",
          "sm:duration-200 sm:data-starting-style:-translate-y-[48%] sm:data-starting-style:scale-[0.97] sm:data-starting-style:opacity-0",
          "sm:data-ending-style:-translate-y-[48%] sm:data-ending-style:scale-[0.97] sm:data-ending-style:opacity-0",
          sizes[size],
          className
        )}
        {...props}
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border-strong/40 sm:hidden" />
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-badge text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 px-5 pb-2 pt-5 pr-12 sm:px-6 sm:pt-6", className)} {...props} />
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3 sm:px-6", className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 border-t border-border bg-surface-2/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6",
        className
      )}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn("text-lg font-medium tracking-tight text-fg", className)} {...props} />
}

export function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return <DialogPrimitive.Description className={cn("text-sm text-fg-muted", className)} {...props} />
}
