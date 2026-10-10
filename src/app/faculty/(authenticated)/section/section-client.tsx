"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { Users, Search, ShieldCheck, Clock, Plus, X, Download, Upload, Pencil, Trash2 } from "lucide-react";
import { createStudent, importStudentsCSV, updateStudent, deleteStudent, unlockStudentRegistration, deleteMultipleStudentsTutor, deleteAllSectionStudents } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { TutorSectionOnboarding } from "@/components/tutor-section-onboarding";
import { toast } from "sonner";
import { listDelay, transition } from "@/lib/motion";

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
type Session = { name: string; sectionId?: string; role?: string };

export function SectionClient({ reportData, session }: { reportData: ReportData; session: Session }) {
  const [students, setStudents] = useState<Student[]>(reportData.students);
  const totalStudents = reportData.totalStudents ?? students.length;
  const registeredCount = reportData.registeredCount ?? 0;
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  
  const [newName, setNewName] = useState("");
  const [newRegNo, setNewRegNo] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Presence tracking
  useEffect(() => {
    const channel = supabase.channel('online-users');

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const onlineIds = new Set<string>();
      for (const id in state) {
        onlineIds.add(id);
      }
      setOnlineUserIds(onlineIds);
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Keep students list up to date if reportData changes
  useEffect(() => {
    setStudents(reportData.students);
  }, [reportData.students]);

  // Real-time updates for live registrations
  useEffect(() => {
    const channel = supabase
      .channel("public:student_registrations_section")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_registrations" },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.registerNumber ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (!session.sectionId) {
    return <TutorSectionOnboarding />;
  }

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

  function openEditModal(student: Student) {
    setEditingStudentId(student.id);
    setNewName(student.name);
    setNewRegNo(student.registerNumber || "");
    setNewEmail(student.email || "");
    setIsEditModalOpen(true);
  }

  async function handleEditSave() {
    if (!newName || !newRegNo || !newEmail || !editingStudentId) return;
    setIsSaving(true);
    try {
      await updateStudent(editingStudentId, { name: newName, registerNumber: newRegNo, email: newEmail });
      setIsEditModalOpen(false);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteStudent(id: string) {
    if (!confirm("Are you sure want to delete this student? Their registration selections will also be deleted permanently.")) return;
    try {
      await deleteStudent(id);
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleUnlockStudent(id: string) {
    if (!confirm("Are you sure want to unlock this student's registration? This allows them edit their locked choices.")) return;
    try {
      await unlockStudentRegistration(id);
      router.refresh();
      alert("Registration successfully unlocked.");
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure want to delete ${selectedIds.size} selected students?`)) return;
    
    setIsDeletingBulk(true);
    try {
      await deleteMultipleStudentsTutor(Array.from(selectedIds));
      setSelectedIds(new Set());
      router.refresh();
      alert("Students deleted successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to delete students");
    } finally {
      setIsDeletingBulk(false);
    }
  }

  async function handleDeleteAll() {
    const confirmDelete = window.prompt("Type 'CONFIRM' to delete ALL students in your section. This will also erase their registrations. action cannot be undone.");
    if (confirmDelete !== "CONFIRM") return;
    setIsDeletingAll(true);
    try {
      await deleteAllSectionStudents();
      toast.success("All students have been deleted.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete students");
    } finally {
      setIsDeletingAll(false);
    }
  }

  function handleDownloadTemplate() {
    const headers = ["Name", "Register Number", "Email"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + "John Doe,RA2211003010123,jd1234@srmist.edu.in";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_import_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
      
      // Assume first line is header
      const dataLines = lines.slice(1);
      const parsedData = dataLines.map(line => {
        const [name, registerNumber, email] = line.split(",").map(val => val.trim());
        return { name, registerNumber, email };
      }).filter(s => s.name && s.registerNumber && s.email);

      if (parsedData.length === 0) {
        throw new Error("No valid data found in CSV. Make sure you match the template.");
      }

      const result = await importStudentsCSV(parsedData);
      alert(`Imported ${result.imported} students. Skipped ${result.skipped} (already exist).`);
      router.refresh();
    } catch (err: any) {
      alert("Error importing CSV: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-8 relative">
      <div>
        <h1 className="text-3xl font-bold text-fg">Student Directory</h1>
        <p className="text-fg-muted mt-1">Review student registrations and eligibility for your section.</p>
      </div>

      {!session.sectionId && (
        <div className="bg-warning/10 border border-warning/30 rounded-card p-6 text-sm text-warning-text">
          ⚠ Your account doesn't have a section assigned. Please contact the System Administrator.
        </div>
      )}

      {/* Top Statistic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-card p-6 flex items-center justify-between shadow-1">
          <div>
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-primary-text" />
            </div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Intake Count</p>
            <p className="text-3xl font-bold text-fg mt-1">{totalStudents}</p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-6 flex items-center justify-between shadow-1">
          <div>
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-warning-text" />
            </div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Submitted Count</p>
            <p className="text-3xl font-bold text-fg mt-1">{registeredCount}</p>
          </div>
        </div>
      </div>

      {/* Directory Table Area */}
      <div className="bg-surface border border-border rounded-panel shadow-1 overflow-hidden">
        <div className="px-6 py-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-fg flex items-center gap-2">
              <Users className="w-5 h-5 text-fg-muted" />
              Student Directory
            </h2>
            <p className="text-sm text-fg-muted mt-1">
              Verify registration eligibility status and submission receipts.
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 flex-wrap sm:flex-nowrap">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-9 pr-4 py-2 bg-surface border border-border-strong rounded-control text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            
            <button 
              onClick={handleDownloadTemplate}
              className="bg-surface border border-border text-fg px-4 py-2 rounded-control text-sm font-medium hover:bg-surface-2 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download Template
            </button>
            
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="bg-surface border border-border text-fg px-4 py-2 rounded-control text-sm font-medium hover:bg-surface-2 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" /> {isUploading ? "Importing..." : "Import CSV"}
            </button>

            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-primary text-primary-fg px-4 py-2 rounded-control text-sm font-medium hover:bg-primary-strong transition whitespace-nowrap flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Student
            </button>
            
            <button 
              onClick={handleDeleteAll}
              disabled={isDeletingAll || students.length === 0}
              className="bg-danger/10 text-danger-text px-4 py-2 rounded-control text-sm font-medium hover:bg-danger/20 transition whitespace-nowrap flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> {isDeletingAll ? "Deleting..." : "Delete All"}
            </button>

            {selectedIds.size > 0 && (
              <button 
                onClick={handleDeleteSelected}
                disabled={isDeletingBulk}
                className="bg-danger-strong text-primary-fg px-4 py-2 rounded-control text-sm font-medium hover:bg-danger-strong transition flex items-center gap-2 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> {isDeletingBulk ? "Deleting..." : `Delete (${selectedIds.size})`}
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded-badge border-border-strong text-primary-text focus-visible:ring-ring cursor-pointer"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(filtered.map(s => s.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
                <th className="px-6 py-4 font-semibold text-fg-muted text-xs tracking-wider uppercase">Name</th>
                <th className="px-6 py-4 font-semibold text-fg-muted text-xs tracking-wider uppercase">Register Number</th>
                <th className="px-6 py-4 font-semibold text-fg-muted text-xs tracking-wider uppercase">SRM Email</th>
                <th className="px-6 py-4 font-semibold text-fg-muted text-xs tracking-wider uppercase">Submitted</th>
                <th className="px-6 py-4 font-semibold text-fg-muted text-xs tracking-wider uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-fg-muted">
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
                      transition={{ ...transition.fade, delay: listDelay(i, 0.02) }}
                      className="hover:bg-surface-2/10 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded-badge border-border-strong text-primary-text focus-visible:ring-ring cursor-pointer"
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) newSet.add(s.id);
                            else newSet.delete(s.id);
                            setSelectedIds(newSet);
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 text-fg font-medium">
                        <div className="flex items-center gap-2">
                          {s.name}
                          {onlineUserIds.has(s.id) && (
                            <span className="w-2 h-2 rounded-full bg-success" title="Online now" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-fg">
                        {s.registerNumber ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-fg-muted">
                        {s.email ?? "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded-badge text-xs font-bold ${isRegistered ? "text-success-text bg-success/10" : "text-danger-text bg-danger/10"}`}>
                          {isRegistered ? "YES" : "NO"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {(session.role === "SUPER_ADMIN" || session.role === "COURSE_COORDINATOR") && isRegistered && (
                            <button onClick={() => handleUnlockStudent(s.id)} className="p-1.5 text-warning-text hover:bg-warning/10 rounded-badge transition-colors" title="Unlock Registration">
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => openEditModal(s)} className="p-1.5 text-primary-text hover:bg-primary/10 rounded-badge transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeleteStudent(s.id)} className="p-1.5 text-danger-text hover:bg-danger/10 rounded-badge transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-border rounded-card w-full max-w-md shadow-3 overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h3 className="text-xl font-bold text-fg">Add New Student</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-fg-muted hover:text-fg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-fg-muted mb-1 uppercase">Full Name</label>
                  <input 
                    value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2 bg-surface border border-border-strong rounded-control text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-muted mb-1 uppercase">Register Number</label>
                  <input 
                    value={newRegNo} onChange={e => setNewRegNo(e.target.value)}
                    placeholder="e.g. RA2211003010xxx"
                    className="w-full px-4 py-2 bg-surface border border-border-strong rounded-control text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-muted mb-1 uppercase">SRM Email</label>
                  <input 
                    value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="e.g. jd1234@srmist.edu.in"
                    className="w-full px-4 py-2 bg-surface border border-border-strong rounded-control text-sm"
                  />
                </div>
              </div>
              <div className="p-6 bg-surface-2 border-t border-border flex justify-end gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-control text-sm font-medium hover:bg-surface-3 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddStudent}
                  disabled={isSaving}
                  className="bg-primary text-primary-fg px-6 py-2 rounded-control text-sm font-medium hover:bg-primary-strong transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Add Student"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Student Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-surface border border-border rounded-card w-full max-w-md shadow-3 overflow-hidden"
            >
              <div className="flex justify-between items-center p-6 border-b border-border">
                <h3 className="text-xl font-bold text-fg">Edit Student</h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-fg-muted hover:text-fg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-fg-muted mb-1 uppercase">Full Name</label>
                  <input 
                    value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2 bg-surface border border-border-strong rounded-control text-sm focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-muted mb-1 uppercase">Register Number</label>
                  <input 
                    value={newRegNo} onChange={e => setNewRegNo(e.target.value)}
                    placeholder="e.g. RA2211003010xxx"
                    className="w-full px-4 py-2 bg-surface border border-border-strong rounded-control text-sm focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-fg-muted mb-1 uppercase">SRM Email</label>
                  <input 
                    value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    placeholder="e.g. jd1234@srmist.edu.in"
                    className="w-full px-4 py-2 bg-surface border border-border-strong rounded-control text-sm focus-visible:ring-2 focus-visible:ring-ring outline-none"
                  />
                </div>
              </div>
              <div className="p-6 bg-surface-2 border-t border-border flex justify-end gap-3">
                <button 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-control text-sm font-medium hover:bg-surface-2 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleEditSave}
                  disabled={isSaving}
                  className="bg-primary text-primary-fg px-6 py-2 rounded-control text-sm font-medium hover:bg-primary-strong transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
