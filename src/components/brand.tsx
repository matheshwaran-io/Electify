import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const sizes = {
  sm: { tile: "size-7 rounded-badge", icon: "size-4" },
  md: { tile: "size-8 rounded-badge", icon: "size-4.5" },
  lg: { tile: "size-11 rounded-control", icon: "size-6" },
}

/** The brand mark: the one place besides the primary CTA that wears the gradient. */
export function BrandMark({ size = "md", className }: { size?: keyof typeof sizes; className?: string }) {
  const s = sizes[size]
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center bg-brand text-primary-fg highlight-inset shadow-1", s.tile, className)}
    >
      <Check className={s.icon} strokeWidth={3} />
    </span>
  )
}

export function Wordmark({ size = "md", className }: { size?: keyof typeof sizes; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <span className={cn("font-semibold tracking-tight text-fg", size === "lg" ? "text-xl" : "text-base")}>Electify</span>
    </span>
  )
}
