"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, GraduationCap, Layers, Users } from "lucide-react";
import { toast } from "sonner";
import { assignTutorSections } from "@/app/actions/admin";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Avatar, PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type StaffUser = { id: string; name: string; email: string; role: string; employeeId: string | null; isActive: boolean; createdAt: Date; managedSectionIds?: string[] };
type StudentUser = { id: string; name: string; email: string; registerNumber: string | null; isActive: boolean; isEligible: boolean; createdAt: Date; programmeName: string | null };

const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

function NameCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={name} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-fg">{name}</span>
        {sub ? <span className="block truncate text-xs font-normal text-fg-muted">{sub}</span> : null}
      </span>
    </span>
  );
}

const studentColumns: Column<StudentUser>[] = [
  {
    id: "name",
    header: "Name",
    mobile: "title",
    hideable: false,
    cell: (u) => <NameCell name={u.name} sub={u.email} />,
    sortValue: (u) => u.name,
    searchValue: (u) => u.name,
  },
  {
    id: "reg",
    header: "Register no.",
    cell: (u) => <span className="font-mono text-xs text-fg-muted">{u.registerNumber ?? "—"}</span>,
    sortValue: (u) => u.registerNumber,
    searchValue: (u) => u.registerNumber,
  },
  { id: "programme", header: "Programme", cell: (u) => <span className="text-fg-muted">{u.programmeName ?? "—"}</span>, sortValue: (u) => u.programmeName },
  {
    id: "active",
    header: "Account",
    cell: (u) => (
      <Badge size="sm" tone={u.isActive ? "success" : "danger"} dot>
        {u.isActive ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "eligible",
    header: "Eligible",
    cell: (u) => (
      <Badge size="sm" tone={u.isEligible ? "success" : "warning"}>
        {u.isEligible ? "Eligible" : "Not eligible"}
      </Badge>
    ),
  },
  {
    id: "joined",
    header: "Joined",
    cell: (u) => <span className="whitespace-nowrap text-fg-muted">{formatDate(u.createdAt)}</span>,
    sortValue: (u) => new Date(u.createdAt).getTime(),
  },
];

const studentFilters: FilterDef<StudentUser>[] = [
  { id: "eligible", label: "Eligible", options: yesNo, predicate: (u, v) => u.isEligible === (v === "yes") },
  { id: "active", label: "Active", options: yesNo, predicate: (u, v) => u.isActive === (v === "yes") },
];

export function UsersClient({ staff, students, hierarchy }: { staff: StaffUser[]; students: StudentUser[]; hierarchy: any[] }) {
  const [managingTutor, setManagingTutor] = useState<StaffUser | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const staffColumns: Column<StaffUser>[] = [
    {
      id: "name",
      header: "Name",
      mobile: "title",
      hideable: false,
      cell: (u) => <NameCell name={u.name} />,
      sortValue: (u) => u.name,
      searchValue: (u) => u.name,
    },
    {
      id: "email",
      header: "Email",
      mobile: "subtitle",
      cell: (u) => <span className="text-fg-muted">{u.email}</span>,
      sortValue: (u) => u.email,
      searchValue: (u) => u.email,
    },
    { id: "employee", header: "Employee ID", cell: (u) => <span className="font-mono text-xs text-fg-muted">{u.employeeId ?? "—"}</span> },
    { id: "role", header: "Role", mobileWide: true, cell: (u) => <StatusBadge status={u.role} size="sm" />, sortValue: (u) => u.role },
    {
      id: "status",
      header: "Status",
      cell: (u) => (
        <Badge size="sm" tone={u.isActive ? "success" : "danger"} dot>
          {u.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "joined",
      header: "Joined",
      cell: (u) => <span className="whitespace-nowrap text-fg-muted">{formatDate(u.createdAt)}</span>,
      sortValue: (u) => new Date(u.createdAt).getTime(),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (u) =>
        u.role === "CLASS_TUTOR" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setManagingTutor(u);
              setManageOpen(true);
            }}
          >
            <Layers /> Manage sections
          </Button>
        ) : null,
    },
  ];

  const roles = [...new Set(staff.map((u) => u.role))];
  const staffFilters: FilterDef<StaffUser>[] =
    roles.length > 1 ? [{ id: "role", label: "Role", options: roles.map((r) => ({ value: r, label: statusLabel(r) })), predicate: (u, v) => u.role === v }] : [];

  return (
    <div>
      <PageHeader title="Users" description="Every staff and student account in the system." />

      <Tabs defaultValue="staff">
        <TabsList variant="pill" className="mb-4 w-fit max-w-full">
          <TabsTrigger value="staff">
            <Users /> Staff <span className="font-mono text-xs tabular-nums text-fg-subtle">{staff.length}</span>
          </TabsTrigger>
          <TabsTrigger value="students">
            <GraduationCap /> Students <span className="font-mono text-xs tabular-nums text-fg-subtle">{students.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <DataTable
            data={staff}
            columns={staffColumns}
            getRowId={(u) => u.id}
            caption="Staff accounts"
            searchPlaceholder="Search by name or email"
            filters={staffFilters}
            empty={<EmptyState compact icon={<Users />} title="No staff found" />}
          />
        </TabsContent>
        <TabsContent value="students">
          <DataTable
            data={students}
            columns={studentColumns}
            getRowId={(u) => u.id}
            caption="Student accounts"
            searchPlaceholder="Search by name or register number"
            filters={studentFilters}
            pageSize={25}
            empty={<EmptyState compact icon={<GraduationCap />} title="No students found" />}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent size="lg">
          {managingTutor ? (
            <ManageTutorSections key={managingTutor.id} tutor={managingTutor} hierarchy={hierarchy} onClose={() => setManageOpen(false)} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManageTutorSections({ tutor, hierarchy, onClose }: { tutor: StaffUser; hierarchy: any[]; onClose: () => void }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>(tutor.managedSectionIds || []);
  const [isSaving, setIsSaving] = useState(false);

  const toggleSection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await assignTutorSections(tutor.id, selectedIds);
      toast.success("Sections updated successfully");
      router.refresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update sections");
    } finally {
      setIsSaving(false);
    }
  };

  // Flatten sections from hierarchy for easy rendering
  const allSections: { id: string; label: string; programme: string; batch: string }[] = [];
  hierarchy.forEach((f) =>
    f.departments.forEach((d: any) =>
      d.programmes.forEach((p: any) =>
        p.batches.forEach((b: any) =>
          b.sections.forEach((s: any) => {
            allSections.push({ id: s.id, label: s.label, programme: p.name, batch: b.year });
          })
        )
      )
    )
  );

  // Group sections by programme > batch
  const grouped = allSections.reduce((acc, sec) => {
    const key = `${sec.programme} · ${sec.batch}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(sec);
    return acc;
  }, {} as Record<string, typeof allSections>);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Manage sections</DialogTitle>
        <DialogDescription>Choose the classes {tutor.name} looks after.</DialogDescription>
      </DialogHeader>

      <DialogBody className="max-h-[55dvh] space-y-6 overflow-y-auto scrollbar-thin">
        {Object.entries(grouped).map(([groupName, secs]) => (
          <fieldset key={groupName} className="space-y-3">
            <legend className="text-xs font-medium text-fg-muted">{groupName}</legend>
            <div className="flex flex-wrap gap-2">
              {secs.map((sec) => {
                const isSelected = selectedIds.includes(sec.id);
                return (
                  <button
                    key={sec.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSection(sec.id)}
                    className={cn(
                      "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-fg"
                        : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    {isSelected ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
                    Section {sec.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        {Object.keys(grouped).length === 0 ? (
          <EmptyState compact icon={<Layers />} title="No sections yet" description="Create departments and classes first." />
        ) : null}
      </DialogBody>

      <DialogFooter className="flex-col items-stretch sm:justify-between">
        <span className="text-sm text-fg-muted" aria-live="polite">
          <span className="font-mono tabular-nums text-fg">{selectedIds.length}</span> selected
        </span>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isSaving} loadingText="Saving">
            Save assignments
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
