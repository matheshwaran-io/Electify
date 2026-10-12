"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  PlayCircle,
  Clock,
  CalendarDays,
  Users,
  BookOpen,
  Activity,
  Search,
  LayoutGrid,
  Table as TableIcon,
  Download,
  FileSpreadsheet,
  FileJson,
  RefreshCw,
  SlidersHorizontal,
  X,
  Zap,
  ArrowRight,
  Scale,
  Radio,
} from "lucide-react";

import {
  ReplayEventSummary,
  ReplayHubData,
  exportReplaySessionData,
  getEventActivityStream,
} from "@/app/actions/replay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meter, LiveIndicator, AnimatedNumber } from "@/components/ui/data-display";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";

interface ReplayHubClientProps {
  initialData: ReplayHubData;
  userRole?: string;
}

export function ReplayHubClient({ initialData, userRole }: ReplayHubClientProps) {
  const router = useRouter();

  const events = initialData.events;
  const kpis = initialData.kpis;

  // Filters & View State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "OPEN" | "CLOSED" | "DRAFT">("ALL");
  const [sortBy, setSortBy] = React.useState<"newest" | "turnout" | "replay" | "capacity" | "name">("newest");
  const [viewMode, setViewMode] = React.useState<"grid" | "table">("grid");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Comparison State
  const [selectedForCompare, setSelectedForCompare] = React.useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = React.useState(false);

  // Activity Drawer State
  const [activityDrawerOpen, setActivityDrawerOpen] = React.useState(false);
  const [activityTargetEvent, setActivityTargetEvent] = React.useState<ReplayEventSummary | null>(null);
  const [activityStream, setActivityStream] = React.useState<any[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(false);
  const [activityFilter, setActivityFilter] = React.useState<"all" | "registered" | "changes">("all");
  const [autoPollActivity, setAutoPollActivity] = React.useState(true);

  // Export State
  const [exportPendingId, setExportPendingId] = React.useState<string | null>(null);

  // ── Open Activity Drawer ──
  const openActivityDrawer = async (targetEvent: ReplayEventSummary | null = null) => {
    setActivityTargetEvent(targetEvent);
    setActivityDrawerOpen(true);
    setActivityLoading(true);

    try {
      const res = await getEventActivityStream(targetEvent?.id);
      if (res.success && res.data) {
        setActivityStream(res.data);
      }
    } catch {
      toast.error("Failed to load activity stream.");
    } finally {
      setActivityLoading(false);
    }
  };

  // ── Activity Polling when drawer open ──
  React.useEffect(() => {
    if (!activityDrawerOpen || !autoPollActivity) return;

    const interval = setInterval(async () => {
      try {
        const res = await getEventActivityStream(activityTargetEvent?.id);
        if (res.success && res.data) {
          setActivityStream(res.data);
        }
      } catch {
        // silent poll fail
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activityDrawerOpen, autoPollActivity, activityTargetEvent]);

  // ── Export Handler ──
  const handleExport = async (eventId: string, format: "rankings" | "audit_trail" | "json") => {
    setExportPendingId(eventId);
    const toastId = toast.loading(`Preparing ${format.replace("_", " ")} export...`);
    try {
      const res = await exportReplaySessionData(eventId, format);
      if (!res.success || !res.content || !res.filename) {
        toast.error(res.error || "Failed to export data.", { id: toastId });
        return;
      }

      const blob = new Blob([res.content], { type: res.mimeType || "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Successfully exported ${res.filename}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Export error.", { id: toastId });
    } finally {
      setExportPendingId(null);
    }
  };

  // ── Refresh Handler ──
  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Replay hub updated with latest event records.");
    }, 600);
  };

  // ── Toggle Compare Selection ──
  const toggleCompare = (id: string) => {
    setSelectedForCompare((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ── Filter & Sort Logic ──
  const filteredEvents = React.useMemo(() => {
    let list = events;

    if (statusFilter !== "ALL") {
      list = list.filter((e) => e.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.academicYear && e.academicYear.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "turnout") {
        return b.confirmedCount - a.confirmedCount;
      }
      if (sortBy === "replay") {
        return b.replayEventCount - a.replayEventCount;
      }
      if (sortBy === "capacity") {
        return b.capacityUtilization - a.capacityUtilization;
      }
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [events, statusFilter, searchQuery, sortBy]);

  // ── Filtered Activity Drawer items ──
  const filteredActivityStream = React.useMemo(() => {
    if (activityFilter === "all") return activityStream;
    if (activityFilter === "registered") {
      return activityStream.filter((a) => a.eventType === "STUDENT_REGISTERED");
    }
    if (activityFilter === "changes") {
      return activityStream.filter(
        (a) =>
          a.eventType === "STUDENT_CHANGED_CHOICE" ||
          a.eventType === "SEAT_RELEASED" ||
          a.eventType === "REGISTRATION_RESET"
      );
    }
    return activityStream;
  }, [activityStream, activityFilter]);

  // ── Compare Events Objects ──
  const compareEvents = React.useMemo(() => {
    return events.filter((e) => selectedForCompare.includes(e.id));
  }, [events, selectedForCompare]);

  return (
    <div className="space-y-8 pb-12">
      {/* ── Title and Quick Header Controls ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-light tracking-display text-fg">Registration Replay</h1>
            <Badge tone="outline" className="border-border text-fg-muted text-xs capitalize">
              {userRole ? userRole.replace(/_/g, " ").toLowerCase() : "Audit Hub"}
            </Badge>
          </div>
          <p className="text-fg-muted mt-2 max-w-2xl">
            Select any registration event to step through timeline submissions, analyze peak rush velocity, review seat changes, and export accredited audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openActivityDrawer(null)}
            className="border-border text-fg hover:bg-surface-2"
          >
            <Activity className="w-4 h-4 mr-2 text-primary-text" />
            Live Stream Feed
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-fg-muted hover:text-fg"
            title="Refresh Replay Data"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* ── Top Executive KPI Metrics Bar ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Replay Sessions</span>
            <CalendarDays className="w-4 h-4 text-fg-subtle" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal">
              <AnimatedNumber value={kpis.totalSessions} />
            </span>
            <span className="text-xs text-fg-muted">recorded</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Live Windows</span>
            <LiveIndicator state={kpis.activeWindows > 0 ? "live" : "idle"} />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal">
              <AnimatedNumber value={kpis.activeWindows} />
            </span>
            <span className="text-xs text-success-text font-medium">
              {kpis.activeWindows > 0 ? "Accepting choices" : "None active"}
            </span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Confirmed Submissions</span>
            <Users className="w-4 h-4 text-fg-subtle" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal">
              <AnimatedNumber value={kpis.totalSubmissions} />
            </span>
            <span className="text-xs text-fg-muted">students enrolled</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-card p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>Replay Audit Actions</span>
            <Activity className="w-4 h-4 text-fg-subtle" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono text-fg font-normal">
              <AnimatedNumber value={kpis.totalReplayLogs} />
            </span>
            <span className="text-xs text-primary-text font-medium">atomic logs</span>
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
              placeholder="Search by event title, year, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-surface-2 border border-border-strong rounded-control text-sm text-fg placeholder:text-fg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right Toolbar Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Compare Trigger */}
            {selectedForCompare.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCompareModalOpen(true)}
                className="border-primary/40 bg-primary/10 text-primary-text hover:bg-primary/20"
              >
                <Scale className="w-3.5 h-3.5 mr-1.5" />
                Compare ({selectedForCompare.length})
              </Button>
            )}

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-surface-2 border border-border rounded-control px-2.5 py-1.5 text-xs text-fg-muted">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-medium text-fg">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-fg text-xs focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-surface text-fg">Most Recent</option>
                <option value="turnout" className="bg-surface text-fg">Highest Turnout</option>
                <option value="replay" className="bg-surface text-fg">Most Replay Logs</option>
                <option value="capacity" className="bg-surface text-fg">Capacity %</option>
                <option value="name" className="bg-surface text-fg">Name (A-Z)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-surface-2 border border-border rounded-control p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-badge transition-colors ${
                  viewMode === "grid" ? "bg-surface text-fg shadow-1" : "text-fg-muted hover:text-fg"
                }`}
                title="Grid Card View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-badge transition-colors ${
                  viewMode === "table" ? "bg-surface text-fg shadow-1" : "text-fg-muted hover:text-fg"
                }`}
                title="Dense Table View"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/60 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-fg-muted font-medium shrink-0 mr-1">Status:</span>
          {(
            [
              { id: "ALL", label: "All Sessions", count: events.length, hasLiveDot: false },
              {
                id: "OPEN",
                label: "Live / Open",
                count: events.filter((e) => e.status === "OPEN").length,
                hasLiveDot: true,
              },
              {
                id: "CLOSED",
                label: "Closed",
                count: events.filter((e) => e.status === "CLOSED").length,
                hasLiveDot: false,
              },
              {
                id: "DRAFT",
                label: "Drafts",
                count: events.filter((e) => e.status === "DRAFT").length,
                hasLiveDot: false,
              },
            ] as const
          ).map((tab) => {
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-control text-xs font-medium transition-all ${
                  active
                    ? "bg-primary/15 text-primary-text border border-primary/30"
                    : "bg-surface-2 text-fg-muted hover:text-fg hover:bg-surface-3 border border-transparent"
                }`}
              >
                {tab.hasLiveDot && tab.count > 0 && (
                  <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
                )}
                <span>{tab.label}</span>
                <span className="text-[10px] opacity-75 font-mono">({tab.count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content View: Grid vs Table ── */}
      {filteredEvents.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-card bg-surface/50">
          <CalendarDays className="w-10 h-10 text-fg-subtle mx-auto mb-3" />
          <h3 className="text-base font-medium text-fg">No matching registration events</h3>
          <p className="text-sm text-fg-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search query or changing the status filter tab above.
          </p>
          {(searchQuery || statusFilter !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className="mt-4"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => {
            const isComparing = selectedForCompare.includes(event.id);
            const isOpen = event.status === "OPEN";

            return (
              <div
                key={event.id}
                className={`bg-surface border rounded-card transition-all duration-200 flex flex-col overflow-hidden group hover:border-border-strong ${
                  isComparing ? "border-primary ring-1 ring-primary/40" : "border-border"
                }`}
              >
                {/* Card Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/faculty/replay/${event.id}`}
                        className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary-text group-hover:bg-primary group-hover:text-canvas transition-colors shadow-sm shrink-0"
                        title="Open Chronological Replay"
                      >
                        <PlayCircle className="w-6 h-6" />
                      </Link>
                      <div>
                        {event.academicYear && (
                          <span className="text-[11px] font-mono text-fg-muted block">
                            Batch {event.academicYear}
                          </span>
                        )}
                        <span className="text-[11px] text-fg-muted">
                          {event.groupCount} group{event.groupCount !== 1 ? "s" : ""} · {event.electiveCount} electives
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                          isOpen
                            ? "bg-success/15 text-success-text border border-success/30"
                            : event.status === "CLOSED"
                            ? "bg-danger/10 text-danger-text border border-danger/20"
                            : "bg-surface-2 text-fg-muted border border-border"
                        }`}
                      >
                        {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                        {event.status}
                      </span>

                      {/* Compare Checkbox */}
                      <input
                        type="checkbox"
                        checked={isComparing}
                        onChange={() => toggleCompare(event.id)}
                        className="w-4 h-4 rounded border-border-strong text-primary accent-primary cursor-pointer"
                        title="Select for comparison"
                      />
                    </div>
                  </div>

                  <Link href={`/faculty/replay/${event.id}`}>
                    <h3 className="text-lg font-medium text-fg group-hover:text-primary-text transition-colors line-clamp-2">
                      {event.name}
                    </h3>
                  </Link>

                  {event.description && (
                    <p className="text-xs text-fg-muted mt-1.5 line-clamp-2">{event.description}</p>
                  )}
                </div>

                {/* Capacity & Progress Meter */}
                <div className="px-6 py-2">
                  <div className="flex justify-between items-center text-xs mb-1.5">
                    <span className="text-fg-muted">Seat Utilization</span>
                    <span className="font-mono text-fg font-medium">
                      {event.allocatedSeats} / {event.totalCapacity} ({event.capacityUtilization}%)
                    </span>
                  </div>
                  <Meter
                    value={event.allocatedSeats}
                    max={Math.max(1, event.totalCapacity)}
                    tone={
                      event.capacityUtilization >= 95
                        ? "danger"
                        : event.capacityUtilization >= 70
                        ? "warning"
                        : "primary"
                    }
                    label={`${event.name} capacity`}
                  />
                </div>

                {/* 4-Stat Metric Grid */}
                <div className="grid grid-cols-2 gap-2 px-6 py-3 border-y border-border/60 bg-surface-2/40 text-xs">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                    <div>
                      <span className="text-fg font-medium">{event.confirmedCount}</span>
                      <span className="text-fg-muted text-[11px] ml-1">students</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-primary-text shrink-0" />
                    <div>
                      <span className="text-fg font-medium">{event.replayEventCount}</span>
                      <span className="text-fg-muted text-[11px] ml-1">audit logs</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                    <div className="truncate">
                      <span className="text-fg font-medium">{event.electiveCount}</span>
                      <span className="text-fg-muted text-[11px] ml-1">courses</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-warning-text shrink-0" />
                    <div className="truncate">
                      {event.secondsToFirstSubmission !== null ? (
                        <span className="text-fg font-mono text-[11px]">
                          ⚡ {event.secondsToFirstSubmission}s rush
                        </span>
                      ) : (
                        <span className="text-fg-muted text-[11px]">
                          Direct pick
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline Timestamps */}
                <div className="px-6 py-3 text-xs text-fg-muted space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-fg-subtle" />
                      <span>Created</span>
                    </div>
                    <span>{format(new Date(event.createdAt), "MMM d, yyyy")}</span>
                  </div>

                  {event.openDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-fg-subtle" />
                        <span>Opened</span>
                      </div>
                      <span>{format(new Date(event.openDate), "MMM d, h:mm a")}</span>
                    </div>
                  )}
                </div>

                {/* Card Action Controls Footer */}
                <div className="mt-auto px-6 py-4 bg-surface-2 border-t border-border flex items-center justify-between gap-2">
                  <Link href={`/faculty/replay/${event.id}`} className="flex-1">
                    <Button size="sm" className="w-full bg-primary text-canvas hover:bg-primary/90">
                      <PlayCircle className="w-4 h-4 mr-1.5" />
                      Launch Replay
                    </Button>
                  </Link>

                  {/* Activity Stream Drawer Button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openActivityDrawer(event)}
                    className="border-border text-fg hover:bg-surface-3 px-2.5"
                    title="Live Event Activity Feed"
                  >
                    <Activity className="w-4 h-4" />
                  </Button>

                  {/* Export Options Menu */}
                  <Menu>
                    <MenuTrigger
                      disabled={exportPendingId === event.id}
                      className="inline-flex items-center justify-center h-8 px-2.5 rounded-control text-xs font-medium border border-border bg-surface text-fg hover:bg-surface-3 transition-colors disabled:opacity-50"
                      title="Export Options"
                    >
                      {exportPendingId === event.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-primary-text" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </MenuTrigger>
                    <MenuContent align="end" className="w-56">
                      <MenuItem onClick={() => handleExport(event.id, "rankings")}>
                        <FileSpreadsheet className="w-4 h-4 mr-2 text-success-text" />
                        Export Rankings (CSV)
                      </MenuItem>
                      <MenuItem onClick={() => handleExport(event.id, "audit_trail")}>
                        <Activity className="w-4 h-4 mr-2 text-primary-text" />
                        Export Audit Trail (CSV)
                      </MenuItem>
                      <MenuItem onClick={() => handleExport(event.id, "json")}>
                        <FileJson className="w-4 h-4 mr-2 text-warning-text" />
                        Export JSON Transcript
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Table View */
        <div className="bg-surface border border-border rounded-card overflow-hidden shadow-1">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 border-b border-border text-xs text-fg-muted uppercase font-medium">
                <tr>
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredEvents.length > 0 &&
                        selectedForCompare.length === filteredEvents.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedForCompare(filteredEvents.map((ev) => ev.id));
                        } else {
                          setSelectedForCompare([]);
                        }
                      }}
                      className="rounded border-border text-primary accent-primary"
                    />
                  </th>
                  <th className="py-3 px-4">Event Details</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Window Timeline</th>
                  <th className="py-3 px-4">Submissions</th>
                  <th className="py-3 px-4">Capacity Utilization</th>
                  <th className="py-3 px-4">Replay Logs</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEvents.map((event) => {
                  const isComparing = selectedForCompare.includes(event.id);
                  const isOpen = event.status === "OPEN";

                  return (
                    <tr
                      key={event.id}
                      className={`hover:bg-surface-2/60 transition-colors ${
                        isComparing ? "bg-primary/5" : ""
                      }`}
                    >
                      <td className="py-4 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isComparing}
                          onChange={() => toggleCompare(event.id)}
                          className="rounded border-border text-primary accent-primary"
                        />
                      </td>

                      <td className="py-4 px-4">
                        <Link
                          href={`/faculty/replay/${event.id}`}
                          className="font-medium text-fg hover:text-primary-text transition-colors block"
                        >
                          {event.name}
                        </Link>
                        <div className="text-xs text-fg-muted mt-0.5">
                          {event.academicYear ? `Batch ${event.academicYear} · ` : ""}
                          {event.electiveCount} courses in {event.groupCount} groups
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isOpen
                              ? "bg-success/15 text-success-text"
                              : event.status === "CLOSED"
                              ? "bg-danger/10 text-danger-text"
                              : "bg-surface-2 text-fg-muted"
                          }`}
                        >
                          {isOpen && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />}
                          {event.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs text-fg-muted">
                        <div>
                          Opened: {event.openDate ? format(new Date(event.openDate), "MMM d, h:mm a") : "—"}
                        </div>
                        {event.closeDate && (
                          <div className="mt-0.5">
                            Closed: {format(new Date(event.closeDate), "MMM d, h:mm a")}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className="font-mono text-fg font-medium">{event.confirmedCount}</span>
                        <span className="text-xs text-fg-muted ml-1">students</span>
                      </td>

                      <td className="py-4 px-4 min-w-44">
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="text-fg-muted">{event.allocatedSeats}/{event.totalCapacity}</span>
                          <span className="font-mono text-fg font-medium">{event.capacityUtilization}%</span>
                        </div>
                        <Meter
                          value={event.allocatedSeats}
                          max={Math.max(1, event.totalCapacity)}
                          tone={
                            event.capacityUtilization >= 95
                              ? "danger"
                              : event.capacityUtilization >= 70
                              ? "warning"
                              : "primary"
                          }
                          label={`${event.name} capacity`}
                        />
                      </td>

                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-control bg-primary/10 text-primary-text font-mono text-xs">
                          <Activity className="w-3 h-3" />
                          {event.replayEventCount}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/faculty/replay/${event.id}`}>
                            <Button size="sm" variant="ghost" className="h-8 text-primary-text hover:bg-primary/10">
                              <PlayCircle className="w-4 h-4 mr-1" />
                              Replay
                            </Button>
                          </Link>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openActivityDrawer(event)}
                            className="h-8 text-fg-muted hover:text-fg hover:bg-surface-2"
                            title="Live Activity"
                          >
                            <Activity className="w-4 h-4" />
                          </Button>

                          <Menu>
                            <MenuTrigger
                              disabled={exportPendingId === event.id}
                              className="inline-flex items-center justify-center h-8 w-8 rounded-control text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors disabled:opacity-50"
                              title="Export"
                            >
                              {exportPendingId === event.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-primary-text" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </MenuTrigger>
                            <MenuContent align="end" className="w-52">
                              <MenuItem onClick={() => handleExport(event.id, "rankings")}>
                                <FileSpreadsheet className="w-4 h-4 mr-2 text-success-text" />
                                Export Rankings
                              </MenuItem>
                              <MenuItem onClick={() => handleExport(event.id, "audit_trail")}>
                                <Activity className="w-4 h-4 mr-2 text-primary-text" />
                                Export Audit Trail
                              </MenuItem>
                              <MenuItem onClick={() => handleExport(event.id, "json")}>
                                <FileJson className="w-4 h-4 mr-2 text-warning-text" />
                                Export JSON
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Sliding Live Activity Feed Drawer (`Sheet`) ── */}
      <Sheet open={activityDrawerOpen} onOpenChange={setActivityDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-surface border-l border-border">
          {/* Drawer Header */}
          <div className="p-6 border-b border-border bg-surface-2/60 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-text" />
                  <h2 className="text-lg font-medium text-fg">
                    {activityTargetEvent ? activityTargetEvent.name : "System Live Activity Stream"}
                  </h2>
                </div>
                <p className="text-xs text-fg-muted mt-1">
                  Chronological event pipeline recorded during live registrations.
                </p>
              </div>
            </div>

            {/* Drawer Controls Bar */}
            <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-border/60">
              {/* Event Type Filters */}
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "registered", label: "Enroll" },
                    { id: "changes", label: "Changes" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActivityFilter(f.id)}
                    className={`px-2.5 py-1 rounded-badge text-[11px] font-medium transition-colors ${
                      activityFilter === f.id
                        ? "bg-primary/20 text-primary-text"
                        : "text-fg-muted hover:bg-surface-3"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Auto Poll Toggle */}
              <button
                onClick={() => setAutoPollActivity(!autoPollActivity)}
                className={`text-[11px] flex items-center gap-1.5 px-2 py-1 rounded-control border transition-colors ${
                  autoPollActivity
                    ? "border-success/30 bg-success/10 text-success-text"
                    : "border-border bg-surface text-fg-muted"
                }`}
                title="Toggle live stream auto-refresh"
              >
                <Radio className={`w-3 h-3 ${autoPollActivity ? "animate-pulse" : ""}`} />
                {autoPollActivity ? "Streaming (4s)" : "Paused"}
              </button>
            </div>
          </div>

          {/* Drawer Event List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-thin">
            {activityLoading ? (
              <div className="py-12 text-center text-fg-muted text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary-text" />
                Streaming replay logs...
              </div>
            ) : filteredActivityStream.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border rounded-control text-fg-muted text-xs">
                No replay actions logged yet for this filter.
              </div>
            ) : (
              filteredActivityStream.map((item) => {
                const isReg = item.eventType === "STUDENT_REGISTERED";
                const isChange = item.eventType === "STUDENT_CHANGED_CHOICE";
                const isRelease = item.eventType === "SEAT_RELEASED";

                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-control border border-border bg-surface-2/40 hover:bg-surface-2 transition-colors text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-medium uppercase ${
                          isReg
                            ? "bg-success/15 text-success-text"
                            : isChange
                            ? "bg-primary/15 text-primary-text"
                            : isRelease
                            ? "bg-warning/15 text-warning-text"
                            : "bg-surface-3 text-fg-muted"
                        }`}
                      >
                        {item.eventType.replace(/_/g, " ")}
                      </span>

                      <span className="text-[11px] text-fg-muted">
                        {item.timestamp ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true }) : ""}
                      </span>
                    </div>

                    <div className="font-medium text-fg text-sm">
                      {item.studentName || "Anonymous Student"}
                    </div>

                    <div className="text-fg-muted truncate">
                      {item.subjectName || item.newSubject || item.oldSubject || "Elective Seat"}
                    </div>

                    {item.seatBefore != null && item.seatAfter != null && (
                      <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                        <span className="text-fg-subtle">Seat Transition:</span>
                        <span className="text-fg-muted">{item.seatBefore}</span>
                        <ArrowRight className="w-3 h-3 text-fg-subtle" />
                        <span className="text-fg font-medium">{item.seatAfter}</span>
                        <span
                          className={`ml-1 text-[10px] ${
                            item.seatAfter < item.seatBefore ? "text-danger-text" : "text-success-text"
                          }`}
                        >
                          ({item.seatAfter - item.seatBefore})
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Multi-Session Comparison Modal (`Dialog`) ── */}
      <Dialog open={compareModalOpen} onOpenChange={setCompareModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-primary-text" />
              Replay Session Comparison
            </DialogTitle>
            <DialogDescription>
              Comparing {compareEvents.length} selected registration events across turnout velocity, capacity fill, and audit activity.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border border-border rounded-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-fg-muted font-medium border-b border-border">
                <tr>
                  <th className="py-3 px-4">Metric</th>
                  {compareEvents.map((evt) => (
                    <th key={evt.id} className="py-3 px-4 text-fg font-semibold min-w-48">
                      {evt.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">Status</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          evt.status === "OPEN"
                            ? "bg-success/15 text-success-text"
                            : evt.status === "CLOSED"
                            ? "bg-danger/10 text-danger-text"
                            : "bg-surface-2 text-fg-muted"
                        }`}
                      >
                        {evt.status}
                      </span>
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">Academic Batch</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4 font-mono">
                      {evt.academicYear || "—"}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">Confirmed Students</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4 font-mono font-medium text-fg">
                      {evt.confirmedCount}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">Capacity Utilization</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4">
                      <div className="font-mono font-medium text-fg mb-1">
                        {evt.allocatedSeats} / {evt.totalCapacity} ({evt.capacityUtilization}%)
                      </div>
                      <Meter
                        value={evt.allocatedSeats}
                        max={Math.max(1, evt.totalCapacity)}
                        label={evt.name}
                      />
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">Electives Offered</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4">
                      {evt.electiveCount} courses in {evt.groupCount} groups
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">Replay Audit Logs</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4 font-mono text-primary-text font-medium">
                      {evt.replayEventCount} actions
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">First Entry Velocity</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4 font-mono">
                      {evt.secondsToFirstSubmission !== null ? `⚡ ${evt.secondsToFirstSubmission}s` : "—"}
                    </td>
                  ))}
                </tr>

                <tr>
                  <td className="py-3 px-4 font-medium text-fg-muted">Launch Replay</td>
                  {compareEvents.map((evt) => (
                    <td key={evt.id} className="py-3 px-4">
                      <Link href={`/faculty/replay/${evt.id}`}>
                        <Button size="sm" className="bg-primary text-canvas">
                          <PlayCircle className="w-3.5 h-3.5 mr-1" />
                          Replay
                        </Button>
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
