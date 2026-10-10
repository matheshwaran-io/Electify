"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { useSpotlight } from "@/components/ui/interactions"

type CardProps = React.ComponentProps<"div"> & {
  /** Cursor-following border light on pointer devices. */
  spotlight?: boolean
  padded?: boolean
}

export function Card({ className, spotlight, padded, ...props }: CardProps) {
  const ref = useSpotlight<HTMLDivElement>()
  return (
    <div
      ref={spotlight ? ref : undefined}
      data-slot="card"
      className={cn(
        "rounded-card border border-border bg-surface text-fg shadow-1",
        spotlight && "spotlight",
        padded && "p-5",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)} {...props} />
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-sm font-semibold tracking-tight text-fg", className)} {...props} />
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 text-sm text-fg-muted", className)} {...props} />
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5", className)} {...props} />
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center gap-2 border-t border-border px-5 py-3.5", className)} {...props} />
}
