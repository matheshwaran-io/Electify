"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, GraduationCap } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";

type StaffUser = { id: string; name: string; email: string; role: string; employeeId: string | null; isActive: boolean; createdAt: Date };
type StudentUser = { id: string; name: string; email: string; registerNumber: string | null; isActive: boolean; isEligible: boolean; createdAt: Date; programmeName: string | null };

export function UsersClient({ staff, students }: { staff: StaffUser[]; students: StudentUser[] }) {
  const [tab, setTab] = useState<"staff" | "students">("staff");
  const [search, setSearch] = useState("");

  const filteredStaff = staff.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );
  const filteredStudents = students.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || (u.registerNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Users</h1>
        <p className="text-[var(--muted-foreground)] mt-1">All staff and student accounts in the system.</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex bg-[var(--card)] border border-[var(--border)] rounded-xl p-1">
          {(["staff", "students"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${tab === t ? "bg-indigo-600 text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              {t === "staff" ? <Users className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
              {t} ({t === "staff" ? staff.length : students.length})
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "staff" ? "Search by name or email…" : "Search by name or register number…"}
            className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "staff" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--accent)]/30">
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Name</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Email</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Employee ID</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Role</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Status</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredStaff.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-[var(--accent)]/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-[var(--foreground)]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">{u.email}</td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)] font-mono text-xs">{u.employeeId ?? "—"}</td>
                    <td className="px-6 py-4"><StatusBadge status={u.role} /></td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium ${u.isActive ? "text-emerald-400" : "text-red-400"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                  </motion.tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">No staff found.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--accent)]/30">
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Name</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Register No.</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Programme</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Active</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Eligible</th>
                  <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredStudents.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-[var(--accent)]/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{u.name}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[var(--muted-foreground)]">{u.registerNumber ?? "—"}</td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">{u.programmeName ?? "—"}</td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium ${u.isActive ? "text-emerald-400" : "text-red-400"}`}>{u.isActive ? "Yes" : "No"}</span></td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium ${u.isEligible ? "text-emerald-400" : "text-orange-400"}`}>{u.isEligible ? "Yes" : "No"}</span></td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                  </motion.tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-[var(--muted-foreground)]">No students found.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
