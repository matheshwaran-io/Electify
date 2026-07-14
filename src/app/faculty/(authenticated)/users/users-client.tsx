"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Users, GraduationCap } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";

type StaffUser = { id: string; name: string; email: string; role: string; employeeId: string | null; isActive: boolean; createdAt: Date; managedSectionIds?: string[] };
type StudentUser = { id: string; name: string; email: string; registerNumber: string | null; isActive: boolean; isEligible: boolean; createdAt: Date; programmeName: string | null };

export function UsersClient({ staff, students, hierarchy }: { staff: StaffUser[]; students: StudentUser[]; hierarchy: any[] }) {
  const [tab, setTab] = useState<"staff" | "students">("staff");
  const [search, setSearch] = useState("");
  const [managingTutor, setManagingTutor] = useState<StaffUser | null>(null);

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
                  <th className="text-right px-6 py-4 font-semibold text-[var(--muted-foreground)]">Actions</th>
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
                    <td className="px-6 py-4 text-right">
                      {u.role === "CLASS_TUTOR" && (
                        <button
                          onClick={() => setManagingTutor(u)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-md transition-colors"
                        >
                          Manage Sections
                        </button>
                      )}
                    </td>
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

      {managingTutor && (
        <ManageTutorSectionsModal
          tutor={managingTutor}
          hierarchy={hierarchy}
          onClose={() => setManagingTutor(null)}
        />
      )}
    </div>
  );
}

import { X, Check } from "lucide-react";
import { assignTutorSections } from "@/app/actions/admin";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

function ManageTutorSectionsModal({ tutor, hierarchy, onClose }: { tutor: StaffUser; hierarchy: any[]; onClose: () => void }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(tutor.managedSectionIds || []);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await assignTutorSections(tutor.id, selectedIds);
      toast.success("Sections updated successfully");
      router.refresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update sections");
    } finally {
      setIsSaving(false);
    }
  };

  // Flatten sections from hierarchy for easy rendering
  const allSections: { id: string; label: string; programme: string; batch: string }[] = [];
  hierarchy.forEach(f => f.departments.forEach((d: any) => d.programmes.forEach((p: any) => p.batches.forEach((b: any) => b.sections.forEach((s: any) => {
    allSections.push({ id: s.id, label: s.label, programme: p.name, batch: b.year });
  })))));

  // Group sections by programme > batch
  const grouped = allSections.reduce((acc, sec) => {
    const key = `${sec.programme} (${sec.batch})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sec);
    return acc;
  }, {} as Record<string, typeof allSections>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out_1]">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 flex items-center justify-between border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">Manage Tutor Sections</h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">Assign classes to {tutor.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-[var(--muted-foreground)] hover:bg-[var(--accent)] rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {Object.entries(grouped).map(([groupName, secs]) => (
            <div key={groupName} className="space-y-3">
              <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider">{groupName}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {secs.map(sec => {
                  const isSelected = selectedIds.includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      onClick={() => toggleSection(sec.id)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                        isSelected 
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md" 
                          : "bg-[var(--accent)]/30 border-[var(--border)] text-[var(--muted-foreground)] hover:border-indigo-500/30 hover:text-[var(--foreground)]"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-white bg-white/20" : "border-slate-400 dark:border-slate-600"}`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      Sec {sec.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-8 text-[var(--muted-foreground)]">No sections available in the system.</div>
          )}
        </div>

        <div className="p-6 border-t border-[var(--border)] bg-[var(--accent)]/10 shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--muted-foreground)]">{selectedIds.length} section(s) selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Assignments"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
