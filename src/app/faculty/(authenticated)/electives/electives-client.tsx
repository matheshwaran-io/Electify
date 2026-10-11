"use client";

import * as React from "react";
import { AlertTriangle, BookOpen, Building2, Layers, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Sparkles, Split, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { AnimatedNumber, Meter } from "@/components/ui/data-display";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  setElectiveSeatAllocations,
  createCoordinatorElective,
  updateCoordinatorElective,
  deleteCoordinatorElective,
  createCoordinatorElectiveGroup,
  updateCoordinatorElectiveGroup,
  deleteCoordinatorElectiveGroup,
  getCoordinatorElectives,
} from "@/app/actions/coordinator";

export type SectionHierarchyItem = {
  id: string;
  label: string;
  programmeName: string;
  batchYear: string;
  departmentId: string;
  displayName: string;
};

export type DepartmentHierarchyItem = {
  id: string;
  name: string;
  code: string;
  sections: SectionHierarchyItem[];
};

export type ElectiveAllocation = {
  id: string;
  electiveId: string;
  departmentId: string;
  departmentName: string;
  departmentCode: string;
  sectionId: string | null;
  sectionLabel: string | null;
  maxSeats: number;
  availableSeats: number;
  bookedSeats: number;
  isFull: boolean;
};

export type ElectiveItem = {
  id: string;
  name: string;
  courseCode: string | null;
  credits: number;
  description: string | null;
  maxSeats: number;
  availableSeats: number;
  isActive: boolean;
  isFull: boolean;
  totalAllottedSeats: number;
  totalBookedSeats: number;
  unallocatedSeats: number;
  allocations: ElectiveAllocation[];
};

export type GroupItem = {
  eventId: string;
  eventName: string;
  eventStatus: string;
  groupId: string;
  groupName: string;
  minChoices: number;
  maxChoices: number;
  electives: ElectiveItem[];
};

interface ElectivesClientProps {
  initialGroups: GroupItem[];
  hierarchy: DepartmentHierarchyItem[];
  userRole: string;
}

type AllotmentTarget = { elective: ElectiveItem; groupName: string; eventName: string };
type SubjectModal = { mode: "create" | "edit"; groupId?: string; elective?: ElectiveItem };
type GroupModal = { mode: "create" | "edit"; eventId?: string; group?: { id: string; name: string; minChoices: number; maxChoices: number } };
type DeleteTarget = { type: "subject" | "group"; id: string; name: string };

/** Open state that keeps its payload through the close animation. */
function useDialog<T>() {
  const [state, setState] = React.useState<{ open: boolean; data: T | null; key: number }>({ open: false, data: null, key: 0 });
  return {
    ...state,
    show: (data: T) => setState((s) => ({ open: true, data, key: s.key + 1 })),
    close: () => setState((s) => ({ ...s, open: false })),
    onOpenChange: (open: boolean) => setState((s) => ({ ...s, open })),
  };
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-control border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger-text">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function ElectivesClient({ initialGroups, hierarchy }: ElectivesClientProps) {
  const [groups, setGroups] = React.useState<GroupItem[]>(initialGroups);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedEventId, setSelectedEventId] = React.useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const allotment = useDialog<AllotmentTarget>();
  const subject = useDialog<SubjectModal>();
  const group = useDialog<GroupModal>();
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  // Refresh data from server
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await getCoordinatorElectives();
      setGroups(fresh);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to refresh data";
      toast.error(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  const succeed = (msg: string) => {
    toast.success(msg);
    refreshData();
  };

  // Extract unique events for selector
  const distinctEvents = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; status: string }>();
    for (const g of groups) {
      if (!map.has(g.eventId)) {
        map.set(g.eventId, { id: g.eventId, name: g.eventName, status: g.eventStatus });
      }
    }
    return Array.from(map.values());
  }, [groups]);

  // Compute overall stats
  const stats = React.useMemo(() => {
    let totalSubjects = 0;
    let totalCapacity = 0;
    let totalAllotted = 0;
    let totalBooked = 0;

    for (const g of groups) {
      for (const e of g.electives) {
        totalSubjects += 1;
        totalCapacity += e.maxSeats;
        totalAllotted += e.totalAllottedSeats;
        totalBooked += e.totalBookedSeats;
      }
    }

    const allocationRate = totalCapacity > 0 ? Math.round((totalAllotted / totalCapacity) * 100) : 0;
    return { totalSubjects, totalCapacity, totalAllotted, totalBooked, allocationRate };
  }, [groups]);

  // Filter groups & electives
  const filteredGroups = React.useMemo(() => {
    return groups
      .filter((g) => selectedEventId === "ALL" || g.eventId === selectedEventId)
      .map((g) => {
        const matchingElectives = g.electives.filter((e) => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          return (
            e.name.toLowerCase().includes(query) ||
            (e.courseCode && e.courseCode.toLowerCase().includes(query)) ||
            e.allocations.some((a) => a.departmentName.toLowerCase().includes(query) || (a.sectionLabel && a.sectionLabel.toLowerCase().includes(query)))
          );
        });
        return { ...g, electives: matchingElectives };
      })
      .filter((g) => g.electives.length > 0 || !searchQuery.trim());
  }, [groups, selectedEventId, searchQuery]);

  return (
    <div>
      <PageHeader
        title="Electives & seats"
        description="Subjects, the baskets students pick from, and how seats are split across classes."
        meta={<Badge tone="outline">Course Controller · Semi Control</Badge>}
        actions={
          <>
            <Tooltip content="Refresh">
              <Button variant="ghost" size="icon" aria-label="Refresh" onClick={refreshData} disabled={isRefreshing}>
                <RefreshCw className={cn(isRefreshing && "animate-spin")} />
              </Button>
            </Tooltip>
            {distinctEvents.length > 0 ? (
              <Button variant="secondary" onClick={() => group.show({ mode: "create", eventId: distinctEvents[0].id })}>
                <Layers /> Add basket
              </Button>
            ) : null}
            {groups.length > 0 ? (
              <Button onClick={() => subject.show({ mode: "create", groupId: groups[0].groupId })}>
                <Plus /> Add subject
              </Button>
            ) : null}
          </>
        }
      />

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Subjects</p>
          <AnimatedNumber value={stats.totalSubjects} className="mt-1 block text-4xl font-light tracking-display text-fg" tabular />
          <p className="mt-1 text-xs text-fg-subtle">Across all baskets</p>
        </div>
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Capacity</p>
          <AnimatedNumber value={stats.totalCapacity} className="mt-1 block text-4xl font-light tracking-display text-fg" tabular />
          <p className="mt-1 text-xs text-fg-subtle">Total seats</p>
        </div>
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Allotted</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <AnimatedNumber value={stats.totalAllotted} className="text-4xl font-light tracking-display text-fg" tabular />
            <span className="font-mono text-sm tabular-nums text-fg-subtle">/ {stats.totalCapacity}</span>
          </p>
          <Meter value={stats.totalAllotted} max={stats.totalCapacity} label="Seats allotted to classes" className="mt-3" />
        </div>
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Registered</p>
          <AnimatedNumber value={stats.totalBooked} className="mt-1 block text-4xl font-light tracking-display text-fg" tabular />
          <p className="mt-1 text-xs text-fg-subtle">Active enrollments</p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-96">
          <Input
            placeholder="Search subject, code, department or section"
            aria-label="Search subjects"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leading={<Search />}
            trailing={
              searchQuery ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="inline-flex size-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null
            }
          />
        </div>
        {distinctEvents.length > 1 ? (
          <div className="sm:w-64">
            <Select
              aria-label="Event"
              value={selectedEventId}
              onValueChange={setSelectedEventId}
              options={[{ value: "ALL", label: `All events (${distinctEvents.length})` }, ...distinctEvents.map((ev) => ({ value: ev.id, label: ev.name }))]}
            />
          </div>
        ) : null}
      </div>

      {/* Baskets & subjects */}
      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No subjects found"
          description={
            searchQuery ? "Nothing matches your search. Try a different query." : "No elective baskets or subjects have been set up for this programme yet."
          }
          className="rounded-panel bg-surface-2"
          action={
            distinctEvents.length > 0 && !searchQuery ? (
              <Button onClick={() => group.show({ mode: "create", eventId: distinctEvents[0].id })}>
                <Plus /> Create first basket
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-10">
          {filteredGroups.map((g) => (
            <section key={g.groupId} aria-labelledby={`basket-${g.groupId}`} className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`basket-${g.groupId}`} className="text-xl font-light tracking-display text-fg">
                      {g.groupName}
                    </h2>
                    <Badge size="sm" tone="outline">
                      Pick {g.minChoices === g.maxChoices ? g.minChoices : `${g.minChoices}–${g.maxChoices}`}
                    </Badge>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                    {g.eventName} <StatusBadge status={g.eventStatus} size="sm" />
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      group.show({
                        mode: "edit",
                        eventId: g.eventId,
                        group: { id: g.groupId, name: g.groupName, minChoices: g.minChoices, maxChoices: g.maxChoices },
                      })
                    }
                  >
                    <Pencil /> Edit basket
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => subject.show({ mode: "create", groupId: g.groupId })}>
                    <Plus /> Subject
                  </Button>
                </div>
              </div>

              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {g.electives.map((elective) => (
                  <ElectiveCard
                    key={elective.id}
                    elective={elective}
                    onAllot={() => allotment.show({ elective, groupName: g.groupName, eventName: g.eventName })}
                    onEdit={() => subject.show({ mode: "edit", groupId: g.groupId, elective })}
                    onDelete={() => {
                      setDeleteTarget({ type: "subject", id: elective.id, name: elective.name });
                      setDeleteOpen(true);
                    }}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* 1. Seat allotment */}
      <Dialog open={allotment.open} onOpenChange={allotment.onOpenChange}>
        <DialogContent size="xl">
          {allotment.data ? (
            <SeatAllotmentForm
              key={allotment.key}
              target={allotment.data}
              hierarchy={hierarchy}
              onClose={allotment.close}
              onSuccess={(msg) => {
                allotment.close();
                succeed(msg);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 2. Subject create / edit */}
      <Dialog open={subject.open} onOpenChange={subject.onOpenChange}>
        <DialogContent size="lg">
          {subject.data ? (
            <SubjectForm
              key={subject.key}
              modal={subject.data}
              groups={groups}
              onClose={subject.close}
              onSuccess={(msg) => {
                subject.close();
                succeed(msg);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 3. Basket create / edit */}
      <Dialog open={group.open} onOpenChange={group.onOpenChange}>
        <DialogContent size="md">
          {group.data ? (
            <GroupForm
              key={group.key}
              modal={group.data}
              events={distinctEvents}
              onClose={group.close}
              onSuccess={(msg) => {
                group.close();
                succeed(msg);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 4. Delete */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title={`Delete ${deleteTarget?.type === "group" ? "basket" : "subject"}?`}
        description="This action cannot be undone."
        impact={deleteTarget ? [{ label: deleteTarget.type === "group" ? "Basket" : "Subject", value: deleteTarget.name }] : undefined}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            if (deleteTarget.type === "subject") {
              await deleteCoordinatorElective(deleteTarget.id);
              succeed(`Subject "${deleteTarget.name}" removed.`);
            } else {
              await deleteCoordinatorElectiveGroup(deleteTarget.id);
              succeed(`Basket "${deleteTarget.name}" removed.`);
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Deletion failed.");
            throw err;
          }
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject card
// ─────────────────────────────────────────────────────────────────────────────
function ElectiveCard({ elective, onAllot, onEdit, onDelete }: { elective: ElectiveItem; onAllot: () => void; onEdit: () => void; onDelete: () => void }) {
  const unallocated = elective.unallocatedSeats;
  const isFullyAllotted = elective.totalAllottedSeats === elective.maxSeats;
  const isOverAllotted = elective.totalAllottedSeats > elective.maxSeats;
  const allotTone = isFullyAllotted ? "success" : isOverAllotted ? "danger" : "warning";

  return (
    <li className="flex flex-col rounded-card border border-border bg-surface p-4 shadow-1 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {elective.courseCode ? <span className="font-mono text-xs text-fg-muted">{elective.courseCode}</span> : null}
            <span className="text-xs text-fg-subtle">· {elective.credits} credits</span>
            {!elective.isActive ? (
              <Badge size="sm" tone="danger">
                Inactive
              </Badge>
            ) : null}
          </div>
          <h3 className="mt-1 text-base font-medium leading-snug text-fg">{elective.name}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm tabular-nums text-fg">
            {elective.availableSeats}
            <span className="text-fg-subtle">/{elective.maxSeats}</span>
          </p>
          <p className="text-2xs text-fg-subtle">seats left</p>
        </div>
      </div>

      {elective.description ? <p className="mt-2 line-clamp-2 text-sm text-fg-muted">{elective.description}</p> : null}

      <div className="mt-4 border-t border-border pt-3.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-medium text-fg">
            <Building2 className="size-3.5 text-fg-subtle" /> Class allotments
          </span>
          <Badge size="sm" tone={allotTone}>
            <span className="font-mono tabular-nums">
              {elective.totalAllottedSeats}/{elective.maxSeats}
            </span>{" "}
            allotted
          </Badge>
        </div>
        <Meter value={elective.totalAllottedSeats} max={elective.maxSeats} tone={allotTone} label={`${elective.name} seats allotted`} className="mt-2 h-1" />

        {elective.allocations.length === 0 ? (
          <p className="mt-3 rounded-control border border-dashed border-border-strong/60 px-3 py-2 text-xs text-fg-muted">
            Open pool. No class quotas yet.
          </p>
        ) : (
          <div className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {elective.allocations.map((alloc) => (
              <span key={alloc.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg">
                <span className="font-medium">{alloc.sectionLabel ? `Sec ${alloc.sectionLabel}` : alloc.departmentCode}</span>
                <span className="font-mono tabular-nums text-fg-muted">
                  {alloc.availableSeats}/{alloc.maxSeats}
                </span>
                {alloc.bookedSeats > 0 ? <span className="text-2xs text-success-text">{alloc.bookedSeats} booked</span> : null}
              </span>
            ))}
            {unallocated > 0 ? (
              <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-text">
                +{unallocated} unallocated
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3.5">
        <Button size="sm" onClick={onAllot}>
          <Split /> Allot seats
        </Button>
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${elective.name}`} />}>
            <MoreHorizontal />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onClick={onEdit}>
              <Pencil /> Edit subject
            </MenuItem>
            <MenuItem tone="danger" onClick={onDelete}>
              <Trash2 /> Delete subject
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seat allotment: split a subject's seats across departments and sections
// ─────────────────────────────────────────────────────────────────────────────
function SeatAllotmentForm({
  target,
  hierarchy,
  onClose,
  onSuccess,
}: {
  target: AllotmentTarget;
  hierarchy: DepartmentHierarchyItem[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const { elective } = target;

  const [allocations, setAllocations] = React.useState<{ tempId: string; departmentId: string; sectionId: string | null; maxSeats: number; bookedSeats: number }[]>(
    () =>
      elective.allocations.map((a) => ({
        tempId: a.id,
        departmentId: a.departmentId,
        sectionId: a.sectionId,
        maxSeats: a.maxSeats,
        bookedSeats: a.bookedSeats,
      }))
  );

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const totalAllotted = allocations.reduce((sum, a) => sum + (Number(a.maxSeats) || 0), 0);
  const remainingSeats = elective.maxSeats - totalAllotted;
  const isOverAllotted = totalAllotted > elective.maxSeats;
  const pct = elective.maxSeats > 0 ? Math.round((totalAllotted / elective.maxSeats) * 100) : 0;

  const addRow = () => {
    if (hierarchy.length === 0) return;
    const defaultDept = hierarchy[0];
    const defaultSec = defaultDept.sections.length > 0 ? defaultDept.sections[0].id : null;
    const defaultSeats = Math.max(0, Math.min(25, remainingSeats > 0 ? remainingSeats : 20));

    setAllocations((prev) => [
      ...prev,
      { tempId: `new_${Date.now()}_${Math.random()}`, departmentId: defaultDept.id, sectionId: defaultSec, maxSeats: defaultSeats, bookedSeats: 0 },
    ]);
  };

  const removeRow = (index: number) => {
    const item = allocations[index];
    if (item.bookedSeats > 0) {
      setValidationError(`Cannot remove class with ${item.bookedSeats} registered students.`);
      return;
    }
    setAllocations((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  };

  const updateRow = (index: number, field: "departmentId" | "sectionId" | "maxSeats", value: string) => {
    setAllocations((prev) => {
      const next = [...prev];
      if (field === "departmentId") {
        next[index].departmentId = value;
        // Reset section to first available in that department
        const dept = hierarchy.find((d) => d.id === value);
        next[index].sectionId = dept && dept.sections.length > 0 ? dept.sections[0].id : null;
      } else if (field === "sectionId") {
        next[index].sectionId = value === "ALL" ? null : value;
      } else if (field === "maxSeats") {
        next[index].maxSeats = Math.max(0, parseInt(value, 10) || 0);
      }
      return next;
    });
    setValidationError(null);
  };

  // Quick action: evenly distribute seats across the first department's sections
  const autoDistributeAcrossSections = (deptId: string) => {
    const dept = hierarchy.find((d) => d.id === deptId) || hierarchy[0];
    if (!dept || dept.sections.length === 0) {
      setValidationError("No class sections found in selected department.");
      return;
    }

    const activeSecs = dept.sections.slice(0, 4); // Take up to 4 sections
    const perSection = Math.floor(elective.maxSeats / activeSecs.length);
    const remainder = elective.maxSeats % activeSecs.length;

    setAllocations(
      activeSecs.map((sec, i) => ({
        tempId: `auto_${sec.id}`,
        departmentId: dept.id,
        sectionId: sec.id,
        maxSeats: perSection + (i === 0 ? remainder : 0),
        bookedSeats: 0,
      }))
    );
    setValidationError(null);
  };

  const handleSave = async () => {
    if (isOverAllotted) {
      setValidationError(`Total allotted seats (${totalAllotted}) exceeds subject maximum capacity (${elective.maxSeats}).`);
      return;
    }

    // Check duplicate sections
    const sectionKeys = new Set<string>();
    for (const a of allocations) {
      const key = `${a.departmentId}_${a.sectionId || "all"}`;
      if (sectionKeys.has(key)) {
        setValidationError("Duplicate allotment detected. Each department/class section can only be added once.");
        return;
      }
      sectionKeys.add(key);
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await setElectiveSeatAllocations(
        elective.id,
        allocations.map((a) => ({ departmentId: a.departmentId, sectionId: a.sectionId, maxSeats: Number(a.maxSeats) }))
      );
      onSuccess(`Seat allotments updated for ${elective.name}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save seat allotments.";
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const departmentOptions = hierarchy.map((dept) => ({ value: dept.id, label: `${dept.name} (${dept.code})` }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Allot seats</DialogTitle>
        <DialogDescription>
          {elective.name} · <span className="font-mono tabular-nums">{elective.maxSeats}</span> seats in total
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-5">
        <div className="rounded-card bg-surface-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex items-baseline gap-1.5">
              <span className="text-3xl font-light tabular-nums tracking-display text-fg">{totalAllotted}</span>
              <span className="font-mono text-sm tabular-nums text-fg-subtle">/ {elective.maxSeats}</span>
            </p>
            <span className="font-mono text-xs tabular-nums text-fg-muted">{pct}%</span>
          </div>
          <Meter
            value={totalAllotted}
            max={elective.maxSeats}
            tone={isOverAllotted ? "danger" : remainingSeats === 0 ? "success" : "primary"}
            label="Seats allotted"
            className="mt-3 h-2"
          />
          <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span
              aria-live="polite"
              className={cn("font-medium", isOverAllotted ? "text-danger-text" : remainingSeats === 0 ? "text-success-text" : "text-warning-text")}
            >
              {remainingSeats > 0
                ? `${remainingSeats} seats stay in the open pool`
                : remainingSeats === 0
                  ? "Every seat is allotted to a class"
                  : `Over capacity by ${Math.abs(remainingSeats)} seats`}
            </span>
            <button
              type="button"
              onClick={() => autoDistributeAcrossSections(hierarchy[0]?.id)}
              className="inline-flex items-center gap-1 self-start font-medium text-fg underline-offset-4 hover:underline"
            >
              <Sparkles className="size-3.5" /> Split evenly across sections
            </button>
          </div>
        </div>

        {validationError ? <ErrorNote>{validationError}</ErrorNote> : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-fg">
              Class quotas <span className="font-mono text-xs tabular-nums text-fg-subtle">{allocations.length}</span>
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={addRow} disabled={hierarchy.length === 0}>
              <Plus /> Add class
            </Button>
          </div>

          {allocations.length === 0 ? (
            <EmptyState compact icon={<Building2 />} title="No class quotas yet" description="All seats are in one open pool until you add a class." />
          ) : (
            <ul className="space-y-2.5">
              {allocations.map((alloc, idx) => {
                const currentDept = hierarchy.find((d) => d.id === alloc.departmentId) || hierarchy[0];
                const availableSections = currentDept ? currentDept.sections : [];
                // A saved quota can point at a section outside this list; keep it visible by its real label.
                const saved = alloc.sectionId && !availableSections.some((s) => s.id === alloc.sectionId)
                  ? elective.allocations.find((a) => a.sectionId === alloc.sectionId)
                  : undefined;
                const sectionOptions = [
                  { value: "ALL", label: "Entire department pool" },
                  ...(saved && alloc.sectionId ? [{ value: alloc.sectionId, label: `Section ${saved.sectionLabel ?? "?"} (${saved.departmentCode})` }] : []),
                  ...availableSections.map((sec) => ({ value: sec.id, label: sec.displayName })),
                ];
                return (
                  <li key={alloc.tempId} className="grid grid-cols-2 gap-3 rounded-card border border-border bg-surface-2/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6.5rem_auto] sm:items-end">
                    <Field label="Department" className="col-span-2 sm:col-span-1">
                      <Select size="sm" value={alloc.departmentId} onValueChange={(v) => updateRow(idx, "departmentId", v)} options={departmentOptions} />
                    </Field>
                    <Field label="Class" className="col-span-2 sm:col-span-1">
                      <Select
                        size="sm"
                        value={alloc.sectionId || "ALL"}
                        onValueChange={(v) => updateRow(idx, "sectionId", v)}
                        options={sectionOptions}
                      />
                    </Field>
                    <Field label="Seats" description={alloc.bookedSeats > 0 ? `${alloc.bookedSeats} booked` : undefined}>
                      <Input
                        type="number"
                        inputMode="numeric"
                        inputSize="sm"
                        min={alloc.bookedSeats || 0}
                        max={elective.maxSeats}
                        value={alloc.maxSeats}
                        onChange={(e) => updateRow(idx, "maxSeats", e.target.value)}
                        className="font-mono"
                      />
                    </Field>
                    <div className="flex items-end justify-end self-end pb-0.5 sm:self-auto">
                      <Tooltip content={alloc.bookedSeats > 0 ? "Students are booked here" : "Remove"}>
                        <span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove class quota"
                            onClick={() => removeRow(idx)}
                            disabled={alloc.bookedSeats > 0}
                            className="text-fg-muted hover:bg-danger/10 hover:text-danger-text"
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      </Tooltip>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={isSubmitting} loadingText="Saving" disabled={isOverAllotted}>
          Save allotments
        </Button>
      </DialogFooter>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject form (create or edit)
// ─────────────────────────────────────────────────────────────────────────────
function SubjectForm({ modal, groups, onClose, onSuccess }: { modal: SubjectModal; groups: GroupItem[]; onClose: () => void; onSuccess: (msg: string) => void }) {
  const isEdit = modal.mode === "edit";
  const elective = modal.elective;

  const [groupId, setGroupId] = React.useState<string>(modal.groupId || (groups.length > 0 ? groups[0].groupId : ""));
  const [name, setName] = React.useState(elective?.name || "");
  const [courseCode, setCourseCode] = React.useState(elective?.courseCode || "");
  const [credits, setCredits] = React.useState(elective?.credits || 3);
  const [maxSeats, setMaxSeats] = React.useState(elective?.maxSeats || 50);
  const [description, setDescription] = React.useState(elective?.description || "");
  const [isActive, setIsActive] = React.useState(elective?.isActive !== undefined ? elective.isActive : true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Subject name is required.");
      return;
    }
    if (maxSeats <= 0) {
      setError("Maximum capacity must be greater than zero.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && elective) {
        await updateCoordinatorElective(elective.id, {
          name,
          courseCode: courseCode || undefined,
          credits: Number(credits),
          maxSeats: Number(maxSeats),
          description: description || undefined,
          isActive,
        });
        onSuccess(`Subject "${name}" updated successfully!`);
      } else {
        await createCoordinatorElective(groupId, {
          name,
          courseCode: courseCode || undefined,
          credits: Number(credits),
          maxSeats: Number(maxSeats),
          description: description || undefined,
        });
        onSuccess(`Subject "${name}" created successfully!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save subject.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit subject" : "New elective subject"}</DialogTitle>
        <DialogDescription>{isEdit ? "Changes show up for students right away." : "Add it to a basket, then allot its seats to classes."}</DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {!isEdit ? (
          <Field label="Basket">
            <Select value={groupId} onValueChange={setGroupId} options={groups.map((g) => ({ value: g.groupId, label: `${g.groupName} (${g.eventName})` }))} />
          </Field>
        ) : null}

        <Field label="Subject title">
          <Input placeholder="e.g. Cloud Computing & Microservices" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Course code" optional className="col-span-2 sm:col-span-1">
            <Input placeholder="e.g. 21CSE301T" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Credits">
            <Input type="number" inputMode="numeric" min={1} max={12} value={credits} onChange={(e) => setCredits(parseInt(e.target.value, 10) || 3)} className="font-mono" />
          </Field>
          <Field label="Max capacity">
            <Input type="number" inputMode="numeric" min={1} value={maxSeats} onChange={(e) => setMaxSeats(parseInt(e.target.value, 10) || 50)} className="font-mono" />
          </Field>
        </div>

        <Field label="Description" optional>
          <Textarea rows={3} placeholder="Syllabus outline, prerequisites and learning objectives" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>

        {isEdit ? (
          <div className="flex items-center justify-between gap-4 rounded-control border border-border px-3.5 py-3">
            <div>
              <p className="text-sm font-medium text-fg">Active in registration</p>
              <p className="text-xs text-fg-muted">Inactive subjects are hidden from students.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active in registration" />
          </div>
        ) : null}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} loadingText="Saving">
          {isEdit ? "Update subject" : "Create subject"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Basket form (create or edit)
// ─────────────────────────────────────────────────────────────────────────────
function GroupForm({
  modal,
  events,
  onClose,
  onSuccess,
}: {
  modal: GroupModal;
  events: { id: string; name: string; status: string }[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const isEdit = modal.mode === "edit";
  const [eventId, setEventId] = React.useState<string>(modal.eventId || (events[0]?.id ?? ""));
  const [name, setName] = React.useState(modal.group?.name || "");
  const [minChoices, setMinChoices] = React.useState(modal.group?.minChoices || 1);
  const [maxChoices, setMaxChoices] = React.useState(modal.group?.maxChoices || 1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEdit && modal.group) {
        await updateCoordinatorElectiveGroup(modal.group.id, { name, minChoices: Number(minChoices), maxChoices: Number(maxChoices) });
        onSuccess(`Basket "${name}" updated!`);
      } else {
        await createCoordinatorElectiveGroup(eventId, { name, minChoices: Number(minChoices), maxChoices: Number(maxChoices) });
        onSuccess(`Basket "${name}" created!`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save group.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contents">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit basket" : "New basket"}</DialogTitle>
        <DialogDescription>A basket is a set of subjects students choose between.</DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {!isEdit ? (
          <Field label="Registration event">
            <Select value={eventId} onValueChange={setEventId} options={events.map((ev) => ({ value: ev.id, label: ev.name }))} />
          </Field>
        ) : null}

        <Field label="Basket name">
          <Input placeholder="e.g. Professional Elective I (Core AI)" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min choices">
            <Input type="number" inputMode="numeric" min={1} value={minChoices} onChange={(e) => setMinChoices(parseInt(e.target.value, 10) || 1)} className="font-mono" />
          </Field>
          <Field label="Max choices">
            <Input type="number" inputMode="numeric" min={1} value={maxChoices} onChange={(e) => setMaxChoices(parseInt(e.target.value, 10) || 1)} className="font-mono" />
          </Field>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting} loadingText="Saving">
          {isEdit ? "Update basket" : "Create basket"}
        </Button>
      </DialogFooter>
    </form>
  );
}
