"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { controlClass, useFieldControl } from "@/components/ui/input"
import { overlaySurface } from "@/components/ui/popover"

export type Option = { value: string; label: string; description?: string; disabled?: boolean }

type SelectProps = {
  value: string | null
  onValueChange: (value: string) => void
  options: Option[]
  placeholder?: string
  disabled?: boolean
  className?: string
  size?: "sm" | "md"
  "aria-label"?: string
  name?: string
}

/** Native-feeling select with keyboard typeahead. */
export function Select({ value, onValueChange, options, placeholder = "Select", disabled, className, size = "md", name, ...rest }: SelectProps) {
  const field = useFieldControl()
  const items = React.useMemo(() => options.map((o) => ({ value: o.value, label: o.label })), [options])
  // A value with no matching option would render as its raw id; show the placeholder instead.
  const known = value != null && options.some((o) => o.value === value)
  return (
    <SelectPrimitive.Root
      items={items}
      value={known ? value : null}
      onValueChange={(v) => v != null && onValueChange(v as string)}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        id={field?.id}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        aria-label={rest["aria-label"]}
        className={cn(
          controlClass,
          "flex items-center justify-between gap-2 px-3 text-left",
          size === "sm" ? "h-9 text-sm" : "h-11 text-sm sm:h-10",
          "data-popup-open:border-primary data-placeholder:text-fg-subtle",
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} className="truncate" />
        <SelectPrimitive.Icon className="text-fg-subtle">
          <ChevronsUpDown className="size-4" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-60">
          <SelectPrimitive.Popup
            className={cn(overlaySurface, "max-h-(--available-height) min-w-(--anchor-width) overflow-y-auto p-1")}
          >
            <SelectPrimitive.List>
              {options.map((o) => (
                <SelectPrimitive.Item key={o.value} value={o.value} disabled={o.disabled} className={optionClass}>
                  <span className="min-w-0 flex-1">
                    <SelectPrimitive.ItemText className="block truncate">{o.label}</SelectPrimitive.ItemText>
                    {o.description ? <span className="block truncate text-xs text-fg-muted">{o.description}</span> : null}
                  </span>
                  <SelectPrimitive.ItemIndicator className="text-primary-text">
                    <Check className="size-4" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

const optionClass = cn(
  "flex cursor-default select-none items-center gap-2 rounded-control px-2.5 py-2 text-sm text-fg outline-none",
  "data-highlighted:bg-surface-2 data-selected:font-medium data-disabled:opacity-40"
)

type ComboboxProps = {
  value: string | null
  onValueChange: (value: string | null) => void
  options: Option[]
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

/** Searchable select for long option lists. */
export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Search",
  emptyText = "No matches",
  disabled,
  className,
  ...rest
}: ComboboxProps) {
  const field = useFieldControl()
  const selected = options.find((o) => o.value === value) ?? null
  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      onValueChange={(item) => onValueChange((item as Option | null)?.value ?? null)}
      itemToStringLabel={(item: Option) => item.label}
      isItemEqualToValue={(a: Option, b: Option) => a.value === b.value}
      disabled={disabled}
    >
      <div className={cn("relative", className)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <ComboboxPrimitive.Input
          id={field?.id}
          aria-describedby={field?.describedBy}
          aria-invalid={field?.invalid || undefined}
          aria-label={rest["aria-label"]}
          placeholder={placeholder}
          className={cn(controlClass, "h-11 pl-9 pr-9 text-sm sm:h-10")}
        />
        <ComboboxPrimitive.Trigger
          aria-label="Show options"
          className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
        >
          <ChevronsUpDown className="size-4" />
        </ComboboxPrimitive.Trigger>
      </div>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={6} className="z-60">
          <ComboboxPrimitive.Popup
            className={cn(overlaySurface, "max-h-[min(var(--available-height),20rem)] w-(--anchor-width) overflow-y-auto p-1")}
          >
            <ComboboxPrimitive.Empty className="px-3 py-6 text-center text-sm text-fg-muted empty:hidden">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: Option) => (
                <ComboboxPrimitive.Item key={item.value} value={item} disabled={item.disabled} className={optionClass}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.description ? <span className="block truncate text-xs text-fg-muted">{item.description}</span> : null}
                  </span>
                  <ComboboxPrimitive.ItemIndicator className="text-primary-text">
                    <Check className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
