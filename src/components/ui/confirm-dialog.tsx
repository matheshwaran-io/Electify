"use client"

import * as React from "react"
import { AlertTriangle, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ImpactRow = { label: string; value: React.ReactNode; tone?: "danger" | "warning" | "neutral" }

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  /** What this action will change. Real values only. */
  impact?: ImpactRow[]
  children?: React.ReactNode
  tone?: "danger" | "default"
  confirmLabel: string
  cancelLabel?: string
  /** Type-to-confirm guard for destructive operations. */
  requireText?: string
  /** Throw to keep the dialog open; the message is shown inline. */
  onConfirm: () => Promise<void> | void
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  impact,
  children,
  tone = "default",
  confirmLabel,
  cancelLabel = "Cancel",
  requireText,
  onConfirm,
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputId = React.useId()

  React.useEffect(() => {
    if (!open) {
      setTyped("")
      setError(null)
    }
  }, [open])

  const armed = !requireText || typed.trim() === requireText
  const Icon = tone === "danger" ? AlertTriangle : Info

  async function confirm() {
    if (!armed || pending) return
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Nothing was changed.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent size="md" showClose={!pending}>
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-control",
                tone === "danger" ? "bg-danger/10 text-danger-text" : "bg-primary/10 text-primary-text"
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <div className="space-y-1">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {impact && impact.length > 0 ? (
            <dl className="divide-y divide-border overflow-hidden rounded-control border border-border bg-surface-2/40">
              {impact.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 px-3.5 py-2.5 text-sm">
                  <dt className="text-fg-muted">{row.label}</dt>
                  <dd
                    className={cn(
                      "font-mono font-medium tabular-nums",
                      row.tone === "danger" ? "text-danger-text" : row.tone === "warning" ? "text-warning-text" : "text-fg"
                    )}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          {children}

          {requireText ? (
            <div className="space-y-2">
              <label htmlFor={inputId} className="text-sm text-fg-muted">
                Type <span className="font-mono font-medium text-fg">{requireText}</span> to confirm
              </label>
              <Input
                id={inputId}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => e.key === "Enter" && confirm()}
                className="font-mono"
              />
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-control border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger-text">
              {error}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "primary"}
            onClick={confirm}
            disabled={!armed}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
