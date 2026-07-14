"use client";

import { motion } from "framer-motion";
import { Info, Mail, ShieldCheck } from "lucide-react";

export function StatusPanel() {
  return (
    <div className="relative w-full max-w-[420px] bg-white/70 dark:bg-slate-900/40 backdrop-blur-[32px] rounded-2xl border border-white/40 dark:border-white/[0.08] p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden group transition-all duration-300">
      
      {/* Background sweep animation kept for premium feel */}
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

      <div className="space-y-6 relative z-10">
        
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-white/[0.05]">
          <Info className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Access Guidelines</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-md bg-slate-100 dark:bg-slate-800/50">
              <Mail className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">Students</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Sign in with your official university <span className="font-medium text-slate-900 dark:text-slate-300">email</span> to participate in the elective bidding process.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-md bg-slate-100 dark:bg-slate-800/50">
              <ShieldCheck className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">Staff & Faculty</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Tutors and Coordinators must register using their assigned <span className="font-medium text-slate-900 dark:text-slate-300">secure invite code</span>.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-white/[0.05]">
          <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium">Having trouble?</span>
          <a href="#" className="text-[11px] font-bold text-slate-900 dark:text-white hover:underline decoration-slate-400 underline-offset-2">Contact IT Support &rarr;</a>
        </div>
      </div>
    </div>
  );
}
