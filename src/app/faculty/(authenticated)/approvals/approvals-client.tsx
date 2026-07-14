"use client";

import { motion } from "framer-motion";
import { FileText, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";

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
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Registration Approvals</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          {Object.keys(byStudent).length} students have submitted registrations.
        </p>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-20 text-[var(--muted-foreground)]">
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
              transition={{ delay: i * 0.05 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden"
            >
              {/* Student Header */}
              <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--border)] bg-[var(--accent)]/20">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
                  {regs[0].studentName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--foreground)]">{regs[0].studentName}</p>
                  <p className="text-xs text-[var(--muted-foreground)] font-mono">{regs[0].registerNumber ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {regs.length} elective(s) registered
                </div>
              </div>

              {/* Registrations */}
              <div className="divide-y divide-[var(--border)]">
                {regs.map((reg) => (
                  <div key={reg.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--foreground)]">{reg.electiveName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {reg.courseCode ? `${reg.courseCode} · ` : ""}
                        {reg.groupName} · {reg.eventName}
                      </p>
                    </div>
                    <StatusBadge status={reg.eventStatus} />
                    <p className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
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
