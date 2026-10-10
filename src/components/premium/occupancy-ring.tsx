"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { transition } from "@/lib/motion";

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
  let strokeColor = "stroke-success";
  if (percentage >= 90) strokeColor = "stroke-danger";
  else if (percentage >= 75) strokeColor = "stroke-warning";
  else if (percentage >= 50) strokeColor = "stroke-live";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background Track */}
        <circle
          className="stroke-surface-3"
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
          transition={transition.value}
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-2xs font-bold text-fg-muted">
        {Math.round(percentage)}%
      </span>
    </div>
  );
}
