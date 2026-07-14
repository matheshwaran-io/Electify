import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { UserCheck, RefreshCw, AlertTriangle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function EventFeed({ events, currentIndex }: { events: any[]; currentIndex: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Show events up to current index
  const visibleEvents = events.slice(Math.max(0, currentIndex - 50), currentIndex + 1);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [currentIndex]);

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
    <div ref={containerRef} className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {visibleEvents.map((ev, idx) => {
          const details = getEventDetails(ev);
          const isLatest = ev.id === events[currentIndex]?.id;

          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              className={`p-3 rounded-xl border ${details.color} transition-colors ${isLatest ? 'ring-2 ring-indigo-500/50' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-[var(--muted-foreground)]">
                  {format(new Date(ev.timestamp), "HH:mm:ss")}
                </span>
                <span className="text-xs font-bold text-[var(--foreground)] truncate max-w-[150px]">
                  {ev.studentName || "System"}
                </span>
              </div>
              <div className="flex gap-3 mt-2">
                <div className="mt-0.5 shrink-0">{details.icon}</div>
                <div>
                  <p className="text-sm font-bold text-[var(--foreground)]">{details.title}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                    {details.desc}
                  </p>
                  {ev.seatAfter !== null && (
                    <p className="text-[10px] font-mono text-[var(--muted-foreground)] mt-1">
                      Seats: {ev.seatBefore} → {ev.seatAfter}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      {visibleEvents.length === 0 && (
        <div className="text-center text-sm text-[var(--muted-foreground)] py-8">
          Awaiting events...
        </div>
      )}
    </div>
  );
}
