"use client";

import * as React from "react";
import { motion } from "framer-motion";

interface OccupancyRingProps {
  value: number; // Percentage from 0 to 100
  size?: number;
  strokeWidth?: number;
}

export function OccupancyRing({
  value,
  size = 60,
  strokeWidth = 6,
}: OccupancyRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(100, Math.max(0, value));
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine color based on capacity filled
  let strokeColor = "stroke-emerald-500";
  if (percentage >= 90) strokeColor = "stroke-red-500";
  else if (percentage >= 75) strokeColor = "stroke-amber-500";
  else if (percentage >= 50) strokeColor = "stroke-cyan-500";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track */}
        <circle
          className="stroke-slate-100 dark:stroke-slate-800"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Animated Progress Circle */}
        <motion.circle
          className={strokeColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-slate-700 dark:text-slate-300">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
