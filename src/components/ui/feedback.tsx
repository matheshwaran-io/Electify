import * as React from "react"
import { AlertCircle, RotateCw, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("skeleton rounded-badge", className)} {...props} />
}

type StateProps = {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({ icon, title, description, action, className, compact }: StateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {icon ? (
        <div className="mb-4 inline-flex size-11 items-center justify-center rounded-control border border-border bg-surface-2 text-fg-subtle [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title = "This didn't load",
  description = "Check your connection and try again.",
  onRetry,
  className,
  offline,
}: Partial<StateProps> & { onRetry?: () => void; offline?: boolean }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-4 inline-flex size-11 items-center justify-center rounded-control border border-danger/25 bg-danger/10 text-danger-text">
        {offline ? <WifiOff className="size-5" /> : <AlertCircle className="size-5" />}
      </div>
      <p className="text-sm font-semibold text-fg">{offline ? "You're offline" : title}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-control border border-border bg-surface px-3.5 text-sm font-medium text-fg shadow-1 transition-colors hover:bg-surface-2"
        >
          <RotateCw className="size-4" /> Try again
        </button>
      ) : null}
    </div>
  )
}

/** Inline callout for contextual notices. */
export function Callout({
  tone = "neutral",
  icon,
  title,
  children,
  className,
  action,
}: {
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "live"
  icon?: React.ReactNode
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  const tones = {
    neutral: "border-border bg-surface-2/60 text-fg [&_[data-icon]]:text-fg-subtle",
    primary: "border-primary/25 bg-primary/8 [&_[data-icon]]:text-primary-text",
    success: "border-success/25 bg-success/8 [&_[data-icon]]:text-success-text",
    warning: "border-warning/30 bg-warning/10 [&_[data-icon]]:text-warning-text",
    danger: "border-danger/25 bg-danger/8 [&_[data-icon]]:text-danger-text",
    live: "border-live/30 bg-live/8 [&_[data-icon]]:text-live-text",
  }
  return (
    <div className={cn("flex items-start gap-3 rounded-control border px-4 py-3 text-sm", tones[tone], className)}>
      {icon ? (
        <span data-icon className="mt-0.5 shrink-0 [&_svg]:size-4">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium text-fg">{title}</p> : null}
        {children ? <div className={cn("text-fg-muted", title && "mt-0.5")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
