"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { CornerDownLeft, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Kbd } from "@/components/ui/kbd"

export type Command = {
  id: string
  label: string
  group: string
  icon?: React.ReactNode
  hint?: string
  keywords?: string[]
  shortcut?: string[]
  perform: () => void
}

/** Subsequence match with a bonus for word starts and contiguous runs. */
function score(text: string, query: string) {
  if (!query) return 1
  const t = text.toLowerCase()
  const q = query.toLowerCase()
  if (t.includes(q)) return 100 - t.indexOf(q)
  let ti = 0
  let s = 0
  let run = 0
  for (const ch of q) {
    const found = t.indexOf(ch, ti)
    if (found === -1) return 0
    run = found === ti ? run + 1 : 0
    s += 1 + run + (found === 0 || t[found - 1] === " " ? 3 : 0)
    ti = found + 1
  }
  return s
}

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  placeholder = "Search or jump to",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: Command[]
  placeholder?: string
}) {
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listRef = React.useRef<HTMLDivElement>(null)
  const listId = React.useId()

  React.useEffect(() => {
    if (open) {
      setQuery("")
      setActive(0)
    }
  }, [open])

  const results = React.useMemo(() => {
    return commands
      .map((c) => ({ c, s: Math.max(score(c.label, query), ...(c.keywords ?? []).map((k) => score(k, query) * 0.8)) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => (query ? b.s - a.s : 0))
      .map((r) => r.c)
  }, [commands, query])

  const groups = React.useMemo(() => {
    const map = new Map<string, Command[]>()
    for (const c of results) map.set(c.group, [...(map.get(c.group) ?? []), c])
    return [...map.entries()]
  }, [results])

  React.useEffect(() => setActive(0), [query])
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const run = (c?: Command) => {
    if (!c) return
    onOpenChange(false)
    // let the dialog start closing before navigating
    requestAnimationFrame(() => c.perform())
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      run(results[active])
    }
  }

  let index = -1
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <DialogPrimitive.Popup
          aria-label="Command palette"
          className={cn(
            "fixed left-1/2 top-[12vh] z-50 flex max-h-[min(70vh,32rem)] w-[min(40rem,calc(100%-1.5rem))] -translate-x-1/2 flex-col overflow-hidden",
            "rounded-card border border-border bg-surface text-fg shadow-3 outline-none",
            "transition-[opacity,transform] duration-200 ease-snappy data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0"
          )}
        >
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-fg-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={results[active] ? `${listId}-${results[active].id}` : undefined}
              className="h-13 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle sm:text-sm"
            />
            <Kbd>esc</Kbd>
          </div>

          <div ref={listRef} id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
            {results.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-fg-muted">No results for &ldquo;{query}&rdquo;</p>
            ) : (
              groups.map(([group, items]) => (
                <div key={group} role="group" aria-label={group} className="mb-1 last:mb-0">
                  <p className="px-3 pb-1.5 pt-2 text-xs font-medium text-fg-subtle">{group}</p>
                  {items.map((c) => {
                    index += 1
                    const i = index
                    const isActive = i === active
                    return (
                      <div
                        key={c.id}
                        id={`${listId}-${c.id}`}
                        role="option"
                        aria-selected={isActive}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(c)}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2.5 text-sm",
                          isActive ? "bg-surface-2 text-fg" : "text-fg-muted"
                        )}
                      >
                        <span className={cn("flex size-4 shrink-0 items-center justify-center [&_svg]:size-4", isActive ? "text-fg" : "text-fg-subtle")}>
                          {c.icon}
                        </span>
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.hint ? <span className="truncate text-xs text-fg-subtle">{c.hint}</span> : null}
                        {c.shortcut ? (
                          <span className="hidden items-center gap-1 sm:flex">
                            {c.shortcut.map((k) => (
                              <Kbd key={k}>{k}</Kbd>
                            ))}
                          </span>
                        ) : isActive ? (
                          <CornerDownLeft className="size-3.5 text-fg-subtle" />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          <div className="hidden items-center gap-4 border-t border-border px-4 py-2.5 text-xs text-fg-subtle sm:flex">
            <span className="flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="flex items-center gap-1.5">
              <Kbd>↵</Kbd> open
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <Kbd>?</Kbd> shortcuts
            </span>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
