"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  resetRegistrationEvent,
  deleteRegistrationEvent,
  updateRegistrationEvent,
  updateRegistrationEventStatus,
  createRegistrationEvent,
} from "@/app/actions/coordinator";
import { createEventFromTemplate, type DetailedTemplate } from "@/app/actions/templates";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from "@/components/ui/menu";

export type EventItem = {
  id: string;
  name: string;
  description?: string | null;
  academicYear: string | null;
  academicBatchId?: string | null;
  semester: number | null;
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
  createdAt: Date;
  programmeName: string | null;
  programmeCode: string | null;
  /** Full identity of the classes the event is open to, e.g. "MCA F · 2025–2027" */
  classLabels: string[];
};

/** A class (cohort section) the user may create events for in the selected session. */
export type ClassOption = {
  sectionId: string;
  label: string;
  stage: string;
  programmeId: string;
  semester: number | null;
};

const SEMESTER_OPTIONS = [{ value: "", label: "Not set" }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Semester ${i + 1}` }))];

function toLocalInput(d: Date | string | null) {
  if (!d) return "";
  const date = new Date(d);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CLOSED", label: "Closed" },
  { value: "ARCHIVED", label: "Archived" },
];

export function EventsClient({
  events,
  classes = [],
  sessionLabel,
  templates = [],
}: {
  events: EventItem[];
  classes?: ClassOption[];
  sessionLabel: string;
  templates?: DetailedTemplate[];
}) {
  const router = useRouter();

  // Reset dialog state
  const [resetting, setResetting] = useState<EventItem | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Delete dialog state
  const [deleting, setDeleting] = useState<EventItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Edit dialog state
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSemester, setEditSemester] = useState("");
  const [editStatus, setEditStatus] = useState("DRAFT");
  const [editOpenDate, setEditOpenDate] = useState("");
  const [editCloseDate, setEditCloseDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editErrors, setEditErrors] = useState<{ name?: string }>({});

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createSectionId, setCreateSectionId] = useState("");
  const [createSemester, setCreateSemester] = useState("");
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [createOpenDate, setCreateOpenDate] = useState("");
  const [createCloseDate, setCreateCloseDate] = useState("");
  const [createStatus, setCreateStatus] = useState("DRAFT");
  const [createDescription, setCreateDescription] = useState("");
  const [createErrors, setCreateErrors] = useState<{ name?: string; sectionId?: string }>({});

  const [isPending, startTransition] = useTransition();

  const handleReset = async () => {
    if (!resetting) return;
    try {
      await resetRegistrationEvent(resetting.id);
      router.refresh();
      toast.success(`Reset ${resetting.name}. All students must register again.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reset event";
      toast.error(msg);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteRegistrationEvent(deleting.id);
      router.refresh();
      toast.success(`Deleted event "${deleting.name}" successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete event";
      toast.error(msg);
      throw err;
    }
  };

  const handleStatusChange = (event: EventItem, newStatus: string) => {
    startTransition(async () => {
      try {
        await updateRegistrationEventStatus(event.id, newStatus);
        router.refresh();
        toast.success(`Event marked as ${statusLabel(newStatus)}.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update status";
        toast.error(msg);
      }
    });
  };

  const openEditModal = (e: EventItem) => {
    setEditing(e);
    setEditName(e.name);
    setEditSemester(e.semester ? String(e.semester) : "");
    setEditStatus(e.status);
    setEditOpenDate(toLocalInput(e.openDate));
    setEditCloseDate(toLocalInput(e.closeDate));
    setEditDescription(e.description || "");
    setEditErrors({});
    setEditOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;

    if (!editName.trim()) {
      setEditErrors({ name: "Event name is required." });
      return;
    }

    startTransition(async () => {
      try {
        await updateRegistrationEvent(editing.id, {
          name: editName,
          semester: editSemester ? Number(editSemester) : null,
          status: editStatus,
          openDate: editOpenDate ? new Date(editOpenDate).toISOString() : null,
          closeDate: editCloseDate ? new Date(editCloseDate).toISOString() : null,
          description: editDescription,
        });

        toast.success(`Updated "${editName}" successfully.`);
        setEditOpen(false);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update event";
        toast.error(msg);
      }
    });
  };

  const targetClass = classes.find((c) => c.sectionId === createSectionId) ?? null;

  const openCreateModal = () => {
    setCreateTemplateId("");
    setCreateName("");
    const first = classes.length === 1 ? classes[0] : null;
    setCreateSectionId(first ? first.sectionId : "");
    setCreateSemester(first?.semester ? String(first.semester) : "");
    setCreateOpenDate("");
    setCreateCloseDate("");
    setCreateStatus("DRAFT");
    setCreateDescription("");
    setCreateErrors({});
    setCreateOpen(true);
  };

  // Validate, then ask for an explicit confirmation of the full class identity.
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof createErrors = {};
    if (!createName.trim()) errors.name = "Event name is required.";
    if (!createSectionId) errors.sectionId = "Choose the class this event is for.";
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }
    setConfirmCreateOpen(true);
  };

  const confirmCreate = async () => {
    const payload = {
      name: createName,
      targetSectionId: createSectionId,
      semester: createSemester ? Number(createSemester) : null,
      status: createStatus,
      openDate: createOpenDate ? new Date(createOpenDate).toISOString() : null,
      closeDate: createCloseDate ? new Date(createCloseDate).toISOString() : null,
      description: createDescription,
    };
    if (createTemplateId) {
      const res = await createEventFromTemplate({ templateId: createTemplateId, ...payload });
      if (!res.success) throw new Error(res.error || "Failed to create event from template");
      toast.success(`"${res.eventName}" created for ${targetClass?.label ?? "the class"} with the template's electives.`);
    } else {
      const result = await createRegistrationEvent(payload);
      toast.success(`"${result.event.name}" created for ${targetClass?.label ?? "the class"}.`);
    }
    setConfirmCreateOpen(false);
    setCreateOpen(false);
    router.refresh();
  };

  const classOptions = classes.map((c) => ({ value: c.sectionId, label: `${c.label} · ${c.stage}` }));

  const columns: Column<EventItem>[] = [
    {
      id: "name",
      header: "Event",
      mobile: "title",
      hideable: false,
      cell: (e) => (
        <div>
          <span className="block font-medium text-fg">{e.name}</span>
          {e.description ? <span className="block truncate text-xs text-fg-muted">{e.description}</span> : null}
        </div>
      ),
      sortValue: (e) => e.name,
      searchValue: (e) => `${e.name} ${e.description ?? ""}`,
      className: "min-w-56",
    },
    {
      id: "class",
      header: "Class",
      mobile: "subtitle",
      cell: (e) => <span className="text-fg-muted">{e.classLabels.length ? e.classLabels.join(", ") : "No class"}</span>,
      sortValue: (e) => e.classLabels[0] ?? "",
      searchValue: (e) => `${e.classLabels.join(" ")} ${e.programmeName ?? ""} ${e.programmeCode ?? ""}`,
    },
    {
      id: "semester",
      header: "Semester",
      cell: (e) => <span className="text-fg-muted">{e.semester ? `Semester ${e.semester}` : "—"}</span>,
      sortValue: (e) => e.semester,
    },
    {
      id: "status",
      header: "Status",
      cell: (e) => <StatusBadge status={e.status} size="sm" />,
      sortValue: (e) => e.status,
    },
    {
      id: "open",
      header: "Opens",
      cell: (e) => <span className="whitespace-nowrap text-fg-muted">{e.openDate ? formatDate(e.openDate) : "—"}</span>,
      sortValue: (e) => (e.openDate ? new Date(e.openDate).getTime() : null),
    },
    {
      id: "close",
      header: "Closes",
      cell: (e) => <span className="whitespace-nowrap text-fg-muted">{e.closeDate ? formatDate(e.closeDate) : "—"}</span>,
      sortValue: (e) => (e.closeDate ? new Date(e.closeDate).getTime() : null),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (e) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openEditModal(e)}
            aria-label={`Edit ${e.name}`}
          >
            <Pencil className="size-3.5" /> Edit
          </Button>

          <Button
            size="sm"
            variant="destructive-soft"
            onClick={() => {
              setResetting(e);
              setResetConfirmOpen(true);
            }}
            aria-label={`Reset registrations for ${e.name}`}
          >
            <RotateCcw className="size-3.5" /> Reset data
          </Button>

          <Button
            size="sm"
            variant="destructive-soft"
            onClick={() => {
              setDeleting(e);
              setDeleteConfirmOpen(true);
            }}
            aria-label={`Delete event ${e.name}`}
            className="text-danger-text hover:bg-danger/10 hover:border-danger/25"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>

          <Menu>
            <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${e.name}`} />}>
              <MoreHorizontal className="size-4" />
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Event Status</MenuLabel>
              {e.status !== "PUBLISHED" ? (
                <MenuItem onClick={() => handleStatusChange(e, "PUBLISHED")}>
                  <CheckCircle className="size-4 text-primary" /> Publish event
                </MenuItem>
              ) : (
                <MenuItem onClick={() => handleStatusChange(e, "CLOSED")}>
                  <Clock className="size-4" /> Close event
                </MenuItem>
              )}
              {e.status !== "DRAFT" ? (
                <MenuItem onClick={() => handleStatusChange(e, "DRAFT")}>
                  <Calendar className="size-4" /> Set to Draft
                </MenuItem>
              ) : null}
              {e.status !== "ARCHIVED" ? (
                <MenuItem onClick={() => handleStatusChange(e, "ARCHIVED")}>
                  <Archive className="size-4" /> Archive event
                </MenuItem>
              ) : null}

              <MenuLabel>Navigation</MenuLabel>
              <MenuItem onClick={() => router.push(`/faculty/monitor?eventId=${e.id}`)}>
                <Radio className="size-4 text-emerald-400" /> Live monitor
              </MenuItem>
              <MenuItem onClick={() => router.push("/faculty/electives")}>
                <BookOpen className="size-4" /> Manage electives
              </MenuItem>
              <MenuItem onClick={() => router.push("/faculty/window")}>
                <Activity className="size-4" /> Live window
              </MenuItem>
              <MenuItem onClick={() => router.push(`/faculty/replay/${e.id}`)}>
                <History className="size-4" /> Replay log
              </MenuItem>

              <MenuLabel>Danger Zone</MenuLabel>
              <MenuItem
                tone="danger"
                onClick={() => {
                  setResetting(e);
                  setResetConfirmOpen(true);
                }}
              >
                <RotateCcw className="size-4" /> Reset registrations
              </MenuItem>
              <MenuItem
                tone="danger"
                onClick={() => {
                  setDeleting(e);
                  setDeleteConfirmOpen(true);
                }}
              >
                <Trash2 className="size-4" /> Delete event permanently
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      ),
    },
  ];

  const statuses = [...new Set(events.map((e) => e.status))];
  const filters: FilterDef<EventItem>[] =
    statuses.length > 1
      ? [
          {
            id: "status",
            label: "Status",
            options: statuses.map((s) => ({ value: s, label: statusLabel(s) })),
            predicate: (e, v) => e.status === v,
          },
        ]
      : [];

  return (
    <div>
      <PageHeader
        title="Registration events"
        description={`Events in Academic Session ${sessionLabel} for the classes you manage. Each event is for one class and keeps its own subjects, seats and window.`}
        actions={
          <Button variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="size-3.5" /> Create event
          </Button>
        }
      />

      <DataTable
        data={events}
        columns={columns}
        getRowId={(e) => e.id}
        caption="Registration events"
        searchPlaceholder="Search events or classes"
        filters={filters}
        empty={
          <EmptyState
            compact
            icon={<Calendar />}
            title="No events found"
            description={classes.length ? `No events in ${sessionLabel} yet.` : `You don't manage any class in ${sessionLabel}.`}
            action={
              <Button onClick={openCreateModal}>
                <Plus className="size-4" /> Create event
              </Button>
            }
          />
        }
      />

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        open={resetConfirmOpen}
        onOpenChange={setResetConfirmOpen}
        tone="danger"
        title="Reset this event?"
        description="Every registration for this event is deleted and its seats are released. Students will have to register again. This cannot be undone."
        impact={
          resetting
            ? [
                { label: "Event", value: resetting.name },
                { label: "Class", value: resetting.classLabels.join(", ") || "—" },
                { label: "Academic session", value: sessionLabel },
                { label: "Registrations", value: "All deleted", tone: "danger" },
              ]
            : undefined
        }
        requireText="RESET"
        confirmLabel="Reset registrations"
        onConfirm={handleReset}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        tone="danger"
        title="Delete this registration event?"
        description="This will permanently delete this registration event along with all associated student selections, seat allotments, and replay logs. This action cannot be reversed."
        impact={
          deleting
            ? [
                { label: "Event", value: deleting.name },
                { label: "Class", value: deleting.classLabels.join(", ") || "—" },
                { label: "Academic session", value: sessionLabel },
                { label: "Records", value: "All allocations & logs deleted", tone: "danger" },
              ]
            : undefined
        }
        requireText="DELETE"
        confirmLabel="Delete event permanently"
        onConfirm={handleDelete}
      />

      {/* Edit Event Modal */}
      <Dialog open={editOpen} onOpenChange={(o) => !isPending && setEditOpen(o)}>
        <DialogContent size="lg" showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>Edit registration event</DialogTitle>
            <DialogDescription>
              {editing ? `${editing.classLabels.join(", ") || "No class"} · Academic session ${sessionLabel}` : "Update event timeline, schedule, or details."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit}>
            <DialogBody className="space-y-4">
              <Field label="Event name" error={editErrors.name}>
                <Input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editErrors.name) setEditErrors({});
                  }}
                  disabled={isPending}
                  autoFocus
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Semester">
                  <Select value={editSemester} onValueChange={setEditSemester} options={SEMESTER_OPTIONS} disabled={isPending} />
                </Field>

                <Field label="Status">
                  <Select
                    value={editStatus}
                    onValueChange={setEditStatus}
                    options={STATUS_OPTIONS}
                    disabled={isPending}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opens at" description="Start of registration window">
                  <Input
                    type="datetime-local"
                    value={editOpenDate}
                    onChange={(e) => setEditOpenDate(e.target.value)}
                    disabled={isPending}
                  />
                </Field>

                <Field label="Closes at" description="End of registration window">
                  <Input
                    type="datetime-local"
                    value={editCloseDate}
                    onChange={(e) => setEditCloseDate(e.target.value)}
                    disabled={isPending}
                  />
                </Field>
              </div>

              <Field label="Description" description="Optional guidance or remarks for students">
                <Textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={isPending}
                  rows={2}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={isPending} loadingText="Saving...">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Event Modal */}
      <Dialog open={createOpen} onOpenChange={(o) => !isPending && setCreateOpen(o)}>
        <DialogContent size="lg" showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>Create registration event</DialogTitle>
            <DialogDescription>
              One event for one class in Academic Session {sessionLabel}. Another class (even with the same name) needs its own event.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate}>
            <DialogBody className="space-y-4">
              {templates.length > 0 && (
                <Field
                  label="Curriculum Template (Optional)"
                  description="Pre-populate course baskets & electives from an existing blueprint"
                >
                  <Select
                    value={createTemplateId || null}
                    onValueChange={(val) => {
                      setCreateTemplateId(val);
                      const chosen = templates.find((t) => t.id === val);
                      if (chosen) {
                        if (!createName || templates.some((t) => createName.startsWith(t.name.slice(0, 8)))) {
                          setCreateName(`${chosen.name.replace(" Template", "")} Registration`);
                        }
                        const sameProgramme = classes.filter((c) => c.programmeId === chosen.programmeId);
                        if (sameProgramme.length === 1) {
                          setCreateSectionId(sameProgramme[0].sectionId);
                          setCreateSemester(sameProgramme[0].semester ? String(sameProgramme[0].semester) : "");
                        }
                      }
                    }}
                    options={[
                      { value: "", label: "None — Start with blank baskets" },
                      ...templates.map((t) => ({
                        value: t.id,
                        label: `${t.name} (${t.groupCount} baskets, ${t.electiveCount} electives)`,
                      })),
                    ]}
                    placeholder="Select template..."
                    disabled={isPending}
                  />
                </Field>
              )}

              <Field label="Event name" description="e.g. Fall 2026 Elective Registration" error={createErrors.name}>
                <Input
                  placeholder="e.g. Fall 2026 Elective Registration"
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value);
                    if (createErrors.name) setCreateErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  disabled={isPending}
                  autoFocus
                />
              </Field>

              <Field
                label="Class"
                description="Only students of this class and cohort can see and register for the event."
                error={createErrors.sectionId}
              >
                <Select
                  value={createSectionId || null}
                  onValueChange={(val) => {
                    setCreateSectionId(val);
                    const chosen = classes.find((c) => c.sectionId === val);
                    if (chosen?.semester && !createSemester) setCreateSemester(String(chosen.semester));
                    if (createErrors.sectionId) setCreateErrors((prev) => ({ ...prev, sectionId: undefined }));
                  }}
                  options={classOptions}
                  placeholder={classes.length ? "Select class" : "No classes in this session"}
                  disabled={isPending || classes.length === 0}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Semester" description={`Academic session ${sessionLabel}`}>
                  <Select value={createSemester} onValueChange={setCreateSemester} options={SEMESTER_OPTIONS} disabled={isPending} />
                </Field>

                <Field label="Initial status">
                  <Select
                    value={createStatus}
                    onValueChange={setCreateStatus}
                    options={STATUS_OPTIONS}
                    disabled={isPending}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opens at" description="Start of registration window">
                  <Input
                    type="datetime-local"
                    value={createOpenDate}
                    onChange={(e) => setCreateOpenDate(e.target.value)}
                    disabled={isPending}
                  />
                </Field>

                <Field label="Closes at" description="End of registration window">
                  <Input
                    type="datetime-local"
                    value={createCloseDate}
                    onChange={(e) => setCreateCloseDate(e.target.value)}
                    disabled={isPending}
                  />
                </Field>
              </div>

              <Field label="Description" description="Optional student notice">
                <Textarea
                  placeholder="Instructions for students regarding elective choices..."
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  disabled={isPending}
                  rows={2}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || classes.length === 0}>
                Review and create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmCreateOpen}
        onOpenChange={setConfirmCreateOpen}
        title="Create this registration event?"
        description="Check the class carefully: classes with the same name in other cohorts are separate and need their own events."
        impact={[
          { label: "Event", value: createName.trim() || "—" },
          { label: "Class", value: targetClass?.label ?? "—" },
          { label: "Academic session", value: sessionLabel },
          { label: "Semester", value: createSemester ? `Semester ${createSemester}` : "Not set" },
          { label: "Opens", value: createOpenDate ? new Date(createOpenDate).toLocaleString() : "Not scheduled" },
          { label: "Closes", value: createCloseDate ? new Date(createCloseDate).toLocaleString() : "Not scheduled" },
          ...(createTemplateId ? [{ label: "Template", value: templates.find((t) => t.id === createTemplateId)?.name ?? "—" }] : []),
        ]}
        confirmLabel="Create event"
        onConfirm={confirmCreate}
      />
    </div>
  );
}
