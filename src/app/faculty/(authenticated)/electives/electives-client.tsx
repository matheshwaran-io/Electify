"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { listDelay, spring } from "@/lib/motion";

type Elective = { id: string; name: string; courseCode: string | null; credits: number; maxSeats: number; availableSeats: number; isFull: boolean };
type Group = { eventId: string; eventName: string; eventStatus: string; groupId: string; groupName: string; electives: Elective[] };

export function ElectivesClient({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-fg">Electives</h1>
          <p className="text-fg-muted mt-1">Elective courses in your programme's events.</p>
        </div>
        <div className="text-center py-20 text-fg-muted">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No electives configured yet.</p>
        </div>
      </div>
    );
  }

  // Group by event
  const byEvent = groups.reduce<Record<string, Group[]>>((acc, g) => {
    if (!acc[g.eventId]) acc[g.eventId] = [];
    acc[g.eventId].push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-fg">Electives</h1>
        <p className="text-fg-muted mt-1">Elective courses in your programme's events.</p>
      </div>

      {Object.entries(byEvent).map(([eventId, eventGroups]) => (
        <div key={eventId} className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-fg">{eventGroups[0].eventName}</h2>
            <StatusBadge status={eventGroups[0].eventStatus} />
          </div>

          {eventGroups.map((group) => (
            <div key={group.groupId} className="bg-surface border border-border rounded-card overflow-hidden">
              <div className="px-6 py-4 border-b border-border bg-surface-2/20">
                <h3 className="font-semibold text-fg">{group.groupName}</h3>
                <p className="text-xs text-fg-muted">{group.electives.length} elective(s)</p>
              </div>
              <div className="divide-y divide-border">
                {group.electives.map((elective, i) => (
                  <motion.div
                    key={elective.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ ...spring.gentle, delay: listDelay(i, 0.04) }}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    <div className="w-9 h-9 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-4 h-4 text-primary-text" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-fg">{elective.name}</p>
                      <p className="text-xs text-fg-muted">
                        {elective.courseCode ? `${elective.courseCode} · ` : ""}{elective.credits} credits
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${elective.isFull ? "text-danger-text" : "text-success-text"}`}>
                        {elective.availableSeats}/{elective.maxSeats}
                      </p>
                      <p className="text-xs text-fg-muted">seats left</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
