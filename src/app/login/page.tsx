"use client";

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { HeroGeometricBackground } from "@/components/background/hero-geometric-background";
import { AuthContainer } from "@/components/auth/auth-container";
import { StatusPanel } from "@/components/ui/status-panel";
import { CenterpieceWireframe } from "@/components/ui/centerpiece-wireframe";
import { ThemeToggle } from "@/components/theme-toggle";

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
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-500 animate-gradient">
                  Authentication.
                </span>
              </h1>

              <p className="text-slate-600 dark:text-slate-400 text-[18px] leading-[1.8] max-w-[560px]">
                Smart elective selection portal. Access elective selections, check real-time seat distributions, and verify your registrations.
              </p>
            </div>
          </div>

          {/* Left Side Elements: Status panel and geometric wireframe centerpiece */}
          <div className="flex flex-col sm:flex-row items-center gap-12 pt-4">
            <StatusPanel />
            <div className="hidden sm:block">
              <CenterpieceWireframe />
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
