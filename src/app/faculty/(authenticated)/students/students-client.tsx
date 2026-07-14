"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Search, Trash2 } from "lucide-react";
import { deleteMultipleStudents } from "@/app/actions/coordinator";
import { useRouter } from "next/navigation";

type Student = { id: string; name: string; email: string; registerNumber: string | null; isActive: boolean; isEligible: boolean; createdAt: Date; sectionLabel: string | null };

export function StudentsClient({ students }: { students: Student[] }) {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registerNumber ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (s.sectionLabel ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected students?`)) return;
    
    setIsDeleting(true);
    try {
      await deleteMultipleStudents(Array.from(selectedIds));
      setSelectedIds(new Set());
      router.refresh();
    } catch (error: any) {
      alert(error.message || "Failed to delete students");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Students</h1>
          <p className="text-[var(--muted-foreground)] mt-1">{students.length} students in your programme.</p>
        </div>
        {selectedIds.size > 0 && (
          <button 
            onClick={handleDeleteSelected} 
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? "Deleting..." : `Delete Selected (${selectedIds.size})`}
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, register number, or section…"
          className="w-full pl-11 pr-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--accent)]/30">
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500/50 cursor-pointer"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filtered.map(s => s.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Student</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Register No.</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Section</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Active</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Eligible</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[var(--muted-foreground)]">
                    <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    No students found.
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-[var(--accent)]/20 transition-colors">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500/50 cursor-pointer"
                        checked={selectedIds.has(s.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedIds);
                          if (e.target.checked) newSet.add(s.id);
                          else newSet.delete(s.id);
                          setSelectedIds(newSet);
                        }}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--foreground)]">{s.name}</p>
                          <p className="text-xs text-[var(--muted-foreground)]">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[var(--muted-foreground)]">{s.registerNumber ?? "—"}</td>
                    <td className="px-6 py-4">
                      {s.sectionLabel ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Section {s.sectionLabel}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium ${s.isActive ? "text-emerald-400" : "text-red-400"}`}>{s.isActive ? "Yes" : "No"}</span></td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium ${s.isEligible ? "text-emerald-400" : "text-orange-400"}`}>{s.isEligible ? "Yes" : "No"}</span></td>
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
