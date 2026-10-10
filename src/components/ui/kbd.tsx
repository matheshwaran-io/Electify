import { cn } from "@/lib/utils"

/** Keycap glyph for keyboard shortcuts. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("keycap", className)}>{children}</kbd>
}

/** Renders a shortcut like ["mod", "K"] with the platform's modifier glyph. */
export function Shortcut({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((k) => (
        <Kbd key={k}>{k === "mod" ? <ModKey /> : k}</Kbd>
      ))}
    </span>
  )
}

function ModKey() {
  // Rendered on both server and client; CSS swaps the glyph on Apple platforms
  // would need UA sniffing, so show the neutral form that reads on every OS.
  return <span aria-label="Command or Control">⌘</span>
}
