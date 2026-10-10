"use client"

import { MotionConfig } from "framer-motion"
import { TooltipProvider } from "@/components/ui/tooltip"

/** Honours prefers-reduced-motion for every motion component; shares tooltip timing. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>{children}</TooltipProvider>
    </MotionConfig>
  )
}
