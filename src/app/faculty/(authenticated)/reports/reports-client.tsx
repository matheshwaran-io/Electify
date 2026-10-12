"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Download, FileSpreadsheet, FileText, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import type { CoordinatorReportsPayload, StudentAllotment } from "@/app/actions/coordinator";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { AnimatedNumber, Meter } from "@/components/ui/data-display";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";

function sortAscendingByRegNo(items: StudentAllotment[]): StudentAllotment[] {
  return [...items].sort((a, b) => {
    const regA = (a.registerNumber || "").trim();
    const regB = (b.registerNumber || "").trim();
    if (regA && regB) {
      return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: "base" });
    }
    if (regA) return -1;
    if (regB) return 1;
    return a.name.localeCompare(b.name);
  });
}

const columns: Column<StudentAllotment>[] = [
  {
    id: "name",
    header: "Student",
    mobile: "title",
    hideable: false,
    cell: (s) => (
      <span className="block min-w-0">
        <span className="block font-medium text-fg">{s.name}</span>
        <span className="block truncate text-xs font-normal text-fg-muted">{s.email}</span>
      </span>
    ),
    searchValue: (s) => s.name,
  },
  {
    id: "reg",
    header: "Register no.",
    mobile: "subtitle",
    cell: (s) => <span className="font-mono text-xs text-fg">{s.registerNumber || "—"}</span>,
    searchValue: (s) => s.registerNumber,
  },
  { id: "section", header: "Section", cell: (s) => <Badge size="sm">Section {s.sectionLabel}</Badge> },
  {
    id: "subjects",
    header: "Allotted subjects",
    mobileWide: true,
    cell: (s) =>
      s.subjects.length === 0 ? (
        <span className="text-xs text-fg-subtle">No electives chosen</span>
      ) : (
        <span className="flex max-w-xl flex-wrap gap-1.5 whitespace-normal">
          {s.subjects.map((sub, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg">
              {sub.courseCode ? <span className="font-mono text-fg-muted">{sub.courseCode}</span> : null}
              <span>{sub.name}</span>
            </span>
          ))}
        </span>
      ),
    searchValue: (s) => s.subjects.map((sub) => `${sub.name} ${sub.courseCode ?? ""}`).join(" "),
  },
  {
    id: "receipt",
    header: "Receipt",
    cell: (s) => (
      <span className="font-mono text-xs text-fg-muted">{s.receiptNumber || "—"}</span>
    ),
  },
];

/** Coloured by completion, because the colour carries meaning here. */
const pctTone = (pct: number) => (pct >= 80 ? "success" : pct >= 50 ? "warning" : "danger") as "success" | "warning" | "danger";

export function ReportsClient({ data }: { data: CoordinatorReportsPayload }) {
  const { sections, allotments, events } = data;
  const [tab, setTab] = useState<"allotments" | "sections">("allotments");

  // Compute metrics
  const totalStudentsInSections = sections.reduce((s, r) => s + r.totalStudents, 0);
  const totalRegisteredCount = allotments.length;
  const overallPct = totalStudentsInSections > 0 ? Math.round((totalRegisteredCount / totalStudentsInSections) * 100) : 0;
  const totalSubjectsAllotted = allotments.reduce((sum, a) => sum + a.subjects.length, 0);

  const sorted = useMemo(() => sortAscendingByRegNo(allotments), [allotments]);

  // Unique sections list from data
  const availableSectionLabels = useMemo(() => {
    const set = new Set<string>();
    sections.forEach((s) => set.add(s.sectionLabel));
    allotments.forEach((a) => {
      if (a.sectionLabel) set.add(a.sectionLabel);
    });
    return Array.from(set).sort();
  }, [sections, allotments]);

  const filters = useMemo<FilterDef<StudentAllotment>[]>(() => {
    const out: FilterDef<StudentAllotment>[] = [];
    if (availableSectionLabels.length > 1) {
      out.push({
        id: "section",
        label: "Section",
        options: availableSectionLabels.map((l) => ({ value: l, label: `Section ${l}` })),
        predicate: (a, v) => a.sectionLabel === v || a.sectionId === v,
      });
    }
    if (events.length > 1) {
      out.push({ id: "event", label: "Event", options: events.map((ev) => ({ value: ev.id, label: ev.name })), predicate: (a, v) => a.eventId === v });
    }
    return out;
  }, [availableSectionLabels, events]);

  // ── Download 1: CSV Spreadsheet in Ascending Order ────────────────────────
  const exportCSV = (rows: StudentAllotment[]) => {
    const list = sortAscendingByRegNo(rows);
    if (list.length === 0) {
      toast.error("No student allotments match your filter.");
      return;
    }

    const BOM = "﻿";
    const maxSubjects = Math.max(1, ...list.map((s) => s.subjects.length));
    const subjectHeaders = Array.from({ length: maxSubjects }, (_, i) => `Subject ${i + 1}`);

    const headers = [
      "S.No",
      "Register Number",
      "Student Name",
      "Section",
      "Programme",
      "Chosen Subjects (All)",
      ...subjectHeaders,
      "Total Chosen Subjects",
      "Receipt Number",
      "Registration Status",
      "Submitted At",
    ];

    const csvRows = list.map((s, idx) => {
      const allSubjects = s.subjects.map((sub) => (sub.courseCode ? `${sub.courseCode}: ${sub.name}` : sub.name)).join(" | ");

      const subjectCols = Array.from({ length: maxSubjects }, (_, i) => {
        const sub = s.subjects[i];
        return sub ? (sub.courseCode ? `${sub.courseCode}: ${sub.name}` : sub.name) : "";
      });

      return [
        idx + 1,
        s.registerNumber || "—",
        s.name,
        s.sectionLabel,
        s.programmeName,
        allSubjects || "None",
        ...subjectCols,
        s.subjects.length,
        s.receiptNumber || "—",
        s.status,
        s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN") : "—",
      ].map((val) => `"${String(val).replace(/"/g, '""')}"`);
    });

    const csvContent = BOM + [headers.map((h) => `"${h}"`).join(","), ...csvRows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `student_allotments_ascending_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV report downloaded in ascending order of register number");
  };

  // ── Download 2: PDF Document in Ascending Order ───────────────────────────
  const exportPDF = async (rows: StudentAllotment[]) => {
    const list = sortAscendingByRegNo(rows);
    if (list.length === 0) {
      toast.error("No student allotments to export.");
      return;
    }

    // Loaded on demand so the PDF library never ships with the page.
    const [{ default: jsPDF }, { default: autoTable }, { drawLogo, BRAND_PDF }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("@/lib/brand-pdf"),
    ]);

    const sectionLabels = new Set(list.map((s) => s.sectionLabel));
    const sectionText = sectionLabels.size === 1 ? `Section ${[...sectionLabels][0]}` : "All Sections";

    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Midnight header bar with the reverse logo (E 7mm; wordmark baseline at y 12.05)
    doc.setFillColor(...BRAND_PDF.midnight);
    doc.rect(0, 0, pageWidth, 28, "F");
    const logo = drawLogo(doc, { x: 14, y: 6, height: 7, ink: BRAND_PDF.mist });
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("STUDENT ELECTIVE ALLOTMENTS REPORT", 14 + logo.width + 6, 12.05);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Sorted: Ascending by Register Number • Section: ${sectionText}`, 14, 21);
    doc.text(`Total Records: ${list.length} Students`, pageWidth - 14, 13, { align: "right" });
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, pageWidth - 14, 21, { align: "right" });

    const tableData = list.map((s, idx) => {
      const subjectsStr =
        s.subjects.length > 0
          ? s.subjects.map((sub, i) => `${i + 1}. ${sub.courseCode ? sub.courseCode + ": " : ""}${sub.name}`).join("\n")
          : "No electives chosen";
      return [idx + 1, s.registerNumber || "—", s.name, `Sec ${s.sectionLabel}`, subjectsStr, s.status || "CONFIRMED", s.receiptNumber || "—"];
    });

    autoTable(doc, {
      head: [["S.No", "Register Number", "Student Name", "Section", "Chosen Subjects", "Status", "Receipt No."]],
      body: tableData,
      startY: 34,
      styles: { fontSize: 8, cellPadding: 3.5, valign: "middle" },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 38, fontStyle: "bold" },
        2: { cellWidth: 40 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: "auto" },
        5: { cellWidth: 24, halign: "center" },
        6: { cellWidth: 36 },
      },
    });

    doc.save(`student_allotments_ascending_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF report downloaded in ascending order of register number");
  };

  const stats = [
    { label: "Students", value: totalStudentsInSections, sub: "Across all sections" },
    { label: "Registered", value: totalRegisteredCount, sub: `${Math.max(0, totalStudentsInSections - totalRegisteredCount)} still to register` },
    { label: "Completion", value: overallPct, suffix: "%", sub: "Registration turnout" },
    { label: "Selections", value: totalSubjectsAllotted, sub: "Elective choices recorded" },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Who picked what, section by section. Exports follow your search and filters."
        meta={
          <Badge tone="outline">
            <ArrowUpDown /> Sorted by register number
          </Badge>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-surface-2 p-4 sm:p-5">
            <p className="text-sm text-fg-muted">{s.label}</p>
            <p className="mt-1 flex items-baseline">
              <AnimatedNumber value={s.value} className="text-4xl font-light tracking-display text-fg" tabular />
              {s.suffix ? <span className="text-2xl font-light text-fg-muted">{s.suffix}</span> : null}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">{s.sub}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "allotments" | "sections")}>
        <TabsList variant="pill" className="mb-4 w-fit max-w-full">
          <TabsTrigger value="allotments">
            <Users /> Allotments <span className="font-mono text-xs tabular-nums text-fg-subtle">{allotments.length}</span>
          </TabsTrigger>
          <TabsTrigger value="sections">
            <Layers /> Sections <span className="font-mono text-xs tabular-nums text-fg-subtle">{sections.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allotments">
          <DataTable
            data={sorted}
            columns={columns}
            getRowId={(s) => `${s.studentId}-${s.eventId}`}
            caption="Student elective allotments"
            searchPlaceholder="Search register no., name or subject"
            filters={filters}
            pageSize={25}
            urlKey="allot"
            toolbar={(rows) => (
              <>
                <Button size="sm" variant="secondary" onClick={() => exportCSV(rows)}>
                  <FileSpreadsheet /> CSV
                </Button>
                <Button size="sm" onClick={() => exportPDF(rows)}>
                  <Download /> PDF
                </Button>
              </>
            )}
            empty={
              <EmptyState
                compact
                icon={<FileText />}
                title={allotments.length === 0 ? "No allotments yet" : "No student allotments found"}
                description={allotments.length === 0 ? "Confirmed registrations appear here." : "Try clearing your search or filters."}
              />
            }
          />
        </TabsContent>

        <TabsContent value="sections">
          {sections.length === 0 ? (
            <EmptyState icon={<FileText />} title="No sections found" description="Sections for this programme appear here." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sections.map((sec, i) => {
                const pct = sec.totalStudents > 0 ? Math.round((sec.registeredCount / sec.totalStudents) * 100) : 0;
                const tone = pctTone(pct);
                return (
                  <li
                    key={sec.sectionId}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    className="rounded-card border border-border bg-surface p-4 shadow-1 animate-enter sm:p-5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-sm font-medium text-fg">
                        {sec.sectionLabel}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-fg">Section {sec.sectionLabel}</p>
                        <p className="text-xs text-fg-muted">
                          <span className="font-mono tabular-nums text-fg">{sec.registeredCount}</span> of{" "}
                          <span className="font-mono tabular-nums">{sec.totalStudents}</span> registered
                        </p>
                      </div>
                      <span
                        className={
                          tone === "success" ? "text-2xl font-light text-success-text" : tone === "warning" ? "text-2xl font-light text-warning-text" : "text-2xl font-light text-danger-text"
                        }
                      >
                        <span className="tabular-nums">{pct}</span>%
                      </span>
                    </div>
                    <Meter value={sec.registeredCount} max={sec.totalStudents} tone={tone} label={`Section ${sec.sectionLabel} completion`} className="mt-4" />
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
