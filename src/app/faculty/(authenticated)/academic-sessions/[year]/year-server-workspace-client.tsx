"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CalendarDays,
  ChevronRight,
  FileBarChart,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Mail,
  Trash2,
} from "lucide-react";
import {
  type YearServerWorkspaceDetails,
  type YearServerWorkspaceClass,
  deleteYearServer,
} from "@/app/actions/year-servers";
import { useSwitchSection } from "@/components/layout/section-switcher";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function YearServerWorkspaceClient({
  details,
  isAdmin = false,
  isRootAdmin = false,
  activeSectionId,
}: {
  details: YearServerWorkspaceDetails;
  isAdmin?: boolean;
  isRootAdmin?: boolean;
  activeSectionId?: string;
}) {
  const router = useRouter();
  const { switchTo, pending } = useSwitchSection();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [selectedProgrammeId, setSelectedProgrammeId] = React.useState<string>(
    details.programmes[0]?.programmeId ?? ""
  );

  const handleDeleteConfirm = async () => {
    const res = await deleteYearServer(details.id);
    if (!res.success) {
      throw new Error(res.error);
    }
    toast.success(`${details.title} deleted successfully`);
    router.push("/faculty/academic-sessions");
    router.refresh();
  };

  const selectedProgramme =
    details.programmes.find((p) => p.programmeId === selectedProgrammeId) ?? details.programmes[0];

  const handleSelectClass = async (cls: YearServerWorkspaceClass) => {
    try {
      await switchTo({
        id: cls.sectionId,
        label: cls.sectionLabel,
        batch: String(details.year),
        programme: cls.programmeName,
        classLabel: cls.classLabel,
      });
      router.push("/faculty/section");
    } catch {
      toast.error("Could not switch active class");
    }
  };

  const workspaceLinks = [
    {
      title: "Overview",
      description: "Live dashboard, participation metrics, and countdown timers",
      href: "/faculty/dashboard",
      icon: LayoutDashboard,
      color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    },
    {
      title: "Programmes & Classes",
      description: "Academic hierarchy, departments, batches and section configurations",
      href: "/faculty/departments",
      icon: Layers,
      color: "text-sky-500 bg-sky-500/10 border-sky-500/20",
    },
    {
      title: "Students",
      description: "Student rosters, enrollment status, and password verifications",
      href: "/faculty/students",
      icon: GraduationCap,
      color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      title: "Registration Events",
      description: "Class-targeted registration windows, timers and rules",
      href: "/faculty/events",
      icon: Calendar,
      color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      title: "Subjects & Seat Allocation",
      description: "Elective offerings, group constraints, and per-class quotas",
      href: "/faculty/electives",
      icon: BookOpen,
      color: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    },
    {
      title: "Signup Codes",
      description: "Student onboarding codes, invite generation, and limits",
      href: "/faculty/invites",
      icon: Mail,
      color: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    },
    {
      title: "Registrations & Reports",
      description: "Allotment sheets, audit trails, and student receipts",
      href: "/faculty/reports",
      icon: FileBarChart,
      color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    },
  ];

  return (
    <div className="space-y-8 animate-enter">
      {/* ── Breadcrumb & Back Link ── */}
      <div className="flex items-center gap-2 text-xs text-fg-muted font-mono">
        <Link
          href="/faculty/academic-sessions"
          className="hover:text-fg transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="size-3" />
          <span>Academic Timelines</span>
        </Link>
        <span>/</span>
        <span className="text-fg font-medium">{details.year}</span>
        {activeSectionId && (
          <>
            <span>/</span>
            <span className="text-primary font-medium">Class Workspace</span>
          </>
        )}
      </div>

      {/* ── Server Workspace Header ── */}
      <div className="rounded-panel border border-border bg-surface p-6 shadow-1 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-badge bg-primary/10 text-primary border border-primary/20">
                <CalendarDays className="size-5" />
              </span>
              <div>
                <h1 className="text-2xl font-light tracking-display text-fg sm:text-3xl">
                  {details.year} Academic Timeline
                </h1>
                <p className="text-xs text-fg-muted font-mono mt-0.5">
                  Academic Timeline · {details.year} Intake
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={details.status === "ACTIVE" ? "success" : "neutral"}>
              {details.status}
            </Badge>
            <Link
              href="/faculty/academic-sessions"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Switch Timeline
            </Link>
            {isAdmin && isRootAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className="text-danger-text hover:bg-danger/10 gap-1 text-xs"
              >
                <Trash2 className="size-3.5" />
                <span>Delete Academic Timeline</span>
              </Button>
            )}
          </div>
        </div>

        {/* Metrics Row */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border/60 pt-6 sm:grid-cols-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
              <BookOpen className="size-3 text-fg-muted" />
              <span>Programmes</span>
            </div>
            <p className="text-xl font-light tabular-nums text-fg font-mono">
              {details.metrics.programmesCount}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
              <Layers className="size-3 text-fg-muted" />
              <span>Classes</span>
            </div>
            <p className="text-xl font-light tabular-nums text-fg font-mono">
              {details.metrics.classesCount}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
              <GraduationCap className="size-3 text-fg-muted" />
              <span>Students</span>
            </div>
            <p className="text-xl font-light tabular-nums text-fg font-mono">
              {details.metrics.studentsCount}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
              <Calendar className="size-3 text-fg-muted" />
              <span>Events</span>
            </div>
            <p className="text-xl font-light tabular-nums text-fg font-mono">
              {details.metrics.eventsCount}
            </p>
          </div>
        </div>
      </div>

      {/* ── Workspace Modules Grid ── */}
      <div>
        <h2 className="text-base font-medium tracking-tight text-fg mb-3">
          Workspace Modules
        </h2>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {workspaceLinks.map((mod) => (
            <Link
              key={mod.title}
              href={mod.href}
              className="group flex flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-1 transition-all duration-150 hover:border-primary/40 hover:shadow-2"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-8 items-center justify-center rounded-badge border",
                      mod.color
                    )}
                  >
                    <mod.icon className="size-4" />
                  </span>
                  <ChevronRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                </div>
                <h3 className="mt-3 text-sm font-medium text-fg group-hover:text-primary transition-colors">
                  {mod.title}
                </h3>
                <p className="mt-1 text-xs text-fg-muted leading-relaxed">
                  {mod.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Programmes & Classes Hierarchy ── */}
      <div className="rounded-panel border border-border bg-surface p-6 shadow-1 space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-medium tracking-tight text-fg">
              Programmes & Classes in {details.year}
            </h2>
            <p className="text-xs text-fg-muted">
              Choose an assigned class to view its roster, registration events and electives.
            </p>
          </div>
        </div>

        {details.programmes.length === 0 ? (
          <EmptyState
            title="No programmes configured in this year"
            description="Add academic batches and sections in Programmes & Classes to begin."
            className="p-8 text-center"
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
            {/* Programme Selector Sidebar */}
            <div className="space-y-1.5">
              <span className="block text-2xs uppercase tracking-wider text-fg-subtle font-mono px-2 mb-2">
                Programmes ({details.programmes.length})
              </span>
              <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                {details.programmes.map((p) => {
                  const isSelected = p.programmeId === selectedProgramme?.programmeId;
                  return (
                    <button
                      key={p.programmeId}
                      type="button"
                      onClick={() => setSelectedProgrammeId(p.programmeId)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-xs transition-colors",
                        isSelected
                          ? "bg-primary/10 text-primary font-medium border border-primary/25"
                          : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                      )}
                    >
                      <span className="truncate">{p.programmeName}</span>
                      <span className="font-mono text-2xs text-fg-subtle">
                        {p.classes.length} class{p.classes.length === 1 ? "" : "es"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Classes for Selected Programme */}
            {selectedProgramme ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/50 pb-2">
                  <div>
                    <h3 className="text-sm font-medium text-fg">
                      {selectedProgramme.programmeName}
                    </h3>
                    <p className="text-2xs text-fg-muted font-mono">
                      {selectedProgramme.departmentName}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-fg-subtle">
                    {selectedProgramme.classes.length} class{selectedProgramme.classes.length === 1 ? "" : "es"} in {details.year}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {selectedProgramme.classes.map((cls) => {
                    const isActive = cls.sectionId === activeSectionId;
                    return (
                      <div
                        key={cls.sectionId}
                        className={cn(
                          "rounded-card border bg-surface-2/30 p-4 shadow-1 flex flex-col justify-between transition-colors",
                          isActive ? "border-primary/50 ring-1 ring-primary/25" : "border-border hover:border-border-strong"
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h4 className="text-sm font-medium text-fg">
                                  Section {cls.sectionLabel}
                                </h4>
                                {isActive && (
                                  <span className="inline-flex items-center gap-1 rounded-badge bg-primary/20 px-1.5 py-0.2 text-2xs font-medium text-primary">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs text-fg-muted font-mono">
                                {cls.classLabel}
                              </p>
                            </div>
                            <span className="rounded-badge bg-surface-2 px-2 py-0.5 font-mono text-2xs text-fg-subtle border border-border">
                              {cls.studentCount} student{cls.studentCount === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="mt-3 text-xs text-fg-subtle space-y-1">
                            <p>
                              <span className="text-fg-muted">Registration Events:</span>{" "}
                              <span className="font-mono text-fg">{cls.eventCount}</span>
                            </p>
                            {cls.tutors.length > 0 && (
                              <p className="truncate">
                                <span className="text-fg-muted">Tutor:</span>{" "}
                                <span className="text-fg">{cls.tutors.map((t) => t.name).join(", ")}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/40">
                          <Button
                            size="sm"
                            variant={isActive ? "primary" : "outline"}
                            className="w-full text-xs"
                            disabled={pending}
                            onClick={() => handleSelectClass(cls)}
                          >
                            <span>{isActive ? "Manage Active Class" : "Select & Manage Class"}</span>
                            <ArrowRight className="size-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── Danger Zone ── */}
      {isAdmin && (
        <div className="rounded-panel border border-danger/30 bg-danger/5 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-medium text-danger-text flex items-center gap-1.5">
                <Trash2 className="size-4" />
                Danger Zone · Delete Academic Year
              </h3>
              <p className="text-xs text-fg-muted mt-1 max-w-xl">
                Permanently delete the Academic Year {details.year} workspace. Unresolved historical events and registrations will remain preserved in Data Review.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="shrink-0"
            >
              Delete Academic Timeline {details.year}
            </Button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete Academic Timeline ${details.year}`}
        description={
          details.metrics.studentsCount > 0 || details.metrics.eventsCount > 0
            ? `This will remove the Academic Timeline ${details.year} workspace. Existing student registrations and historical receipts will be safely preserved in Data Review.`
            : `This will permanently remove the Academic Timeline ${details.year} workspace.`
        }
        tone="danger"
        confirmLabel="Delete Academic Timeline"
        requireText={
          details.metrics.studentsCount > 0 || details.metrics.eventsCount > 0
            ? String(details.year)
            : undefined
        }
        impact={[
          { label: "Programmes Linked", value: details.metrics.programmesCount },
          { label: "Classes Configured", value: details.metrics.classesCount },
          {
            label: "Enrolled Students",
            value: details.metrics.studentsCount,
            tone: details.metrics.studentsCount > 0 ? "warning" : "neutral",
          },
          { label: "Registration Events", value: details.metrics.eventsCount },
        ]}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
