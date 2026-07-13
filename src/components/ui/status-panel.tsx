"use client";

import { motion } from "framer-motion";

export function StatusPanel() {
  return (
    <div className="relative w-full max-w-[400px] bg-white/[0.72] dark:bg-white/[0.02] backdrop-blur-2xl rounded-2xl border border-slate-200/60 dark:border-white/[0.08] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.03)] dark:shadow-[0_30px_100px_rgba(0,0,0,0.4)] overflow-hidden group transition-all duration-300">
      
      {/* ── Layer 8: Reflection Sweep Layer (animates every 15s) ──────────────── */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.05] dark:opacity-8 z-20"
        style={{
          background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
          backgroundSize: "200% 100%",
        }}
      >
        <motion.div
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
          className="w-full h-full"
          style={{
            background: "linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.1) 50%, transparent 65%)",
          }}
        />
      </div>

      <div className="space-y-5 relative z-10">
        
        {/* Header with Live indicator */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/[0.05]">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Elective Registration</span>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest">LIVE</span>
          </div>
        </div>

        {/* Phase Details */}
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Registration opens in</span>
          <h4 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            02 <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Days</span> &middot; 14 <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Hours</span>
          </h4>
        </div>

        {/* Queue Count */}
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">Current Queue</span>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-300">
            2,431 Students <span className="text-xs text-slate-500 font-normal">waiting</span>
          </div>
        </div>

        {/* System status info */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-bold">System Status</span>
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-300">Operational</span>
        </div>
      </div>
    </div>
  );
}
