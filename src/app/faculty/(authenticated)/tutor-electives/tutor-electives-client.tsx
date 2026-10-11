"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, Layers, MoreHorizontal, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { createElective, createElectiveGroup, createRegistrationWindow, updateElective, deleteElective, updateElectiveGroup, deleteElectiveGroup, resetSectionSubjects } from "@/app/actions/tutor";
import { useRouter } from "next/navigation";
import { TutorSectionOnboarding } from "@/components/tutor-section-onboarding";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Disclosure } from "@/components/ui/disclosure";
import { AnimatedNumber, Meter, OccupancyRing, seatState } from "@/components/ui/data-display";
import { ConfirmDialog, type ImpactRow } from "@/components/ui/confirm-dialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Elective = {
  id: string;
  name: string;
  courseCode: string | null;
  credits: number;
  maxSeats: number;
  availableSeats: number;
  isFull: boolean;
};
type Group = { id: string; name: string; electives: Elective[] };
type EventInfo = { id: string; name: string; status: string; openDate: Date | null; closeDate: Date | null };
type EventData = { event: EventInfo; groups: Group[] };

type Pending = { kind: "subject"; elective: Elective } | { kind: "group"; group: Group } | { kind: "reset"; eventId: string };

export function TutorElectivesClient({ electivesData, hasActiveSection = true }: { electivesData: EventData[]; hasActiveSection?: boolean }) {
  const router = useRouter();
  const allGroups = electivesData.flatMap((e) => e.groups);
  const allElectives = allGroups.flatMap((g) => g.electives);

  const courseOptions = allElectives.length;
  const totalCap = allElectives.reduce((acc, curr) => acc + curr.maxSeats, 0);
  const totalAvailable = allElectives.reduce((acc, curr) => acc + curr.availableSeats, 0);
  const seatsBooked = totalCap - totalAvailable;
  const allocationRate = totalCap > 0 ? Math.round((seatsBooked / totalCap) * 100) : 0;

  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Group dialog (add + rename)
  const [groupDialog, setGroupDialog] = useState<{ open: boolean; mode: "add" | "edit" }>({ open: false, mode: "add" });
  const [newGroupOnlyName, setNewGroupOnlyName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Subject dialog (add + edit)
  const [subjectDialog, setSubjectDialog] = useState<{ open: boolean; mode: "add" | "edit" }>({ open: false, mode: "add" });
  const [newElectiveName, setNewElectiveName] = useState("");
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newMaxSeats, setNewMaxSeats] = useState("");
  const [newCredits, setNewCredits] = useState("3");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [editingElectiveId, setEditingElectiveId] = useState<string | null>(null);

  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Accordion state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(Object.fromEntries(allGroups.map((g) => [g.id, true])));
  const toggleGroup = (id: string) => setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // States for creating a window directly from empty state
  const [isWindowCreating, setIsWindowCreating] = useState(false);
  const [newWindowName, setNewWindowName] = useState("");
  const [newWindowYear, setNewWindowYear] = useState(new Date().getFullYear() + "-" + (new Date().getFullYear() + 1));

  const firstEventId = electivesData[0]?.event.id;

  async function handleCreateWindow() {
    if (!newWindowName) return;
    setIsWindowCreating(true);
    try {
      await createRegistrationWindow({ name: newWindowName, academicYear: newWindowYear });
      router.refresh();
      toast.success("Window created successfully.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsWindowCreating(false);
    }
  }

  function openAddGroupModal() {
    setNewGroupOnlyName("");
    setGroupDialog({ open: true, mode: "add" });
  }

  function openEditGroupModal(group: Group) {
    setEditingGroupId(group.id);
    setNewGroupOnlyName(group.name);
    setGroupDialog({ open: true, mode: "edit" });
  }

  async function handleAddGroupSave() {
    if (!newGroupOnlyName.trim()) return toast.error("Please enter a group name");
    if (!firstEventId) return toast.error("No event ID available");

    setIsSaving(true);
    try {
      const newGroup = await createElectiveGroup(firstEventId, newGroupOnlyName);
      setGroupDialog((d) => ({ ...d, open: false }));
      setExpandedGroups((prev) => ({ ...prev, [newGroup.id]: true }));
      toast.success("Group created successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditGroupSave() {
    if (!newGroupOnlyName || !editingGroupId) return toast.error("Group name is required");
    setIsSaving(true);
    try {
      await updateElectiveGroup(editingGroupId, newGroupOnlyName);
      setGroupDialog((d) => ({ ...d, open: false }));
      toast.success("Group updated successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function openAddSubjectModal(groupId: string) {
    setSelectedGroupId(groupId);
    setNewElectiveName("");
    setNewCourseCode("");
    setNewMaxSeats("");
    setNewCredits("3");
    setSubjectDialog({ open: true, mode: "add" });
  }

  function openEditModal(elective: Elective) {
    setEditingElectiveId(elective.id);
    setNewElectiveName(elective.name);
    setNewCourseCode(elective.courseCode || "");
    setNewMaxSeats(elective.maxSeats.toString());
    setNewCredits(elective.credits.toString());
    setSubjectDialog({ open: true, mode: "edit" });
  }

  async function handleAddSubjectSave() {
    if (!newElectiveName || !newMaxSeats) return toast.error("Please fill required fields (Name, Seats)");
    if (!selectedGroupId) return toast.error("Invalid group selected.");

    setIsSaving(true);
    try {
      await createElective(selectedGroupId, {
        name: newElectiveName,
        courseCode: newCourseCode || undefined,
        maxSeats: parseInt(newMaxSeats),
        credits: parseInt(newCredits),
      });

      setSubjectDialog((d) => ({ ...d, open: false }));
      toast.success("Subject added successfully");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleEditSave() {
    if (!newElectiveName || !newMaxSeats || !editingElectiveId) return toast.error("Please fill required fields (Name, Seats)");
    setIsSaving(true);
    try {
      await updateElective(editingElectiveId, {
        name: newElectiveName,
        courseCode: newCourseCode || undefined,
        maxSeats: parseInt(newMaxSeats),
        credits: parseInt(newCredits),
      });
      setSubjectDialog((d) => ({ ...d, open: false }));
      toast.success("Subject updated successfully");
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
      if (pending.kind === "subject") {
        await deleteElective(pending.elective.id);
        toast.success("Subject deleted");
      } else if (pending.kind === "group") {
        await deleteElectiveGroup(pending.group.id);
        toast.success("Group deleted");
      } else {
        await resetSectionSubjects(pending.eventId);
        toast.success("All subjects and groups reset successfully.");
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
      throw err;
    }
  }

  if (electivesData.length === 0) {
    if (!hasActiveSection) {
      return <TutorSectionOnboarding />;
    }

    return (
      <div>
        <PageHeader title="Subjects & groups" description="Elective listings and seat quotas for your section." />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateWindow();
          }}
          className="mx-auto max-w-md rounded-panel bg-surface-2 p-5 animate-enter sm:p-8"
        >
          <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-surface text-fg shadow-1">
            <BookOpen className="size-5" />
          </span>
          <h2 className="mt-5 text-2xl font-light tracking-display text-fg">Set up your classes</h2>
          <p className="mt-2 text-sm text-fg-muted">There is no registration event yet. Create a registration window first, then add electives to it.</p>
          <div className="mt-6 space-y-4">
            <Field label="Event name">
              <Input value={newWindowName} onChange={(e) => setNewWindowName(e.target.value)} placeholder="e.g. B.TECH EVEN SEM AI F..." />
            </Field>
            <Field label="Academic year">
              <Input value={newWindowYear} onChange={(e) => setNewWindowYear(e.target.value)} placeholder="e.g. 2026-2027" className="font-mono" />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={!newWindowName} loading={isWindowCreating} loadingText="Creating">
              <Plus /> Create registration window
            </Button>
          </div>
        </form>
      </div>
    );
  }

  const q = search.toLowerCase();

  const confirmCopy: { title: string; description: string; label: string; impact: ImpactRow[]; requireText?: string } = !pending
    ? { title: "", description: "", label: "Confirm", impact: [] }
    : pending.kind === "subject"
      ? {
          title: "Delete this subject?",
          description: "All student registrations for it are removed too.",
          label: "Delete subject",
          impact: [
            { label: "Subject", value: pending.elective.name },
            { label: "Seats taken", value: pending.elective.maxSeats - pending.elective.availableSeats, tone: "danger" },
          ],
        }
      : pending.kind === "group"
        ? {
            title: "Delete this group?",
            description: "Every subject inside it and their student registrations are permanently deleted.",
            label: "Delete group",
            impact: [
              { label: "Group", value: pending.group.name },
              { label: "Subjects", value: pending.group.electives.length, tone: "danger" },
            ],
          }
        : {
            title: "Reset all subjects?",
            description: "Deletes every subject and group for this section. This cannot be undone.",
            label: "Reset everything",
            impact: [
              { label: "Groups", value: allGroups.length, tone: "danger" },
              { label: "Subjects", value: allElectives.length, tone: "danger" },
            ],
            requireText: "CONFIRM",
          };

  const stats = [
    { label: "Course options", value: courseOptions },
    { label: "Total capacity", value: totalCap },
    { label: "Seats booked", value: seatsBooked },
  ];

  return (
    <div>
      <PageHeader
        title="Subjects & groups"
        description="Elective groups, their subjects and seat quotas."
        actions={
          <>
            <Button onClick={openAddGroupModal}>
              <Plus /> Add group
            </Button>
            <Menu>
              <MenuTrigger render={<Button variant="secondary" size="icon" aria-label="More actions" />}>
                <MoreHorizontal />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem tone="danger" disabled={allGroups.length === 0 || !firstEventId} onClick={() => firstEventId && ask({ kind: "reset", eventId: firstEventId })}>
                  <Trash2 /> Reset all subjects
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-card bg-surface-2 p-4 sm:p-5">
            <p className="text-sm text-fg-muted">{s.label}</p>
            <AnimatedNumber value={s.value} className="mt-1 block text-4xl font-light tracking-display text-fg" tabular />
          </div>
        ))}
        <div className="rounded-card bg-surface-2 p-4 sm:p-5">
          <p className="text-sm text-fg-muted">Allocation</p>
          <p className="mt-1 flex items-baseline">
            <AnimatedNumber value={allocationRate} className="text-4xl font-light tracking-display text-fg" tabular />
            <span className="text-2xl font-light text-fg-muted">%</span>
          </p>
          <Meter value={seatsBooked} max={totalCap} label="Seats allocated" className="mt-3" />
        </div>
      </div>

      {allGroups.length > 0 ? (
        <div className="mb-4 sm:max-w-sm">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects or course codes"
            aria-label="Search subjects"
            leading={<Search />}
            trailing={
              search ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                  className="inline-flex size-8 items-center justify-center rounded-full text-fg-subtle hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              ) : null
            }
          />
        </div>
      ) : null}

      <div className="space-y-3">
        {allGroups.length === 0 ? (
          <EmptyState
            icon={<Layers />}
            title="No groups yet"
            description="A group holds the subjects a student chooses one from."
            className="rounded-panel bg-surface-2"
            action={
              <Button onClick={openAddGroupModal}>
                <Plus /> Create first group
              </Button>
            }
          />
        ) : (
          allGroups.map((group, gIndex) => {
            const filteredElectives = group.electives.filter((e) => e.name.toLowerCase().includes(q) || (e.courseCode && e.courseCode.toLowerCase().includes(q)));

            if (search && filteredElectives.length === 0) return null;

            const isExpanded = Boolean(expandedGroups[group.id]);
            const groupCap = group.electives.reduce((acc, curr) => acc + curr.maxSeats, 0);
            const groupAvailable = group.electives.reduce((acc, curr) => acc + curr.availableSeats, 0);
            const groupFilled = groupCap - groupAvailable;
            const groupFillPerc = groupCap > 0 ? Math.round((groupFilled / groupCap) * 100) : 0;

            return (
              <section
                key={group.id}
                style={{ animationDelay: `${Math.min(gIndex, 6) * 50}ms` }}
                className="overflow-hidden rounded-card border border-border bg-surface shadow-1 animate-enter"
              >
                <div className="flex items-center gap-2 p-2 pr-3 sm:p-3">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => toggleGroup(group.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-control p-2 text-left transition-colors hover:bg-surface-2/70"
                  >
                    <span aria-hidden className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-fg text-canvas">
                      <Layers className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium text-fg">{group.name}</span>
                        <Badge size="sm" className="hidden sm:inline-flex">
                          {group.electives.length} subjects
                        </Badge>
                      </span>
                      <span className="mt-1.5 flex items-center gap-2.5 text-xs text-fg-muted">
                        <span className="font-mono tabular-nums">
                          <span className="text-fg">{groupFilled}</span>/{groupCap}
                        </span>
                        <Meter value={groupFilled} max={groupCap} label={`${group.name} seats filled`} className="h-1 max-w-28 flex-1" />
                        <span className="font-mono tabular-nums">{groupFillPerc}%</span>
                      </span>
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform duration-300", isExpanded && "rotate-180")} />
                  </button>

                  <Button size="sm" variant="secondary" onClick={() => openAddSubjectModal(group.id)} className="hidden sm:inline-flex">
                    <Plus /> Subject
                  </Button>
                  <Menu>
                    <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${group.name}`} />}>
                      <MoreHorizontal />
                    </MenuTrigger>
                    <MenuContent align="end">
                      <MenuItem onClick={() => openAddSubjectModal(group.id)} className="sm:hidden">
                        <Plus /> Add subject
                      </MenuItem>
                      <MenuItem onClick={() => openEditGroupModal(group)}>
                        <Pencil /> Rename group
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem tone="danger" onClick={() => ask({ kind: "group", group })}>
                        <Trash2 /> Delete group
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </div>

                <Disclosure open={isExpanded}>
                  <div className="border-t border-border p-3">
                    {filteredElectives.length === 0 ? (
                      <p className="py-8 text-center text-sm text-fg-muted">
                        {group.electives.length === 0 ? "No subjects in this group yet." : "No subjects match your search in this group."}
                      </p>
                    ) : (
                      <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {filteredElectives.map((e) => {
                          const filled = e.maxSeats - e.availableSeats;
                          const state = seatState(e.availableSeats, e.maxSeats);
                          return (
                            <li key={e.id} className="flex items-start gap-3 rounded-control border border-border bg-surface-2/50 p-3.5">
                              <OccupancyRing filled={filled} total={e.maxSeats} state={state} size={48} label={`${filled} of ${e.maxSeats} seats filled`}>
                                <span className="font-mono text-2xs tabular-nums text-fg">{e.maxSeats > 0 ? Math.round((filled / e.maxSeats) * 100) : 0}%</span>
                              </OccupancyRing>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {e.courseCode ? <span className="font-mono text-2xs text-fg-muted">{e.courseCode}</span> : null}
                                  {e.isFull ? (
                                    <Badge size="sm" tone="danger">
                                      Full
                                    </Badge>
                                  ) : null}
                                </div>
                                <h3 className="mt-0.5 text-sm font-medium leading-snug text-fg">{e.name}</h3>
                                <p className="mt-1 text-xs text-fg-muted">
                                  {e.credits} credits · <span className="font-mono tabular-nums text-fg">{filled}</span>/{e.maxSeats} filled ·{" "}
                                  <span className={cn("font-mono tabular-nums", e.isFull ? "text-danger-text" : state === "low" ? "text-warning-text" : "text-fg")}>
                                    {e.availableSeats}
                                  </span>{" "}
                                  left
                                </p>
                              </div>
                              <Menu>
                                <MenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.name}`} className="-mr-1 -mt-1" />}>
                                  <MoreHorizontal />
                                </MenuTrigger>
                                <MenuContent align="end">
                                  <MenuItem onClick={() => openEditModal(e)}>
                                    <Pencil /> Edit subject
                                  </MenuItem>
                                  <MenuItem tone="danger" onClick={() => ask({ kind: "subject", elective: e })}>
                                    <Trash2 /> Delete subject
                                  </MenuItem>
                                </MenuContent>
                              </Menu>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </Disclosure>
              </section>
            );
          })
        )}
      </div>

      {/* Group dialog */}
      <Dialog open={groupDialog.open} onOpenChange={(o) => !isSaving && setGroupDialog((d) => ({ ...d, open: o }))}>
        <DialogContent size="sm" showClose={!isSaving}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (groupDialog.mode === "edit") handleEditGroupSave();
              else handleAddGroupSave();
            }}
            className="contents"
          >
            <DialogHeader>
              <DialogTitle>{groupDialog.mode === "edit" ? "Rename group" : "New group"}</DialogTitle>
              <DialogDescription>Students pick one subject from each group.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <Field label="Group name">
                <Input
                  value={newGroupOnlyName}
                  onChange={(e) => setNewGroupOnlyName(e.target.value)}
                  placeholder={groupDialog.mode === "edit" ? "e.g. Professional Electives" : "e.g. Core Electives"}
                  autoFocus
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setGroupDialog((d) => ({ ...d, open: false }))} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving} loadingText="Saving" disabled={!newGroupOnlyName.trim()}>
                {groupDialog.mode === "edit" ? "Save changes" : "Create group"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subject dialog */}
      <Dialog open={subjectDialog.open} onOpenChange={(o) => !isSaving && setSubjectDialog((d) => ({ ...d, open: o }))}>
        <DialogContent size="lg" showClose={!isSaving}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (subjectDialog.mode === "edit") handleEditSave();
              else handleAddSubjectSave();
            }}
            className="contents"
          >
            <DialogHeader>
              <DialogTitle>{subjectDialog.mode === "edit" ? "Edit subject" : "Add subject"}</DialogTitle>
              <DialogDescription>Seat quota is the most students who can take it from your section.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Course name" className="col-span-2">
                  <Input value={newElectiveName} onChange={(e) => setNewElectiveName(e.target.value)} placeholder="e.g. Machine Learning" autoFocus />
                </Field>
                <Field label="Course code" optional className="col-span-2 sm:col-span-1">
                  <Input value={newCourseCode} onChange={(e) => setNewCourseCode(e.target.value)} placeholder="e.g. ML101" className="font-mono" />
                </Field>
                <Field label="Seat quota">
                  <Input type="number" inputMode="numeric" min={1} value={newMaxSeats} onChange={(e) => setNewMaxSeats(e.target.value)} placeholder="e.g. 60" />
                </Field>
                <Field label="Credits">
                  <Input type="number" inputMode="numeric" min={0} value={newCredits} onChange={(e) => setNewCredits(e.target.value)} />
                </Field>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setSubjectDialog((d) => ({ ...d, open: false }))} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" loading={isSaving} loadingText="Saving">
                {subjectDialog.mode === "edit" ? "Save changes" : "Save subject"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="danger"
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
