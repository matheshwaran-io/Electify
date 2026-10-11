/**
 * CSV and PDF exports for the tutor's section report. Output is unchanged
 * from the original page; the PDF library is loaded only when needed.
 */

export type ExportRegistration = {
  studentId: string;
  electiveName: string;
  courseCode: string | null;
  credits: number;
  groupName: string;
  eventName: string;
};

export type ExportStudent = {
  id: string;
  name: string;
  registerNumber: string | null;
  isEligible: boolean;
  email: string;
  registrations: ExportRegistration[];
  registrationStatus: string;
  receiptNumber: string | null;
  submittedAt: string | null;
};

export type ExportGroup = { groupName: string; electiveName: string; courseCode: string | null; count: number };

export type ExportInput = {
  students: ExportStudent[];
  groups: ExportGroup[];
  groupedSubjects: [string, ExportGroup[]][];
  totalStudents: number;
  registeredCount: number;
  pendingCount: number;
  overallPct: number;
  sectionLabel: string;
  programmeName: string;
  departmentName: string;
};

function byRegisterNumber(students: ExportStudent[]) {
  return [...students].sort((a, b) => {
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

// ── Premium CSV Export ──────────────────────────────────────────────────
export function exportSectionCSV(d: ExportInput) {
  const { students, groups, groupedSubjects, totalStudents, registeredCount, pendingCount, overallPct, sectionLabel, programmeName, departmentName } = d;
  const BOM = "﻿";
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
  byRegisterNumber(students).forEach((s, idx) => {
    const isRegistered = s.registrationStatus === "CONFIRMED";
    const regs = s.registrations.map((r) => `${r.groupName}: ${r.courseCode ? r.courseCode + " - " : ""}${r.electiveName}`).join(" | ");
    const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
    lines.push(`"${idx + 1}","${s.name}","${s.registerNumber ?? "—"}","${s.email}","${isRegistered ? "Confirmed" : "Pending"}","${s.receiptNumber ?? "—"}","${submittedAt}","${regs || "—"}"`);
  });

  lines.push("");
  lines.push(`"SUBJECT DISTRIBUTION"`);
  lines.push(`"Elective Group","Course Code","Subject Name","Students Enrolled"`);
  groups.forEach((g) => {
    lines.push(`"${g.groupName}","${g.courseCode ?? "—"}","${g.electiveName}","${g.count}"`);
  });

  lines.push("");
  lines.push(`"SUBJECT-WISE STUDENT LIST"`);

  groupedSubjects.forEach(([groupName, groupSubjects]) => {
    groupSubjects.forEach((subject) => {
      lines.push("");
      lines.push(`"Group: ${groupName} | Subject: ${subject.courseCode ? subject.courseCode + " - " : ""}${subject.electiveName}"`);
      lines.push(`"S.No","Student Name","Register Number","Email","Receipt No.","Submitted At"`);

      const enrolledStudents = students.filter(
        (s) => s.registrationStatus === "CONFIRMED" && s.registrations.some((r) => r.groupName === groupName && r.electiveName === subject.electiveName)
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
}

// ── Premium PDF Export ─────────────────────────────────────────────────
export async function exportSectionPDF(d: ExportInput) {
  const { students, groups, groupedSubjects, totalStudents, registeredCount, pendingCount, overallPct, sectionLabel, programmeName, departmentName } = d;
  const [{ default: jsPDF }, { default: autoTable }, { drawLogo, BRAND_PDF }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    import("@/lib/brand-pdf"),
  ]);

  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header: midnight bar with the reverse logo (E 8mm)
  doc.setFillColor(...BRAND_PDF.midnight);
  doc.rect(0, 0, pageWidth, 32, "F");
  drawLogo(doc, { x: 14, y: 7.5, height: 8, ink: BRAND_PDF.mist });
  doc.setTextColor(255, 255, 255);
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

  // Student table sorted ascending by register number
  let startY = boxY + 30;
  doc.setTextColor(14, 19, 48);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Student Registration Details (Ascending by Reg. No.)", 14, startY);
  startY += 4;

  const tableData = byRegisterNumber(students).map((s, idx) => {
    const isRegistered = s.registrationStatus === "CONFIRMED";
    const regs = s.registrations
      .map((r, i) => {
        const code = r.courseCode ? `${r.courseCode}: ` : "";
        return `${i + 1}. ${code}${r.electiveName}`;
      })
      .join("\n");
    const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—";
    return [String(idx + 1), s.registerNumber ?? "—", s.name, isRegistered ? "Confirmed" : "Pending", regs || "None", s.receiptNumber ?? "—", submittedAt];
  });

  autoTable(doc, {
    head: [["#", "Register No.", "Student Name", "Status", "Chosen Subjects", "Receipt No.", "Submitted"]],
    body: tableData,
    startY,
    styles: { fontSize: 7, cellPadding: 3, lineWidth: 0.1, lineColor: [226, 232, 240] },
    headStyles: { fillColor: [14, 19, 48], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 32, fontStyle: "bold" },
      2: { cellWidth: 36 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: "auto" },
      5: { cellWidth: 28 },
      6: { cellWidth: 24 },
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
  doc.setFillColor(14, 19, 48);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Subject Distribution Summary", 14, 16);

  autoTable(doc, {
    head: [["Elective Group", "Course Code", "Subject Name", "Students Enrolled"]],
    body: groups.map((g) => [g.groupName, g.courseCode ?? "—", g.electiveName, String(g.count)]),
    startY: 30,
    styles: { fontSize: 8, cellPadding: 4, lineWidth: 0.1, lineColor: [226, 232, 240] },
    headStyles: { fillColor: [14, 19, 48], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      3: { halign: "center", fontStyle: "bold" },
    },
  });

  // Subject-wise Student Lists
  groupedSubjects.forEach(([groupName, groupSubjects]) => {
    groupSubjects.forEach((subject) => {
      doc.addPage();

      doc.setFillColor(14, 19, 48);
      doc.rect(0, 0, pageWidth, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Subject: ${subject.courseCode ? subject.courseCode + " - " : ""}${subject.electiveName}`, 14, 16);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Group: ${groupName}`, pageWidth - 14, 16, { align: "right" });

      const enrolledStudents = students.filter(
        (s) => s.registrationStatus === "CONFIRMED" && s.registrations.some((r) => r.groupName === groupName && r.electiveName === subject.electiveName)
      );

      if (enrolledStudents.length === 0) {
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.text("No students enrolled yet.", 14, 40);
      } else {
        const subjectTableData = enrolledStudents.map((s, idx) => {
          const submittedAt = s.submittedAt ? new Date(s.submittedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" }) : "—";
          return [String(idx + 1), s.name, s.registerNumber ?? "—", s.email, s.receiptNumber ?? "—", submittedAt];
        });

        autoTable(doc, {
          head: [["#", "Student Name", "Register No.", "Email", "Receipt No.", "Submitted"]],
          body: subjectTableData,
          startY: 30,
          styles: { fontSize: 7, cellPadding: 3, lineWidth: 0.1, lineColor: [226, 232, 240] },
          headStyles: { fillColor: [14, 19, 48], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
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
}
