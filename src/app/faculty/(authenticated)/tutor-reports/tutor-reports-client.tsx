"use client";

import { motion } from "framer-motion";
import { FileText, Users, CheckCircle, Search } from "lucide-react";
import { useState } from "react";

type Registration = { studentId: string; electiveName: string; groupName: string; eventName: string };
type Student = { id: string; name: string; registerNumber: string | null; isEligible: boolean; registrations: Registration[] };
type ReportData = { students: Student[]; totalStudents: number; registeredCount: number };

export function TutorReportsClient({ reportData }: { reportData: ReportData }) {
  const { students, totalStudents, registeredCount } = reportData;
  const overallPct = totalStudents > 0 ? Math.round((registeredCount / totalStudents) * 100) : 0;

  const [search, setSearch] = useState("");
  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registerNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Reports</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Registration completion statistics for your section.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">Total Students</p>
          </div>
          <p className="text-3xl font-bold text-[var(--foreground)]">{totalStudents}</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">Registered</p>
          </div>
          <p className="text-3xl font-bold text-[var(--foreground)]">{registeredCount}</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">Completion Rate</p>
          </div>
          <p className="text-3xl font-bold text-[var(--foreground)]">{overallPct}%</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search students..."
          className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--accent)]/30">
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Student</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Register No.</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Registrations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-16 text-[var(--muted-foreground)]">
                    No students found.
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => {
                  const isRegistered = s.registrations.length > 0;
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-[var(--accent)]/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-[var(--foreground)]">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted-foreground)] font-mono text-xs">{s.registerNumber ?? "—"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${isRegistered ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-red-500/15 text-red-400 border-red-500/25"}`}>
                          {isRegistered ? "Registered" : "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--muted-foreground)] text-xs max-w-xs truncate">
                        {isRegistered ? s.registrations.map(r => r.electiveName).join(", ") : "—"}
                      </td>
                    </motion.tr>
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
