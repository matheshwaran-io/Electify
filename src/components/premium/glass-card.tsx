"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  glow?: "indigo" | "cyan" | "none";
  hoverEffect?: boolean;
}

export function GlassCard({
  children,
  className,
  glow = "none",
  hoverEffect = true,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 100,
        damping: 15,
      }}
      // whileHover lift only fires on pointer/mouse devices via CSS media query.
      // On touch devices (hover: none), this has no visual effect.
      whileHover={
        hoverEffect
          ? {
              y: -3,
              transition: { duration: 0.2, ease: "easeOut" },
            }
          : undefined
      }
      className={cn(
        "glass-panel rounded-cards p-6 shadow-glass relative overflow-hidden",
        glow === "indigo" && "indigo-glow",
        glow === "cyan" && "cyan-glow",
        className
      )}
      {...props}
    >
      {/* Soft internal gradient shine */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
