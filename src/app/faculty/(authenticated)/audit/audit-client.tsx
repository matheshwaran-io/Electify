"use client";

import { motion } from "framer-motion";
import { ShieldAlert, Activity } from "lucide-react";
import { format } from "date-fns";

type AuditLog = { id: string; action: string; userId: string | null; userEmail: string | null; userRole: string | null; ipAddress: string | null; createdAt: Date };
type Data = { logs: AuditLog[]; total: number; pages: number; page: number };

export function AuditClient({ data }: { data: Data }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Audit Logs</h1>
          <p className="text-[var(--muted-foreground)] mt-1">{data.total} total events recorded.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)] bg-[var(--card)] border border-[var(--border)] px-4 py-2 rounded-xl">
          <ShieldAlert className="w-4 h-4" />
          Page {data.page} of {data.pages}
        </div>
      </div>

      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--accent)]/30">
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Action</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">User</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Role</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">IP Address</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16 text-[var(--muted-foreground)]">
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
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-[var(--accent)]/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                          <Activity className="w-3.5 h-3.5 text-indigo-400" />
                        </div>
                        <span className="font-medium text-[var(--foreground)]">{log.action.replace(/_/g, " ")}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">{log.userEmail ?? "—"}</td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)] text-xs">{log.userRole ?? "—"}</td>
                    <td className="px-6 py-4 font-mono text-xs text-[var(--muted-foreground)]">{log.ipAddress ?? "—"}</td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)] whitespace-nowrap">
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
