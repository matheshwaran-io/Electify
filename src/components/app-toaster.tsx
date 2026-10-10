"use client";

import type { CSSProperties } from "react";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";

/** Sonner, skinned with design tokens so toasts follow the active theme. */
export function AppToaster() {
  const { resolvedTheme } = useTheme();

  const tone = (color: string, text: string) => ({
    bg: `color-mix(in oklab, var(${color}) 10%, var(--surface-1))`,
    border: `color-mix(in oklab, var(${color}) 35%, var(--surface-1))`,
    text: `var(${text})`,
  });
  const success = tone("--success", "--success-text");
  const error = tone("--danger", "--danger-text");
  const warning = tone("--warning", "--warning-text");
  const info = tone("--primary", "--primary-text");

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      closeButton
      richColors
      toastOptions={{ classNames: { toast: "font-sans shadow-2" } }}
      style={
        {
          "--normal-bg": "var(--surface-1)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--text)",
          "--success-bg": success.bg,
          "--success-border": success.border,
          "--success-text": success.text,
          "--error-bg": error.bg,
          "--error-border": error.border,
          "--error-text": error.text,
          "--warning-bg": warning.bg,
          "--warning-border": warning.border,
          "--warning-text": warning.text,
          "--info-bg": info.bg,
          "--info-border": info.border,
          "--info-text": info.text,
          "--border-radius": "var(--radius-control)",
        } as CSSProperties
      }
    />
  );
}
