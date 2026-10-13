"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, ChevronsUpDown, LogOut, Search, Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { Tooltip } from "@/components/ui/tooltip"

export type AssignedSection = {
  id: string
  label: string
  batch: string
  programme: string
  /** Full class identity, e.g. "MCA F · 2025–2027". Distinguishes same-named classes. */
  classLabel?: string
  /** e.g. "Year 2 · Semester 3" in the selected academic session */
  stage?: string
}

export function sectionName(s: AssignedSection) {
  return s.classLabel ?? `Section ${s.label}`
}

function sectionDetail(s: AssignedSection) {
  return s.classLabel ? s.stage ?? s.programme : `${s.programme} · ${s.batch}`
}

/** Switches the active section through the existing API, then refreshes server data in place. */
export function useSwitchSection() {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [target, setTarget] = React.useState<string | null>(null)

  const switchTo = React.useCallback(
    async (section: AssignedSection) => {
      setTarget(section.id)
      try {
        const res = await fetch("/api/switch-section", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sectionId: section.id }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Couldn't switch section")
        }
        startTransition(() => router.refresh())
        toast.success(`Now viewing ${sectionName(section)}`, { description: sectionDetail(section) })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't switch section")
      } finally {
        setTarget(null)
      }
    },
    [router]
  )

  return { switchTo, pending: pending || target !== null, target }
}

export function SectionSwitcher({
  sections,
  activeId,
  collapsed,
}: {
  sections: AssignedSection[]
  activeId?: string
  collapsed?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const { switchTo, pending, target } = useSwitchSection()
  const active = sections.find((s) => s.id === activeId) ?? sections[0]

  const filtered = sections.filter((s) =>
    `${s.classLabel ?? ""} ${s.programme} ${s.batch} ${s.label}`.toLowerCase().includes(query.trim().toLowerCase())
  )

  if (!active) return null

  const trigger = (
    <PopoverTrigger
      aria-label={`Active class: ${sectionName(active)}, ${sectionDetail(active)}. Change class`}
      className={cn(
        "group flex w-full items-center gap-2.5 rounded-control border border-border bg-surface text-left shadow-1 transition-colors hover:border-border-strong",
        collapsed ? "size-10 justify-center p-0" : "px-2.5 py-2"
      )}
    >
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-badge bg-surface-2 font-mono text-xs font-medium text-fg">
        {pending ? <Spinner className="size-3.5" /> : active.label}
      </span>
      {!collapsed ? (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-fg">{sectionName(active)}</span>
            <span className="block truncate text-xs text-fg-muted">{sectionDetail(active)}</span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-fg-subtle" />
        </>
      ) : null}
    </PopoverTrigger>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {collapsed ? (
        <Tooltip content={`${sectionName(active)} · ${sectionDetail(active)}`} side="right">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
      <PopoverContent side={collapsed ? "right" : "bottom"} className="w-72 p-0">
        {sections.length > 4 ? (
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a class"
              aria-label="Find a class"
              className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
            />
          </div>
        ) : null}
        <div role="listbox" aria-label="Your classes in this academic session" className="max-h-72 overflow-y-auto p-1">
          {filtered.length === 0 ? <p className="px-3 py-6 text-center text-sm text-fg-muted">No classes match</p> : null}
          {filtered.map((s) => {
            const isActive = s.id === active.id
            return (
              <div
                key={s.id}
                className="group/item flex w-full items-center gap-2 rounded-control px-2.5 py-1.5 hover:bg-surface-2"
              >
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={pending}
                  onClick={() => {
                    setOpen(false)
                    if (!isActive) switchTo(s)
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
                >
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-badge border border-border font-mono text-xs font-medium">
                    {target === s.id ? <Spinner className="size-3.5" /> : s.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fg">{sectionName(s)}</span>
                    <span className="block truncate text-xs text-fg-muted">{sectionDetail(s)}</span>
                  </span>
                  {isActive ? <Check className="size-4 text-primary-text shrink-0" /> : null}
                </button>
                <button
                  type="button"
                  aria-label={`Exit Section ${s.label}`}
                  title={`Exit from Section ${s.label}`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm(`Exit from Section ${s.label}? You can re-claim it later from Manage sections.`)) {
                      try {
                        const { exitTutorSection } = await import("@/app/actions/tutor");
                        await exitTutorSection(s.id);
                        toast.success(`Exited Section ${s.label}`);
                        window.location.reload();
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Failed to exit section");
                      }
                    }
                  }}
                  className="opacity-0 group-hover/item:opacity-100 p-1.5 text-fg-muted hover:text-danger-text hover:bg-danger/10 rounded-control transition-all shrink-0"
                >
                  <LogOut className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="border-t border-border p-1">
          <Link
            href="/faculty/assign-sections"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <Settings2 className="size-4" /> Manage sections
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  )
}
