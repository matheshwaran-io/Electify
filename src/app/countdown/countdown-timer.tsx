"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Calendar, Clock, RefreshCw } from "lucide-react";

interface CountdownTimerProps {
  startDateStr: string;
  registrationEnabled: boolean;
}

export function CountdownTimer({ startDateStr, registrationEnabled }: CountdownTimerProps) {
  const router = useRouter();
  const targetTime = React.useMemo(() => new Date(startDateStr).getTime(), [startDateStr]);

  const [timeLeft, setTimeLeft] = React.useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isOver: false,
    totalRemainingMs: 0,
  });

  const totalDuration = React.useMemo(() => {
    return 24 * 60 * 60 * 1000; // 24 hours max fallback
  }, []);

  React.useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetTime - Date.now();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOver: true, totalRemainingMs: 0 });
        return true;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        isOver: false,
        totalRemainingMs: difference,
      });

      return false;
    };

    const isOver = calculateTimeLeft();
    if (isOver) {
      if (registrationEnabled) {
        router.push("/dashboard");
        router.refresh();
      } else {
        // Just refresh to get the latest settings
        router.refresh();
      }
      return;
    }

    const timer = setInterval(() => {
      const isOver = calculateTimeLeft();
      if (isOver) {
        clearInterval(timer);
        if (registrationEnabled) {
          toast.success("Registration is now open! Navigating...");
          router.push("/dashboard");
          router.refresh();
        } else {
          router.refresh();
        }
      }
    }, 1000);

    // If the timer is over and registration is still not enabled, poll every 5 seconds to check if settings changed
    let pollTimer: NodeJS.Timeout;
    if (isOver && !registrationEnabled) {
      pollTimer = setInterval(() => {
        router.refresh();
      }, 5000);
    }

    return () => {
      clearInterval(timer);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [targetTime, router, registrationEnabled]);

  const formattedDate = React.useMemo(() => {
    return new Date(startDateStr).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [startDateStr]);

  const formattedTime = React.useMemo(() => {
    return new Date(startDateStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [startDateStr]);

  if (timeLeft.isOver) {
    return (
      <div className="text-center py-6 space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500" />
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          {!registrationEnabled
            ? "Waiting for coordinator to enable registration..."
            : "Registration is open! Loading dashboard..."}
        </p>
      </div>
    );
  }

  // Calculate circular stroke offset
  const size = 200;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const remainingFraction = Math.min(1, timeLeft.totalRemainingMs / totalDuration);
  const strokeDashoffset = circumference - remainingFraction * circumference;

  const timeBlocks = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Mins", value: timeLeft.minutes },
    { label: "Secs", value: timeLeft.seconds },
  ];

  return (
    <div className="flex flex-col items-center space-y-8">
      {/* Circular Timer Visualizer */}
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <defs>
            <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          {/* Track circle */}
          <circle
            className="stroke-slate-100 dark:stroke-slate-900"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Animated Progress Indicator */}
          <motion.circle
            stroke="url(#timerGradient)"
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "linear" }}
            r={radius}
            cx={size / 2}
            cy={size / 2}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Digital Clock Display */}
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-extrabold tracking-tighter text-slate-900 dark:text-white tabular-nums">
            {String(timeLeft.hours).padStart(2, "0")}:{String(timeLeft.minutes).padStart(2, "0")}:{String(timeLeft.seconds).padStart(2, "0")}
          </span>
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
            Remaining Time
          </span>
        </div>
      </div>

      {/* Structured Time Blocks */}
      <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
        {timeBlocks.map((block) => (
          <div key={block.label} className="border border-slate-200/50 dark:border-slate-800/50 bg-white/40 dark:bg-slate-950/30 backdrop-blur-sm shadow-sm rounded-inputs p-3 flex flex-col items-center justify-center">
            <span className="text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">
              {String(block.value).padStart(2, "0")}
            </span>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
              {block.label}
            </span>
          </div>
        ))}
      </div>

      {/* Date & Time Widget */}
      <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/30 dark:border-slate-800/30 px-4 py-2.5 rounded-buttons">
        <span className="flex items-center gap-1.5 text-slate-700 dark:text-indigo-400">
          <Calendar className="w-3.5 h-3.5" /> {formattedDate}
        </span>
        <span className="flex items-center gap-1.5 text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" /> Opens at {formattedTime}
        </span>
      </div>
    </div>
  );
}
