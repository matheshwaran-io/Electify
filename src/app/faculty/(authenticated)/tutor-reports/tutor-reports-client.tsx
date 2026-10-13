"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpen, ChevronDown, Download, FileSpreadsheet, MoreHorizontal, RotateCcw, Search, Users, X } from "lucide-react";
import { toast } from "sonner";
import { TutorSectionOnboarding } from "@/components/tutor-section-onboarding";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { resetSectionRegistrationEvent, manualRegisterStudentByTutor } from "@/app/actions/tutor";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/feedback";
import { Disclosure } from "@/components/ui/disclosure";
import { AnimatedNumber, Meter } from "@/components/ui/data-display";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { exportSectionCSV, exportSectionPDF, type ExportInput } from "./export";

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
  eventName?: string | null;
  eventStatus?: string;
  /** Full class identity, e.g. "MCA F · 2025–2027" */
  classLabel?: string;
  academicSession?: string;
  availableElectives?: ElectiveOption[];
};

type TabId = "overview" | "students" | "subjects";

const isConfirmed = (s: Student) => s.registrationStatus === "CONFIRMED";

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      inputSize="sm"
      leading={<Search />}
      trailing={
        value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            className="inline-flex size-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
          >
            <X className="size-4" />
          </button>
        ) : null
      }
    />
  );
}

function SubjectChip({ r }: { r: Registration }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg">
      <span className="shrink-0 text-fg-subtle">{r.groupName}</span>
      {r.courseCode ? <span className="shrink-0 font-mono text-fg-muted">{r.courseCode}</span> : null}
      <span className="truncate">{r.electiveName}</span>
    </span>
  );
}

export function TutorReportsClient({ reportData, hasActiveSection = true }: { reportData: ReportData; hasActiveSection?: boolean }) {
  const router = useRouter();
  const { students, totalStudents, registeredCount, sectionLabel, programmeName, departmentName, groups, eventId, eventStatus, availableElectives } = reportData;
  const pendingCount = totalStudents - registeredCount;
  const overallPct = totalStudents > 0 ? Math.round((registeredCount / totalStudents) * 100) : 0;

  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [resetOpen, setResetOpen] = useState(false);
  const [registeringStudent, setRegisteringStudent] = useState<Student | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

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

  const handleReset = async () => {
    try {
      await resetSectionRegistrationEvent();
      toast.success("Registrations reset successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset registrations");
      throw err;
    }
  };

  if (!hasActiveSection) {
    return <TutorSectionOnboarding />;
  }

  const exportInput: ExportInput = {
    students,
    groups,
    groupedSubjects,
    totalStudents,
    registeredCount,
    pendingCount,
    overallPct,
    sectionLabel,
    programmeName,
    departmentName,
  };

  const subtitle = [
    reportData.classLabel || (sectionLabel ? `Section ${sectionLabel}` : "Your section"),
    reportData.academicSession ? `Academic session ${reportData.academicSession}` : null,
    reportData.eventName,
    departmentName,
  ]
    .filter(Boolean)
    .join(" · ");

  const columns: Column<Student>[] = [
    {
      id: "name",
      header: "Student",
      mobile: "title",
      hideable: false,
      cell: (s) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">{s.name}</span>
            <span className="block truncate text-xs font-normal text-fg-muted">{s.email}</span>
          </span>
          {onlineUserIds.has(s.id) ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-2xs font-medium text-success-text">
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
    {
      id: "status",
      header: "Status",
      cell: (s) =>
        isConfirmed(s) ? (
          <Badge size="sm" tone="success" dot>
            Confirmed
          </Badge>
        ) : (
          <Badge size="sm" tone="warning">
            Pending
          </Badge>
        ),
      sortValue: (s) => (isConfirmed(s) ? 1 : 0),
    },
    {
      id: "receipt",
      header: "Receipt",
      cell: (s) => <span className="font-mono text-xs text-fg-muted">{s.receiptNumber ?? "—"}</span>,
      searchValue: (s) => s.receiptNumber,
    },
    {
      id: "electives",
      header: "Electives",
      mobile: "hidden",
      cell: (s) =>
        s.registrations.length > 0 ? (
          <span className="flex max-w-md flex-wrap gap-1.5">
            {s.registrations.map((r, j) => (
              <SubjectChip key={j} r={r} />
            ))}
          </span>
        ) : (
          <span className="text-xs text-fg-subtle">—</span>
        ),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (s) =>
        !isConfirmed(s) && eventStatus === "CLOSED" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              setRegisteringStudent(s);
              setRegisterOpen(true);
            }}
          >
            Register manually
          </Button>
        ) : null,
    },
  ];

  const statusFilter: FilterDef<Student>[] = [
    {
      id: "status",
      label: "Status",
      options: [
        { value: "registered", label: "Confirmed" },
        { value: "pending", label: "Pending" },
      ],
      predicate: (s, v) => (v === "registered" ? isConfirmed(s) : !isConfirmed(s)),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Section report"
        description={subtitle}
        actions={
          <>
            <Button variant="secondary" onClick={() => exportSectionCSV(exportInput)}>
              <FileSpreadsheet /> CSV
            </Button>
            <Button onClick={() => exportSectionPDF(exportInput)}>
              <Download /> PDF
            </Button>
            <Menu>
              <MenuTrigger render={<Button variant="secondary" size="icon" aria-label="More actions" />}>
                <MoreHorizontal />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem tone="danger" onClick={() => setResetOpen(true)}>
                  <RotateCcw /> Reset registrations
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Students", value: totalStudents },
          { label: "Confirmed", value: registeredCount },
          { label: "Pending", value: pendingCount },
        ].map((s) => (
          <div key={s.label} className="rounded-card bg-surface-2 p-4 sm:p-5">
            <p className="text-sm text-fg-muted">{s.label}</p>
            <AnimatedNumber value={s.value} className="mt-1 block text-4xl font-light tracking-display text-fg" tabular />
          </div>
        ))}
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Completion</p>
          <p className="mt-1 flex items-baseline">
            <AnimatedNumber value={overallPct} className="text-4xl font-light tracking-display text-fg" tabular />
            <span className="text-2xl font-light text-fg-muted">%</span>
          </p>
          <Meter value={registeredCount} max={totalStudents} label="Section completion" className="mt-3" />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
        <TabsList variant="pill" className="mb-4 w-fit max-w-full">
          <TabsTrigger value="overview">
            <BarChart3 /> Overview
          </TabsTrigger>
          <TabsTrigger value="students">
            <Users /> Students
          </TabsTrigger>
          <TabsTrigger value="subjects">
            <BookOpen /> Subjects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="animate-enter">
          <OverviewTab students={students} groups={groups} totalStudents={totalStudents} registeredCount={registeredCount} pendingCount={pendingCount} />
        </TabsContent>

        <TabsContent value="students" className="animate-enter">
          <DataTable
            data={students}
            columns={columns}
            getRowId={(s) => s.id}
            caption="Students in this section"
            searchPlaceholder="Search name, register no. or receipt"
            filters={statusFilter}
            pageSize={30}
            urlKey="sr"
            renderExpanded={(s) =>
              s.registrations.length > 0 ? (
                <div>
                  <p className="mb-3 text-xs font-medium text-fg-muted">{s.name}&apos;s elective selections</p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {s.registrations.map((r, j) => (
                      <li key={j} className="rounded-control border border-border bg-surface p-3">
                        <p className="text-2xs font-medium text-fg-subtle">{r.groupName}</p>
                        <p className="mt-0.5 text-sm font-medium leading-tight text-fg">
                          {r.courseCode ? <span className="font-mono text-fg-muted">{r.courseCode} · </span> : null}
                          {r.electiveName}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-fg-muted">No electives chosen yet.</p>
              )
            }
            empty={<EmptyState compact icon={<Users />} title="No students found" description="Try a different search or filter." />}
          />
        </TabsContent>

        <TabsContent value="subjects" className="animate-enter">
          <SubjectsTab groupedSubjects={groupedSubjects} totalStudents={totalStudents} students={students} />
        </TabsContent>
      </Tabs>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent size="lg">
          {registeringStudent && eventId ? (
            <ManualRegister
              key={registeringStudent.id}
              student={registeringStudent}
              eventId={eventId}
              availableElectives={availableElectives || []}
              onClose={() => setRegisterOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        tone="danger"
        title="Reset this section's registrations?"
        description="Every registration in your section is cleared and students have to register again. This cannot be undone."
        impact={[
          { label: "Class", value: reportData.classLabel || sectionLabel || "—" },
          { label: "Academic session", value: reportData.academicSession || "—" },
          { label: "Confirmed registrations", value: registeredCount, tone: "danger" },
        ]}
        requireText="CONFIRM"
        confirmLabel="Reset registrations"
        onConfirm={handleReset}
      />
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab({
  students,
  groups,
  totalStudents,
  registeredCount,
  pendingCount,
}: {
  students: Student[];
  groups: GroupSummary[];
  totalStudents: number;
  registeredCount: number;
  pendingCount: number;
}) {
  const maxCount = Math.max(...groups.map((g) => g.count), 1);
  const [showAll, setShowAll] = useState(true);
  const [overviewSearch, setOverviewSearch] = useState("");

  const confirmedStudents = students
    .filter((s) => s.registrationStatus === "CONFIRMED" && s.submittedAt)
    .sort((a, b) => new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime());

  let list = confirmedStudents;
  if (overviewSearch.trim()) {
    const q = overviewSearch.toLowerCase();
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.registerNumber && s.registerNumber.toLowerCase().includes(q)) ||
        (s.receiptNumber && s.receiptNumber.toLowerCase().includes(q))
    );
  }
  const visibleList = showAll ? list : list.slice(0, 10);

  const regPct = totalStudents > 0 ? (registeredCount / totalStudents) * 100 : 0;
  const pendPct = totalStudents > 0 ? (pendingCount / totalStudents) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
        <h2 className="text-sm font-medium text-fg">Registration progress</h2>
        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full bg-success transition-[width] duration-700 ease-gentle" style={{ width: `${regPct}%` }} />
          <div className="h-full bg-warning/70 transition-[width] duration-700 ease-gentle" style={{ width: `${pendPct}%` }} />
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4">
          {[
            { label: "Confirmed", value: registeredCount, dot: "bg-success" },
            { label: "Pending", value: pendingCount, dot: "bg-warning" },
          ].map((row) => (
            <div key={row.label}>
              <dt className="flex items-center gap-2 text-xs text-fg-muted">
                <span aria-hidden className={cn("size-2 rounded-full", row.dot)} />
                {row.label}
              </dt>
              <dd className="mt-1 text-2xl font-light tabular-nums text-fg">
                {row.value} <span className="text-sm text-fg-subtle">/ {totalStudents}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
        <h2 className="text-sm font-medium text-fg">Subject enrollment</h2>
        {groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-fg-muted">No registrations yet.</p>
        ) : (
          <ul className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1 scrollbar-thin">
            {groups.slice(0, 10).map((g, i) => (
              <li key={i}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-fg">
                    {g.courseCode ? <span className="font-mono text-fg-muted">{g.courseCode} · </span> : null}
                    {g.electiveName}
                  </span>
                  <span className="shrink-0 font-mono tabular-nums text-fg-muted">{g.count}</span>
                </div>
                <Meter value={g.count} max={maxCount} label={`${g.electiveName} enrollment`} className="mt-1.5" />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-card border border-border bg-surface shadow-1 lg:col-span-2">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-medium text-fg">Registered students</h2>
            <Badge size="sm" tone="success">
              <span className="font-mono tabular-nums">{confirmedStudents.length}</span> confirmed
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 sm:w-56 sm:flex-none">
              <SearchInput value={overviewSearch} onChange={setOverviewSearch} placeholder="Search registered" />
            </div>
            {confirmedStudents.length > 10 ? (
              <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)} className="shrink-0">
                {showAll ? "Top 10" : `All ${confirmedStudents.length}`}
              </Button>
            ) : null}
          </div>
        </div>

        {visibleList.length === 0 ? (
          <p className="border-t border-border py-8 text-center text-sm text-fg-muted">No matching registrations found.</p>
        ) : (
          <ul className="max-h-[36rem] divide-y divide-border overflow-y-auto border-t border-border scrollbar-thin">
            {visibleList.map((s) => (
              <li key={s.id} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:items-start sm:gap-4 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{s.name}</p>
                  <p className="font-mono text-xs text-fg-muted">{s.registerNumber ?? "—"}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.registrations.map((r, j) => (
                    <SubjectChip key={j} r={r} />
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-fg-subtle sm:flex-col sm:items-end sm:gap-1">
                  <span className="font-mono text-fg-muted">{s.receiptNumber ?? "—"}</span>
                  <time dateTime={s.submittedAt!}>{formatDateTime(s.submittedAt)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Manual Register ──────────────────────────────────────────────────────
function ManualRegister({ student, eventId, availableElectives, onClose }: { student: Student; eventId: string; availableElectives: ElectiveOption[]; onClose: () => void }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selections, setSelections] = useState<Record<string, string>>({});

  const groupOptions = useMemo(() => {
    const map = new Map<string, { groupId: string; groupName: string; electives: ElectiveOption[] }>();
    availableElectives.forEach((e) => {
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
    <>
      <DialogHeader>
        <DialogTitle>Register manually</DialogTitle>
        <DialogDescription>
          Pick one subject per group for {student.name}
          {student.registerNumber ? <span className="font-mono"> ({student.registerNumber})</span> : null}.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {groupOptions.length === 0 ? <p className="text-sm text-fg-muted">No electives are available for this event.</p> : null}
        {groupOptions.map((g) => (
          <Field key={g.groupId} label={g.groupName}>
            <Select
              value={selections[g.groupId] || null}
              onValueChange={(v) => setSelections((prev) => ({ ...prev, [g.groupId]: v }))}
              placeholder="Select a subject"
              options={g.electives.map((e) => ({
                value: e.id,
                label: `${e.courseCode ? `${e.courseCode} - ` : ""}${e.name} (${e.availableSeats} seats left)`,
                disabled: e.availableSeats <= 0,
              }))}
            />
          </Field>
        ))}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={isSubmitting} loadingText="Registering">
          Confirm registration
        </Button>
      </DialogFooter>
    </>
  );
}

// ── Subjects Tab ─────────────────────────────────────────────────────────
function SubjectsTab({ groupedSubjects, totalStudents, students }: { groupedSubjects: [string, GroupSummary[]][]; totalStudents: number; students: Student[] }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(groupedSubjects.map(([name]) => name)));
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [subjectSearch, setSubjectSearch] = useState("");

  const toggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Build a map of (electiveName) -> list of students registered for it
  const studentsPerSubject = useMemo(() => {
    const map = new Map<string, { id: string; name: string; registerNumber: string | null; submittedAt: string | null }[]>();
    for (const student of students) {
      if (student.registrationStatus !== "CONFIRMED") continue;
      for (const reg of student.registrations) {
        const key = `${reg.groupName}::${reg.electiveName}`;
        const list = map.get(key) || [];
        list.push({ id: student.id, name: student.name, registerNumber: student.registerNumber, submittedAt: student.submittedAt });
        map.set(key, list);
      }
    }
    // Sort each list by name
    map.forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [students]);

  if (groupedSubjects.length === 0) {
    return <EmptyState icon={<BookOpen />} title="No subjects chosen yet" description="Subjects appear here once students confirm." />;
  }

  const q = subjectSearch.toLowerCase().trim();

  return (
    <div className="space-y-3">
      <div className="sm:max-w-sm">
        <SearchInput value={subjectSearch} onChange={setSubjectSearch} placeholder="Find a student in any subject" />
      </div>

      {groupedSubjects.map(([groupName, subjects]) => {
        const isOpen = expandedGroups.has(groupName);
        const groupTotal = subjects.reduce((sum, s) => sum + s.count, 0);

        return (
          <section key={groupName} className="overflow-hidden rounded-card border border-border bg-surface shadow-1">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggle(setExpandedGroups, groupName)}
              className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-2/70 sm:px-5"
            >
              <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-fg text-canvas">
                <BookOpen className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{groupName}</span>
                <span className="block text-xs text-fg-muted">
                  {subjects.length} subject{subjects.length !== 1 ? "s" : ""} · {groupTotal} enrollment{groupTotal !== 1 ? "s" : ""}
                </span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform duration-200", isOpen && "rotate-180")} />
            </button>

            <Disclosure open={isOpen}>
              <ul className="space-y-2 border-t border-border p-3 sm:p-4">
                {subjects.map((sub, idx) => {
                  const pct = totalStudents > 0 ? Math.round((sub.count / totalStudents) * 100) : 0;
                  const subjectKey = `${groupName}::${sub.electiveName}`;
                  const isSubjectExpanded = expandedSubjects.has(subjectKey);
                  const enrolledStudents = studentsPerSubject.get(subjectKey) || [];

                  // Filter students by search query
                  const filteredStudents = q
                    ? enrolledStudents.filter((s) => s.name.toLowerCase().includes(q) || (s.registerNumber && s.registerNumber.toLowerCase().includes(q)))
                    : enrolledStudents;

                  // If searching and no students match, hide this subject
                  if (q && filteredStudents.length === 0) return null;

                  return (
                    <li key={idx} className="overflow-hidden rounded-control border border-border">
                      <button
                        type="button"
                        aria-expanded={isSubjectExpanded}
                        onClick={() => toggle(setExpandedSubjects, subjectKey)}
                        className="w-full p-3 text-left transition-colors hover:bg-surface-2/60"
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">
                            {sub.courseCode ? <span className="font-mono text-fg-muted">{sub.courseCode} · </span> : null}
                            {sub.electiveName}
                          </span>
                          <span className="shrink-0 font-mono text-xs tabular-nums text-fg">{sub.count}</span>
                          <span className="w-10 shrink-0 text-right font-mono text-2xs tabular-nums text-fg-subtle">{pct}%</span>
                          <ChevronDown className={cn("size-3.5 shrink-0 text-fg-subtle transition-transform duration-200", isSubjectExpanded && "rotate-180")} />
                        </span>
                        <Meter value={sub.count} max={totalStudents} label={`${sub.electiveName}: ${pct}% of section`} className="mt-2.5 h-1" />
                      </button>

                      <Disclosure open={isSubjectExpanded}>
                        <div className="border-t border-border bg-surface-2/50 p-3">
                          {filteredStudents.length > 0 ? (
                            <ol className="max-h-80 space-y-0.5 overflow-y-auto scrollbar-thin">
                              {filteredStudents.map((s, sIdx) => (
                                <li key={s.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-tight px-2 py-1.5">
                                  <span className="font-mono text-xs text-fg-subtle">{sIdx + 1}</span>
                                  <span className="truncate text-sm text-fg">{s.name}</span>
                                  <span className="font-mono text-xs text-fg-muted">{s.registerNumber || "—"}</span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="py-4 text-center text-xs text-fg-muted">No students found.</p>
                          )}
                          <p className="mt-2 border-t border-border px-2 pt-2 text-2xs text-fg-muted">
                            Showing {filteredStudents.length} of {enrolledStudents.length} student{enrolledStudents.length !== 1 ? "s" : ""} · {pct}% of section
                          </p>
                        </div>
                      </Disclosure>
                    </li>
                  );
                })}
              </ul>
            </Disclosure>
          </section>
        );
      })}
    </div>
  );
}
