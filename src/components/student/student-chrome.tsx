import * as React from "react"
import { cn } from "@/lib/utils"
import { Logo, LogoMark } from "@/components/brand"
import { ThemeToggle } from "@/components/theme-toggle"
import { SignOutButton } from "@/components/student/sign-out-button"

/** Header for every student screen. Calm, compact, always the same. */
export function StudentHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("sticky top-0 z-30 border-b border-border bg-canvas/85 backdrop-blur-md pt-safe", className)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        {/* The wordmark doesn't fit next to the page links on narrow phones. */}
        <LogoMark size="sm" className="sm:hidden" label="Electify" />
        <Logo size="sm" className="hidden sm:block" label="Electify" />
        <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
          {children}
          <ThemeToggle className="size-10 shrink-0" />
          <SignOutButton compactOnMobile />
        </div>
      </div>
    </header>
  )
}

type Tone = "neutral" | "warning" | "danger"

/** Full-screen status for blocked states: one message, one next step. */
export function StudentStatus({
  icon,
  tone = "neutral",
  title,
  children,
  next,
}: {
  icon: React.ReactNode
  tone?: Tone
  title: string
  children: React.ReactNode
  next?: React.ReactNode
}) {
  const tones: Record<Tone, string> = {
    neutral: "border-border bg-surface-2 text-fg-muted",
    warning: "border-warning/30 bg-warning/10 text-warning-text",
    danger: "border-danger/25 bg-danger/10 text-danger-text",
  }
  return (
    <div className="flex min-h-dvh flex-col">
      <StudentHeader />
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-md animate-enter">
          <span className={cn("inline-flex size-12 items-center justify-center rounded-control border [&_svg]:size-5", tones[tone])}>{icon}</span>
          <h1 className="mt-5 text-2xl font-normal tracking-tight text-fg">{title}</h1>
          <div className="mt-2 space-y-3 text-fg-muted">{children}</div>
          {next ? <div className="mt-6 rounded-control border border-border bg-surface p-4 text-sm text-fg-muted shadow-1">{next}</div> : null}
        </div>
      </main>
    </div>
  )
}
