"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { transition } from "@/lib/motion";

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
    <div className="col-span-1 lg:col-span-12 bg-surface border border-border rounded-panel p-6 shadow-1 overflow-x-auto">
      <div className="min-w-[600px] flex items-center justify-between relative px-4 py-2">
        <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-0.5 bg-border -z-10" />
        
        <motion.div 
          className="absolute left-8 top-1/2 -translate-y-1/2 h-0.5 bg-primary -z-10"
          initial={{ width: 0 }}
          animate={{ width: `calc(${(currentStage / (stages.length - 1)) * 100}% - 4rem)` }}
          transition={transition.value}
        />

        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStage;
          const isCurrent = idx === currentStage;
          
          return (
            <div key={idx} className="flex flex-col items-center gap-3 relative bg-surface px-2">
              <div 
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors duration-500 ${
                  isCompleted ? "bg-primary border-primary text-primary-fg" :
                  isCurrent ? "bg-surface border-primary text-primary-text" :
                  "bg-surface border-border text-fg-muted"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : 
                 isCurrent ? <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" /> :
                 <div className="w-2 h-2 rounded-full bg-fg-muted" />}
              </div>
              <span className={`text-2xs uppercase font-bold tracking-wider ${
                isCurrent ? "text-primary-text" :
                isCompleted ? "text-fg" : "text-fg-muted"
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
