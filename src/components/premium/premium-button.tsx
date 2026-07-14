"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

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
    "inline-flex items-center justify-center font-medium rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 dark:focus:ring-slate-100 dark:focus:ring-offset-slate-950 relative overflow-hidden disabled:opacity-50 disabled:pointer-events-none select-none";

  const variants = {
    primary:
      "bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 border border-transparent shadow-sm",
    secondary:
      "bg-white dark:bg-[#111] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-[#1a1a1a] shadow-sm",
    accent:
      "bg-indigo-600 dark:bg-indigo-500 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 shadow-sm border border-transparent",
    ghost:
      "bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400",
    danger:
      "bg-rose-600 dark:bg-rose-500 text-white hover:bg-rose-700 dark:hover:bg-rose-600 shadow-sm border border-transparent",
    outline:
      "border border-slate-200 dark:border-white/10 bg-transparent hover:bg-slate-50 dark:hover:bg-[#111] text-slate-900 dark:text-white",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs min-h-[32px]",
    md: "px-4 py-2 text-sm min-h-[36px]",
    lg: "px-6 py-3 text-base min-h-[44px]",
  };

  return (
    <motion.button
      type={type}
      whileTap={{ scale: 0.98 }}
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
