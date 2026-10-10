"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface PremiumInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const PremiumInput = React.forwardRef<HTMLInputElement, PremiumInputProps>(
  ({ className, label, error, icon, type = "text", ...props }, ref) => {
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label className="block text-xs font-bold uppercase tracking-wider text-fg-muted">
            {label}
          </label>
        )}
        <div className="relative rounded-control overflow-hidden shadow-1">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none">
              {icon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              // min-h-[48px] ensures 44px+ touch target; text-base prevents iOS Safari zoom on focus
              "w-full min-h-[48px] rounded-control border border-border bg-surface px-4 py-3 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary transition-all placeholder:text-fg-subtle disabled:opacity-50",
              icon && "pl-11",
              error && "border-danger focus-visible:ring-ring focus-visible:border-danger",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs font-semibold text-danger-text mt-1">{error}</p>
        )}
      </div>
    );
  }
);

PremiumInput.displayName = "PremiumInput";
