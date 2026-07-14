"use client";

import { motion, useMotionValue, useTransform, useReducedMotion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";

export function HeroGeometricBackground() {
  const { theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  // Mouse tracking for parallax spotlight (maximum translation: 8px)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Real mouse coordinates for the radial highlight
  const mousePageX = useMotionValue(0);
  const mousePageY = useMotionValue(0);

  useEffect(() => {
    setMounted(true);

    const handleMouseMove = (e: MouseEvent) => {
      // Normalize values between -0.5 and 0.5 for parallax
      mouseX.set((e.clientX / window.innerWidth) - 0.5);
      mouseY.set((e.clientY / window.innerHeight) - 0.5);

      // Track raw coordinates for mouse spotlight
      mousePageX.set(e.clientX);
      mousePageY.set(e.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mouseX, mouseY, mousePageX, mousePageY]);

  // Map mouse positions to absolute 8px maximum offset
  const parallaxX = useTransform(mouseX, [-0.5, 0.5], [-8, 8]);
  const parallaxY = useTransform(mouseY, [-0.5, 0.5], [-8, 8]);

  const isDark = theme === "dark";

  // Mouse spotlight coordinates used in inline styling
  const spotlightStyle = useTransform(
    [mousePageX, mousePageY],
    ([x, y]) => `radial-gradient(600px circle at ${x}px ${y}px, ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'}, transparent 80%)`
  );

  // Pause animations when window is hidden
  const [isTabActive, setIsTabActive] = useState(true);
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  if (!mounted) {
    return <div className="fixed inset-0 bg-[#050816] -z-10" />;
  }

  return (
    <div className="fixed inset-0 w-full h-full overflow-hidden select-none pointer-events-none z-0 transition-colors duration-500 bg-[#FAFBFD] dark:bg-[#050816]">
      
      {/* ── Monochrome Grain Overlay (2% Opacity) ────────────────────────── */}
      <div 
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.015] z-30 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* ── Radial Spotlight following the mouse (Max 8px translation) ────────── */}
      <motion.div 
        style={{ 
          x: parallaxX, 
          y: parallaxY,
          background: spotlightStyle,
        }}
        className="absolute inset-0 w-full h-full z-20 pointer-events-none mix-blend-screen"
      />

      {/* ── Layer 1: Slow-Drift OS Base Gradient (80s Cycle) ────────────────── */}
      <motion.div
        animate={
          shouldReduceMotion || !isTabActive
            ? {}
            : {
                background: isDark
                  ? [
                      "radial-gradient(circle at 10% 10%, #0B1535 0%, #050816 70%)",
                      "radial-gradient(circle at 90% 90%, #161F4F 0%, #0B1535 50%, #050816 100%)",
                      "radial-gradient(circle at 10% 90%, #1B1A63 0%, #0B1535 60%, #050816 100%)",
                      "radial-gradient(circle at 10% 10%, #0B1535 0%, #050816 70%)",
                    ]
                  : [
                      "radial-gradient(circle at 10% 10%, #FAFBFD 0%, #FAFBFD 70%)",
                      "radial-gradient(circle at 90% 90%, #EEF2F6 0%, #E2E8F0 50%, #FAFBFD 100%)",
                      "radial-gradient(circle at 10% 90%, #FAFBFD 0%, #E2E8F0 60%, #FAFBFD 100%)",
                      "radial-gradient(circle at 10% 10%, #FAFBFD 0%, #FAFBFD 70%)",
                    ],
              }
        }
        transition={{
          duration: 80,
          repeat: Infinity,
          ease: "linear",
        }}
        className="absolute inset-0 w-full h-full"
      />

      {/* ── Layer 2: 3 blurred light sources (8% Opacity, 250px blur) ───────── */}
      <motion.div 
        style={{ x: parallaxX, y: parallaxY }}
        className="absolute inset-0 w-full h-full mix-blend-screen dark:mix-blend-screen z-10 opacity-80"
      >
        {/* Top Left: Slate */}
        <motion.div
          animate={shouldReduceMotion || !isTabActive ? {} : { x: [0, 15, 0], y: [0, -15, 0] }}
          transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-[-25%] left-[-20%] w-[70%] h-[70%] rounded-full blur-[250px] ${
            isDark ? "bg-[#334155]/10" : "bg-[#94A3B8]/10"
          }`}
        />

        {/* Center Right: Slate */}
        <motion.div
          animate={shouldReduceMotion || !isTabActive ? {} : { x: [0, -15, 0], y: [0, 15, 0] }}
          transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute top-[15%] right-[-20%] w-[60%] h-[60%] rounded-full blur-[250px] ${
            isDark ? "bg-[#1E293B]/10" : "bg-[#CBD5E1]/10"
          }`}
        />

        {/* Bottom Left: Slate */}
        <motion.div
          animate={shouldReduceMotion || !isTabActive ? {} : { x: [0, 15, 0], y: [0, 15, 0] }}
          transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
          className={`absolute bottom-[-20%] left-[-15%] w-[65%] h-[65%] rounded-full blur-[250px] ${
            isDark ? "bg-[#475569]/10" : "bg-[#E2E8F0]/10"
          }`}
        />
      </motion.div>

      {/* ── Layer 3: Soft Ambient Aurora (60s Color Shift) ──────────────────── */}
      <motion.div
        animate={
          shouldReduceMotion || !isTabActive
            ? {}
            : {
                background: isDark
                  ? [
                      "radial-gradient(circle at 50% 50%, rgba(51, 65, 85, 0.05) 0%, transparent 60%)",
                      "radial-gradient(circle at 60% 40%, rgba(30, 41, 59, 0.05) 0%, transparent 60%)",
                      "radial-gradient(circle at 40% 60%, rgba(71, 85, 105, 0.05) 0%, transparent 60%)",
                      "radial-gradient(circle at 50% 50%, rgba(51, 65, 85, 0.05) 0%, transparent 60%)",
                    ]
                  : [
                      "radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.05) 0%, transparent 60%)",
                      "radial-gradient(circle at 60% 40%, rgba(203, 213, 225, 0.05) 0%, transparent 60%)",
                      "radial-gradient(circle at 40% 60%, rgba(226, 232, 240, 0.05) 0%, transparent 60%)",
                      "radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.05) 0%, transparent 60%)",
                    ],
              }
        }
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 w-full h-full mix-blend-screen z-10"
      />

      {/* ── Layer 4: Specialized Minimal Geometry & Arcs (Max 8px Parallax) ── */}
      <motion.div
        style={{ x: parallaxX, y: parallaxY }}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      >
        {/* Large orbital ring behind the Hero (Left, rotates 1 deg every 40s -> 14400s rotation) */}
        <motion.div
          animate={shouldReduceMotion || !isTabActive ? {} : { rotate: 360 }}
          transition={{ duration: 14400, repeat: Infinity, ease: "linear" }}
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(40, 60, 120, 0.05)",
          }}
          className="absolute top-[18%] left-[-5%] w-[50vw] h-[50vw] max-w-[700px] max-h-[700px] rounded-full border border-solid hidden md:block"
        >
          {/* Subtle Arc / Tick marks */}
          <div className="absolute top-[15%] left-[15%] w-[70%] h-[70%] rounded-full border border-dashed opacity-40 border-indigo-500/10" />
        </motion.div>

        {/* Medium ring behind the Login Card (Right) */}
        <motion.div
          animate={shouldReduceMotion || !isTabActive ? {} : { rotate: -360 }}
          transition={{ duration: 18000, repeat: Infinity, ease: "linear" }}
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(40, 60, 120, 0.06)",
          }}
          className="absolute top-[22%] right-[5%] w-[38vw] h-[38vw] max-w-[500px] max-h-[500px] rounded-full border border-solid"
        >
          {/* Edge highlighted arc */}
          <div className="absolute inset-0 rounded-full border border-l-transparent border-t-indigo-500/20 border-r-transparent border-b-transparent animate-pulse" />
        </motion.div>

        {/* Small rotating center object (Bottom center, rotates 1 deg every 25s -> 9000s rotation) */}
        <motion.div
          animate={
            shouldReduceMotion || !isTabActive
              ? {}
              : {
                  y: [0, -10, 0],
                }
          }
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute bottom-[10%] left-[45%] w-[80px] h-[80px] hidden md:flex items-center justify-center opacity-50"
        >
          <motion.svg
            animate={shouldReduceMotion || !isTabActive ? {} : { rotate: 360 }}
            transition={{ duration: 9000, repeat: Infinity, ease: "linear" }}
            viewBox="0 0 100 100"
            className={isDark ? "text-white" : "text-indigo-900"}
            style={{ opacity: 0.05 }}
          >
            <polygon
              points="50,10 85,30 85,70 50,90 15,70 15,30"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" strokeWidth="1" />
          </motion.svg>
        </motion.div>

        {/* Thin technical construction lines (2% Opacity) */}
        <svg 
          className={`absolute inset-0 w-full h-full hidden lg:block ${
            isDark ? "text-white" : "text-indigo-900"
          }`}
          style={{ opacity: 0.02 }}
        >
          {/* Technical horizontal coordinate rule */}
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5 5" />
          {/* Subtle vertical rule */}
          <line x1="30%" y1="0" x2="30%" y2="100%" stroke="currentColor" strokeWidth="0.5" />
          <line x1="70%" y1="0" x2="70%" y2="100%" stroke="currentColor" strokeWidth="0.5" strokeDasharray="20 10" />
        </svg>
      </motion.div>

      {/* ── Soft background twinkling accents (3% Opacity) ─────────────────── */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            animate={
              shouldReduceMotion || !isTabActive
                ? {}
                : {
                    opacity: [0.015, 0.07, 0.015],
                  }
            }
            transition={{
              duration: 20 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              position: "absolute",
              left: `${((i * 31) % 90) + 5}%`,
              top: `${((i * 23) % 80) + 10}%`,
              width: (i % 2) + 2,
              height: (i % 2) + 2,
              transform: "translateZ(0)",
            }}
            className="rounded-full bg-slate-400/20 dark:bg-white/20 blur-[0.5px]"
          />
        ))}
      </div>
    </div>
  );
}
