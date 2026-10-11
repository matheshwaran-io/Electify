"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Building, ChevronRight, GraduationCap, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Disclosure } from "@/components/ui/disclosure";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createFaculty, createDepartment, deleteFaculty, deleteDepartment } from "@/app/actions/admin";

type Section = { id: string; label: string; isActive: boolean };
type Batch = { id: string; year: string; sections: Section[] };
type Programme = { id: string; name: string; code: string; degreeType: string | null; batches: Batch[] };
type Department = { id: string; name: string; code: string; programmes: Programme[] };
type Faculty = { id: string; name: string; code: string; departments: Department[] };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Row({
  open,
  onToggle,
  icon,
  title,
  meta,
  level,
  onDelete,
  deleteTitle,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  meta: string;
  level: 0 | 1 | 2;
  onDelete?: () => void;
  deleteTitle?: string;
}) {
  return (
    <div
      className={cn(
        "group flex w-full items-center gap-2 text-left transition-colors hover:bg-surface-2/70",
        level === 0 ? "px-4 py-3.5 sm:px-5" : level === 1 ? "px-4 py-2.5 sm:px-5" : "px-4 py-2.5 sm:pl-5"
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span
          aria-hidden
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full [&_svg]:size-4",
            level === 0 ? "size-10 bg-fg text-canvas" : "size-8 bg-surface-2 text-fg-muted"
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-fg", level === 0 ? "font-medium" : "text-sm font-medium")}>{title}</span>
          <span className="block truncate text-xs text-fg-muted">{meta}</span>
        </span>
      </button>

      {onDelete ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger/10 hover:text-danger-text"
          aria-label={deleteTitle ?? "Delete"}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="p-1 text-fg-subtle transition-colors hover:text-fg"
        aria-label="Toggle details"
      >
        <ChevronRight className={cn("size-4 shrink-0 transition-transform duration-200", open && "rotate-90")} />
      </button>
    </div>
  );
}

export function DepartmentsClient({ tree }: { tree: { faculties: Faculty[] } }) {
  const router = useRouter();
  const [openFaculties, setOpenFaculties] = useState<Set<string>>(new Set());
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());
  const [openProgs, setOpenProgs] = useState<Set<string>>(new Set());

  // Modal states
  const [showFacultyModal, setShowFacultyModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);

  // Delete dialog states
  const [deletingFaculty, setDeletingFaculty] = useState<Faculty | null>(null);
  const [deletingDept, setDeletingDept] = useState<{ dept: Department; facultyName: string } | null>(null);

  // Transitions
  const [isFacultyPending, startFacultyTransition] = useTransition();
  const [isDeptPending, startDeptTransition] = useTransition();

  // Faculty form
  const [facultyName, setFacultyName] = useState("");
  const [facultyCode, setFacultyCode] = useState("");
  const [includeInitialDept, setIncludeInitialDept] = useState(false);
  const [initialDeptName, setInitialDeptName] = useState("");
  const [initialDeptCode, setInitialDeptCode] = useState("");
  const [facultyErrors, setFacultyErrors] = useState<{
    name?: string;
    code?: string;
    deptName?: string;
    deptCode?: string;
  }>({});

  // Department form
  const [deptFacultyId, setDeptFacultyId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptErrors, setDeptErrors] = useState<{
    facultyId?: string;
    name?: string;
    code?: string;
  }>({});

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setter(next);
  };

  const allOpen = tree.faculties.length > 0 && tree.faculties.every((f) => openFaculties.has(f.id));
  const expandAll = () => {
    if (allOpen) {
      setOpenFaculties(new Set());
      setOpenDepts(new Set());
      setOpenProgs(new Set());
      return;
    }
    setOpenFaculties(new Set(tree.faculties.map((f) => f.id)));
    setOpenDepts(new Set(tree.faculties.flatMap((f) => f.departments.map((d) => d.id))));
    setOpenProgs(new Set(tree.faculties.flatMap((f) => f.departments.flatMap((d) => d.programmes.map((p) => p.id)))));
  };

  const openAddDeptModal = (facultyId?: string) => {
    const defaultId = facultyId || (tree.faculties.length > 0 ? tree.faculties[0].id : null);
    setDeptFacultyId(defaultId);
    setDeptName("");
    setDeptCode("");
    setDeptErrors({});
    setShowDeptModal(true);
  };

  const resetFacultyForm = () => {
    setFacultyName("");
    setFacultyCode("");
    setIncludeInitialDept(false);
    setInitialDeptName("");
    setInitialDeptCode("");
    setFacultyErrors({});
  };

  const handleCreateFaculty = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof facultyErrors = {};

    if (!facultyName.trim()) {
      errors.name = "Faculty name is required.";
    }
    if (!facultyCode.trim()) {
      errors.code = "Faculty code is required.";
    }
    if (includeInitialDept) {
      if (!initialDeptName.trim()) {
        errors.deptName = "Department name is required.";
      }
      if (!initialDeptCode.trim()) {
        errors.deptCode = "Department code is required.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFacultyErrors(errors);
      return;
    }

    startFacultyTransition(async () => {
      try {
        const result = await createFaculty({
          name: facultyName,
          code: facultyCode,
          initialDepartment: includeInitialDept
            ? {
                name: initialDeptName,
                code: initialDeptCode,
              }
            : undefined,
        });

        toast.success(`Faculty "${result.faculty.name}" created successfully.`);
        if (result.faculty?.id) {
          setOpenFaculties((prev) => new Set([...prev, result.faculty.id]));
        }
        setShowFacultyModal(false);
        resetFacultyForm();
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create faculty.";
        toast.error(msg);
      }
    });
  };

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof deptErrors = {};

    if (!deptFacultyId) {
      errors.facultyId = "Please select a faculty.";
    }
    if (!deptName.trim()) {
      errors.name = "Department name is required.";
    }
    if (!deptCode.trim()) {
      errors.code = "Department code is required.";
    }

    if (Object.keys(errors).length > 0) {
      setDeptErrors(errors);
      return;
    }

    startDeptTransition(async () => {
      try {
        const result = await createDepartment({
          facultyId: deptFacultyId!,
          name: deptName,
          code: deptCode,
        });

        toast.success(`Department "${result.department.name}" created successfully.`);
        if (deptFacultyId) {
          setOpenFaculties((prev) => new Set([...prev, deptFacultyId]));
        }
        setShowDeptModal(false);
        setDeptName("");
        setDeptCode("");
        setDeptErrors({});
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create department.";
        toast.error(msg);
      }
    });
  };

  const handleDeleteFaculty = async () => {
    if (!deletingFaculty) return;
    try {
      await deleteFaculty(deletingFaculty.id);
      toast.success(`Deleted "${deletingFaculty.name}" successfully.`);
      setDeletingFaculty(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete faculty.";
      toast.error(msg);
      throw err;
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deletingDept) return;
    try {
      await deleteDepartment(deletingDept.dept.id);
      toast.success(`Deleted "${deletingDept.dept.name}" successfully.`);
      setDeletingDept(null);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete department.";
      toast.error(msg);
      throw err;
    }
  };

  return (
    <div>
      <PageHeader
        title="Departments & classes"
        description="Faculties, departments, programmes and their sections."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {tree.faculties.length > 0 ? (
              <Button variant="secondary" size="sm" onClick={expandAll}>
                {allOpen ? "Collapse all" : "Expand all"}
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openAddDeptModal()}
              disabled={tree.faculties.length === 0}
            >
              <Users className="size-3.5" /> Add department
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                resetFacultyForm();
                setShowFacultyModal(true);
              }}
            >
              <Plus className="size-3.5" /> Add faculty
            </Button>
          </div>
        }
      />

      {tree.faculties.length === 0 ? (
        <EmptyState
          icon={<Building />}
          title="No faculties yet"
          description="The academic hierarchy will show up here once it is set up."
          action={
            <Button
              onClick={() => {
                resetFacultyForm();
                setShowFacultyModal(true);
              }}
            >
              <Plus className="size-4" /> Add faculty
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {tree.faculties.map((faculty) => (
            <li key={faculty.id} className="overflow-hidden rounded-card border border-border bg-surface shadow-1">
              <Row
                level={0}
                open={openFaculties.has(faculty.id)}
                onToggle={() => toggle(openFaculties, setOpenFaculties, faculty.id)}
                icon={<Building />}
                title={faculty.name}
                meta={`${faculty.code} · ${plural(faculty.departments.length, "department")}`}
                onDelete={() => setDeletingFaculty(faculty)}
                deleteTitle={`Delete ${faculty.name}`}
              />

              <Disclosure open={openFaculties.has(faculty.id)}>
                <div className="border-t border-border">
                  <div className="flex items-center justify-between bg-surface-2/70 px-4 py-2 sm:px-5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                      Departments ({faculty.departments.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-fg-muted hover:text-fg"
                      onClick={() => openAddDeptModal(faculty.id)}
                    >
                      <Plus className="size-3.5" /> Add department
                    </Button>
                  </div>

                  {faculty.departments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center bg-surface py-8 px-4 text-center">
                      <Users className="mb-2 size-7 text-fg-subtle opacity-40" />
                      <p className="text-sm font-medium text-fg">No departments yet</p>
                      <p className="mt-0.5 mb-3 text-xs text-fg-muted">Add the first department under {faculty.name}.</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openAddDeptModal(faculty.id)}
                      >
                        <Plus className="size-3.5" /> Add department
                      </Button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {faculty.departments.map((dept) => (
                        <li key={dept.id}>
                          <Row
                            level={1}
                            open={openDepts.has(dept.id)}
                            onToggle={() => toggle(openDepts, setOpenDepts, dept.id)}
                            icon={<Users />}
                            title={dept.name}
                            meta={`${dept.code} · ${plural(dept.programmes.length, "programme")}`}
                            onDelete={() => setDeletingDept({ dept, facultyName: faculty.name })}
                            deleteTitle={`Delete ${dept.name}`}
                          />

                          <Disclosure open={openDepts.has(dept.id)}>
                            <ul className="space-y-2 bg-surface-2/50 p-3 sm:pl-14">
                              {dept.programmes.map((prog) => (
                                <li key={prog.id} className="overflow-hidden rounded-control border border-border bg-surface">
                                  <Row
                                    level={2}
                                    open={openProgs.has(prog.id)}
                                    onToggle={() => toggle(openProgs, setOpenProgs, prog.id)}
                                    icon={<BookOpen />}
                                    title={prog.name}
                                    meta={`${prog.code} · ${prog.degreeType ?? "—"} · ${plural(prog.batches.length, "batch", "batches")}`}
                                  />

                                  <Disclosure open={openProgs.has(prog.id)}>
                                    <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
                                      {prog.batches.flatMap((b) => b.sections).map((sec) => (
                                        <span
                                          key={sec.id}
                                          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 text-xs font-medium text-fg"
                                        >
                                          <GraduationCap className="size-3.5 text-fg-subtle" />
                                          Section {sec.label}
                                        </span>
                                      ))}
                                      {prog.batches.length === 0 ? <p className="text-xs text-fg-muted">No batches or sections defined.</p> : null}
                                    </div>
                                  </Disclosure>
                                </li>
                              ))}
                              {dept.programmes.length === 0 ? <li className="px-1 text-xs text-fg-muted">No programmes yet.</li> : null}
                            </ul>
                          </Disclosure>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Disclosure>
            </li>
          ))}
        </ul>
      )}

      {/* Delete Faculty Dialog */}
      <ConfirmDialog
        open={Boolean(deletingFaculty)}
        onOpenChange={(o) => !o && setDeletingFaculty(null)}
        tone="danger"
        title="Delete this faculty?"
        description="Deleting this faculty will also remove its associated departments, programmes, batches, and sections. This cannot be undone."
        impact={
          deletingFaculty
            ? [
                { label: "Faculty", value: deletingFaculty.name },
                { label: "Code", value: deletingFaculty.code },
                { label: "Departments", value: `${deletingFaculty.departments.length} departments`, tone: "danger" },
              ]
            : undefined
        }
        requireText="DELETE"
        confirmLabel="Delete faculty"
        onConfirm={handleDeleteFaculty}
      />

      {/* Delete Department Dialog */}
      <ConfirmDialog
        open={Boolean(deletingDept)}
        onOpenChange={(o) => !o && setDeletingDept(null)}
        tone="danger"
        title="Delete this department?"
        description="Deleting this department will also remove all programmes and classes under it. This cannot be undone."
        impact={
          deletingDept
            ? [
                { label: "Department", value: deletingDept.dept.name },
                { label: "Code", value: deletingDept.dept.code },
                { label: "Parent faculty", value: deletingDept.facultyName },
                { label: "Programmes", value: `${deletingDept.dept.programmes.length} programmes`, tone: "danger" },
              ]
            : undefined
        }
        requireText="DELETE"
        confirmLabel="Delete department"
        onConfirm={handleDeleteDepartment}
      />

      {/* Add Faculty Modal */}
      <Dialog open={showFacultyModal} onOpenChange={(o) => !isFacultyPending && setShowFacultyModal(o)}>
        <DialogContent size="md" showClose={!isFacultyPending}>
          <DialogHeader>
            <DialogTitle>Add faculty</DialogTitle>
            <DialogDescription>
              Create a new academic faculty division. You can also define its first department immediately.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateFaculty}>
            <DialogBody className="space-y-4">
              <Field label="Faculty name" description="Full official title of the faculty" error={facultyErrors.name}>
                <Input
                  placeholder="e.g. Faculty of Computing and Data Sciences"
                  value={facultyName}
                  onChange={(e) => {
                    setFacultyName(e.target.value);
                    if (facultyErrors.name) setFacultyErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  disabled={isFacultyPending}
                  autoFocus
                />
              </Field>

              <Field label="Faculty code" description="Unique short code (e.g. FCDS)" error={facultyErrors.code}>
                <Input
                  placeholder="e.g. FCDS"
                  value={facultyCode}
                  onChange={(e) => {
                    setFacultyCode(e.target.value.toUpperCase());
                    if (facultyErrors.code) setFacultyErrors((prev) => ({ ...prev, code: undefined }));
                  }}
                  disabled={isFacultyPending}
                />
              </Field>

              <div className="rounded-control border border-border bg-surface-2/70 p-3.5 transition-colors">
                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium text-fg">Include initial department</span>
                    <p className="text-xs text-fg-muted">Add the faculty&apos;s first department right now</p>
                  </div>
                  <Switch
                    checked={includeInitialDept}
                    onCheckedChange={setIncludeInitialDept}
                    disabled={isFacultyPending}
                  />
                </label>

                {includeInitialDept ? (
                  <div className="mt-3.5 space-y-3 border-t border-border pt-3.5">
                    <Field label="Department name" description="e.g. Department of Artificial Intelligence" error={facultyErrors.deptName}>
                      <Input
                        placeholder="Department of Artificial Intelligence"
                        value={initialDeptName}
                        onChange={(e) => {
                          setInitialDeptName(e.target.value);
                          if (facultyErrors.deptName) setFacultyErrors((prev) => ({ ...prev, deptName: undefined }));
                        }}
                        disabled={isFacultyPending}
                      />
                    </Field>

                    <Field label="Department code" description="e.g. AI" error={facultyErrors.deptCode}>
                      <Input
                        placeholder="AI"
                        value={initialDeptCode}
                        onChange={(e) => {
                          setInitialDeptCode(e.target.value.toUpperCase());
                          if (facultyErrors.deptCode) setFacultyErrors((prev) => ({ ...prev, deptCode: undefined }));
                        }}
                        disabled={isFacultyPending}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowFacultyModal(false)}
                disabled={isFacultyPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isFacultyPending}
                loadingText="Creating..."
              >
                Create faculty
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Department Modal */}
      <Dialog open={showDeptModal} onOpenChange={(o) => !isDeptPending && setShowDeptModal(o)}>
        <DialogContent size="md" showClose={!isDeptPending}>
          <DialogHeader>
            <DialogTitle>Add department</DialogTitle>
            <DialogDescription>
              Create a new academic department under an existing faculty.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDepartment}>
            <DialogBody className="space-y-4">
              <Field label="Faculty" description="Select the parent faculty" error={deptErrors.facultyId}>
                <Select
                  value={deptFacultyId || null}
                  onValueChange={(val) => {
                    setDeptFacultyId(val);
                    if (deptErrors.facultyId) setDeptErrors((prev) => ({ ...prev, facultyId: undefined }));
                  }}
                  options={tree.faculties.map((f) => ({
                    value: f.id,
                    label: `${f.name} (${f.code})`,
                  }))}
                  placeholder="Select a faculty"
                  disabled={isDeptPending}
                />
              </Field>

              <Field label="Department name" description="Full official title of the department" error={deptErrors.name}>
                <Input
                  placeholder="e.g. Department of Mechanical Engineering"
                  value={deptName}
                  onChange={(e) => {
                    setDeptName(e.target.value);
                    if (deptErrors.name) setDeptErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  disabled={isDeptPending}
                  autoFocus
                />
              </Field>

              <Field label="Department code" description="Unique short code (e.g. MECH)" error={deptErrors.code}>
                <Input
                  placeholder="e.g. MECH"
                  value={deptCode}
                  onChange={(e) => {
                    setDeptCode(e.target.value.toUpperCase());
                    if (deptErrors.code) setDeptErrors((prev) => ({ ...prev, code: undefined }));
                  }}
                  disabled={isDeptPending}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeptModal(false)}
                disabled={isDeptPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isDeptPending}
                loadingText="Creating..."
              >
                Create department
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
