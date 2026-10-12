"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Layers,
  Search,
  X,
  Sparkles,
  Plus,
  Eye,
  MoreHorizontal,
  Copy,
  Trash2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  BookOpen,
  GraduationCap,
  SlidersHorizontal,
  CheckCircle2,
} from "lucide-react";

import {
  DetailedTemplate,
  TemplateBatchOption,
  createEventFromTemplate,
  createTemplate,
  duplicateTemplate,
  deleteTemplate,
} from "@/app/actions/templates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { formatDate } from "@/lib/format";

interface TemplatesClientProps {
  initialTemplates: DetailedTemplate[];
  batches: TemplateBatchOption[];
  programmes: { id: string; name: string; code: string }[];
  userRole?: string;
  currentUserId?: string;
  userProgrammeId?: string;
}

export function TemplatesClient({
  initialTemplates,
  batches,
  programmes,
  userRole,
  currentUserId,
  userProgrammeId,
}: TemplatesClientProps) {
  const router = useRouter();

  const [templates, setTemplates] = React.useState<DetailedTemplate[]>(initialTemplates);

  React.useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);

  const [search, setSearch] = React.useState("");
  const [selectedProgramme, setSelectedProgramme] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<"newest" | "courses" | "name">("newest");

  // ── "Use This Template" Modal State ──
  const [useModalTemplate, setUseModalTemplate] = React.useState<DetailedTemplate | null>(null);
  const [eventName, setEventName] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [academicYear, setAcademicYear] = React.useState("");
  const [openDate, setOpenDate] = React.useState("");
  const [closeDate, setCloseDate] = React.useState("");
  const [eventStatus, setEventStatus] = React.useState("DRAFT");
  const [eventDescription, setEventDescription] = React.useState("");
  const [isSubmittingEvent, setIsSubmittingEvent] = React.useState(false);
  const [eventErrors, setEventErrors] = React.useState<{ name?: string; batchId?: string }>({});

  // ── Template Structure Preview Modal State ──
  const [previewTemplate, setPreviewTemplate] = React.useState<DetailedTemplate | null>(null);

  // ── Create New Template Modal State ──
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [newTemplateName, setNewTemplateName] = React.useState("");
  const [newProgrammeId, setNewProgrammeId] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [newGroups, setNewGroups] = React.useState<
    Array<{
      name: string;
      minChoices: number;
      maxChoices: number;
      electives: Array<{
        name: string;
        courseCode: string;
        credits: number;
        defaultMaxSeats: number;
      }>;
    }>
  >([
    {
      name: "Professional Elective I",
      minChoices: 1,
      maxChoices: 1,
      electives: [
        { name: "", courseCode: "", credits: 3, defaultMaxSeats: 40 },
        { name: "", courseCode: "", credits: 3, defaultMaxSeats: 40 },
      ],
    },
  ]);
  const [isCreatingTemplate, setIsCreatingTemplate] = React.useState(false);

  // ── Delete Template Dialog State ──
  const [deletingTemplate, setDeletingTemplate] = React.useState<DetailedTemplate | null>(null);

  // ── Compute KPIs ──
  const totalTemplates = templates.length;
  const uniqueProgrammesCount = new Set(templates.map((t) => t.programmeId)).size;
  const totalGroups = templates.reduce((acc, t) => acc + t.groupCount, 0);
  const totalElectives = templates.reduce((acc, t) => acc + t.electiveCount, 0);

  // ── Programme Filters List ──
  const programmeOptions = React.useMemo(() => {
    const list = Array.from(
      new Map(
        templates.map((t) => [t.programmeId, t.programmeName || "Unknown Programme"])
      ).entries()
    );
    return list;
  }, [templates]);

  // ── Filtered & Sorted Templates ──
  const filteredTemplates = React.useMemo(() => {
    let list = templates;

    if (selectedProgramme !== "ALL") {
      list = list.filter((t) => t.programmeId === selectedProgramme);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.programmeName && t.programmeName.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          t.groups.some((g) =>
            g.electives.some(
              (e) =>
                e.name.toLowerCase().includes(q) ||
                (e.courseCode && e.courseCode.toLowerCase().includes(q))
            )
          )
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "courses") {
        return b.electiveCount - a.electiveCount;
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [templates, selectedProgramme, search, sortBy]);

  // ── Open "Use This Template" Modal ──
  const handleOpenUseModal = (template: DetailedTemplate) => {
    setUseModalTemplate(template);
    // Find matching batch for template's programme
    const matchingBatches = batches.filter((b) => b.programmeId === template.programmeId);
    const defaultBatch = matchingBatches[0] || batches[0];

    const currentYear = new Date().getFullYear();
    setEventName(`${template.name.replace(" Template", "")} — ${currentYear} Registration`);
    setBatchId(defaultBatch ? defaultBatch.id : "");
    setAcademicYear(defaultBatch ? defaultBatch.year : `${currentYear}-${currentYear + 2}`);
    setOpenDate("");
    setCloseDate("");
    setEventStatus("DRAFT");
    setEventDescription(template.description || "");
    setEventErrors({});
  };

  // ── Submit Create Event from Template ──
  const handleCreateEventFromTemplate = async () => {
    if (!useModalTemplate) return;

    const errors: { name?: string; batchId?: string } = {};
    if (!eventName.trim()) errors.name = "Event title is required.";
    if (!batchId) errors.batchId = "Please select a target academic batch.";

    if (Object.keys(errors).length > 0) {
      setEventErrors(errors);
      return;
    }

    setIsSubmittingEvent(true);
    const toastId = toast.loading("Creating registration event from template...");

    try {
      const res = await createEventFromTemplate({
        templateId: useModalTemplate.id,
        name: eventName.trim(),
        academicBatchId: batchId,
        academicYear: academicYear.trim(),
        description: eventDescription.trim(),
        openDate: openDate || null,
        closeDate: closeDate || null,
        status: eventStatus,
      });

      if (!res.success || !res.eventId) {
        toast.error(res.error || "Failed to create event from template.", { id: toastId });
        return;
      }

      toast.success(
        `Successfully created event "${eventName}"! Initialized with ${useModalTemplate.groupCount} baskets and ${useModalTemplate.electiveCount} courses.`,
        { id: toastId }
      );
      setUseModalTemplate(null);
      router.push(`/faculty/events`);
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.", { id: toastId });
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  // ── Duplicate Template ──
  const handleDuplicate = async (template: DetailedTemplate) => {
    const toastId = toast.loading(`Cloning "${template.name}"...`);
    try {
      const res = await duplicateTemplate(template.id);
      if (!res.success) {
        toast.error(res.error || "Failed to duplicate template.", { id: toastId });
        return;
      }
      toast.success(`Created duplicate of "${template.name}"!`, { id: toastId });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate template.", { id: toastId });
    }
  };

  // ── Delete Template ──
  const handleConfirmDelete = async () => {
    if (!deletingTemplate) return;
    const targetId = deletingTemplate.id;
    const targetName = deletingTemplate.name;

    try {
      const res = await deleteTemplate(targetId);
      if (!res.success) {
        toast.error(res.error || "Failed to delete template.");
        throw new Error(res.error || "Failed to delete template.");
      }
      setTemplates((prev) => prev.filter((t) => t.id !== targetId));
      toast.success(`Deleted template "${targetName}".`);
      setDeletingTemplate(null);
      router.refresh();
    } catch (err: any) {
      if (err.message && !err.message.includes("Failed to delete template")) {
        toast.error(err.message);
      }
      throw err;
    }
  };

  // ── Save New Template ──
  const handleCreateTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName.trim()) {
      toast.error("Please provide a template title.");
      return;
    }
    if (!newProgrammeId) {
      toast.error("Please select a target programme.");
      return;
    }

    setIsCreatingTemplate(true);
    const toastId = toast.loading("Saving new template...");
    try {
      const res = await createTemplate({
        name: newTemplateName.trim(),
        programmeId: newProgrammeId,
        description: newDescription.trim() || undefined,
        groups: newGroups.map((g) => ({
          name: g.name.trim() || "Elective Basket",
          minChoices: g.minChoices,
          maxChoices: g.maxChoices,
          electives: g.electives
            .filter((e) => e.name.trim().length > 0)
            .map((e) => ({
              name: e.name.trim(),
              courseCode: e.courseCode.trim() || undefined,
              credits: e.credits || 3,
              defaultMaxSeats: e.defaultMaxSeats || 40,
            })),
        })),
      });

      if (!res.success) {
        toast.error(res.error || "Failed to save template.", { id: toastId });
        return;
      }

      toast.success(`Template "${newTemplateName}" created successfully!`, { id: toastId });
      setCreateModalOpen(false);
      setNewTemplateName("");
      setNewDescription("");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to create template.", { id: toastId });
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  // Available batches for selected template in modal
  const modalBatchOptions = React.useMemo(() => {
    if (!useModalTemplate) return [];
    const filtered = batches.filter((b) => b.programmeId === useModalTemplate.programmeId);
    return filtered.length > 0 ? filtered : batches;
  }, [useModalTemplate, batches]);

  return (
    <div className="space-y-8 pb-12">
      {/* ── Page Header & Top CTA ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-light tracking-display text-fg">Event Templates</h1>
            <Badge tone="outline" className="border-border text-fg-muted text-xs capitalize">
              {userRole ? userRole.replace(/_/g, " ").toLowerCase() : "Curriculum Blueprints"}
            </Badge>
          </div>
          <p className="text-fg-muted mt-2 max-w-2xl">
            Reusable elective baskets and curriculum blueprints. Use any template to instantiate a ready-to-run registration event with one click.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => {
              setNewTemplateName("");
              setNewProgrammeId(programmes[0]?.id || "");
              setNewDescription("");
              setCreateModalOpen(true);
            }}
            className="bg-primary text-canvas hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Template
          </Button>
        </div>
      </div>

      {/* ── Executive KPI Metrics Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Total Templates</span>
            <Layers className="w-4 h-4 text-fg-subtle" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal">{totalTemplates}</span>
            <span className="text-xs text-fg-muted">blueprints</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Covered Programmes</span>
            <GraduationCap className="w-4 h-4 text-fg-subtle" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal">{uniqueProgrammesCount}</span>
            <span className="text-xs text-fg-muted">programmes</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Pre-Configured Baskets</span>
            <BookOpen className="w-4 h-4 text-fg-subtle" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal">{totalGroups}</span>
            <span className="text-xs text-fg-muted">elective groups</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Pre-Configured Electives</span>
            <Sparkles className="w-4 h-4 text-primary-text" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal text-primary-text">
              {totalElectives}
            </span>
            <span className="text-xs text-primary-text font-medium">courses ready</span>
          </div>
        </div>
      </div>

      {/* ── Search, Filters & View Options Toolbar ── */}
      <div className="bg-surface border border-border rounded-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-muted" />
            <input
              type="text"
              placeholder="Search by template name, programme, or course code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-surface-2 border border-border-strong rounded-control text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-control px-2.5 py-1.5 text-xs text-fg-muted">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-medium text-fg">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-fg text-xs focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-surface text-fg">Most Recent</option>
                <option value="courses" className="bg-surface text-fg">Most Courses</option>
                <option value="name" className="bg-surface text-fg">Name (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Programme Filter Chips */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/60 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-fg-muted font-medium shrink-0 mr-1">Programme:</span>
          <button
            onClick={() => setSelectedProgramme("ALL")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-control text-xs font-medium transition-all ${
              selectedProgramme === "ALL"
                ? "bg-primary/15 text-primary-text border border-primary/30"
                : "bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 border border-transparent"
            }`}
          >
            All Programmes ({templates.length})
          </button>
          {programmeOptions.map(([progId, progName]) => {
            const active = selectedProgramme === progId;
            const count = templates.filter((t) => t.programmeId === progId).length;
            return (
              <button
                key={progId}
                onClick={() => setSelectedProgramme(progId)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-control text-xs font-medium transition-all shrink-0 ${
                  active
                    ? "bg-primary/15 text-primary-text border border-primary/30"
                    : "bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 border border-transparent"
                }`}
              >
                <span>{progName}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Template Cards Grid ── */}
      {filteredTemplates.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-card bg-surface/50">
          <Layers className="w-10 h-10 text-fg-subtle mx-auto mb-3" />
          <h3 className="text-base font-medium text-fg">No templates found</h3>
          <p className="text-sm text-fg-muted mt-1 max-w-sm mx-auto">
            {search || selectedProgramme !== "ALL"
              ? "Try adjusting your search query or programme filter."
              : "No templates have been defined yet. Create your first blueprint to get started."}
          </p>
          {(search || selectedProgramme !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedProgramme("ALL");
              }}
              className="mt-4"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const allCourses = template.groups.flatMap((g) => g.electives);

            // Compute role permission for this template
            const canDelete =
              template.canDelete ??
              (userRole === "SYSTEM_ADMIN" ||
                (userRole === "COURSE_COORDINATOR" &&
                  ((userProgrammeId && userProgrammeId === template.programmeId) ||
                    (currentUserId && currentUserId === template.createdById))));

            const isOwner = Boolean(currentUserId && template.createdById === currentUserId);
            const isAssignedProgramme = Boolean(
              userProgrammeId && template.programmeId === userProgrammeId
            );

            return (
              <div
                key={template.id}
                className="bg-surface border border-border rounded-card transition-all duration-200 flex flex-col overflow-hidden hover:border-border-strong group"
              >
                {/* Card Top */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary-text shrink-0 shadow-sm">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-medium text-primary-text block truncate">
                            {template.programmeName || "Universal Programme"}
                          </span>
                          {isOwner && (
                            <Badge
                              tone="outline"
                              className="border-primary/40 text-primary-text text-[9px] py-0 px-1 font-mono uppercase"
                            >
                              Author
                            </Badge>
                          )}
                          {!isOwner && userRole === "COURSE_COORDINATOR" && isAssignedProgramme && (
                            <Badge
                              tone="outline"
                              className="border-border text-fg-muted text-[9px] py-0 px-1 font-mono uppercase"
                            >
                              Programme
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-fg-muted">
                          {template.groupCount} basket{template.groupCount !== 1 ? "s" : ""} · {template.electiveCount} courses
                        </span>
                      </div>
                    </div>

                    {/* Overflow Menu with Role-Based Controls */}
                    <Menu>
                      <MenuTrigger className="p-1 rounded-control text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </MenuTrigger>
                      <MenuContent align="end" className="w-56 p-1.5">
                        <MenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate Template
                        </MenuItem>
                        {canDelete ? (
                          <MenuItem
                            tone="danger"
                            onClick={() => setDeletingTemplate(template)}
                          >
                            <Trash2 className="w-4 h-4 mr-2 text-danger-text" />
                            Delete Template
                          </MenuItem>
                        ) : (
                          <div
                            className="px-2.5 py-2 text-xs flex items-start gap-2 select-none bg-surface-2/60 rounded-control border border-border/50 mt-1 cursor-not-allowed"
                            title={
                              template.deleteRestrictionReason ||
                              "Restricted: You do not have permissions to delete this template based on your assigned role."
                            }
                          >
                            <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-fg-subtle" />
                            <div className="flex flex-col min-w-0">
                              <span className="font-medium text-fg-muted">Delete Restricted</span>
                              <span className="text-[10px] text-fg-subtle leading-tight">
                                {template.deleteRestrictionReason ||
                                  (userRole === "COURSE_COORDINATOR"
                                    ? `Restricted to ${template.programmeCode || "programme"} coordinator`
                                    : "Admin or Coordinator authority required")}
                              </span>
                            </div>
                          </div>
                        )}
                      </MenuContent>
                    </Menu>
                  </div>

                  <h3 className="text-lg font-medium text-fg group-hover:text-primary-text transition-colors line-clamp-1">
                    {template.name}
                  </h3>

                  {template.description && (
                    <p className="text-xs text-fg-muted mt-1.5 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </div>

                {/* Electives & Groups Preview Chips */}
                <div className="px-6 py-3 border-y border-border/60 bg-surface-2/40 space-y-2">
                  <div className="text-[11px] font-medium text-fg-muted flex items-center justify-between">
                    <span>Curriculum Structure</span>
                    <span className="font-mono text-fg">{template.groupCount} Baskets</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-16 overflow-hidden">
                    {allCourses.slice(0, 4).map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded-badge bg-surface border border-border text-[11px] text-fg-muted font-mono truncate max-w-44"
                        title={c.name}
                      >
                        {c.courseCode ? `${c.courseCode} · ` : ""}
                        {c.name}
                      </span>
                    ))}
                    {allCourses.length > 4 && (
                      <span className="px-2 py-0.5 rounded-badge bg-primary/10 text-primary-text text-[11px] font-mono font-medium">
                        +{allCourses.length - 4} more courses
                      </span>
                    )}
                  </div>
                </div>

                {/* Creator & Date Footer Info */}
                <div className="px-6 py-2.5 text-xs text-fg-muted flex items-center justify-between">
                  <span>
                    {template.creatorName ? `By ${template.creatorName}` : "System Template"}
                  </span>
                  <span>{formatDate(new Date(template.createdAt))}</span>
                </div>

                {/* Actions Bottom Bar with "Use this template" Button */}
                <div className="mt-auto px-6 py-4 bg-surface-2 border-t border-border flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleOpenUseModal(template)}
                    className="flex-1 bg-primary text-canvas hover:bg-primary/90 font-medium shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 mr-1.5" />
                    Use This Template
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewTemplate(template)}
                    className="border-border text-fg hover:bg-surface-3 px-3"
                    title="Preview Template Structure"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal: "Use This Template" -> Create Registration Event ── */}
      {useModalTemplate && (
        <Dialog open={true} onOpenChange={() => !isSubmittingEvent && setUseModalTemplate(null)}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-text" />
                Create Event from Template
              </DialogTitle>
              <DialogDescription>
                Instantiate a new elective registration window using &quot;{useModalTemplate.name}&quot;. All {useModalTemplate.groupCount} baskets and {useModalTemplate.electiveCount} courses will be cloned automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-sm">
              {/* Event Name */}
              <Field label="Registration Event Title" error={eventErrors.name}>
                <Input
                  value={eventName}
                  onChange={(e) => {
                    setEventName(e.target.value);
                    if (eventErrors.name) setEventErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="e.g. MCA GenAI - 2026 Batch Elective Registration"
                  disabled={isSubmittingEvent}
                  autoFocus
                />
              </Field>

              {/* Target Batch Selector */}
              <Field
                label="Target Academic Batch"
                description={`Recommended: Batches under ${useModalTemplate.programmeName || "this programme"}`}
                error={eventErrors.batchId}
              >
                <select
                  value={batchId}
                  onChange={(e) => {
                    setBatchId(e.target.value);
                    const selected = batches.find((b) => b.id === e.target.value);
                    if (selected) {
                      setAcademicYear(`${selected.year}-${parseInt(selected.year, 10) + 2}`);
                    }
                    if (eventErrors.batchId) {
                      setEventErrors((prev) => ({ ...prev, batchId: undefined }));
                    }
                  }}
                  disabled={isSubmittingEvent}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-control text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="" disabled>
                    Select an academic batch...
                  </option>
                  {modalBatchOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.programmeName ? `${b.programmeName} — ` : ""}
                      {b.year} Batch ({b.sectionCount} Section{b.sectionCount !== 1 ? "s" : ""})
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Academic Year" description="e.g. 2026-2028">
                  <Input
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="2026-2028"
                    disabled={isSubmittingEvent}
                  />
                </Field>

                <Field label="Initial Status">
                  <select
                    value={eventStatus}
                    onChange={(e) => setEventStatus(e.target.value)}
                    disabled={isSubmittingEvent}
                    className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-control text-sm text-fg focus:outline-none cursor-pointer"
                  >
                    <option value="DRAFT">DRAFT (Review before launch)</option>
                    <option value="OPEN">OPEN (Immediately active)</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Opens at (Optional)">
                  <Input
                    type="datetime-local"
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    disabled={isSubmittingEvent}
                  />
                </Field>

                <Field label="Closes at (Optional)">
                  <Input
                    type="datetime-local"
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    disabled={isSubmittingEvent}
                  />
                </Field>
              </div>

              <Field label="Description / Student Guidance (Optional)">
                <Textarea
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  placeholder="Instructions for students during selection..."
                  rows={2}
                  disabled={isSubmittingEvent}
                />
              </Field>

              {/* Blueprint Summary Box */}
              <div className="p-3.5 rounded-control bg-primary/10 border border-primary/20 text-xs space-y-1.5">
                <div className="font-medium text-primary-text flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary-text" />
                  Automatic Blueprint Provisions:
                </div>
                <div className="text-fg-muted space-y-1 pl-5">
                  <div>• {useModalTemplate.groupCount} Elective Baskets will be created</div>
                  <div>• {useModalTemplate.electiveCount} Courses will be instantiated with seat limits</div>
                  <div>• Section seat allocations will be linked for the target batch</div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="secondary"
                onClick={() => setUseModalTemplate(null)}
                disabled={isSubmittingEvent}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateEventFromTemplate}
                loading={isSubmittingEvent}
                loadingText="Instantiating Event..."
                className="bg-primary text-canvas"
              >
                Create Event from Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modal: Template Structure Preview ── */}
      {previewTemplate && (
        <Dialog open={true} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary-text" />
                <DialogTitle>{previewTemplate.name}</DialogTitle>
              </div>
              <DialogDescription>
                {previewTemplate.programmeName} · {previewTemplate.groupCount} Baskets · {previewTemplate.electiveCount} Courses
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-3">
              {previewTemplate.groups.map((grp, idx) => (
                <div
                  key={grp.id}
                  className="rounded-control border border-border bg-surface-2/40 overflow-hidden"
                >
                  <div className="p-3.5 bg-surface-2 border-b border-border flex items-center justify-between">
                    <div>
                      <span className="font-mono text-xs text-primary-text font-medium mr-2">
                        Basket {idx + 1}
                      </span>
                      <span className="font-medium text-fg text-sm">{grp.name}</span>
                    </div>
                    <span className="text-xs text-fg-muted font-mono">
                      Pick: {grp.minChoices} of {grp.electives.length}
                    </span>
                  </div>

                  <div className="p-3 space-y-2">
                    {grp.electives.map((el) => (
                      <div
                        key={el.id}
                        className="flex items-center justify-between text-xs p-2 rounded-badge bg-surface border border-border/80"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-medium text-fg truncate">
                            {el.courseCode ? (
                              <span className="font-mono text-primary-text mr-1.5">
                                [{el.courseCode}]
                              </span>
                            ) : null}
                            {el.name}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 font-mono text-fg-muted">
                          <span>{el.credits} credits</span>
                          <span>{el.defaultMaxSeats} seats</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPreviewTemplate(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  const t = previewTemplate;
                  setPreviewTemplate(null);
                  handleOpenUseModal(t);
                }}
                className="bg-primary text-canvas"
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                Use This Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modal: Create New Template ── */}
      {createModalOpen && (
        <Dialog open={true} onOpenChange={() => !isCreatingTemplate && setCreateModalOpen(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary-text" />
                Create Event Blueprint Template
              </DialogTitle>
              <DialogDescription>
                Define a reusable curriculum template with pre-configured elective baskets and courses.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateTemplateSubmit} className="space-y-4 py-2">
              <Field label="Template Title">
                <Input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="e.g. M.Tech AI & Robotics Semester III Template"
                  disabled={isCreatingTemplate}
                  autoFocus
                />
              </Field>

              <Field label="Target Programme">
                <select
                  value={newProgrammeId}
                  onChange={(e) => setNewProgrammeId(e.target.value)}
                  disabled={isCreatingTemplate}
                  className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-control text-sm text-fg focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Select programme...
                  </option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Description (Optional)">
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Outline the curriculum guidelines for this elective window..."
                  rows={2}
                  disabled={isCreatingTemplate}
                />
              </Field>

              {/* Baskets & Courses Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-fg-muted tracking-wider">
                    Elective Baskets ({newGroups.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setNewGroups([
                        ...newGroups,
                        {
                          name: `Elective Basket ${newGroups.length + 1}`,
                          minChoices: 1,
                          maxChoices: 1,
                          electives: [
                            { name: "", courseCode: "", credits: 3, defaultMaxSeats: 40 },
                            { name: "", courseCode: "", credits: 3, defaultMaxSeats: 40 },
                          ],
                        },
                      ])
                    }
                    className="text-xs text-primary-text hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Basket
                  </button>
                </div>

                {newGroups.map((grp, gIdx) => (
                  <div
                    key={gIdx}
                    className="p-3.5 rounded-control border border-border bg-surface-2/40 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <Input
                        value={grp.name}
                        onChange={(e) => {
                          const updated = [...newGroups];
                          updated[gIdx].name = e.target.value;
                          setNewGroups(updated);
                        }}
                        placeholder="Basket Name (e.g. Professional Elective I)"
                        className="flex-1 text-sm font-medium"
                      />
                      {newGroups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewGroups(newGroups.filter((_, i) => i !== gIdx))}
                          className="text-fg-muted hover:text-danger-text p-1.5"
                          title="Remove Basket"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Courses within this basket */}
                    <div className="space-y-2 pl-2 border-l-2 border-border">
                      <div className="text-[11px] font-medium text-fg-muted">Courses:</div>
                      {grp.electives.map((el, eIdx) => (
                        <div key={eIdx} className="flex items-center gap-2">
                          <Input
                            value={el.courseCode}
                            onChange={(e) => {
                              const updated = [...newGroups];
                              updated[gIdx].electives[eIdx].courseCode = e.target.value;
                              setNewGroups(updated);
                            }}
                            placeholder="Code (e.g. CS501)"
                            className="w-24 text-xs font-mono"
                          />
                          <Input
                            value={el.name}
                            onChange={(e) => {
                              const updated = [...newGroups];
                              updated[gIdx].electives[eIdx].name = e.target.value;
                              setNewGroups(updated);
                            }}
                            placeholder="Elective Course Title"
                            className="flex-1 text-xs"
                          />
                          <Input
                            type="number"
                            value={el.defaultMaxSeats}
                            onChange={(e) => {
                              const updated = [...newGroups];
                              updated[gIdx].electives[eIdx].defaultMaxSeats = parseInt(
                                e.target.value,
                                10
                              ) || 40;
                              setNewGroups(updated);
                            }}
                            placeholder="Seats"
                            className="w-16 text-xs text-center font-mono"
                            title="Default Max Seats"
                          />
                          {grp.electives.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...newGroups];
                                updated[gIdx].electives = updated[gIdx].electives.filter(
                                  (_, i) => i !== eIdx
                                );
                                setNewGroups(updated);
                              }}
                              className="text-fg-muted hover:text-danger-text p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...newGroups];
                          updated[gIdx].electives.push({
                            name: "",
                            courseCode: "",
                            credits: 3,
                            defaultMaxSeats: 40,
                          });
                          setNewGroups(updated);
                        }}
                        className="text-[11px] text-primary-text hover:underline flex items-center gap-1 pt-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Course to Basket
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={isCreatingTemplate}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={isCreatingTemplate}
                  loadingText="Saving Template..."
                  className="bg-primary text-canvas"
                >
                  Save Template
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Delete Template Dialog with Role-Based Authority ── */}
      {deletingTemplate && (
        <ConfirmDialog
          open={true}
          onOpenChange={() => setDeletingTemplate(null)}
          title={`Delete Template: ${deletingTemplate.name}`}
          tone="danger"
          confirmLabel="Delete Template"
          onConfirm={handleConfirmDelete}
          description="Are you sure you want to permanently delete this template? Any existing registration events that were previously created using it will remain intact."
          impact={[
            {
              label: "Template",
              value: deletingTemplate.name,
            },
            {
              label: "Role Authority",
              value: (
                <div className="flex items-center gap-1.5">
                  {userRole === "SYSTEM_ADMIN" ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-warning-text" />
                      <span className="text-warning-text font-medium text-xs">
                        System Admin (Universal Authority)
                      </span>
                    </>
                  ) : deletingTemplate.createdById === currentUserId ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-primary-text" />
                      <span className="text-primary-text font-medium text-xs">
                        Template Creator & Owner
                      </span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-primary-text" />
                      <span className="text-primary-text font-medium text-xs">
                        Programme Coordinator ({deletingTemplate.programmeCode || "Assigned"})
                      </span>
                    </>
                  )}
                </div>
              ),
            },
            {
              label: "Assigned Programme",
              value: deletingTemplate.programmeName || "Universal Programme",
            },
            {
              label: "Elective Baskets",
              value: `${deletingTemplate.groupCount} group${deletingTemplate.groupCount !== 1 ? "s" : ""}`,
            },
            {
              label: "Elective Courses",
              value: `${deletingTemplate.electiveCount} course${deletingTemplate.electiveCount !== 1 ? "s" : ""}`,
              tone: "danger",
            },
          ]}
        />
      )}
    </div>
  );
}
