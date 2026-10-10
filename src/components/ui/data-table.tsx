"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronDown, Columns3, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { transition } from "@/lib/motion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { EmptyState, Skeleton } from "@/components/ui/feedback"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export type Column<T> = {
  id: string
  header: string
  cell: (row: T) => React.ReactNode
  /** Enables sorting on this column. */
  sortValue?: (row: T) => string | number | null | undefined
  /** Text that the search box matches against. */
  searchValue?: (row: T) => string | null | undefined
  align?: "left" | "right"
  className?: string
  /** Can the user hide it from the column menu? Default true. */
  hideable?: boolean
  defaultHidden?: boolean
  /** Placement in the < md card view. */
  mobile?: "title" | "subtitle" | "meta" | "hidden"
}

export type FilterDef<T> = {
  id: string
  label: string
  options: { value: string; label: string }[]
  predicate: (row: T, value: string) => boolean
}

type SortState = { id: string; dir: "asc" | "desc" } | null

type DataTableProps<T> = {
  data: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  searchPlaceholder?: string
  filters?: FilterDef<T>[]
  pageSize?: number
  initialSort?: SortState
  selectable?: boolean
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode
  onRowClick?: (row: T) => void
  renderExpanded?: (row: T) => React.ReactNode
  toolbar?: React.ReactNode
  empty?: React.ReactNode
  loading?: boolean
  caption: string
  /** Sync search, filters, sort and page to the URL under this prefix. */
  urlKey?: string
  rowClassName?: (row: T) => string | undefined
  className?: string
}

function useTableState(urlKey: string | undefined, filterIds: string[], initialSort: SortState) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const k = (name: string) => (urlKey ? `${urlKey}_${name}` : name)

  const read = React.useCallback(() => {
    if (!urlKey) return null
    const sortRaw = params.get(k("sort"))
    const [sid, sdir] = sortRaw?.split(".") ?? []
    return {
      query: params.get(k("q")) ?? "",
      page: Math.max(1, Number(params.get(k("page")) ?? 1) || 1),
      sort: sid ? ({ id: sid, dir: sdir === "desc" ? "desc" : "asc" } as SortState) : initialSort,
      filters: Object.fromEntries(filterIds.map((id) => [id, params.get(k(`f_${id}`))]).filter(([, v]) => v)) as Record<string, string>,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, urlKey])

  const initial = read()
  const [query, setQuery] = React.useState(initial?.query ?? "")
  const [page, setPage] = React.useState(initial?.page ?? 1)
  const [sort, setSort] = React.useState<SortState>(initial?.sort ?? initialSort)
  const [filters, setFilters] = React.useState<Record<string, string>>(initial?.filters ?? {})

  React.useEffect(() => {
    if (!urlKey) return
    const next = new URLSearchParams(params.toString())
    const set = (name: string, v: string | null) => (v ? next.set(k(name), v) : next.delete(k(name)))
    set("q", query || null)
    set("page", page > 1 ? String(page) : null)
    set("sort", sort ? `${sort.id}.${sort.dir}` : null)
    filterIds.forEach((id) => set(`f_${id}`, filters[id] ?? null))
    const qs = next.toString()
    if (qs !== params.toString()) router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page, sort, filters, urlKey])

  return { query, setQuery, page, setPage, sort, setSort, filters, setFilters }
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Search",
  filters = [],
  pageSize = 20,
  initialSort = null,
  selectable,
  bulkActions,
  onRowClick,
  renderExpanded,
  toolbar,
  empty,
  loading,
  caption,
  urlKey,
  rowClassName,
  className,
}: DataTableProps<T>) {
  const { query, setQuery, page, setPage, sort, setSort, filters: active, setFilters } = useTableState(
    urlKey,
    filters.map((f) => f.id),
    initialSort
  )
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)))
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const deferredQuery = React.useDeferredValue(query)

  const visible = columns.filter((c) => !hidden.has(c.id))

  const rows = React.useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    let out = data
    if (q) {
      out = out.filter((row) =>
        columns.some((c) => (c.searchValue?.(row) ?? "").toString().toLowerCase().includes(q))
      )
    }
    for (const f of filters) {
      const v = active[f.id]
      if (v) out = out.filter((row) => f.predicate(row, v))
    }
    if (sort) {
      const col = columns.find((c) => c.id === sort.id)
      if (col?.sortValue) {
        const dir = sort.dir === "asc" ? 1 : -1
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a)
          const bv = col.sortValue!(b)
          if (av == null) return 1
          if (bv == null) return -1
          return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true })) * dir
        })
      }
    }
    return out
  }, [data, columns, filters, active, sort, deferredQuery])

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const pageRows = rows.slice((current - 1) * pageSize, current * pageSize)
  const selectedRows = data.filter((r) => selected.has(getRowId(r)))
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(getRowId(r)))
  const someOnPage = pageRows.some((r) => selected.has(getRowId(r)))

  React.useEffect(() => {
    // Drop selections for rows that no longer exist (after a delete, refresh).
    setSelected((prev) => {
      const ids = new Set(data.map(getRowId))
      const next = new Set([...prev].filter((id) => ids.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [data, getRowId])

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return
    setSort((s) => (s?.id !== col.id ? { id: col.id, dir: "asc" } : s.dir === "asc" ? { id: col.id, dir: "desc" } : null))
  }
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      pageRows.forEach((r) => (allOnPage ? next.delete(getRowId(r)) : next.add(getRowId(r))))
      return next
    })
  const clear = () => setSelected(new Set())
  const activeFilterCount = Object.values(active).filter(Boolean).length
  const interactiveRow = Boolean(onRowClick || renderExpanded)

  const handleRow = (row: T) => {
    if (renderExpanded) setExpanded((e) => (e === getRowId(row) ? null : getRowId(row)))
    onRowClick?.(row)
  }

  const titleCol = columns.find((c) => c.mobile === "title") ?? columns[0]
  const subtitleCol = columns.find((c) => c.mobile === "subtitle")
  const metaCols = visible.filter((c) => c !== titleCol && c !== subtitleCol && c.mobile !== "hidden")

  return (
    <div className={cn("overflow-hidden rounded-card border border-border bg-surface shadow-1", className)}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            leading={<Search />}
            trailing={
              query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="inline-flex size-8 items-center justify-center rounded-badge text-fg-subtle hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null
            }
            inputSize="sm"
            className="h-9"
          />
        </div>

        {filters.length > 0 ? (
          <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 scrollbar-none">
            {filters.map((f) => (
              <FilterChip
                key={f.id}
                def={f}
                value={active[f.id]}
                onChange={(v) => {
                  setFilters((prev) => ({ ...prev, [f.id]: v ?? "" }))
                  setPage(1)
                }}
              />
            ))}
            {activeFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => setFilters({})}
                className="h-8 shrink-0 rounded-badge px-2 text-xs font-medium text-fg-muted hover:text-fg"
              >
                Reset
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2 sm:ml-auto">
          {toolbar}
          <ColumnMenu columns={columns} hidden={hidden} setHidden={setHidden} />
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence initial={false}>
        {selectable && selected.size > 0 ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition.fade}
            className="overflow-hidden border-b border-border bg-primary/6"
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <span className="text-sm font-medium text-fg">
                <span className="font-mono tabular-nums">{selected.size}</span> selected
              </span>
              <button type="button" onClick={clear} className="text-sm text-fg-muted hover:text-fg">
                Clear
              </button>
              <div className="ml-auto flex items-center gap-2">{bulkActions?.(selectedRows, clear)}</div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Desktop table */}
      <div className="hidden max-h-[calc(100dvh-16rem)] overflow-auto md:block scrollbar-thin">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr>
              {selectable ? (
                <th scope="col" className="w-10 border-b border-border px-4 py-2.5">
                  <Checkbox
                    aria-label="Select all rows on this page"
                    checked={allOnPage}
                    indeterminate={!allOnPage && someOnPage}
                    onCheckedChange={togglePage}
                  />
                </th>
              ) : null}
              {visible.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  aria-sort={sort?.id === col.id ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  className={cn(
                    "whitespace-nowrap border-b border-border px-4 py-2.5 text-left text-xs font-medium text-fg-muted",
                    col.align === "right" && "text-right",
                    col.className
                  )}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      data-inline
                      onClick={() => toggleSort(col)}
                      className={cn("group/sort inline-flex items-center gap-1 rounded-badge hover:text-fg", col.align === "right" && "flex-row-reverse")}
                    >
                      {col.header}
                      {sort?.id === col.id ? (
                        sort.dir === "asc" ? <ArrowUp className="size-3.5 text-fg" /> : <ArrowDown className="size-3.5 text-fg" />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-0 transition-opacity group-hover/sort:opacity-60" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {renderExpanded ? <th aria-label="Expand" className="w-10 border-b border-border" /> : null}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {selectable ? <td className="border-b border-border px-4 py-3" /> : null}
                    {visible.map((c) => (
                      <td key={c.id} className="border-b border-border px-4 py-3">
                        <Skeleton className="h-4 w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              : pageRows.map((row) => {
                  const id = getRowId(row)
                  const isOpen = expanded === id
                  return (
                    <React.Fragment key={id}>
                      <tr
                        onClick={interactiveRow ? () => handleRow(row) : undefined}
                        data-selected={selected.has(id) || undefined}
                        className={cn(
                          "group/row transition-colors data-selected:bg-primary/5",
                          interactiveRow && "cursor-pointer hover:bg-surface-2/60",
                          isOpen && "bg-surface-2/60",
                          rowClassName?.(row)
                        )}
                      >
                        {selectable ? (
                          <td className="border-b border-border px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox aria-label="Select row" checked={selected.has(id)} onCheckedChange={() => toggleRow(id)} />
                          </td>
                        ) : null}
                        {visible.map((col) => (
                          <td
                            key={col.id}
                            className={cn("border-b border-border px-4 py-3 align-middle text-fg", col.align === "right" && "text-right", col.className)}
                          >
                            {col.cell(row)}
                          </td>
                        ))}
                        {renderExpanded ? (
                          <td className="border-b border-border pr-3 text-right">
                            <button
                              type="button"
                              data-inline
                              aria-expanded={isOpen}
                              aria-label={isOpen ? "Collapse row" : "Expand row"}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRow(row)
                              }}
                              className="inline-flex size-7 items-center justify-center rounded-badge text-fg-subtle hover:bg-surface-3 hover:text-fg"
                            >
                              <ChevronDown className={cn("size-4 transition-transform duration-200", isOpen && "rotate-180")} />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                      {renderExpanded && isOpen ? (
                        <tr>
                          <td colSpan={visible.length + (selectable ? 1 : 0) + 1} className="border-b border-border bg-surface-2/40 px-4 py-4">
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={transition.fade}>
                              {renderExpanded(row)}
                            </motion.div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  )
                })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border md:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="space-y-2 p-4">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </li>
            ))
          : pageRows.map((row) => {
              const id = getRowId(row)
              const isOpen = expanded === id
              return (
                <li key={id} data-selected={selected.has(id) || undefined} className={cn("data-selected:bg-primary/5", rowClassName?.(row))}>
                  <div className="flex items-start gap-3 p-4">
                    {selectable ? (
                      <div className="pt-0.5">
                        <Checkbox aria-label="Select row" checked={selected.has(id)} onCheckedChange={() => toggleRow(id)} />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      disabled={!interactiveRow}
                      onClick={() => handleRow(row)}
                      aria-expanded={renderExpanded ? isOpen : undefined}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <div className="text-sm font-medium text-fg">{titleCol.cell(row)}</div>
                      {subtitleCol ? <div className="mt-0.5 text-xs text-fg-muted">{subtitleCol.cell(row)}</div> : null}
                      {metaCols.length > 0 ? (
                        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                          {metaCols.map((c) => (
                            <div key={c.id} className="min-w-0">
                              <dt className="text-2xs text-fg-subtle">{c.header}</dt>
                              <dd className="mt-0.5 truncate text-xs text-fg">{c.cell(row)}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : null}
                    </button>
                    {renderExpanded ? <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform", isOpen && "rotate-180")} /> : null}
                  </div>
                  {renderExpanded && isOpen ? <div className="border-t border-border bg-surface-2/40 p-4">{renderExpanded(row)}</div> : null}
                </li>
              )
            })}
      </ul>

      {!loading && rows.length === 0 ? (
        empty ?? <EmptyState compact icon={<Search />} title="Nothing matches" description="Try a different search or clear the filters." />
      ) : null}

      {/* Pagination */}
      {rows.length > 0 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-fg-muted">
          <span>
            <span className="font-mono tabular-nums text-fg">
              {(current - 1) * pageSize + 1}-{Math.min(current * pageSize, rows.length)}
            </span>{" "}
            of <span className="font-mono tabular-nums text-fg">{rows.length}</span>
            {rows.length !== data.length ? <> (filtered from {data.length})</> : null}
          </span>
          {pageCount > 1 ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                <ChevronLeft />
              </Button>
              <span className="px-1 font-mono tabular-nums">
                {current}/{pageCount}
              </span>
              <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function FilterChip<T>({ def, value, onChange }: { def: FilterDef<T>; value?: string; onChange: (v: string | null) => void }) {
  const selected = def.options.find((o) => o.value === value)
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-badge border px-2.5 text-xs font-medium transition-colors",
          selected
            ? "border-primary/30 bg-primary/10 text-primary-text"
            : "border-dashed border-border-strong text-fg-muted hover:border-fg-subtle hover:text-fg"
        )}
      >
        {def.label}
        {selected ? <span className="text-fg">: {selected.label}</span> : <ChevronDown className="size-3.5" />}
      </PopoverTrigger>
      <PopoverContent className="w-52">
        <div role="listbox" aria-label={def.label}>
          {def.options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => onChange(o.value === value ? null : o.value)}
              className="flex w-full items-center justify-between rounded-badge px-2.5 py-2 text-left text-sm text-fg hover:bg-surface-2 aria-selected:font-medium"
            >
              {o.label}
              {o.value === value ? <span className="size-1.5 rounded-full bg-primary" /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ColumnMenu<T>({
  columns,
  hidden,
  setHidden,
}: {
  columns: Column<T>[]
  hidden: Set<string>
  setHidden: React.Dispatch<React.SetStateAction<Set<string>>>
}) {
  const hideable = columns.filter((c) => c.hideable !== false)
  if (hideable.length < 3) return null
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Choose columns"
        className="hidden h-9 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-xs font-medium text-fg-muted shadow-1 hover:text-fg md:inline-flex"
      >
        <Columns3 className="size-4" /> Columns
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        {hideable.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-badge px-2 py-1.5 text-sm text-fg hover:bg-surface-2">
            <Checkbox
              checked={!hidden.has(c.id)}
              onCheckedChange={(checked) =>
                setHidden((prev) => {
                  const next = new Set(prev)
                  if (checked) next.delete(c.id)
                  else next.add(c.id)
                  return next
                })
              }
            />
            {c.header}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}
