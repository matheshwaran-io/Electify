import { motion } from "framer-motion";

export function SeatAllocationChart({ 
  electives, 
  seatMap, 
  currentEventId 
}: { 
  electives: any[]; 
  seatMap: Map<string, number>;
  currentEventId?: string;
}) {
  return (
    <div className="space-y-6">
      {electives.map((el) => {
        const available = seatMap.get(el.id) ?? el.maxSeats;
        const filled = el.maxSeats - available;
        const fillPercentage = Math.min(100, Math.max(0, (filled / el.maxSeats) * 100));
        
        const isUpdated = currentEventId === el.id;

        return (
          <div 
            key={el.id} 
            className={`p-4 rounded-xl border transition-all duration-300 ${isUpdated ? 'bg-indigo-500/10 border-indigo-500/30 shadow-sm' : 'bg-[var(--background)] border-[var(--border)]'}`}
          >
            <div className="flex justify-between items-center mb-3">
              <div>
                <h4 className="font-bold text-sm text-[var(--foreground)]">{el.courseCode ? `${el.courseCode} - ${el.name}` : el.name}</h4>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-[var(--muted-foreground)]">Filled / Max</p>
                <p className="text-sm font-mono text-[var(--foreground)] mt-0.5">
                  <motion.span 
                    key={filled}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-block"
                  >
                    {filled}
                  </motion.span>
                  {" "} / {el.maxSeats}
                </p>
              </div>
            </div>

            <div className="h-3 bg-[var(--accent)] rounded-full overflow-hidden relative">
              <motion.div 
                className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${fillPercentage}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted-foreground)]">
                {fillPercentage.toFixed(1)}% Capacity
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500">
                {available} Seats Left
              </span>
            </div>
          </div>
        );
      })}

      {electives.length === 0 && (
        <div className="text-center text-sm text-[var(--muted-foreground)] py-8">
          No electives found for this event.
        </div>
      )}
    </div>
  );
}
