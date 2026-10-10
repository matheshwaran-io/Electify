import React from "react";

/** Quiet backdrop for standalone screens: a faint grid and one soft primary glow. */
export function HeroGeometricBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden bg-canvas">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at 50% 0%, black, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[60vh]"
        style={{
          background:
            "radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent)",
        }}
      />
    </div>
  );
}
