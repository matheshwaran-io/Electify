"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { HeroGeometricBackground } from "@/components/background/hero-geometric-background";
import { AuthContainer } from "@/components/auth/auth-container";
import { ThemeToggle } from "@/components/theme-toggle";
import { Zap, ShieldCheck, FileText, LayoutGrid } from "lucide-react";

export default function UnifiedLoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#040816] font-sans text-slate-600 dark:text-slate-300 relative overflow-hidden pb-12 selection:bg-indigo-500/30 selection:text-white transition-colors duration-500 flex flex-col justify-center">
      
      {/* Cinematic Ambient Background */}
      <HeroGeometricBackground />

      {/* ── Floating Theme Toggle in Top Right ─────────────────────── */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <ThemeToggle />
      </div>

      {/* ── Main Layout (Generous Whitespace, No Clichés) ─────────── */}
      <div className="max-w-7xl mx-auto px-6 pt-24 lg:pt-32 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start relative z-10 w-full">
        
        {/* LEFT COLUMN: Deep Typographic Hero & Status Panel */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="lg:col-span-7 space-y-16"
        >
          {/* Logo square and titles */}
          <div className="space-y-8">
            <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/10 p-2.5 shadow-md flex items-center justify-center">
              <Image src="/logo.png" alt="Electify Logo" width={36} height={36} className="w-full h-full object-contain" />
            </div>

            <div className="space-y-4">
              <h1 className="text-4xl sm:text-7xl font-bold text-slate-900 dark:text-white tracking-[-0.05em] leading-[0.9]">
                Electify Portal <br />
                <span className="text-slate-800 dark:text-slate-200">
                  Authentication.
                </span>
              </h1>

              <p className="text-slate-600 dark:text-slate-400 text-[18px] leading-[1.8] max-w-[560px]">
                Smart elective selection portal. Access elective selections, check real-time seat distributions, and verify your registrations.
              </p>
            </div>
          </div>

          {/* Interactive Feature Grid Showcase */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
            {/* Feature 1 */}
            <div className="space-y-3 p-5 rounded-2xl bg-white/40 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] backdrop-blur-md shadow-sm hover:border-indigo-500/30 dark:hover:border-indigo-500/20 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 text-[#4F8CFF] flex items-center justify-center border border-indigo-100/50 dark:border-indigo-500/10">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Instant Seat Allocation</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Real-time seat allocation updates powered by Supabase, eliminating lag and synchronization issues.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="space-y-3 p-5 rounded-2xl bg-white/40 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] backdrop-blur-md shadow-sm hover:border-purple-500/30 dark:hover:border-purple-500/20 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 text-[#6D5DFE] flex items-center justify-center border border-purple-100/50 dark:border-purple-500/10">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Race-Free Locking</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Strict database row-level locking guarantees no duplicate selections or overbooking during registration peaks.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="space-y-3 p-5 rounded-2xl bg-white/40 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] backdrop-blur-md shadow-sm hover:border-emerald-500/30 dark:hover:border-emerald-500/20 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-500 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-500/10">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Tamper-Proof Snapshots</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Every registration creates an immutable snapshot of selection details, securing student choices permanently.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="space-y-3 p-5 rounded-2xl bg-white/40 dark:bg-white/[0.01] border border-slate-200/50 dark:border-white/[0.05] backdrop-blur-md shadow-sm hover:border-amber-500/30 dark:hover:border-amber-500/20 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center border border-amber-100/50 dark:border-amber-500/10">
                <LayoutGrid className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Dynamic Tutor Reports</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Clean PDF and CSV reports grouped by subject categories, offering immediate registration progress insights.
              </p>
            </div>
          </div>
        </motion.div>

        {/* RIGHT COLUMN: Floating Glass Auth Panel */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
          className="lg:col-span-5 w-full flex flex-col items-center lg:sticky lg:top-28"
        >
          <AuthContainer />

          {/* Fully Encrypted subtext */}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed max-w-xs text-center mt-6 uppercase tracking-wider font-bold">
            🔒 Protected by security protocols &middot; audit logs active
          </p>
        </motion.div>
      </div>
    </div>
  );
}
