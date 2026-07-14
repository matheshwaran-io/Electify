"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

export function RegistrationTimeline({ event }: { event: any }) {
  const now = new Date();
  
  let currentStage = 0; // 0: Configured, 1: Published, 2: Open, 3: Closing Soon, 4: Closed
  
  if (event.status === "CLOSED" || (event.closeDate && now > event.closeDate)) {
    currentStage = 4;
  } else if (event.openDate && event.closeDate && now >= event.openDate && now <= event.closeDate) {
    const totalDuration = new Date(event.closeDate).getTime() - new Date(event.openDate).getTime();
    const elapsed = now.getTime() - new Date(event.openDate).getTime();
    if (elapsed / totalDuration > 0.8) {
      currentStage = 3; // 80% through
    } else {
      currentStage = 2;
    }
  } else if (event.openDate && now < event.openDate) {
    currentStage = 1;
  } else {
    currentStage = 0;
  }

  const stages = [
    { label: "Configured" },
    { label: "Published" },
    { label: "Portal Open" },
    { label: "Closing Soon" },
    { label: "Closed" },
  ];

  return (
    <div className="col-span-1 lg:col-span-12 bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 shadow-sm overflow-x-auto">
      <div className="min-w-[600px] flex items-center justify-between relative px-4 py-2">
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-[var(--border)] -z-10" />
        
        <motion.div 
          className="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-500 -z-10"
          initial={{ width: 0 }}
          animate={{ width: `calc(${(currentStage / (stages.length - 1)) * 100}% - 4rem)` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />

        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStage;
          const isCurrent = idx === currentStage;
          
          return (
            <div key={idx} className="flex flex-col items-center gap-3 relative bg-[var(--card)] px-2">
              <div 
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors duration-500 ${
                  isCompleted ? "bg-indigo-500 border-indigo-500 text-white" :
                  isCurrent ? "bg-[var(--background)] border-indigo-500 text-indigo-500" :
                  "bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)]"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : 
                 isCurrent ? <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" /> :
                 <div className="w-2 h-2 rounded-full bg-[var(--muted-foreground)]" />}
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider ${
                isCurrent ? "text-indigo-500" :
                isCompleted ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"
              }`}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
