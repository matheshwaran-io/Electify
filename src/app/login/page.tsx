import * as React from "react";
import Image from "next/image";
import { HeroGeometricBackground } from "@/components/background/hero-geometric-background";
import { AuthContainer } from "@/components/auth/auth-container";
import { ThemeToggle } from "@/components/theme-toggle";
import { Zap, ShieldCheck, FileText, LayoutGrid } from "lucide-react";

export default function UnifiedLoginPage() {
  return (
    <div className="min-h-screen bg-canvas font-sans text-fg-muted relative overflow-hidden pb-12 transition-colors duration-500 flex flex-col justify-center">
      
      {/* Cinematic Ambient Background */}
      <HeroGeometricBackground />

      {/* ── Floating Theme Toggle in Top Right ─────────────────────── */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <ThemeToggle />
      </div>

      {/* ── Main Layout (Generous Whitespace, No Clichés) ─────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-24 lg:pt-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start relative z-10 w-full">
        
        {/* LEFT COLUMN: Deep Typographic Hero & Status Panel */}
        <div className="lg:col-span-7 space-y-16 animate-enter">
          {/* Logo square and titles */}
          <div className="space-y-8">
            <div className="w-14 h-14 rounded-card bg-surface border border-border p-2.5 shadow-2 flex items-center justify-center">
              <Image src="/logo.png" alt="Electify Logo" width={36} height={36} className="w-full h-full object-contain" />
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-6xl font-bold text-fg tracking-tight">
                Electify Portal <br />
                <span className="text-fg-muted">
                  Authentication.
                </span>
              </h1>

              <p className="text-fg-muted text-lg leading-[1.8] max-w-140">
                Smart elective selection portal. Access elective selections, check real-time seat distributions, and verify your registrations.
              </p>
            </div>
          </div>

          {/* Interactive Feature Grid Showcase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            {/* Feature 1 */}
            <div className="space-y-3 p-5 rounded-card bg-surface border border-border shadow-1 group animate-enter [animation-delay:100ms]">
              <div className="w-9 h-9 rounded-control bg-primary/10 text-primary-text flex items-center justify-center border border-primary/20">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Instant Seat Allocation</h3>
              <p className="text-xs text-fg-muted leading-relaxed">
                Real-time seat allocation updates powered by Supabase, eliminating lag and synchronization issues.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-3 p-5 rounded-card bg-surface border border-border shadow-1 group animate-enter [animation-delay:200ms]">
              <div className="w-9 h-9 rounded-control bg-primary/10 text-primary-text flex items-center justify-center border border-primary/20">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Race-Free Locking</h3>
              <p className="text-xs text-fg-muted leading-relaxed">
                Strict database row-level locking guarantees no duplicate selections or overbooking during registration peaks.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-3 p-5 rounded-card bg-surface border border-border shadow-1 group animate-enter [animation-delay:300ms]">
              <div className="w-9 h-9 rounded-control bg-success/10 text-success-text flex items-center justify-center border border-success/20">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Tamper-Proof Snapshots</h3>
              <p className="text-xs text-fg-muted leading-relaxed">
                Every registration creates an immutable snapshot of selection details, securing student choices permanently.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="space-y-3 p-5 rounded-card bg-surface border border-border shadow-1 group animate-enter [animation-delay:400ms]">
              <div className="w-9 h-9 rounded-control bg-warning/10 text-warning-text flex items-center justify-center border border-warning/20">
                <LayoutGrid className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-fg uppercase tracking-wider">Dynamic Tutor Reports</h3>
              <p className="text-xs text-fg-muted leading-relaxed">
                Clean PDF and CSV reports grouped by subject categories, offering immediate registration progress insights.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Floating Glass Auth Panel */}
        <div className="lg:col-span-5 w-full flex flex-col items-center lg:sticky lg:top-28 animate-enter [animation-delay:200ms]">
          <AuthContainer />

          {/* Fully Encrypted subtext */}
          <p className="text-2xs text-fg-subtle leading-relaxed max-w-xs text-center mt-6 uppercase tracking-wider font-bold">
            🔒 Protected by security protocols &middot; audit logs active
          </p>
        </div>
      </div>
    </div>
  );
}
