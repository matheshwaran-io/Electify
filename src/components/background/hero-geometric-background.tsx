import React from "react";

export function HeroGeometricBackground() {
  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden select-none pointer-events-none z-0 bg-[#FAFAFA] dark:bg-[#030712]">
      
      {/* ── Architectural Grid Overlay ───────────────────────────────────── */}
      <div className="absolute inset-0 z-0 grid-overlay opacity-50 dark:opacity-40 mask-radial-faded pointer-events-none" 
           style={{ maskImage: "radial-gradient(circle at center, black, transparent 80%)", WebkitMaskImage: "radial-gradient(circle at center, black, transparent 80%)" }} 
      />

      {/* ── Layer 1: Static Premium SaaS Gradients (Light Mode) ────────── */}
      <div 
        className="absolute inset-0 w-full h-full opacity-70 mix-blend-multiply dark:hidden"
        style={{
          background: `
            radial-gradient(circle at 20% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 50% 80%, rgba(56, 189, 248, 0.15) 0%, transparent 60%)
          `
        }}
      />
      
      {/* ── Layer 1: Static Premium SaaS Gradients (Dark Mode) ─────────── */}
      <div 
        className="absolute inset-0 w-full h-full opacity-100 mix-blend-screen hidden dark:block"
        style={{
          background: `
            radial-gradient(circle at 15% 0%, rgba(79, 70, 229, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 85% 15%, rgba(139, 92, 246, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 50% 100%, rgba(56, 189, 248, 0.12) 0%, transparent 60%)
          `
        }}
      />

      {/* ── Top Center Core Glow (The "SaaS Light") ────────────────────── */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[60vw] h-[30vw] rounded-[100%] bg-indigo-500/20 dark:bg-indigo-500/10 blur-[80px] pointer-events-none" />

      {/* ── Layer 2: Monochrome Grain Overlay (Adds premium texture) ───── */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] z-30 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Layer 3: Static Abstract Geometry ──────────────────────────── */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-10 hidden md:block">
        {/* Large orbital ring behind the Hero (Left) */}
        <div className="absolute top-[10%] left-[-10%] w-[50vw] h-[50vw] max-w-[800px] max-h-[800px] rounded-full border border-indigo-500/10 dark:border-indigo-400/[0.05]">
          <div className="absolute top-[10%] left-[10%] w-[80%] h-[80%] rounded-full border border-dashed opacity-40 border-indigo-500/20 dark:border-indigo-400/20" />
        </div>
        
        {/* Medium ring behind the Login Card (Right) */}
        <div className="absolute top-[15%] right-[-5%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] rounded-full border border-purple-500/10 dark:border-purple-400/[0.05]" />

        {/* Small geometric accent (Static) */}
        <div className="absolute bottom-[15%] left-[40%] w-[100px] h-[100px] hidden md:flex items-center justify-center opacity-40">
          <svg viewBox="0 0 100 100" className="text-indigo-600 dark:text-indigo-400 opacity-20">
            <polygon points="50,5 90,25 90,75 50,95 10,75 10,25" fill="none" stroke="currentColor" strokeWidth="0.8" />
            <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" />
          </svg>
        </div>

        {/* Thin technical construction lines with gradient fade */}
        <svg className="absolute inset-0 w-full h-full hidden lg:block text-slate-400 dark:text-slate-500 opacity-10">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
            <linearGradient id="lineGradVert" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <line x1="0" y1="65%" x2="100%" y2="65%" stroke="url(#lineGrad)" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="25%" y1="0" x2="25%" y2="100%" stroke="url(#lineGradVert)" strokeWidth="0.5" />
          <line x1="75%" y1="0" x2="75%" y2="100%" stroke="url(#lineGradVert)" strokeWidth="0.5" strokeDasharray="10 10" />
        </svg>
      </div>
      
      {/* ── Layer 4: Soft background static light nodes ────────────────── */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {Array.from({ length: 15 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${((i * 37) % 90) + 5}%`,
              top: `${((i * 29) % 80) + 10}%`,
              width: (i % 3) + 2,
              height: (i % 3) + 2,
              opacity: (i % 2 === 0) ? 0.1 : 0.05,
            }}
            className="rounded-full bg-indigo-500 dark:bg-indigo-300 blur-[1px]"
          />
        ))}
      </div>
    </div>
  );
}
