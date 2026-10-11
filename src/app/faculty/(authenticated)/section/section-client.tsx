"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Download, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, Upload, Users } from "lucide-react";
import { createStudent, importStudentsCSV, updateStudent, deleteStudent, unlockStudentRegistration, deleteMultipleStudentsTutor, deleteAllSectionStudents } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { TutorSectionOnboarding } from "@/components/tutor-section-onboarding";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/feedback";
import { AnimatedNumber, Meter } from "@/components/ui/data-display";
import { ConfirmDialog, type ImpactRow } from "@/components/ui/confirm-dialog";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Registration = { studentId: string; electiveName: string; groupName: string; eventName: string };
type Student = {
  id: string;
  name: string;
  email: string | null;
  registerNumber: string | null;
  isActive: boolean;
  isEligible: boolean;
  registrations: Registration[];
};
type ReportData = { students: Student[]; totalStudents: number; registeredCount: number };
type Session = { name: string; sectionId?: string; role?: string };

type Pending =
  | { kind: "delete"; student: Student }
  | { kind: "unlock"; student: Student }
  | { kind: "bulk"; ids: string[]; clear: () => void }
  | { kind: "all" };

const submittedFilter: FilterDef<Student>[] = [
  {
    id: "submitted",
    label: "Submitted",
    options: [
      { value: "yes", label: "Submitted" },
      { value: "no", label: "Not yet" },
    ],
    predicate: (s, v) => (s.registrations.length > 0) === (v === "yes"),
  },
];

export function SectionClient({ reportData, session }: { reportData: ReportData; session: Session }) {
  const [students, setStudents] = useState<Student[]>(reportData.students);
  const totalStudents = reportData.totalStudents ?? students.length;
  const registeredCount = reportData.registeredCount ?? 0;
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newRegNo, setNewRegNo] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  if (!session.sectionId) {
    return <TutorSectionOnboarding />;
  }

  const canUnlock = session.role === "SUPER_ADMIN" || session.role === "COURSE_COORDINATOR";

  function openAddModal() {
    setFormMode("add");
    setEditingStudentId(null);
    setNewName("");
    setNewRegNo("");
    setNewEmail("");
    setFormOpen(true);
  }

  function openEditModal(student: Student) {
    setFormMode("edit");
    setEditingStudentId(student.id);
    setNewName(student.name);
    setNewRegNo(student.registerNumber || "");
    setNewEmail(student.email || "");
    setFormOpen(true);
  }

  async function handleAddStudent() {
    if (!newName || !newRegNo || !newEmail) return;
    setIsSaving(true);
    try {
      await createStudent({ name: newName, registerNumber: newRegNo, email: newEmail });
      setFormOpen(false);
      setNewName("");
      setNewRegNo("");
      setNewEmail("");
      toast.success("Student added.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditSave() {
    if (!newName || !newRegNo || !newEmail || !editingStudentId) return;
    setIsSaving(true);
    try {
      await updateStudent(editingStudentId, { name: newName, registerNumber: newRegNo, email: newEmail });
      setFormOpen(false);
      toast.success("Student updated.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function ask(next: Pending) {
    setPending(next);
    setConfirmOpen(true);
  }

  async function runPending() {
    if (!pending) return;
    try {
      if (pending.kind === "delete") {
        await deleteStudent(pending.student.id);
        toast.success("Student deleted.");
      } else if (pending.kind === "unlock") {
        await unlockStudentRegistration(pending.student.id);
        toast.success("Registration successfully unlocked.");
      } else if (pending.kind === "bulk") {
        await deleteMultipleStudentsTutor(pending.ids);
        pending.clear();
        toast.success("Students deleted successfully.");
      } else {
        await deleteAllSectionStudents();
        toast.success("All students have been deleted.");
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
      throw err;
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
      toast.success(`Imported ${result.imported} students. Skipped ${result.skipped} (already exist).`);
      router.refresh();
    } catch (err: any) {
      toast.error("Error importing CSV: " + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const columns: Column<Student>[] = [
    {
      id: "name",
      header: "Name",
      mobile: "title",
      hideable: false,
      cell: (s) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-fg">{s.name}</span>
          {onlineUserIds.has(s.id) ? (
            <span className="inline-flex items-center gap-1 text-2xs font-medium text-success-text">
              <span aria-hidden className="size-1.5 rounded-full bg-success" />
              Online
            </span>
          ) : null}
        </span>
      ),
      sortValue: (s) => s.name.toLowerCase(),
      searchValue: (s) => s.name,
    },
    {
      id: "reg",
      header: "Register no.",
      mobile: "subtitle",
      cell: (s) => <span className="font-mono text-xs text-fg-muted">{s.registerNumber ?? "—"}</span>,
      sortValue: (s) => s.registerNumber,
      searchValue: (s) => s.registerNumber,
    },
    { id: "email", header: "SRM email", mobileWide: true, cell: (s) => <span className="text-fg-muted">{s.email ?? "—"}</span> },
    {
      id: "submitted",
      header: "Submitted",
      cell: (s) =>
        s.registrations.length > 0 ? (
          <Badge size="sm" tone="success" dot>
            Submitted
          </Badge>
        ) : (
          <Badge size="sm" tone="warning">
            Not yet
          </Badge>
        ),
      sortValue: (s) => s.registrations.length,
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (s) => (
        <span className="inline-flex items-center gap-1">
          {canUnlock && s.registrations.length > 0 ? (
            <Tooltip content="Unlock registration">
              <Button size="icon-sm" variant="ghost" aria-label={`Unlock registration for ${s.name}`} onClick={() => ask({ kind: "unlock", student: s })}>
                <ShieldCheck />
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip content="Edit">
            <Button size="icon-sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => openEditModal(s)}>
              <Pencil />
            </Button>
          </Tooltip>
          <Tooltip content="Delete">
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Delete ${s.name}`}
              className="text-danger-text hover:bg-danger/10 hover:text-danger-text"
              onClick={() => ask({ kind: "delete", student: s })}
            >
              <Trash2 />
            </Button>
          </Tooltip>
        </span>
      ),
    },
  ];

  const confirmCopy = (() => {
    if (!pending) return { title: "", description: "", label: "Confirm", impact: [] as ImpactRow[], requireText: undefined as string | undefined };
    switch (pending.kind) {
      case "delete":
        return {
          title: "Delete this student?",
          description: "Their registration selections are deleted permanently too.",
          label: "Delete student",
          impact: [
            { label: "Student", value: pending.student.name },
            { label: "Register no.", value: pending.student.registerNumber ?? "—" },
          ],
          requireText: undefined,
        };
      case "unlock":
        return {
          title: "Unlock this registration?",
          description: "The student will be able to change their locked choices.",
          label: "Unlock",
          impact: [{ label: "Student", value: pending.student.name }],
          requireText: undefined,
        };
      case "bulk":
        return {
          title: "Delete selected students?",
          description: "Their registration selections are deleted permanently too.",
          label: "Delete students",
          impact: [{ label: "Students", value: pending.ids.length, tone: "danger" as const }],
          requireText: undefined,
        };
      case "all":
        return {
          title: "Delete every student in your section?",
          description: "This also erases their registrations. It cannot be undone.",
          label: "Delete all students",
          impact: [{ label: "Students", value: students.length, tone: "danger" as const }],
          requireText: "CONFIRM",
        };
    }
  })();

  return (
    <div>
      <PageHeader
        title="Your section"
        description="Students, their submissions and who is online right now."
        actions={
          <>
            <Button onClick={openAddModal}>
              <Plus /> Add student
            </Button>
            <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} loading={isUploading} loadingText="Importing">
              <Upload /> Import CSV
            </Button>
            <Menu>
              <MenuTrigger render={<Button variant="secondary" size="icon" aria-label="More actions" />}>
                <MoreHorizontal />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem onClick={handleDownloadTemplate}>
                  <Download /> Download CSV template
                </MenuItem>
                <MenuSeparator />
                <MenuItem tone="danger" disabled={students.length === 0} onClick={() => ask({ kind: "all" })}>
                  <Trash2 /> Delete all students
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Students</p>
          <AnimatedNumber value={totalStudents} className="mt-1 block text-4xl font-light tracking-display text-fg" tabular />
        </div>
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Submitted</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber value={registeredCount} className="text-4xl font-light tracking-display text-fg" tabular />
            <span className="font-mono text-sm tabular-nums text-fg-subtle">/ {totalStudents}</span>
          </p>
          <Meter value={registeredCount} max={totalStudents} label="Students who submitted" className="mt-3" />
        </div>
      </div>

      <DataTable
        data={students}
        columns={columns}
        getRowId={(s) => s.id}
        caption="Students in your section"
        searchPlaceholder="Search name or register number"
        filters={submittedFilter}
        pageSize={30}
        selectable
        bulkActions={(selected, clear) => (
          <Button size="sm" variant="destructive" onClick={() => ask({ kind: "bulk", ids: selected.map((s) => s.id), clear })}>
            <Trash2 /> Delete
          </Button>
        )}
        empty={
          students.length === 0 ? (
            <EmptyState
              compact
              icon={<Users />}
              title="No students yet"
              description="Add students one by one or import the CSV template."
              action={
                <Button size="sm" variant="secondary" onClick={handleDownloadTemplate}>
                  <Download /> CSV template
                </Button>
              }
            />
          ) : undefined
        }
      />

      <Dialog open={formOpen} onOpenChange={(o) => !isSaving && setFormOpen(o)}>
        <DialogContent size="md" showClose={!isSaving}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (formMode === "edit") handleEditSave();
              else handleAddStudent();
            }}
            className="contents"
          >
            <DialogHeader>
              <DialogTitle>{formMode === "edit" ? "Edit student" : "Add a student"}</DialogTitle>
              <DialogDescription>
                {formMode === "edit" ? "Update their name, register number or email." : "Their first password is their register number."}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <Field label="Full name">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. John Doe" autoComplete="off" />
              </Field>
              <Field label="Register number">
                <Input
                  value={newRegNo}
                  onChange={(e) => setNewRegNo(e.target.value)}
                  placeholder="e.g. RA2211003010xxx"
                  className="font-mono"
                  autoComplete="off"
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="SRM email">
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="e.g. jd1234@srmist.edu.in" autoComplete="off" />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setFormOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving} loadingText="Saving" disabled={!newName || !newRegNo || !newEmail}>
                {formMode === "edit" ? "Save changes" : "Add student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone={pending?.kind === "unlock" ? "default" : "danger"}
        title={confirmCopy.title}
        description={confirmCopy.description}
        impact={confirmCopy.impact}
        requireText={confirmCopy.requireText}
        confirmLabel={confirmCopy.label}
        onConfirm={runPending}
      />
    </div>
  );
}
