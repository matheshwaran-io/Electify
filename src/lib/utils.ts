import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge the design-token scale from globals.css so that
// `cn("rounded-control", "rounded-card")` resolves to the last value.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["badge", "tight", "control", "popover", "card", "panel"],
      shadow: ["1", "2", "3"],
      text: ["2xs", "display-xl"],
    },
    classGroups: {
      "bg-image": ["bg-brand"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
