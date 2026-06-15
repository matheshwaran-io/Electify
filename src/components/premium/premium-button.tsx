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
    "inline-flex items-center justify-center font-semibold rounded-buttons transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 relative overflow-hidden disabled:opacity-50 disabled:pointer-events-none select-none";

  const variants = {
    primary:
      "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-glow hover:from-indigo-500 hover:to-violet-500 focus:ring-indigo-500 active:from-indigo-700 active:to-violet-700",
    secondary:
      "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-slate-400 active:bg-slate-300 dark:active:bg-slate-600",
    accent:
      "bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-glow-accent hover:from-cyan-400 hover:to-teal-400 focus:ring-cyan-500 active:from-cyan-600 active:to-teal-600",
    ghost:
      "bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400 focus:ring-slate-300 active:bg-slate-200/50",
    danger:
      "bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 focus:ring-red-500 active:from-red-700 active:to-rose-700",
    outline:
      "border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-100/50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 focus:ring-slate-300 active:bg-slate-100 dark:active:bg-slate-800",
  };

  const sizes = {
    // min-h ensures 44px WCAG touch target on all sizes
    sm: "px-4 py-2 text-xs min-h-[44px]",
    md: "px-6 py-2.5 text-sm min-h-[44px]",
    lg: "px-8 py-3.5 text-base min-h-[48px]",
  };

  return (
    <motion.button
      type={type}
      // Only scale on hover for pointer devices — touch devices use active:scale via CSS
      whileTap={{ scale: 0.97 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      style={{ touchAction: "manipulation" }}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
          Loading...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
