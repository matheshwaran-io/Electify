"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { UserCheck, RefreshCw, AlertTriangle, Info, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getLiveActivityEvents } from "@/app/actions/replay";

export function LiveActivityFeed({ eventId }: { eventId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getLiveActivityEvents(eventId);
      if (res.success && res.data) {
        setEvents(res.data.events);
      }
      setLoading(false);
    }
    load();
    
    // In a real app we'd subscribe to realtime updates here
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [eventId]);

  function getEventDetails(ev: any) {
    switch (ev.eventType) {
      case "STUDENT_REGISTERED":
        return {
          icon: <UserCheck className="w-4 h-4 text-emerald-500" />,
          color: "bg-emerald-500/10 border-emerald-500/20",
          title: "Registered",
          desc: ev.subjectName,
        };
      case "STUDENT_CHANGED_CHOICE":
        return {
          icon: <RefreshCw className="w-4 h-4 text-indigo-500" />,
          color: "bg-indigo-500/10 border-indigo-500/20",
          title: "Changed Choice",
          desc: `${ev.oldSubject} → ${ev.newSubject}`,
        };
      case "REGISTRATION_RESET":
        return {
          icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
          color: "bg-red-500/10 border-red-500/20",
          title: "Registration Reset",
          desc: ev.subjectName ? `Refunded seats for ${ev.subjectName}` : "Section reset",
        };
      default:
        return {
          icon: <Info className="w-4 h-4 text-gray-500" />,
          color: "bg-gray-500/10 border-gray-500/20",
          title: ev.eventType,
          desc: ev.subjectName || "",
        };
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-sm col-span-1 lg:col-span-4 flex flex-col h-[480px] overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] shrink-0 flex items-center justify-between bg-[var(--background)]/50">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Live Activity Feed</h3>
        {loading && <Loader2 className="w-3.5 h-3.5 text-[var(--muted-foreground)] animate-spin" />}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {events.map((ev, idx) => {
            const details = getEventDetails(ev);
            return (
              <motion.div
                key={ev.id}
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                className={`p-3 rounded-xl border ${details.color} transition-colors`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[var(--foreground)] truncate max-w-[150px]">
                    {ev.studentName || "System"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    {format(new Date(ev.timestamp), "HH:mm:ss")}
                  </span>
                </div>
                <div className="flex gap-3 mt-2">
                  <div className="mt-0.5 shrink-0">{details.icon}</div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--foreground)] uppercase tracking-wider">{details.title}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                      {details.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {!loading && events.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--muted-foreground)]">
            <Info className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">No recent activity.</p>
          </div>
        )}
      </div>
    </div>
  );
}
