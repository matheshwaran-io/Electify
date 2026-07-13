"use client";

import { motion } from "framer-motion";

export function CenterpieceWireframe() {
  return (
    <div className="relative w-72 h-72 flex items-center justify-center pointer-events-none select-none">
      {/* 60s Centerpiece rotating wireframe */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 flex items-center justify-center"
      >
        {/* Outlined Outer Circle */}
        <div className="absolute w-64 h-64 rounded-full border border-slate-300/30 dark:border-white/[0.04] bg-white/[0.003]" />

        {/* Outlined Diamond */}
        <div className="absolute w-44 h-44 border border-slate-300/20 dark:border-white/[0.03] rotate-45 bg-white/[0.001]" />

        {/* Inner circles & crosshairs */}
        <div className="absolute w-24 h-24 rounded-full border border-slate-300/30 dark:border-white/[0.05] border-dashed" />
        <div className="absolute w-px h-72 bg-gradient-to-b from-transparent via-slate-300/20 dark:via-white/[0.05] to-transparent" />
        <div className="absolute h-px w-72 bg-gradient-to-r from-transparent via-slate-300/20 dark:via-white/[0.05] to-transparent" />
      </motion.div>

      {/* Counter-rotating center core */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="absolute flex items-center justify-center"
      >
        <div className="w-12 h-12 rounded-full border border-slate-300/40 dark:border-white/[0.08]" />
        <div className="absolute w-16 h-16 border border-slate-300/20 dark:border-white/[0.04] rotate-12" />
      </motion.div>
    </div>
  );
}
