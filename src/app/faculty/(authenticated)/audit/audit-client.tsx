"use client";

import * as React from "react";
import { ClipboardList, ShieldAlert, Calendar, User, Eye, EyeOff } from "lucide-react";
import { getAuditLogs } from "@/app/actions/audit";
import { toast } from "sonner";

interface LogEntry {
  id: string;
  action: string;
  userId: string | null;
  userEmail: string | null;
  ipAddress: string | null;
  metadata: string | null;
  createdAt: string;
}

interface ClientProps {
  initialLogs: LogEntry[];
}

export function AuditLogsClient({ initialLogs }: ClientProps) {
  const [logs, setLogs] = React.useState<LogEntry[]>(initialLogs);
  const [loading, setLoading] = React.useState(false);
  const [selectedLogId, setSelectedLogId] = React.useState<string | null>(null);

  const refreshLogs = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs();
      if (res.success && res.data) {
        setLogs(res.data);
        toast.success("Audit logs updated.");
      } else {
        toast.error(res.error || "Failed to load audit logs.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    let color = "bg-slate-500/10 text-slate-600 dark:text-slate-400";
    if (action.includes("REGISTERED") || action.includes("ENABLED") || action.includes("GRANTED")) {
      color = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    } else if (action.includes("REVOKED") || action.includes("DISABLED") || action.includes("SUSPENDED")) {
      color = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    } else if (action.includes("DELETE") || action.includes("EXPIRED")) {
      color = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
    } else if (action.includes("CREATE") || action.includes("IMPORT")) {
      color = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
    }

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border border-current/10 ${color}`}>
        {action.replace(/_/g, " ")}
      </span>
    );
  };

  const formatMetadata = (metaStr: string | null) => {
    if (!metaStr) return "No details provided.";
    try {
      const parsed = JSON.parse(metaStr);
      return (
        <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200/50 dark:border-white/[0.05] overflow-x-auto select-text whitespace-pre-wrap">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch {
      return <span className="font-mono text-[10px] text-slate-500">{metaStr}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/[0.08] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-indigo-500" />
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              Audit Event Log
            </h2>
          </div>
          <button
            onClick={refreshLogs}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Logs"}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/30 dark:bg-slate-900/20 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-extrabold">
                <th className="py-3 px-6">Event Time</th>
                <th className="py-3 px-6">Action / Event</th>
                <th className="py-3 px-6">Actor (Staff Account)</th>
                <th className="py-3 px-6 text-center">Metadata Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 px-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-600">
                    No system audit logs found in database.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = selectedLogId === log.id;
                  
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="text-xs hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors">
                        <td className="py-4 px-6 text-slate-500 dark:text-slate-400 font-semibold space-y-0.5">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(log.createdAt).toLocaleDateString()}
                          </p>
                          <p className="pl-4.5 text-[10px] text-slate-400 dark:text-slate-500">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </p>
                        </td>
                        <td className="py-4 px-6 font-bold">
                          {getActionBadge(log.action)}
                        </td>
                        <td className="py-4 px-6 space-y-0.5">
                          <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {log.userEmail || "SYSTEM"}
                          </p>
                          {log.userId && (
                            <p className="pl-4.5 text-[9px] font-mono text-slate-400 dark:text-slate-500">
                              UID: {log.userId}
                            </p>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => setSelectedLogId(isExpanded ? null : log.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/[0.08] text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all active:scale-95"
                          >
                            {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isExpanded ? "Hide Details" : "View Details"}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Collapsible details drawer inside table */}
                      {isExpanded && (
                        <tr className="bg-slate-50/10 dark:bg-slate-950/20">
                          <td colSpan={4} className="py-3 px-8 border-l-2 border-indigo-500">
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                Event Event Metadata Properties
                              </p>
                              {formatMetadata(log.metadata)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
