"use client"

import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap",
    "rounded-full border border-transparent font-medium",
    "transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-snappy",
    "active:not-disabled:translate-y-px active:not-disabled:scale-[0.985]",
    "disabled:pointer-events-none disabled:opacity-50 data-[loading]:pointer-events-none",
    "aria-invalid:border-danger",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-1 hover:bg-primary-strong",
        brand: "bg-brand text-primary-fg shadow-2 hover:bg-primary-strong",
        secondary: "border-border bg-surface text-fg shadow-1 hover:bg-surface-2",
        outline: "border-border-strong bg-transparent text-fg hover:bg-surface-2",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg aria-expanded:bg-surface-2 aria-expanded:text-fg",
        destructive: "bg-danger-strong text-on-accent shadow-1 hover:bg-danger-strong/90",
        "destructive-soft": "border-danger/25 bg-danger/10 text-danger-text hover:bg-danger/15",
        link: "h-auto px-0 text-primary-text underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-5 text-sm",
        xl: "h-12 px-6 text-base",
        "icon-sm": "size-8",
        icon: "size-10",
        "icon-lg": "size-11",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md" },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner, keeps the width stable and blocks repeat presses. */
    loading?: boolean
    loadingText?: string
  }

function Button({ className, variant, size, loading, loadingText, children, disabled, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? "" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="size-4" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants, type ButtonProps }
