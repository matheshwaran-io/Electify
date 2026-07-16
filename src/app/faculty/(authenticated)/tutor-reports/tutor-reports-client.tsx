"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Users, CheckCircle, Search, Download, ChevronDown, ChevronRight,
  BarChart3, Clock, BookOpen, Filter, TrendingUp, FileSpreadsheet,
} from "lucide-react";
import { useState, useMemo, useEffect, Fragment } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { TutorSectionOnboarding } from "@/components/tutor-section-onboarding";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { resetSectionRegistrationEvent, manualRegisterStudentByTutor } from "@/app/actions/tutor";

type Registration = {
  studentId: string;
  electiveName: string;
  courseCode: string | null;
  credits: number;
  groupName: string;
  eventName: string;
};

type Student = {
  id: string;
  name: string;
  registerNumber: string | null;
  isEligible: boolean;
  email: string;
  registrations: Registration[];
  registrationStatus: string;
  receiptNumber: string | null;
  submittedAt: string | null;
};

type GroupSummary = {
  groupName: string;
  electiveName: string;
  courseCode: string | null;
  count: number;
};

type ElectiveOption = {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  courseCode: string | null;
  availableSeats: number;
  isFull: boolean;
};

type ReportData = {
  students: Student[];
  totalStudents: number;
  registeredCount: number;
  sectionLabel: string;
  programmeName: string;
  departmentName: string;
  groups: GroupSummary[];
  eventId?: string | null;
  eventStatus?: string;
  availableElectives?: ElectiveOption[];
};

type TabId = "overview" | "students" | "subjects";

export function TutorReportsClient({ reportData, hasActiveSection = true }: { reportData: ReportData, hasActiveSection?: boolean }) {
  const router = useRouter();
  const { students, totalStudents, registeredCount, sectionLabel, programmeName, departmentName, groups, eventId, eventStatus, availableElectives } = reportData;
  const pendingCount = totalStudents - registeredCount;
  const overallPct = totalStudents > 0 ? Math.round((registeredCount / totalStudents) * 100) : 0;

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [statusFilter, setStatusFilter] = useState<"all" | "registered" | "pending">("all");
  const [expandedStudents, setExpandedStudents] = useState<Set<string>>(new Set());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isResetting, setIsResetting] = useState(false);

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

  const filtered = useMemo(() => {
    let list = students;
    if (statusFilter === "registered") list = list.filter(s => s.registrationStatus === "CONFIRMED");
    if (statusFilter === "pending") list = list.filter(s => s.registrationStatus !== "CONFIRMED");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.registerNumber ?? "").toLowerCase().includes(q) ||
        (s.receiptNumber ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [students, search, statusFilter]);

  // Group the subjects by group name for the Subjects tab
  const groupedSubjects = useMemo(() => {
    const map = new Map<string, GroupSummary[]>();
    for (const g of groups) {
      const arr = map.get(g.groupName) || [];
      arr.push(g);
      map.set(g.groupName, arr);
    }
    return Array.from(map.entries());
  }, [groups]);

  const toggleExpanded = (id: string) => {
    setExpandedStudents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReset = async () => {
    const confirmReset = window.prompt("Type 'CONFIRM' to reset all registrations for this section. This action cannot be undone.");
    if (confirmReset !== "CONFIRM") return;
    setIsResetting(true);
    try {
      await resetSectionRegistrationEvent();
      toast.success("Registrations reset successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset registrations");
    } finally {
      setIsResetting(false);
    }
  };

  if (!hasActiveSection) {
    return <TutorSectionOnboarding />;
  }

  // ── Premium CSV Export ──────────────────────────────────────────────────
  const exportCSV = () => {
    const BOM = "\uFEFF";
    const lines: string[] = [];

    // Header section
    lines.push(`"ELECTIFY - REGISTRATION REPORT"`);
    lines.push(`"Generated","${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}"`);
    if (sectionLabel) lines.push(`"Section","${sectionLabel}"`);
    if (programmeName) lines.push(`"Programme","${programmeName}"`);
    if (departmentName) lines.push(`"Department","${departmentName}"`);
    lines.push(`"Total Students","${totalStudents}"`);
    lines.push(`"Registered","${registeredCount}"`);
    lines.push(`"Pending","${pendingCount}"`);
    lines.push(`"Completion Rate","${overallPct}%"`);
    lines.push("");

    // Student details
    lines.push(`"S.No","Student Name","Register Number","Email","Status","Receipt No.","Submitted At","Elective Groups & Subjects"`);
    students.forEach((s, idx) => {
      const isRegistered = s.registrationStatus === "CONFIRMED";
      const regs = s.registrations.map(r => `${r.groupName}: ${r.courseCode ? r.courseCode + " - " : ""}${r.electiveName}`).join(" | ");
      const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
      lines.push(`"${idx + 1}","${s.name}","${s.registerNumber ?? "—"}","${s.email}","${isRegistered ? "Confirmed" : "Pending"}","${s.receiptNumber ?? "—"}","${submittedAt}","${regs || "—"}"`);
    });

    lines.push("");
    lines.push(`"SUBJECT DISTRIBUTION"`);
    lines.push(`"Elective Group","Course Code","Subject Name","Students Enrolled"`);
    groups.forEach(g => {
      lines.push(`"${g.groupName}","${g.courseCode ?? "—"}","${g.electiveName}","${g.count}"`);
    });

    lines.push("");
    lines.push(`"SUBJECT-WISE STUDENT LIST"`);
    
    groupedSubjects.forEach(([groupName, groupSubjects]) => {
      groupSubjects.forEach(subject => {
        lines.push("");
        lines.push(`"Group: ${groupName} | Subject: ${subject.courseCode ? subject.courseCode + ' - ' : ''}${subject.electiveName}"`);
        lines.push(`"S.No","Student Name","Register Number","Email","Receipt No.","Submitted At"`);
        
        const enrolledStudents = students.filter(s => 
          s.registrationStatus === "CONFIRMED" && 
          s.registrations.some(r => r.groupName === groupName && r.electiveName === subject.electiveName)
        );
        
        if (enrolledStudents.length === 0) {
          lines.push(`"No students enrolled yet."`);
        } else {
          enrolledStudents.forEach((s, idx) => {
            const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
            lines.push(`"${idx + 1}","${s.name}","${s.registerNumber ?? "—"}","${s.email}","${s.receiptNumber ?? "—"}","${submittedAt}"`);
          });
        }
      });
    });

    const blob = new Blob([BOM + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Electify_Report_Section_${sectionLabel || "All"}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Premium PDF Export ─────────────────────────────────────────────────
  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ELECTIFY", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Elective Registration Report", 14, 23);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })}`, pageWidth - 14, 15, { align: "right" });
    if (sectionLabel) doc.text(`Section ${sectionLabel} • ${programmeName} • ${departmentName}`, pageWidth - 14, 22, { align: "right" });

    // Summary boxes
    const boxY = 38;
    const boxW = (pageWidth - 56) / 4;
    const summaryData = [
      { label: "Total Students", value: String(totalStudents), color: [59, 130, 246] as [number, number, number] },
      { label: "Registered", value: String(registeredCount), color: [16, 185, 129] as [number, number, number] },
      { label: "Pending", value: String(pendingCount), color: [239, 68, 68] as [number, number, number] },
      { label: "Completion", value: `${overallPct}%`, color: [139, 92, 246] as [number, number, number] },
    ];
    summaryData.forEach((item, i) => {
      const x = 14 + i * (boxW + 8);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x, boxY, boxW, 22, 3, 3, "F");
      doc.setDrawColor(...item.color);
      doc.setLineWidth(0.5);
      doc.roundedRect(x, boxY, boxW, 22, 3, 3, "S");
      doc.setTextColor(...item.color);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, x + boxW / 2, boxY + 11, { align: "center" });
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, x + boxW / 2, boxY + 18, { align: "center" });
    });

    // Student table
    let startY = boxY + 30;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Student Registration Details", 14, startY);
    startY += 4;

    const tableData = students.map((s, idx) => {
      const isRegistered = s.registrationStatus === "CONFIRMED";
      const regs = s.registrations.map(r => {
        const code = r.courseCode ? `${r.courseCode} - ` : "";
        return `[${r.groupName}] ${code}${r.electiveName}`;
      }).join("\n");
      const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—";
      return [
        String(idx + 1),
        s.name,
        s.registerNumber ?? "—",
        isRegistered ? "Confirmed" : "Pending",
        s.receiptNumber ?? "—",
        submittedAt,
        regs || "—",
      ];
    });

    autoTable(doc, {
      head: [["#", "Student Name", "Register No.", "Status", "Receipt No.", "Submitted", "Elective Groups & Subjects"]],
      body: tableData,
      startY,
      styles: { fontSize: 7, cellPadding: 3, lineWidth: 0.1, lineColor: [226, 232, 240] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 30 },
        5: { cellWidth: 28 },
        6: { cellWidth: "auto" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const val = data.cell.raw as string;
          if (val === "Confirmed") {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = "bold";
          } else {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
    });

    // Subject Distribution Page
    doc.addPage();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Subject Distribution Summary", 14, 16);

    autoTable(doc, {
      head: [["Elective Group", "Course Code", "Subject Name", "Students Enrolled"]],
      body: groups.map(g => [g.groupName, g.courseCode ?? "—", g.electiveName, String(g.count)]),
      startY: 30,
      styles: { fontSize: 8, cellPadding: 4, lineWidth: 0.1, lineColor: [226, 232, 240] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        3: { halign: "center", fontStyle: "bold" },
      },
    });

    // Subject-wise Student Lists
    groupedSubjects.forEach(([groupName, groupSubjects]) => {
      groupSubjects.forEach(subject => {
        doc.addPage();
        
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Subject: ${subject.courseCode ? subject.courseCode + ' - ' : ''}${subject.electiveName}`, 14, 16);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Group: ${groupName}`, pageWidth - 14, 16, { align: "right" });

        const enrolledStudents = students.filter(s => 
          s.registrationStatus === "CONFIRMED" && 
          s.registrations.some(r => r.groupName === groupName && r.electiveName === subject.electiveName)
        );

        if (enrolledStudents.length === 0) {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(10);
          doc.text("No students enrolled yet.", 14, 40);
        } else {
          const subjectTableData = enrolledStudents.map((s, idx) => {
            const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—";
            return [
              String(idx + 1),
              s.name,
              s.registerNumber ?? "—",
              s.email,
              s.receiptNumber ?? "—",
              submittedAt,
            ];
          });

          autoTable(doc, {
            head: [["#", "Student Name", "Register No.", "Email", "Receipt No.", "Submitted"]],
            body: subjectTableData,
            startY: 30,
            styles: { fontSize: 7, cellPadding: 3, lineWidth: 0.1, lineColor: [226, 232, 240] },
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
              0: { cellWidth: 10, halign: "center" },
            },
          });
        }
      });
    });

    // Footer on all pages
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      const h = doc.internal.pageSize.getHeight();
      doc.setFillColor(248, 250, 252);
      doc.rect(0, h - 12, pageWidth, 12, "F");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Electify • Page ${i} of ${pageCount}`, 14, h - 5);
      doc.text("Confidential - For Internal Use Only", pageWidth - 14, h - 5, { align: "right" });
    }

    doc.save(`Electify_Report_Section_${sectionLabel || "All"}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // ── Tab buttons ─────────────────────────────────────────────────────────
  const tabs: { id: TabId; label: string; icon: typeof Users }[] = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "students", label: "Students", icon: Users },
    { id: "subjects", label: "Subjects", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Registration Reports</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {sectionLabel ? `Section ${sectionLabel}` : "Your section"}{programmeName ? ` • ${programmeName}` : ""}{departmentName ? ` • ${departmentName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleReset}
            disabled={isResetting}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {isResetting ? "Resetting..." : "Reset Registrations"}
          </button>
          <button
            onClick={exportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-md"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span>CSV</span>
          </button>
          <button
            onClick={exportPDF}
            className="group relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-rose-500/25"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Users} label="Total Students" value={totalStudents} color="blue" />
        <SummaryCard icon={CheckCircle} label="Confirmed" value={registeredCount} color="emerald" />
        <SummaryCard icon={Clock} label="Pending" value={pendingCount} color="amber" />
        <CompletionCard pct={overallPct} />
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-xl p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <OverviewTab
              students={students}
              groups={groups}
              totalStudents={totalStudents}
              registeredCount={registeredCount}
              pendingCount={pendingCount}
            />
          </motion.div>
        )}
        {activeTab === "students" && (
          <motion.div key="students" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <StudentsTab
              filtered={filtered}
              search={search}
              setSearch={setSearch}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              expandedStudents={expandedStudents}
              toggleExpanded={toggleExpanded}
              onlineUserIds={onlineUserIds}
              eventId={eventId}
              eventStatus={eventStatus}
              availableElectives={availableElectives}
              groups={groups}
            />
          </motion.div>
        )}
        {activeTab === "subjects" && (
          <motion.div key="subjects" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            <SubjectsTab groupedSubjects={groupedSubjects} totalStudents={totalStudents} students={students} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Summary Card ───────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof Users; label: string; value: number; color: string }) {
  const colorClasses: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: "bg-blue-500/10", text: "text-blue-500", ring: "ring-blue-500/20" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-500", ring: "ring-emerald-500/20" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-500", ring: "ring-amber-500/20" },
  };
  const c = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 ring-1 ${c.ring}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${c.text}`} />
        </div>
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-3xl font-bold text-[var(--foreground)] tabular-nums">{value}</p>
    </div>
  );
}

// ── Completion Ring Card ──────────────────────────────────────────────────
function CompletionCard({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 ring-1 ring-violet-500/20 flex items-center gap-5">
      <div className="relative w-16 h-16 shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke="url(#grad)" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[var(--foreground)]">{pct}%</span>
      </div>
      <div>
        <p className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">Completion</p>
        <p className="text-lg font-bold text-[var(--foreground)] mt-1">Rate</p>
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({ students, groups, totalStudents, registeredCount, pendingCount }: {
  students: Student[];
  groups: GroupSummary[];
  totalStudents: number;
  registeredCount: number;
  pendingCount: number;
}) {
  const maxCount = Math.max(...groups.map(g => g.count), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Registration Status Breakdown */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--muted-foreground)]" />
          Registration Progress
        </h3>
        <div className="space-y-4">
          <ProgressBar label="Confirmed" value={registeredCount} max={totalStudents} color="emerald" />
          <ProgressBar label="Pending" value={pendingCount} max={totalStudents} color="amber" />
        </div>
        {/* Visual bar */}
        <div className="mt-6 h-3 rounded-full bg-[var(--accent)] overflow-hidden flex">
          {registeredCount > 0 && (
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700"
              style={{ width: `${(registeredCount / totalStudents) * 100}%` }}
            />
          )}
          {pendingCount > 0 && (
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
              style={{ width: `${(pendingCount / totalStudents) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Top Elective Subjects */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-5 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--muted-foreground)]" />
          Subject Enrollment
        </h3>
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)] text-center py-8">No registrations yet.</p>
          ) : (
            groups.slice(0, 10).map((g, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--foreground)] font-medium truncate max-w-[70%]">
                    {g.courseCode ? `${g.courseCode} — ` : ""}{g.electiveName}
                  </span>
                  <span className="text-[var(--muted-foreground)] tabular-nums font-medium">{g.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--accent)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(g.count / maxCount) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recently Registered */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 lg:col-span-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
          Recently Registered
        </h3>
        <div className="overflow-x-auto">
          {(() => {
            const recent = students
              .filter(s => s.registrationStatus === "CONFIRMED" && s.submittedAt)
              .sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime())
              .slice(0, 5);
            if (recent.length === 0) return <p className="text-sm text-[var(--muted-foreground)] text-center py-6">No confirmed registrations yet.</p>;
            return (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-[var(--muted-foreground)]">Student</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-[var(--muted-foreground)]">Register No.</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-[var(--muted-foreground)]">Receipt</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-[var(--muted-foreground)]">Submitted</th>
                    <th className="text-left py-2.5 px-3 text-xs font-medium text-[var(--muted-foreground)]">Subjects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {recent.map(s => (
                    <tr key={s.id} className="hover:bg-[var(--accent)]/30 transition-colors">
                      <td className="py-3 px-3 font-medium text-[var(--foreground)]">{s.name}</td>
                      <td className="py-3 px-3 text-[var(--muted-foreground)] font-mono text-xs">{s.registerNumber ?? "—"}</td>
                      <td className="py-3 px-3"><span className="text-xs font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md">{s.receiptNumber ?? "—"}</span></td>
                      <td className="py-3 px-3 text-[var(--muted-foreground)] text-xs">{new Date(s.submittedAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                      <td className="py-3 px-3">
                        <div className="space-y-1.5 max-w-[280px]">
                          {s.registrations.map((r, j) => (
                            <div key={j} className="flex items-start gap-1.5">
                              <span className="text-[10px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider shrink-0 pt-0.5 min-w-[60px]">{r.groupName}:</span>
                              <span className="text-xs text-[var(--foreground)] font-medium leading-tight">
                                {r.courseCode ? <span className="text-indigo-400">{r.courseCode}</span> : null}
                                {r.courseCode ? " — " : ""}{r.electiveName}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const gradients: Record<string, string> = {
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-amber-500 to-amber-400",
  };
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs font-medium text-[var(--muted-foreground)] w-20">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-[var(--accent)] overflow-hidden">
        <motion.div className={`h-full rounded-full bg-gradient-to-r ${gradients[color]}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} />
      </div>
      <span className="text-xs font-bold text-[var(--foreground)] tabular-nums w-12 text-right">{value} <span className="text-[var(--muted-foreground)] font-normal">/ {max}</span></span>
    </div>
  );
}

// ── Students Tab ──────────────────────────────────────────────────────────
function StudentsTab({ filtered, search, setSearch, statusFilter, setStatusFilter, expandedStudents, toggleExpanded, onlineUserIds, eventId, eventStatus, availableElectives, groups }: {
  filtered: Student[];
  search: string;
  setSearch: (s: string) => void;
  statusFilter: "all" | "registered" | "pending";
  setStatusFilter: (f: "all" | "registered" | "pending") => void;
  expandedStudents: Set<string>;
  toggleExpanded: (id: string) => void;
  onlineUserIds: Set<string>;
  eventId?: string | null;
  eventStatus?: string;
  availableElectives?: ElectiveOption[];
  groups?: GroupSummary[];
}) {
  const [registeringStudent, setRegisteringStudent] = useState<Student | null>(null);

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, register number, or receipt..."
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow"
          />
        </div>
        <div className="flex items-center gap-1 bg-[var(--card)] border border-[var(--border)] rounded-lg p-1">
          {(["all", "registered", "pending"] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === f
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {f === "all" ? "All" : f === "registered" ? "Confirmed" : "Pending"}
            </button>
          ))}
        </div>
      </div>

      {/* Student table */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Student</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Register No.</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Receipt</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Electives</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-[var(--muted-foreground)]">
                    No students found.
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => {
                  const isRegistered = s.registrationStatus === "CONFIRMED";
                  const isExpanded = expandedStudents.has(s.id);
                  const hasRegs = s.registrations.length > 0;

                  return (
                    <Fragment key={s.id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(i * 0.015, 0.3) }}
                        className={`hover:bg-[var(--accent)]/30 transition-colors cursor-pointer ${isExpanded ? "bg-[var(--accent)]/20" : ""}`}
                        onClick={() => hasRegs && toggleExpanded(s.id)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                                isRegistered
                                  ? "bg-gradient-to-br from-emerald-500 to-teal-600"
                                  : "bg-gradient-to-br from-slate-400 to-slate-500"
                              }`}>
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              {onlineUserIds.has(s.id) && (
                                <span className="absolute bottom-0 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[var(--background)] rounded-full animate-pulse" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-[var(--foreground)] block leading-tight">{s.name}</span>
                              <span className="text-[10px] text-[var(--muted-foreground)]">{s.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-[var(--muted-foreground)] font-mono text-xs">{s.registerNumber ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            isRegistered
                              ? "bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20"
                              : "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isRegistered ? "bg-emerald-500" : "bg-amber-500"}`} />
                            {isRegistered ? "Confirmed" : "Pending"}
                          </span>
                          {!isRegistered && eventStatus === "CLOSED" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setRegisteringStudent(s); }}
                              className="ml-3 inline-flex items-center gap-1 bg-indigo-500 text-white px-2 py-1 rounded text-[10px] font-medium hover:bg-indigo-600 transition-colors"
                            >
                              Manual Register
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {s.receiptNumber ? (
                            <span className="text-xs font-mono bg-[var(--accent)] px-2 py-0.5 rounded-md text-[var(--foreground)]">{s.receiptNumber}</span>
                          ) : (
                            <span className="text-xs text-[var(--muted-foreground)]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {hasRegs ? (
                            <div className="space-y-1">
                              {s.registrations.map((r, j) => (
                                <div key={j} className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-medium text-[var(--muted-foreground)] shrink-0">{r.groupName}:</span>
                                  <span className="text-[11px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-md font-medium truncate max-w-[200px]">
                                    {r.courseCode ? `${r.courseCode} — ` : ""}{r.electiveName}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--muted-foreground)]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3.5">
                          {hasRegs && (
                            <ChevronDown className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                          )}
                        </td>
                      </motion.tr>
                      <AnimatePresence>
                        {isExpanded && hasRegs && (
                          <tr className="border-b-0">
                            <td colSpan={6} className="p-0">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-[var(--border)] bg-[var(--accent)]/30 px-5 py-4 overflow-hidden"
                              >
                                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
                                  {s.name}&apos;s Elective Selections
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {s.registrations.map((r, j) => (
                                    <div key={j} className="flex items-start gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
                                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <BookOpen className="w-4 h-4 text-indigo-500" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-medium text-[var(--muted-foreground)] uppercase tracking-wider">{r.groupName}</p>
                                        <p className="text-sm font-medium text-[var(--foreground)] mt-0.5 leading-tight">
                                          {r.courseCode ? <span className="text-indigo-400">{r.courseCode}</span> : null}
                                          {r.courseCode ? " — " : ""}{r.electiveName}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[var(--muted-foreground)] text-right">Showing {filtered.length} student{filtered.length !== 1 ? "s" : ""}</p>
      
      <AnimatePresence>
        {registeringStudent && eventId && (
          <ManualRegisterModal
            student={registeringStudent}
            eventId={eventId}
            availableElectives={availableElectives || []}
            onClose={() => setRegisteringStudent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Manual Register Modal ────────────────────────────────────────────────
function ManualRegisterModal({ student, eventId, availableElectives, onClose }: { student: Student; eventId: string; availableElectives: ElectiveOption[]; onClose: () => void }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const groupOptions = useMemo(() => {
    const map = new Map<string, { groupId: string; groupName: string; electives: ElectiveOption[] }>();
    availableElectives.forEach(e => {
      if (!map.has(e.groupId)) {
        map.set(e.groupId, { groupId: e.groupId, groupName: e.groupName, electives: [] });
      }
      map.get(e.groupId)!.electives.push(e);
    });
    return Array.from(map.values());
  }, [availableElectives]);

  const handleSubmit = async () => {
    // Validate that all groups have a selection
    if (Object.keys(selections).length !== groupOptions.length) {
      toast.error("Please select a subject for all groups");
      return;
    }
    
    const formattedSelections = Object.entries(selections).map(([groupId, electiveId]) => ({ groupId, electiveId }));
    
    setIsSubmitting(true);
    try {
      await manualRegisterStudentByTutor(student.id, eventId, formattedSelections);
      toast.success("Student registered successfully");
      router.refresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to register student");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-[var(--foreground)] mb-1">Manual Registration</h2>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">
            Register subjects for {student.name} ({student.registerNumber})
          </p>
          
          <div className="space-y-5">
            {groupOptions.map(g => (
              <div key={g.groupId}>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-2">{g.groupName}</label>
                <select
                  value={selections[g.groupId] || ""}
                  onChange={(e) => setSelections(prev => ({ ...prev, [g.groupId]: e.target.value }))}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="" disabled>Select a subject</option>
                  {g.electives.map(e => (
                    <option key={e.id} value={e.id} disabled={e.availableSeats <= 0}>
                      {e.courseCode ? `${e.courseCode} - ` : ""}{e.name} ({e.availableSeats} seats left)
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[var(--accent)]/30 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Registering..." : "Confirm Registration"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Subjects Tab ─────────────────────────────────────────────────────────
function SubjectsTab({ groupedSubjects, totalStudents, students }: { groupedSubjects: [string, GroupSummary[]][]; totalStudents: number; students: Student[] }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(groupedSubjects.map(([name]) => name)));
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [subjectSearch, setSubjectSearch] = useState("");

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const toggleSubject = (key: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Build a map of (electiveName) -> list of students registered for it
  const studentsPerSubject = useMemo(() => {
    const map = new Map<string, { id: string; name: string; registerNumber: string | null; submittedAt: string | null }[]>();
    for (const student of students) {
      if (student.registrationStatus !== "CONFIRMED") continue;
      for (const reg of student.registrations) {
        const key = `${reg.groupName}::${reg.electiveName}`;
        const list = map.get(key) || [];
        list.push({
          id: student.id,
          name: student.name,
          registerNumber: student.registerNumber,
          submittedAt: student.submittedAt,
        });
        map.set(key, list);
      }
    }
    // Sort each list by name
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [students]);

  if (groupedSubjects.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
        <BookOpen className="w-10 h-10 text-[var(--muted-foreground)] mx-auto mb-3 opacity-50" />
        <p className="text-[var(--muted-foreground)]">No elective subjects have been selected yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
        <input
          type="text"
          placeholder="Search students by name or register number..."
          value={subjectSearch}
          onChange={(e) => setSubjectSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      {groupedSubjects.map(([groupName, subjects]) => {
        const isOpen = expandedGroups.has(groupName);
        const groupTotal = subjects.reduce((sum, s) => sum + s.count, 0);

        return (
          <div key={groupName} className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            <button
              onClick={() => toggleGroup(groupName)}
              className="w-full flex items-center justify-between p-5 hover:bg-[var(--accent)]/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <BookOpen className="w-[18px] h-[18px] text-indigo-500" />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">{groupName}</h3>
                  <p className="text-xs text-[var(--muted-foreground)]">{subjects.length} subject{subjects.length !== 1 ? "s" : ""} • {groupTotal} enrollment{groupTotal !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-[var(--muted-foreground)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-[var(--border)]"
                >
                  <div className="p-4 space-y-2">
                    {subjects.map((sub, idx) => {
                      const pct = totalStudents > 0 ? Math.round((sub.count / totalStudents) * 100) : 0;
                      const subjectKey = `${groupName}::${sub.electiveName}`;
                      const isSubjectExpanded = expandedSubjects.has(subjectKey);
                      const enrolledStudents = studentsPerSubject.get(subjectKey) || [];

                      // Filter students by search query
                      const q = subjectSearch.toLowerCase().trim();
                      const filteredStudents = q
                        ? enrolledStudents.filter(s =>
                            s.name.toLowerCase().includes(q) ||
                            (s.registerNumber && s.registerNumber.toLowerCase().includes(q))
                          )
                        : enrolledStudents;

                      // If searching and no students match, hide this subject
                      if (q && filteredStudents.length === 0) return null;

                      return (
                        <div key={idx} className="rounded-lg border border-[var(--border)] overflow-hidden">
                          <button
                            onClick={() => toggleSubject(subjectKey)}
                            className="w-full flex items-center gap-4 p-3 hover:bg-[var(--accent)]/20 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {sub.courseCode && (
                                  <span className="text-[10px] font-mono font-semibold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{sub.courseCode}</span>
                                )}
                                <span className="text-sm font-medium text-[var(--foreground)] truncate">{sub.electiveName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="w-24 h-1.5 rounded-full bg-[var(--accent)] overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                              <span className="text-xs font-bold text-[var(--foreground)] tabular-nums w-8 text-right">{sub.count}</span>
                              <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums w-8">({pct}%)</span>
                              <ChevronDown className={`w-3.5 h-3.5 text-[var(--muted-foreground)] transition-transform duration-200 ${isSubjectExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </button>

                          <AnimatePresence>
                            {isSubjectExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-t border-[var(--border)] bg-[var(--background)]/50"
                              >
                                <div className="p-3">
                                  {/* Table Header */}
                                  <div className="grid grid-cols-[40px_1fr_1fr] gap-2 px-2 pb-2 mb-1 border-b border-[var(--border)]">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">#</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Student Name</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Register Number</span>
                                  </div>

                                  {filteredStudents.length > 0 ? (
                                    <div className="space-y-0.5 max-h-[320px] overflow-y-auto custom-scrollbar">
                                      {filteredStudents.map((s, sIdx) => (
                                        <div
                                          key={s.id}
                                          className="grid grid-cols-[40px_1fr_1fr] gap-2 px-2 py-2 rounded-md hover:bg-[var(--accent)]/30 transition-colors items-center"
                                        >
                                          <span className="text-xs font-mono text-[var(--muted-foreground)]">{sIdx + 1}</span>
                                          <span className="text-sm text-[var(--foreground)] font-medium truncate">{s.name}</span>
                                          <span className="text-xs font-mono text-[var(--muted-foreground)]">{s.registerNumber || "—"}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-[var(--muted-foreground)] text-center py-4">No students found.</p>
                                  )}

                                  <div className="mt-2 pt-2 border-t border-[var(--border)] flex justify-between items-center px-2">
                                    <span className="text-[10px] text-[var(--muted-foreground)]">
                                      Showing {filteredStudents.length} of {enrolledStudents.length} student{enrolledStudents.length !== 1 ? "s" : ""}
                                    </span>
                                    <span className="text-[10px] font-bold text-indigo-500">
                                      {pct}% of section
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
