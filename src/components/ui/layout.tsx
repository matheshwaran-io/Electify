import * as React from "react"
import { cn } from "@/lib/utils"
import { cleanDisplayName } from "@/lib/format"

/** Page title block: one clear message, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn("flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1.5">
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
        <h1 className="text-2xl font-light tracking-display text-fg sm:text-3xl">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-fg-muted sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}

/** Section within a page: small heading + optional action, no card chrome. */
export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {title || action ? (
        <div className="flex items-end justify-between gap-4">
          <div>
            {title ? <h2 className="text-base font-medium tracking-tight text-fg">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      className={cn(vertical ? "h-full w-px" : "h-px w-full", "shrink-0 bg-border", className)}
    />
  )
}

/** Neutral initials avatar. Identity, not state, so no colour. */
export function Avatar({ name, className, size = "md" }: { name: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const clean = cleanDisplayName(name) || name;
  const initials = clean
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
  const sizes = { sm: "size-7 text-2xs", md: "size-8 text-xs", lg: "size-10 text-sm" }
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full border border-border bg-surface-2 font-medium text-fg-muted",
        sizes[size],
        className
      )}
    >
      {initials || "?"}
    </span>
  )
}

/** Key/value list for detail views. */
export function DescriptionList({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-xs text-fg-muted">{it.label}</dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}
