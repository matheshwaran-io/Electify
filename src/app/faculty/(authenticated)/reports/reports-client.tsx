"use client";

import { motion } from "framer-motion";
import { FileText, Users, CheckCircle, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type SectionReport = { sectionId: string; sectionLabel: string; totalStudents: number; registeredCount: number };

export function ReportsClient({ report }: { report: SectionReport[] }) {
  const totalStudents = report.reduce((s, r) => s + r.totalStudents, 0);
  const totalRegistered = report.reduce((s, r) => s + r.registeredCount, 0);
  const overallPct = totalStudents > 0 ? Math.round((totalRegistered / totalStudents) * 100) : 0;

  const exportCSV = () => {
    const headers = ["Section", "Total Students", "Registered", "Completion Rate"];
    const rows = report.map(r => {
      const pct = r.totalStudents > 0 ? Math.round((r.registeredCount / r.totalStudents) * 100) : 0;
      return [r.sectionLabel, r.totalStudents, r.registeredCount, `${pct}%`];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "registration_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Registration Report", 14, 15);
    
    const tableData = report.map(r => {
      const pct = r.totalStudents > 0 ? Math.round((r.registeredCount / r.totalStudents) * 100) : 0;
      return [r.sectionLabel, r.totalStudents, r.registeredCount, `${pct}%`];
    });

    autoTable(doc, {
      head: [["Section", "Total Students", "Registered", "Completion Rate"]],
      body: tableData,
      startY: 20,
    });
    
    doc.save("registration_report.pdf");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Registration Reports</h1>
          <p className="text-[var(--muted-foreground)] mt-1">Section-wise registration completion statistics.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-[var(--card)] hover:bg-[var(--accent)] border border-[var(--border)] rounded-xl text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> PDF
          </button>
        </div>
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
          <p className="text-3xl font-bold text-[var(--foreground)]">{totalRegistered}</p>
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

      {/* Section Breakdown */}
      {report.length === 0 ? (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>No sections in your programme yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {report.map((sec, i) => {
            const pct = sec.totalStudents > 0 ? Math.round((sec.registeredCount / sec.totalStudents) * 100) : 0;
            return (
              <motion.div
                key={sec.sectionId}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center font-bold text-indigo-400 text-sm">
                      {sec.sectionLabel}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">Section {sec.sectionLabel}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">{sec.registeredCount} / {sec.totalStudents} registered</p>
                    </div>
                  </div>
                  <span className={`text-2xl font-bold ${pct >= 80 ? "text-emerald-400" : pct >= 50 ? "text-orange-400" : "text-red-400"}`}>
                    {pct}%
                  </span>
                </div>
                <div className="w-full bg-[var(--accent)] rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.05 + 0.2 }}
                    className={`h-2 rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-orange-500" : "bg-red-500"}`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
