"use client";

import { motion } from "framer-motion";
import { ShieldAlert, Activity } from "lucide-react";
import { format } from "date-fns";
import { listDelay, transition } from "@/lib/motion";

type AuditLog = { id: string; action: string; userId: string | null; userEmail: string | null; userRole: string | null; ipAddress: string | null; createdAt: Date };
type Data = { logs: AuditLog[]; total: number; pages: number; page: number };

const ROLE_DISPLAY: Record<string, string> = {
  SYSTEM_ADMIN: "System Administrator",
  COURSE_COORDINATOR: "Course Coordinator",
  CLASS_TUTOR: "Class Tutor",
  STUDENT: "Student",
};

export function AuditClient({ data }: { data: Data }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-fg">Audit Logs</h1>
          <p className="text-fg-muted mt-1">{data.total} total events recorded.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-fg-muted bg-surface border border-border px-4 py-2 rounded-control">
          <ShieldAlert className="w-4 h-4" />
          Page {data.page} of {data.pages}
        </div>
      </div>

      <div className="bg-surface rounded-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Action</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">User</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Role</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">IP Address</th>
                <th className="text-left px-6 py-4 font-semibold text-fg-muted">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-fg-muted">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No audit logs yet.
                  </td>
                </tr>
              ) : (
                data.logs.map((log, i) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ ...transition.fade, delay: listDelay(i, 0.02) }}
                    className="hover:bg-surface-2/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-control bg-primary/10 flex items-center justify-center shrink-0">
                          <Activity className="w-3.5 h-3.5 text-primary-text" />
                        </div>
                        <span className="font-medium text-fg">{log.action.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-fg-muted">{log.userEmail ?? "—"}</td>
                    <td className="px-6 py-4 text-fg-muted text-xs">
                      {log.userRole ? (ROLE_DISPLAY[log.userRole] ?? log.userRole.replace(/_/g, " ")) : "—"}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-fg-muted">{log.ipAddress ?? "—"}</td>
                    <td className="px-6 py-4 text-fg-muted whitespace-nowrap">
                      {format(new Date(log.createdAt), "MMM d, yyyy · h:mm a")}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
