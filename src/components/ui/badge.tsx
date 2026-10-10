import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge border font-medium [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "border-border bg-surface-2 text-fg-muted",
        primary: "border-primary/25 bg-primary/10 text-primary-text",
        success: "border-success/25 bg-success/10 text-success-text",
        warning: "border-warning/30 bg-warning/10 text-warning-text",
        danger: "border-danger/25 bg-danger/10 text-danger-text",
        live: "border-live/30 bg-live/10 text-live-text",
        outline: "border-border-strong bg-transparent text-fg-muted",
      },
      size: {
        sm: "h-5 px-1.5 text-2xs",
        md: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  }
)

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>

export function Badge({
  className,
  tone,
  size,
  dot,
  children,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

export { badgeVariants }
