"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { press } from "@/lib/motion";

interface PremiumButtonProps extends Omit<HTMLMotionProps<"button">, "type"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "accent" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  type?: "button" | "submit" | "reset";
}

export function PremiumButton({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  type = "button",
  disabled,
  ...props
}: PremiumButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-control transition-colors duration-150 ease-snappy relative overflow-hidden disabled:opacity-50 disabled:pointer-events-none select-none";

  const variants = {
    primary:
      "bg-primary text-primary-fg hover:bg-primary-strong border border-transparent",
    secondary:
      "bg-surface text-fg border border-border hover:bg-surface-2",
    accent:
      "bg-primary text-primary-fg hover:bg-primary-strong border border-transparent",
    ghost:
      "bg-transparent hover:bg-surface-2 text-fg-muted",
    danger:
      "bg-danger-strong text-primary-fg hover:bg-danger-strong/90 border border-transparent",
    outline:
      "border border-border bg-transparent hover:bg-surface-2 text-fg",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-[32px]",
    md: "px-4 py-2 text-sm min-h-[36px]",
    lg: "px-6 py-3 text-base min-h-[44px]",
  };

  return (
    <motion.button
      type={type}
      whileTap={press}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      style={{ touchAction: "manipulation" }}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
