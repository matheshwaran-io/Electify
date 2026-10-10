"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Search, Trash2, Download, Filter, ChevronLeft, ChevronRight, ArrowUpDown, CheckCircle } from "lucide-react";
import { deleteMultipleStudents } from "@/app/actions/coordinator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { listDelay, transition } from "@/lib/motion";

type Student = { id: string; name: string; email: string; registerNumber: string | null; isActive: boolean; isEligible: boolean; createdAt: Date; sectionLabel: string | null };

export function StudentsClient({ students }: { students: Student[] }) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filters & Sorting
  const [sectionFilter, setSectionFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"NAME" | "REG_NO">("NAME");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Extract unique sections
  const sections = useMemo(() => {
    const secs = new Set<string>();
    students.forEach(s => {
      if (s.sectionLabel) secs.add(s.sectionLabel);
    });
    return Array.from(secs).sort();
  }, [students]);

  // Apply Filters & Search
  const filteredAndSorted = useMemo(() => {
    const result = students.filter(s => {
      // Search
      const searchLower = search.toLowerCase();
      const matchesSearch = 
        s.name.toLowerCase().includes(searchLower) ||
        (s.registerNumber ?? "").toLowerCase().includes(searchLower) ||
        (s.sectionLabel ?? "").toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;

      // Section
      if (sectionFilter !== "ALL" && s.sectionLabel !== sectionFilter) return false;

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let valA = "";
      let valB = "";
      if (sortField === "NAME") {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      } else if (sortField === "REG_NO") {
        valA = (a.registerNumber || "").toLowerCase();
        valB = (b.registerNumber || "").toLowerCase();
      }
      
      if (valA < valB) return sortOrder === "ASC" ? -1 : 1;
      if (valA > valB) return sortOrder === "ASC" ? 1 : -1;
      return 0;
    });

    return result;
  }, [students, search, sectionFilter, sortField, sortOrder]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / itemsPerPage));
  const currentData = filteredAndSorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 on filter changes
  useEffect(() => { setCurrentPage(1); }, [search, sectionFilter, sortField, sortOrder]);

  // Handlers
  const toggleSort = (field: "NAME" | "REG_NO") => {
    if (sortField === field) {
      setSortOrder(prev => prev === "ASC" ? "DESC" : "ASC");
    } else {
      setSortField(field);
      setSortOrder("ASC");
    }
  };

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure want to delete ${selectedIds.size} selected students? This cannot be undone.`)) return;
    
    setIsDeleting(true);
    try {
      await deleteMultipleStudents(Array.from(selectedIds));
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} students deleted successfully`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete students");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleExportCSV() {
    if (filteredAndSorted.length === 0) return toast.error("No students to export");
    
    const headers = ["Name", "Email", "Register Number", "Section"];
    const rows = filteredAndSorted.map(s => [
      `"${s.name}"`,
      `"${s.email}"`,
      `"${s.registerNumber || ""}"`,
      `"${s.sectionLabel || ""}"`
    ]);
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `students_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-fg">Student Directory</h1>
          <p className="text-fg-muted mt-1">{students.length} total students enrolled.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="bg-surface border border-border text-fg px-4 py-2.5 rounded-control text-sm font-medium hover:bg-surface-2 transition shadow-1 flex items-center gap-2 outline-none"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-surface p-4 rounded-card border border-border shadow-1 flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-11 pr-4 py-2.5 bg-surface border border-border-strong rounded-control text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {sections.length > 0 && (
            <div className="flex items-center gap-2 bg-surface border border-border rounded-control px-3 py-1">
              <Filter className="w-3.5 h-3.5 text-fg-muted" />
              <select 
                value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
                className="bg-transparent text-sm font-medium text-fg focus-visible:outline-none py-1.5 outline-none cursor-pointer"
              >
                <option value="ALL">All Sections</option>
                {sections.map(sec => (
                  <option key={sec} value={sec}>Section {sec}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions Banner */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-primary/10 border border-primary/20 rounded-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="text-primary-text font-medium text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              {selectedIds.size} student{selectedIds.size > 1 ? 's' : ''} selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={handleDeleteSelected} disabled={isDeleting}
                className="px-3 py-1.5 bg-danger-strong text-primary-fg text-xs font-bold rounded-control hover:bg-danger-strong transition flex items-center gap-1.5 outline-none"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Table */}
      <div className="bg-surface rounded-panel border border-border overflow-hidden shadow-1">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-surface-2 border-b border-border">
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded-badge border-border-strong text-primary-text focus-visible:ring-ring cursor-pointer"
                    checked={currentData.length > 0 && selectedIds.size === filteredAndSorted.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredAndSorted.map(s => s.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => toggleSort("NAME")} className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-fg-muted hover:text-fg transition outline-none">
                    Student <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-4">
                  <button onClick={() => toggleSort("REG_NO")} className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-fg-muted hover:text-fg transition outline-none">
                    Register No. <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-4 font-bold text-xs uppercase tracking-wider text-fg-muted">Section</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-20">
                    <GraduationCap className="w-10 h-10 mx-auto mb-3 text-fg-muted opacity-50" />
                    <p className="text-fg font-medium mb-1">No students found</p>
                    <p className="text-fg-muted text-sm">Try adjusting your search or filters.</p>
                  </td>
                </tr>
              ) : (
                currentData.map((s, i) => (
                  <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ ...transition.fade, delay: listDelay(i, 0.02) }} className="hover:bg-surface-2/30 transition-colors">
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary-text text-sm font-bold shrink-0 ring-2 ring-canvas">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-fg">{s.name}</p>
                          <p className="text-xs text-fg-muted font-medium">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-fg-muted bg-surface-2 rounded-badge inline-block my-4 mx-6 px-2 py-1">{s.registerNumber ?? "—"}</td>
                    <td className="px-6 py-4">
                      {s.sectionLabel ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-badge text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary-text">
                          Sec {s.sectionLabel}
                        </span>
                      ) : "—"}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border bg-surface-2 flex items-center justify-between">
            <p className="text-xs font-medium text-fg-muted">
              Showing <span className="text-fg font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-fg font-bold">{Math.min(currentPage * itemsPerPage, filteredAndSorted.length)}</span> of <span className="text-fg font-bold">{filteredAndSorted.length}</span> students
            </p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-control border border-border text-fg hover:bg-surface-2 disabled:opacity-50 transition outline-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-xs font-bold text-fg-muted px-2">
                Page {currentPage} of {totalPages}
              </div>
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-control border border-border text-fg hover:bg-surface-2 disabled:opacity-50 transition outline-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
