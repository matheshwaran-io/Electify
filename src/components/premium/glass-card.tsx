"use client";

import * as React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { spring, variants } from "@/lib/motion";

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
      variants={variants.rise}
      initial="hidden"
      animate="visible"
      // whileHover lift only fires on pointer/mouse devices via CSS media query.
      // On touch devices (hover: none), this has no visual effect.
      whileHover={hoverEffect ? { y: -2, transition: spring.snappy } : undefined}
      className={cn(
        "rounded-card border border-border bg-surface p-6 shadow-1 relative overflow-hidden",
        glow !== "none" && "shadow-2",
        className
      )}
      {...props}
    >
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
