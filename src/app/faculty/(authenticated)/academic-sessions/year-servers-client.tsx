"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  GraduationCap,
  History,
  Layers,
  MoreVertical,
  Plus,
  Search,
  Server,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  createYearServer,
  deleteEmptyYearServers,
  deleteYearServer,
  setYearServerStatus,
  type YearServerCard,
} from "@/app/actions/year-servers";
import { selectAcademicSession } from "@/app/actions/workspace";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/feedback";
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
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

const STATUS_CONFIG: Record<
  string,
  { label: string; tone: "success" | "neutral" | "outline"; border: string }
> = {
  ACTIVE: { label: "Active", tone: "success", border: "border-primary/30" },
  PLANNED: { label: "Planned", tone: "neutral", border: "border-border" },
  ARCHIVED: { label: "Archived", tone: "outline", border: "border-border/50 opacity-70" },
};

export function YearServersClient({
  servers,
  isAdmin,
  unresolvedCount,
}: {
  servers: YearServerCard[];
  isAdmin: boolean;
  currentSessionId?: string | null;
  unresolvedCount: number;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newYear, setNewYear] = React.useState(String(new Date().getFullYear() + 1));
  const [newStatus, setNewStatus] = React.useState<"ACTIVE" | "PLANNED">("ACTIVE");
  const [submitting, setSubmitting] = React.useState(false);
  const [enteringId, setEnteringId] = React.useState<string | null>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "ACTIVE" | "PLANNED" | "ARCHIVED">("ALL");

  // Deletion modals
  const [deleteTarget, setDeleteTarget] = React.useState<YearServerCard | null>(null);
  const [cleanEmptyOpen, setCleanEmptyOpen] = React.useState(false);

  // Filter calculations
  const allCount = servers.length;
  const activeCount = servers.filter((s) => s.status === "ACTIVE").length;
  const plannedCount = servers.filter((s) => s.status === "PLANNED").length;
  const archivedCount = servers.filter((s) => s.status === "ARCHIVED").length;
  const emptyServers = servers.filter(
    (s) => s.programmeCount === 0 && s.classCount === 0 && s.studentCount === 0 && s.eventCount === 0
  );

  const filteredServers = React.useMemo(() => {
    return servers.filter((server) => {
      if (statusFilter !== "ALL" && server.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesYear = String(server.year).includes(q);
        const matchesLabel = server.label.toLowerCase().includes(q);
        return matchesYear || matchesLabel;
      }
      return true;
    });
  }, [servers, statusFilter, searchQuery]);

  const handleOpenWorkspace = async (server: YearServerCard) => {
    setEnteringId(server.id);
    try {
      const res = await selectAcademicSession(server.id);
      if (!res.success) {
        throw new Error(res.error || "Could not enter year server");
      }
      toast.success(`Entered ${server.label}`);
      router.push(`/faculty/academic-sessions/${server.year}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open year server");
      setEnteringId(null);
    }
  };

  const handleMakeCurrent = async (server: YearServerCard) => {
    try {
      const res = await selectAcademicSession(server.id);
      if (!res.success) throw new Error(res.error);
      toast.success(`Active workspace switched to ${server.label}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch active server");
    }
  };

  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    const yr = Number(newYear);
    if (!Number.isFinite(yr) || yr < 2000 || yr > 2100) {
      toast.error("Please enter a valid year between 2000 and 2100.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createYearServer({ year: yr, status: newStatus });
      if (!res.success) {
        throw new Error(res.error);
      }
      toast.success(`${yr} Year Server created successfully!`);
      setCreateOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create Year Server");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (server: YearServerCard, nextStatus: "ACTIVE" | "PLANNED" | "ARCHIVED") => {
    try {
      const res = await setYearServerStatus(server.id, nextStatus);
      if (!res.success) {
        throw new Error(res.error);
      }
      toast.success(`${server.label} status updated to ${nextStatus.toLowerCase()}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const targetLabel = deleteTarget.label;
    const res = await deleteYearServer(deleteTarget.id);
    if (!res.success) {
      throw new Error(res.error);
    }
    toast.success(`${targetLabel} deleted successfully`);
    setDeleteTarget(null);
    router.refresh();
  };

  const handleCleanEmptyConfirm = async () => {
    const res = await deleteEmptyYearServers();
    if (!res.success) {
      throw new Error(res.error);
    }
    toast.success(
      res.deletedCount > 0
        ? `Cleaned up ${res.deletedCount} empty test Year Server(s)`
        : "No empty servers to clean"
    );
    setCleanEmptyOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-8 animate-enter">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-badge bg-primary/10 text-primary border border-primary/20">
              <Server className="size-4" />
            </span>
            <h1 className="text-2xl font-light tracking-display text-fg sm:text-3xl">Year Servers</h1>
          </div>
          <p className="mt-1.5 text-sm text-fg-muted max-w-2xl">
            Select an academic year server to manage programmes, classes, students and registrations.
            Each year is a self-contained workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isAdmin && unresolvedCount > 0 ? (
            <Link
              href="/faculty/academic-sessions/review"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <History className="size-3.5 text-amber-500" />
              <span>Data Review</span>
              <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-amber-500/20 text-xs font-mono font-semibold text-amber-400">
                {unresolvedCount}
              </span>
            </Link>
          ) : null}

          {isAdmin && emptyServers.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCleanEmptyOpen(true)}
              className="gap-1.5 text-fg-muted hover:text-fg"
            >
              <Sparkles className="size-3.5 text-primary" />
              <span>Prune Empty ({emptyServers.length})</span>
            </Button>
          ) : null}

          {isAdmin ? (
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="gap-1.5 shadow-sm"
            >
              <Plus className="size-4" />
              <span>Create Year Server</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      {servers.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "rounded-control px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "ALL"
                  ? "bg-surface-2 text-fg shadow-xs border border-border"
                  : "text-fg-subtle hover:text-fg hover:bg-surface-2/50"
              )}
            >
              All <span className="ml-1 font-mono text-2xs opacity-70">({allCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={cn(
                "rounded-control px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "ACTIVE"
                  ? "bg-surface-2 text-emerald-400 shadow-xs border border-border"
                  : "text-fg-subtle hover:text-fg hover:bg-surface-2/50"
              )}
            >
              Active <span className="ml-1 font-mono text-2xs opacity-70">({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("PLANNED")}
              className={cn(
                "rounded-control px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "PLANNED"
                  ? "bg-surface-2 text-fg shadow-xs border border-border"
                  : "text-fg-subtle hover:text-fg hover:bg-surface-2/50"
              )}
            >
              Planned <span className="ml-1 font-mono text-2xs opacity-70">({plannedCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ARCHIVED")}
              className={cn(
                "rounded-control px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === "ARCHIVED"
                  ? "bg-surface-2 text-fg shadow-xs border border-border"
                  : "text-fg-subtle hover:text-fg hover:bg-surface-2/50"
              )}
            >
              Archived <span className="ml-1 font-mono text-2xs opacity-70">({archivedCount})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
            <Input
              type="search"
              placeholder="Filter by year (e.g. 2026)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 pr-8 text-xs font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Year Server Cards Grid ── */}
      {servers.length === 0 ? (
        <EmptyState
          title="No Year Servers available"
          description={
            isAdmin
              ? "Create your first Year Server to start managing programmes and classes."
              : "Contact an administrator to create and configure a Year Server."
          }
          className="rounded-panel border border-border bg-surface p-12 text-center"
        />
      ) : filteredServers.length === 0 ? (
        <EmptyState
          title="No Year Servers match your criteria"
          description="Try clearing your search query or selecting a different status filter."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
            >
              Reset Filters
            </Button>
          }
          className="rounded-panel border border-border bg-surface p-12 text-center"
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredServers.map((server) => {
            const statusConfig = STATUS_CONFIG[server.status] ?? STATUS_CONFIG.ACTIVE;
            const isEntering = enteringId === server.id;

            return (
              <div
                key={server.id}
                className={cn(
                  "group relative flex flex-col justify-between rounded-card border bg-surface p-6 shadow-1 transition-all duration-200 hover:shadow-2",
                  server.isCurrent ? "border-primary/50 ring-1 ring-primary/30" : statusConfig.border
                )}
              >
                <div>
                  {/* Top Bar: Title, Status, and Admin Action Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-medium tracking-tight text-fg font-sans">
                          {server.year} Year Server
                        </h2>
                        {server.isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-badge bg-primary/15 px-2 py-0.5 text-2xs font-medium text-primary border border-primary/25">
                            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-fg-muted font-mono">
                        Workspace · Academic Intake {server.year}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge size="sm" tone={statusConfig.tone}>
                        {statusConfig.label}
                      </Badge>

                      {isAdmin && (
                        <Menu>
                          <MenuTrigger
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "size-7.5 rounded-control text-fg-subtle hover:text-fg hover:bg-surface-2 transition-colors cursor-pointer"
                            )}
                            aria-label={`Actions for ${server.year} Year Server`}
                          >
                            <MoreVertical className="size-4" />
                          </MenuTrigger>
                          <MenuContent align="end" className="w-52">
                            {!server.isCurrent && server.status !== "ARCHIVED" && (
                              <MenuItem onClick={() => handleMakeCurrent(server)}>
                                <Check className="size-4 text-primary" />
                                <span>Set as Current</span>
                              </MenuItem>
                            )}
                            <MenuItem onClick={() => handleOpenWorkspace(server)}>
                              <ArrowRight className="size-4" />
                              <span>Open Workspace</span>
                            </MenuItem>

                            <MenuSeparator />
                            <div className="px-2.5 py-1 text-2xs font-mono uppercase tracking-wider text-fg-subtle">
                              Status
                            </div>
                            {server.status !== "ACTIVE" && (
                              <MenuItem onClick={() => handleStatusChange(server, "ACTIVE")}>
                                <span className="size-2 rounded-full bg-emerald-500 mr-2" />
                                <span>Set to Active</span>
                              </MenuItem>
                            )}
                            {server.status !== "PLANNED" && (
                              <MenuItem onClick={() => handleStatusChange(server, "PLANNED")}>
                                <span className="size-2 rounded-full bg-zinc-400 mr-2" />
                                <span>Set to Planned</span>
                              </MenuItem>
                            )}
                            {server.status !== "ARCHIVED" && (
                              <MenuItem onClick={() => handleStatusChange(server, "ARCHIVED")}>
                                <span className="size-2 rounded-full bg-amber-500 mr-2" />
                                <span>Archive Server</span>
                              </MenuItem>
                            )}

                            <MenuSeparator />
                            <MenuItem tone="danger" onClick={() => setDeleteTarget(server)}>
                              <Trash2 className="size-4 text-danger-text" />
                              <span>Delete Server</span>
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      )}
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="mt-6 grid grid-cols-2 gap-3 rounded-control border border-border/60 bg-surface-2/40 p-3.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
                        <BookOpen className="size-3 text-fg-muted" />
                        <span>Programmes</span>
                      </div>
                      <p className="text-lg font-light tabular-nums text-fg font-mono">
                        {server.programmeCount}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
                        <Layers className="size-3 text-fg-muted" />
                        <span>Classes</span>
                      </div>
                      <p className="text-lg font-light tabular-nums text-fg font-mono">
                        {server.classCount}
                      </p>
                    </div>

                    <div className="space-y-1 border-t border-border/40 pt-2.5">
                      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
                        <GraduationCap className="size-3 text-fg-muted" />
                        <span>Students</span>
                      </div>
                      <p className="text-lg font-light tabular-nums text-fg font-mono">
                        {server.studentCount}
                      </p>
                    </div>

                    <div className="space-y-1 border-t border-border/40 pt-2.5">
                      <div className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-fg-subtle">
                        <Calendar className="size-3 text-fg-muted" />
                        <span>Events</span>
                      </div>
                      <p className="text-lg font-light tabular-nums text-fg font-mono">
                        {server.eventCount}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Clean, Full-Width Action */}
                <div className="mt-6 pt-4 border-t border-border/50">
                  {server.canEnter ? (
                    <Button
                      onClick={() => handleOpenWorkspace(server)}
                      disabled={isEntering}
                      variant={server.isCurrent ? "primary" : "secondary"}
                      className="w-full justify-between gap-2 text-sm font-medium"
                    >
                      <span>{server.isCurrent ? "Enter Workspace" : "Open Workspace"}</span>
                      <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  ) : (
                    <div className="w-full rounded-control bg-surface-2/60 px-3 py-2.5 text-center text-xs text-fg-subtle font-mono">
                      {server.status === "ARCHIVED" ? "Archived Server" : "No Assigned Classes"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Year Server Modal ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateServer}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Server className="size-5 text-primary" />
                <span>Create Year Server</span>
              </DialogTitle>
              <DialogDescription>
                Initializes a new annual academic workspace. Programmes and batches for this admission year will be grouped here.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4 py-4">
              <Field label="Admission / Cohort Year" description="The starting academic intake year (e.g. 2027)">
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  required
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  placeholder="2027"
                  className="font-mono text-base"
                />
              </Field>

              <Field label="Status" description="Planned servers can be configured before opening to students">
                <Select
                  value={newStatus}
                  onValueChange={(val) => setNewStatus(val as "ACTIVE" | "PLANNED")}
                  options={[
                    { value: "ACTIVE", label: "Active — available for staff immediately" },
                    { value: "PLANNED", label: "Planned — preparation and staging mode" },
                  ]}
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Year Server"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.year} Year Server`}
        description={
          deleteTarget && (deleteTarget.studentCount > 0 || deleteTarget.eventCount > 0)
            ? `This will remove the ${deleteTarget.year} Year Server workspace. Existing student registrations and historical receipts will be safely preserved in Data Review.`
            : `This will permanently remove the ${deleteTarget?.year} Year Server workspace.`
        }
        tone="danger"
        confirmLabel="Delete Year Server"
        requireText={
          deleteTarget && (deleteTarget.studentCount > 0 || deleteTarget.eventCount > 0)
            ? String(deleteTarget.year)
            : undefined
        }
        impact={
          deleteTarget
            ? [
                { label: "Programmes Linked", value: deleteTarget.programmeCount },
                { label: "Classes Configured", value: deleteTarget.classCount },
                {
                  label: "Enrolled Students",
                  value: deleteTarget.studentCount,
                  tone: deleteTarget.studentCount > 0 ? "warning" : "neutral",
                },
                { label: "Registration Events", value: deleteTarget.eventCount },
              ]
            : undefined
        }
        onConfirm={handleDeleteConfirm}
      />

      {/* ── Prune Empty Test Servers Confirmation Dialog ── */}
      <ConfirmDialog
        open={cleanEmptyOpen}
        onOpenChange={setCleanEmptyOpen}
        title="Prune Empty Year Servers"
        description={`This will delete all ${emptyServers.length} empty Year Servers with 0 classes, 0 students, and 0 events (${emptyServers.map((s) => s.year).join(", ")}).`}
        tone="default"
        confirmLabel="Prune Empty Servers"
        onConfirm={handleCleanEmptyConfirm}
      />
    </div>
  );
}
