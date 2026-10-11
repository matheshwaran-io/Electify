"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, GraduationCap, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMultipleStudents } from "@/app/actions/coordinator";
import { Avatar, PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";

type Student = { id: string; name: string; email: string; registerNumber: string | null; isActive: boolean; isEligible: boolean; createdAt: Date; sectionLabel: string | null };

const columns: Column<Student>[] = [
  {
    id: "name",
    header: "Student",
    mobile: "title",
    hideable: false,
    cell: (s) => (
      <span className="flex min-w-0 items-center gap-3">
        <Avatar name={s.name} />
        <span className="min-w-0">
          <span className="block truncate font-medium text-fg">{s.name}</span>
          <span className="block truncate text-xs font-normal text-fg-muted">{s.email}</span>
        </span>
      </span>
    ),
    sortValue: (s) => s.name.toLowerCase(),
    searchValue: (s) => s.name,
  },
  {
    id: "reg",
    header: "Register no.",
    cell: (s) => <span className="font-mono text-xs text-fg-muted">{s.registerNumber ?? "—"}</span>,
    sortValue: (s) => (s.registerNumber ?? "").toLowerCase(),
    searchValue: (s) => s.registerNumber,
  },
  {
    id: "section",
    header: "Section",
    cell: (s) => (s.sectionLabel ? <Badge size="sm">Section {s.sectionLabel}</Badge> : <span className="text-fg-subtle">—</span>),
    sortValue: (s) => s.sectionLabel,
    searchValue: (s) => s.sectionLabel,
  },
];

function exportCSV(rows: Student[]) {
  if (rows.length === 0) return toast.error("No students to export");

  const headers = ["Name", "Email", "Register Number", "Section"];
  const lines = rows.map((s) => [`"${s.name}"`, `"${s.email}"`, `"${s.registerNumber || ""}"`, `"${s.sectionLabel || ""}"`]);

  const csvContent = [headers.join(","), ...lines.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `students_export_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function StudentsClient({ students }: { students: Student[] }) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sections = useMemo(() => {
    const secs = new Set<string>();
    students.forEach((s) => {
      if (s.sectionLabel) secs.add(s.sectionLabel);
    });
    return Array.from(secs).sort();
  }, [students]);

  const filters: FilterDef<Student>[] =
    sections.length > 0
      ? [{ id: "section", label: "Section", options: sections.map((sec) => ({ value: sec, label: `Section ${sec}` })), predicate: (s, v) => s.sectionLabel === v }]
      : [];

  async function handleDeleteSelected() {
    if (!pendingDelete || pendingDelete.ids.length === 0) return;
    try {
      await deleteMultipleStudents(pendingDelete.ids);
      pendingDelete.clear();
      toast.success(`${pendingDelete.ids.length} students deleted successfully`);
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete students");
      throw error;
    }
  }

  return (
    <div>
      <PageHeader title="Student directory" description={`${students.length} students enrolled across your programme.`} />

      <DataTable
        data={students}
        columns={columns}
        getRowId={(s) => s.id}
        caption="Students"
        searchPlaceholder="Search name, register no. or section"
        filters={filters}
        initialSort={{ id: "name", dir: "asc" }}
        urlKey="students"
        selectable
        bulkActions={(selected, clear) => (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              setPendingDelete({ ids: selected.map((s) => s.id), clear });
              setConfirmOpen(true);
            }}
          >
            <Trash2 /> Delete
          </Button>
        )}
        toolbar={(rows) => (
          <Button size="sm" variant="secondary" onClick={() => exportCSV(rows)}>
            <Download /> Export CSV
          </Button>
        )}
        empty={<EmptyState compact icon={<GraduationCap />} title="No students found" description="Try adjusting your search or filters." />}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
        title="Delete selected students?"
        description="Their accounts and registrations are permanently removed and their seats go back into the pool. This cannot be undone."
        impact={pendingDelete ? [{ label: "Students", value: pendingDelete.ids.length, tone: "danger" }] : undefined}
        requireText="DELETE"
        confirmLabel="Delete students"
        onConfirm={handleDeleteSelected}
      />
    </div>
  );
}
