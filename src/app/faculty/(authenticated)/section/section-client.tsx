"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, ShieldCheck, CheckCircle2, Clock, Plus, X } from "lucide-react";
import { createStudent } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";

type Registration = { studentId: string; electiveName: string; groupName: string; eventName: string };
type Student = { 
  id: string; 
  name: string; 
  email: string | null;
  registerNumber: string | null; 
  isActive: boolean; 
  isEligible: boolean; 
  registrations: Registration[] 
};
type ReportData = { students: Student[]; totalStudents: number; registeredCount: number };
type Session = { name: string; sectionId?: string };

export function SectionClient({ reportData, session }: { reportData: ReportData; session: Session }) {
  const router = useRouter();
  const { students, totalStudents, registeredCount } = reportData;
  const [search, setSearch] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRegNo, setNewRegNo] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registerNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const eligibleCount = students.filter((s) => s.isEligible).length;
  const activeCount = students.filter((s) => s.isActive).length;

  async function handleAddStudent() {
    if (!newName || !newRegNo || !newEmail) return;
    setIsSaving(true);
    try {
      await createStudent({ name: newName, registerNumber: newRegNo, email: newEmail });
      setIsModalOpen(false);
      setNewName("");
      setNewRegNo("");
      setNewEmail("");
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Student Directory</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Review student registrations and eligibility for your section.</p>
      </div>

      {!session.sectionId && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-6 text-sm text-orange-400">
          ⚠ Your account doesn't have a section assigned. Please contact the System Admin.
        </div>
      )}

      {/* Top Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Intake Count</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{totalStudents}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Eligible Count</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{eligibleCount}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Active Logins</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{activeCount}</p>
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div>
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Submitted Count</p>
            <p className="text-3xl font-bold text-[var(--foreground)] mt-1">{registeredCount}</p>
          </div>
        </div>
      </div>

      {/* Directory Table Area */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-6 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
              <Users className="w-5 h-5 text-[var(--muted-foreground)]" />
              Student Directory
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              Verify registration eligibility status and submission receipts.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-9 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-500 transition shadow-md shadow-indigo-500/20 whitespace-nowrap flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Student
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[var(--background)]/50 border-b border-[var(--border)]">
                <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Register Number</th>
                <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Name</th>
                <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">SRM Email</th>
                <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Eligible</th>
                <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Login Active</th>
                <th className="px-6 py-4 font-semibold text-[var(--muted-foreground)] text-xs tracking-wider uppercase">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[var(--muted-foreground)]">
                    No students match your search.
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
                      className="hover:bg-[var(--accent)]/10 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-[var(--foreground)]">
                        {s.registerNumber ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-[var(--foreground)] font-medium">
                        {s.name}
                      </td>
                      <td className="px-6 py-4 text-[var(--muted-foreground)]">
                        {s.email ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${s.isEligible ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"}`}>
                          {s.isEligible ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${s.isActive ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"}`}>
                          {s.isActive ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-md text-xs font-bold ${isRegistered ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"}`}>
                          {isRegistered ? "YES" : "NO"}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-[var(--border)]">
                <h3 className="text-xl font-bold text-[var(--foreground)]">Add New Student</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Full Name</label>
                  <input 
                    value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">Register Number</label>
                  <input 
                    value={newRegNo} onChange={e => setNewRegNo(e.target.value)}
                    placeholder="e.g. RA2211003010xxx"
                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] mb-1 uppercase">SRM Email</label>
                  <input 
                    value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="e.g. jd1234@srmist.edu.in"
                    className="w-full px-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm"
                  />
                </div>
              </div>
              <div className="p-6 bg-[var(--background)] border-t border-[var(--border)] flex justify-end gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-black/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddStudent}
                  disabled={isSaving}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-indigo-500 transition-colors shadow-md disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Add Student"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
