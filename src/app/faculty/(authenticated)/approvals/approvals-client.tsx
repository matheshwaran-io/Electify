"use client";

import { motion } from "framer-motion";
import { FileText, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { listDelay, spring } from "@/lib/motion";

type Registration = {
  id: string;
  studentId: string;
  studentName: string;
  registerNumber: string | null;
  submittedAt: Date;
  electiveName: string;
  courseCode: string | null;
  groupName: string;
  eventName: string;
  eventStatus: string;
};

export function ApprovalsClient({ registrations }: { registrations: Registration[] }) {
  // Group by student
  const byStudent = registrations.reduce<Record<string, Registration[]>>((acc, r) => {
    if (!acc[r.studentId]) acc[r.studentId] = [];
    acc[r.studentId].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-fg">Registration Approvals</h1>
        <p className="text-fg-muted mt-1">
          {Object.keys(byStudent).length} students have submitted registrations.
        </p>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-20 text-fg-muted">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No registrations submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byStudent).map(([studentId, regs], i) => (
            <motion.div
              key={studentId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.gentle, delay: listDelay(i, 0.05) }}
              className="bg-surface border border-border rounded-card overflow-hidden"
            >
              {/* Student Header */}
              <div className="flex items-center gap-4 px-6 py-4 border-b border-border bg-surface-2/20">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-primary-fg font-bold shrink-0 bg-brand">
                  {regs[0].studentName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-fg">{regs[0].studentName}</p>
                  <p className="text-xs text-fg-muted font-mono">{regs[0].registerNumber ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-success-text bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {regs.length} elective(s) registered
                </div>
              </div>

              {/* Registrations */}
              <div className="divide-y divide-border">
                {regs.map((reg) => (
                  <div key={reg.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-fg">{reg.electiveName}</p>
                      <p className="text-xs text-fg-muted">
                        {reg.courseCode ? `${reg.courseCode} · ` : ""}
                        {reg.groupName} · {reg.eventName}
                      </p>
                    </div>
                    <StatusBadge status={reg.eventStatus} />
                    <p className="text-xs text-fg-muted whitespace-nowrap">
                      {format(new Date(reg.submittedAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
