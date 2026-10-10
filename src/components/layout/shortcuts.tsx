"use client"

import * as React from "react"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import type { NavGroup } from "@/components/layout/nav-config"

const isTyping = (el: EventTarget | null) => {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "combobox"
}

/**
 * Global keyboard layer: mod+K palette, ? cheat sheet, [ sidebar,
 * and Linear-style "g then key" navigation.
 */
export function useGlobalShortcuts({
  onPalette,
  onHelp,
  onToggleSidebar,
  onGo,
  goKeys,
}: {
  onPalette: () => void
  onHelp: () => void
  onToggleSidebar: () => void
  onGo: (href: string) => void
  goKeys: Record<string, string>
}) {
  const pendingG = React.useRef<number | null>(null)

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        onPalette()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (document.querySelector("[role=dialog][data-open]")) return

      if (pendingG.current !== null) {
        window.clearTimeout(pendingG.current)
        pendingG.current = null
        const href = goKeys[e.key.toLowerCase()]
        if (href) {
          e.preventDefault()
          onGo(href)
        }
        return
      }
      if (e.key === "g") {
        pendingG.current = window.setTimeout(() => (pendingG.current = null), 900)
        return
      }
      if (e.key === "?") {
        e.preventDefault()
        onHelp()
      } else if (e.key === "[") {
        e.preventDefault()
        onToggleSidebar()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onPalette, onHelp, onToggleSidebar, onGo, goKeys])
}

export function ShortcutsDialog({ open, onOpenChange, groups }: { open: boolean; onOpenChange: (o: boolean) => void; groups: NavGroup[] }) {
  const general = [
    { keys: ["⌘", "K"], label: "Search and jump anywhere" },
    { keys: ["?"], label: "Show this list" },
    { keys: ["["], label: "Collapse or expand the sidebar" },
    { keys: ["esc"], label: "Close a dialog or menu" },
  ]
  const go = groups.flatMap((g) => g.items).filter((i) => i.key)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Ctrl works wherever ⌘ is shown.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-6 pb-6 sm:grid-cols-2">
          <ShortcutList title="General" rows={general} />
          <ShortcutList title="Go to" rows={go.map((i) => ({ keys: ["G", i.key!.toUpperCase()], label: i.label }))} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function ShortcutList({ title, rows }: { title: string; rows: { keys: string[]; label: string }[] }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-fg-subtle">{title}</p>
      <ul className="divide-y divide-border rounded-control border border-border">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-fg-muted">{r.label}</span>
            <span className="flex gap-1">
              {r.keys.map((k) => (
                <Kbd key={k}>{k}</Kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
