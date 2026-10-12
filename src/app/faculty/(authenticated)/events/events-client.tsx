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
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
  createdAt: Date;
  programmeName: string | null;
  programmeCode: string | null;
};

export type BatchOption = {
  id: string;
  year: string;
  programmeId: string | null;
  programmeName: string | null;
  programmeCode: string | null;
};

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
  batches = [],
  templates = [],
}: {
  events: EventItem[];
  batches?: BatchOption[];
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
  const [editAcademicYear, setEditAcademicYear] = useState("");
  const [editStatus, setEditStatus] = useState("DRAFT");
  const [editOpenDate, setEditOpenDate] = useState("");
  const [editCloseDate, setEditCloseDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editErrors, setEditErrors] = useState<{ name?: string }>({});

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createTemplateId, setCreateTemplateId] = useState("");
  const [createName, setCreateName] = useState("");
  const [createBatchId, setCreateBatchId] = useState("");
  const [createAcademicYear, setCreateAcademicYear] = useState("");
  const [createOpenDate, setCreateOpenDate] = useState("");
  const [createCloseDate, setCreateCloseDate] = useState("");
  const [createStatus, setCreateStatus] = useState("DRAFT");
  const [createDescription, setCreateDescription] = useState("");
  const [createErrors, setCreateErrors] = useState<{ name?: string; batchId?: string }>({});

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
    setEditAcademicYear(e.academicYear || "");
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
          academicYear: editAcademicYear,
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

  const openCreateModal = () => {
    setCreateTemplateId("");
    setCreateName("");
    const defaultBatch = batches.length > 0 ? batches[0] : null;
    setCreateBatchId(defaultBatch ? defaultBatch.id : "");
    setCreateAcademicYear(defaultBatch ? defaultBatch.year : "");
    setCreateOpenDate("");
    setCreateCloseDate("");
    setCreateStatus("DRAFT");
    setCreateDescription("");
    setCreateErrors({});
    setCreateOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof createErrors = {};

    if (!createName.trim()) {
      errors.name = "Event name is required.";
    }
    if (!createBatchId) {
      errors.batchId = "Please select a target programme and batch.";
    }

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    startTransition(async () => {
      try {
        if (createTemplateId) {
          const res = await createEventFromTemplate({
            templateId: createTemplateId,
            name: createName,
            academicBatchId: createBatchId,
            academicYear: createAcademicYear,
            status: createStatus,
            openDate: createOpenDate ? new Date(createOpenDate).toISOString() : null,
            closeDate: createCloseDate ? new Date(createCloseDate).toISOString() : null,
            description: createDescription,
          });

          if (!res.success) {
            throw new Error(res.error || "Failed to create event from template");
          }

          toast.success(
            `Registration event "${res.eventName}" created with pre-configured template electives.`
          );
        } else {
          const result = await createRegistrationEvent({
            name: createName,
            academicBatchId: createBatchId,
            academicYear: createAcademicYear,
            status: createStatus,
            openDate: createOpenDate ? new Date(createOpenDate).toISOString() : null,
            closeDate: createCloseDate ? new Date(createCloseDate).toISOString() : null,
            description: createDescription,
          });

          toast.success(`Registration event "${result.event.name}" created successfully.`);
        }

        setCreateOpen(false);
        router.refresh();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create event";
        toast.error(msg);
      }
    });
  };

  const batchOptions = batches.map((b) => ({
    value: b.id,
    label: `${b.programmeName ?? "Programme"} (${b.programmeCode ?? "—"}) · Year ${b.year}`,
  }));

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
      id: "programme",
      header: "Programme",
      mobile: "subtitle",
      cell: (e) => (
        <span className="text-fg-muted">
          {e.programmeName ?? "—"}
          {e.programmeCode ? <span className="ml-1.5 font-mono text-2xs text-fg-subtle">{e.programmeCode}</span> : null}
        </span>
      ),
      sortValue: (e) => e.programmeName,
      searchValue: (e) => `${e.programmeName ?? ""} ${e.programmeCode ?? ""}`,
    },
    {
      id: "year",
      header: "Academic year",
      cell: (e) => <span className="text-fg-muted">{e.academicYear ?? "—"}</span>,
      sortValue: (e) => e.academicYear,
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
        description="Every registration event across all programmes."
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
        searchPlaceholder="Search events or programmes"
        filters={filters}
        empty={
          <EmptyState
            compact
            icon={<Calendar />}
            title="No events found"
            description="Events created by course controllers show up here."
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
                { label: "Programme", value: resetting.programmeName ?? "—" },
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
                { label: "Programme", value: deleting.programmeName ?? "—" },
                { label: "Academic Year", value: deleting.academicYear ?? "—" },
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
            <DialogDescription>Update event timeline, schedule, or details.</DialogDescription>
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
                <Field label="Academic year" description="e.g. 2026-2028">
                  <Input
                    value={editAcademicYear}
                    onChange={(e) => setEditAcademicYear(e.target.value)}
                    disabled={isPending}
                  />
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
            <DialogDescription>Define a new elective registration window for a programme batch.</DialogDescription>
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
                        const matchedBatch = batches.find((b) => b.programmeId === chosen.programmeId);
                        if (matchedBatch) {
                          setCreateBatchId(matchedBatch.id);
                          setCreateAcademicYear(matchedBatch.year);
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
                label="Target programme & batch"
                description="Programme whose students will register"
                error={createErrors.batchId}
              >
                <Select
                  value={createBatchId || null}
                  onValueChange={(val) => {
                    setCreateBatchId(val);
                    const matched = batches.find((b) => b.id === val);
                    if (matched && !createAcademicYear) {
                      setCreateAcademicYear(matched.year);
                    }
                    if (createErrors.batchId) setCreateErrors((prev) => ({ ...prev, batchId: undefined }));
                  }}
                  options={batchOptions}
                  placeholder="Select programme & batch"
                  disabled={isPending}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Academic year" description="e.g. 2026-2028">
                  <Input
                    placeholder="2026-2028"
                    value={createAcademicYear}
                    onChange={(e) => setCreateAcademicYear(e.target.value)}
                    disabled={isPending}
                  />
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
              <Button type="submit" loading={isPending} loadingText="Creating...">
                Create event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
