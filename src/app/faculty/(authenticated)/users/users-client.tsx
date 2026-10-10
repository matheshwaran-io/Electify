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
        <h1 className="text-3xl font-bold text-fg">Users</h1>
        <p className="text-fg-muted mt-1">All staff and student accounts in the system.</p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex bg-surface border border-border rounded-control p-1">
          {(["staff", "students"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-control text-sm font-medium capitalize transition-all ${tab === t ? "bg-primary text-primary-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {t === "staff" ? <Users className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
              {t} ({t === "staff" ? staff.length : students.length})
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "staff" ? "Search by name or email…" : "Search by name or register number…"}
            className="w-full pl-11 pr-4 py-3 bg-surface border border-border-strong rounded-control text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          {tab === "staff" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/30">
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Name</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Email</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Employee ID</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Role</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Status</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Joined</th>
                  <th className="text-right px-6 py-4 font-semibold text-fg-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStaff.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...transition.fade, delay: listDelay(i, 0.02) }} className="hover:bg-surface-2/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-primary-fg text-xs font-bold shrink-0 bg-brand">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-fg">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-fg-muted">{u.email}</td>
                    <td className="px-6 py-4 text-fg-muted font-mono text-xs">{u.employeeId ?? "—"}</td>
                    <td className="px-6 py-4"><StatusBadge status={u.role} /></td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium ${u.isActive ? "text-success-text" : "text-danger-text"}`}>
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-fg-muted">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                    <td className="px-6 py-4 text-right">
                      {u.role === "CLASS_TUTOR" && (
                        <button
                          onClick={() => setManagingTutor(u)}
                          className="px-3 py-1.5 text-xs font-semibold text-primary-text bg-primary/10 hover:bg-primary/10 rounded-badge transition-colors"
                        >
                          Manage Sections
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
                {filteredStaff.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-fg-muted">No staff found.</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2/30">
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Name</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Register No.</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Programme</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Active</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Eligible</th>
                  <th className="text-left px-6 py-4 font-semibold text-fg-muted">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((u, i) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...transition.fade, delay: listDelay(i, 0.02) }} className="hover:bg-surface-2/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-fg-muted text-xs font-bold shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-fg">{u.name}</p>
                          <p className="text-xs text-fg-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-fg-muted">{u.registerNumber ?? "—"}</td>
                    <td className="px-6 py-4 text-fg-muted">{u.programmeName ?? "—"}</td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium ${u.isActive ? "text-success-text" : "text-danger-text"}`}>{u.isActive ? "Yes" : "No"}</span></td>
                    <td className="px-6 py-4"><span className={`text-xs font-medium ${u.isEligible ? "text-success-text" : "text-warning-text"}`}>{u.isEligible ? "Yes" : "No"}</span></td>
                    <td className="px-6 py-4 text-fg-muted">{format(new Date(u.createdAt), "MMM d, yyyy")}</td>
                  </motion.tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-fg-muted">No students found.</td></tr>
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
import { listDelay, transition } from "@/lib/motion";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm animate-[fadeIn_0.2s_ease-out_1]">
      <div className="bg-surface border border-border rounded-card w-full max-w-xl shadow-3 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 flex items-center justify-between border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-bold text-fg">Manage Tutor Sections</h2>
            <p className="text-sm text-fg-muted mt-1">Assign classes to {tutor.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-fg-muted hover:bg-surface-2 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1 scrollbar-thin">
          {Object.entries(grouped).map(([groupName, secs]) => (
            <div key={groupName} className="space-y-3">
              <h3 className="text-xs font-bold text-fg-muted uppercase tracking-wider">{groupName}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {secs.map(sec => {
                  const isSelected = selectedIds.includes(sec.id);
                  return (
                    <button
                      key={sec.id}
                      onClick={() => toggleSection(sec.id)}
                      className={`flex items-center gap-2 p-3 rounded-control border text-sm font-semibold transition-all ${
                        isSelected 
                          ? "bg-primary border-primary text-primary-fg" 
                          : "bg-surface-2/30 border-border text-fg-muted hover:border-primary/30 hover:text-fg"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? "border-border bg-surface/20" : "border-border-strong"}`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-primary-fg" strokeWidth={3} />}
                      </div>
                      Sec {sec.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-8 text-fg-muted">No sections available in the system.</div>
          )}
        </div>

        <div className="p-6 border-t border-border bg-surface-2/10 shrink-0 flex items-center justify-between">
          <span className="text-sm font-semibold text-fg-muted">{selectedIds.length} section(s) selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-fg-muted hover:text-fg transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 bg-primary hover:bg-primary-strong text-primary-fg text-sm font-bold rounded-control transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Assignments"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
