"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean }
const FieldContext = React.createContext<FieldContextValue | null>(null)

/**
 * Label above, help text and error below. Children inputs pick up id,
 * aria-describedby and aria-invalid from context automatically.
 */
export function Field({
  label,
  description,
  error,
  children,
  className,
  htmlFor,
  optional,
}: {
  label?: React.ReactNode
  description?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
  htmlFor?: string
  optional?: boolean
}) {
  const autoId = React.useId()
  const id = htmlFor ?? autoId
  const descId = description ? `${id}-desc` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label ? (
          <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-fg">
            {label}
            {optional ? <span className="text-xs font-normal text-fg-subtle">Optional</span> : null}
          </label>
        ) : null}
        {children}
        {description && !error ? (
          <p id={descId} className="text-xs text-fg-muted">
            {description}
          </p>
        ) : null}
        {error ? (
          <p id={errId} role="alert" className="text-xs font-medium text-danger-text">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  )
}

export const controlClass = cn(
  "w-full min-w-0 rounded-control border border-border-strong bg-surface text-fg shadow-1",
  "placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150 ease-snappy",
  "hover:border-fg-subtle focus-visible:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/20",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-60",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20"
)

type InputProps = React.ComponentProps<"input"> & {
  leading?: React.ReactNode
  trailing?: React.ReactNode
  inputSize?: "sm" | "md" | "lg"
}

const heights = { sm: "h-8 text-sm", md: "h-10 text-sm", lg: "h-12 text-base" }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leading, trailing, inputSize = "md", id, ...props },
  ref
) {
  const field = React.useContext(FieldContext)
  const input = (
    <input
      ref={ref}
      id={id ?? field?.id}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      aria-invalid={props["aria-invalid"] ?? (field?.invalid || undefined)}
      className={cn(controlClass, heights[inputSize], "px-3", leading && "pl-9", trailing && "pr-10", className)}
      {...props}
    />
  )
  if (!leading && !trailing) return input
  return (
    <div className="relative">
      {leading ? (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle [&_svg]:size-4">
          {leading}
        </span>
      ) : null}
      {input}
      {trailing ? <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span> : null}
    </div>
  )
})

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(function Textarea(
  { className, id, ...props },
  ref
) {
  const field = React.useContext(FieldContext)
  return (
    <textarea
      ref={ref}
      id={id ?? field?.id}
      aria-describedby={field?.describedBy}
      aria-invalid={field?.invalid || undefined}
      className={cn(controlClass, "min-h-24 px-3 py-2 text-sm", className)}
      {...props}
    />
  )
})

export function useFieldControl() {
  return React.useContext(FieldContext)
}
