"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Radio,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  History,
  Download,
  Search,
  Layers,
  Copy,
  ChevronDown,
  Volume2,
  VolumeX,
  BookOpen,
  GraduationCap,
  X,
} from "lucide-react";

import {
  LiveMonitoringData,
  getLiveFeedUpdates,
  getUnregisteredStudentsList,
  toggleEventStatusFromMonitor,
} from "@/app/actions/monitor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatTimeAgo, formatDate } from "@/lib/format";

interface MonitorClientProps {
  initialData: LiveMonitoringData;
  userRole: string;
  userEmail: string;
}

export function MonitorClient({ initialData, userRole }: MonitorClientProps) {
  const router = useRouter();

  const [data, setData] = React.useState<LiveMonitoringData>(initialData);
  const [isAutoRefresh, setIsAutoRefresh] = React.useState<boolean>(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = React.useState<number>(5);
  const [countdown, setCountdown] = React.useState<number>(5);
  const [isManualRefreshing, setIsManualRefreshing] = React.useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(false);

  // Filter & Search states for Live Feed
  const [activityFilter, setActivityFilter] = React.useState<string>("ALL");
  const [activitySearch, setActivitySearch] = React.useState<string>("");
  const [courseSearch, setCourseSearch] = React.useState<string>("");

  // Modal for Unregistered Students
  const [unregisteredModalOpen, setUnregisteredModalOpen] = React.useState<boolean>(false);
  const [selectedSectionName, setSelectedSectionName] = React.useState<string>("");
  const [unregisteredStudents, setUnregisteredStudents] = React.useState<
    Array<{
      id: string;
      name: string;
      email: string;
      registerNumber: string | null;
      sectionName: string;
      sectionId: string;
    }>
  >([]);
  const [isLoadingUnregistered, setIsLoadingUnregistered] = React.useState<boolean>(false);
  const [unregisteredSearch, setUnregisteredSearch] = React.useState<string>("");

  // Confirm Status Change Dialog
  const [statusConfirmTarget, setStatusConfirmTarget] = React.useState<"OPEN" | "PAUSED" | "CLOSED" | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState<boolean>(false);

  // Audio chime synthesizer for live events
  const playAlertSound = React.useCallback(() => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio not permitted without interaction
    }
  }, [soundEnabled]);

  // Keep data synced when initialData changes from page routing
  React.useEffect(() => {
    setData(initialData);
  }, [initialData]);

  const isFetchingRef = React.useRef(false);
  const fetchRef = React.useRef<() => Promise<void>>(() => Promise.resolve());

  // Polling function
  const fetchLatestUpdates = React.useCallback(async () => {
    if (!data.event || isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const latestTimestamp = data.recentActivity[0]?.timestamp;
      const res = await getLiveFeedUpdates(data.event.id, latestTimestamp);

      if (res.success && res.data) {
        const { newEvents, kpis: freshKpis, latestCourseSeats, status } = res.data;

        // Execute side effects outside of the React state reducer
        const existingIds = new Set(data.recentActivity.map((e) => e.id));
        const filteredNew = newEvents.filter((e) => !existingIds.has(e.id));

        if (filteredNew.length > 0) {
          playAlertSound();
          toast.info(
            `${filteredNew.length} new registration update${filteredNew.length !== 1 ? "s" : ""} received`,
            { duration: 2500 }
          );
        }

        setData((prev) => {
          if (!prev.event) return prev;

          const currentExistingIds = new Set(prev.recentActivity.map((e) => e.id));
          const trulyNew = newEvents.filter((e) => !currentExistingIds.has(e.id));
          const updatedActivity = [...trulyNew, ...prev.recentActivity].slice(0, 100);

          // Update course seat stats
          const seatMap = new Map(latestCourseSeats.map((c) => [c.id, c]));
          const updatedCourses = prev.courses.map((course) => {
            const fresh = seatMap.get(course.id);
            if (!fresh) return course;
            const filledSeats = Math.max(0, course.maxSeats - fresh.availableSeats);
            const fillPercentage =
              course.maxSeats > 0 ? Math.min(100, Math.round((filledSeats / course.maxSeats) * 100)) : 0;
            return {
              ...course,
              availableSeats: fresh.availableSeats,
              filledSeats,
              fillPercentage,
              isFull: fresh.isFull,
            };
          });

          // Recalculate KPIs
          const registered =
            freshKpis.registeredStudents !== undefined
              ? freshKpis.registeredStudents
              : prev.kpis.registeredStudents;
          const totalEligible = prev.kpis.totalEligibleStudents;
          const completionRate =
            totalEligible > 0 ? Math.round((registered / totalEligible) * 100) : 0;
          const unregistered = Math.max(0, totalEligible - registered);

          return {
            ...prev,
            event: { ...prev.event, status },
            courses: updatedCourses,
            recentActivity: updatedActivity,
            kpis: {
              ...prev.kpis,
              registeredStudents: registered,
              unregisteredStudents: unregistered,
              completionRate,
            },
          };
        });
      }
    } catch (err) {
      console.error("Live feed poll error:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [data.event, data.recentActivity, playAlertSound]);

  React.useEffect(() => {
    fetchRef.current = fetchLatestUpdates;
  }, [fetchLatestUpdates]);

  // Auto-refresh countdown timer - runs cleanly on tick without side-effects inside state updater
  React.useEffect(() => {
    if (!isAutoRefresh || !data.event) return;

    setCountdown(refreshIntervalSec);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setTimeout(() => {
            fetchRef.current();
          }, 0);
          return refreshIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAutoRefresh, refreshIntervalSec, data.event?.id]);

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await fetchLatestUpdates();
    setCountdown(refreshIntervalSec);
    setIsManualRefreshing(false);
  };

  // Change Active Event
  const handleSelectEvent = (eventId: string) => {
    router.push(`/faculty/monitor?eventId=${eventId}`);
  };

  // Open Unregistered Students Modal
  const handleOpenUnregisteredModal = async (sectionId?: string) => {
    if (!data.event) return;
    const secName = sectionId ? data.sections.find((s) => s.sectionId === sectionId)?.sectionName || "" : "";
    setSelectedSectionName(secName);
    setUnregisteredModalOpen(true);
    setIsLoadingUnregistered(true);
    try {
      const res = await getUnregisteredStudentsList(data.event.id, sectionId);
      if (res.success && res.data) {
        setUnregisteredStudents(res.data);
      } else {
        toast.error(res.error || "Failed to load unregistered students.");
      }
    } catch {
      toast.error("Failed to fetch unregistered students.");
    } finally {
      setIsLoadingUnregistered(false);
    }
  };

  // Copy emails to clipboard
  const handleCopyEmails = () => {
    if (unregisteredStudents.length === 0) return;
    const emails = unregisteredStudents.map((s) => s.email).join(", ");
    navigator.clipboard.writeText(emails);
    toast.success(`Copied ${unregisteredStudents.length} student emails to clipboard!`);
  };

  // Export Unregistered Students to CSV
  const handleExportUnregisteredCSV = () => {
    if (unregisteredStudents.length === 0) return;
    const headers = ["Register Number", "Name", "Email", "Section"];
    const rows = unregisteredStudents.map((s) => [
      `"${s.registerNumber || "N/A"}"`,
      `"${s.name}"`,
      `"${s.email}"`,
      `"${s.sectionName}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `unregistered_students_${data.event?.name.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported pending students CSV.");
  };

  // Export Full Live Snapshot CSV
  const handleExportLiveSnapshot = () => {
    if (!data.event) return;
    const headers = ["ID", "Event Type", "Student Name", "Register No", "Section", "Course", "Timestamp"];
    const rows = data.recentActivity.map((item) => [
      `"${item.id}"`,
      `"${item.eventType}"`,
      `"${item.studentName || "N/A"}"`,
      `"${item.registerNumber || "N/A"}"`,
      `"${item.sectionName || "N/A"}"`,
      `"${item.newSubject || item.subjectName || "N/A"}"`,
      `"${item.timestamp}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `live_monitor_feed_${data.event.id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported live activity log to CSV.");
  };

  // Toggle Event Status
  const handleConfirmStatusChange = async () => {
    if (!data.event || !statusConfirmTarget) return;
    setIsUpdatingStatus(true);
    try {
      const res = await toggleEventStatusFromMonitor(data.event.id, statusConfirmTarget);
      if (res.success && res.newStatus) {
        toast.success(`Event window is now ${res.newStatus}.`);
        setData((prev) => ({
          ...prev,
          event: prev.event ? { ...prev.event, status: res.newStatus! } : null,
        }));
        setStatusConfirmTarget(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update event status.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update window status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Filtered Activity List
  const filteredActivity = React.useMemo(() => {
    let list = data.recentActivity;

    if (activityFilter === "SUBMISSIONS") {
      list = list.filter((a) => a.eventType === "STUDENT_REGISTERED");
    } else if (activityFilter === "SWAPS") {
      list = list.filter((a) => a.eventType === "STUDENT_CHANGED_CHOICE");
    } else if (activityFilter === "CANCELLATIONS") {
      list = list.filter((a) => a.eventType.includes("CANCELLED"));
    }

    if (activitySearch.trim()) {
      const q = activitySearch.toLowerCase();
      list = list.filter(
        (a) =>
          (a.studentName && a.studentName.toLowerCase().includes(q)) ||
          (a.registerNumber && a.registerNumber.toLowerCase().includes(q)) ||
          (a.subjectName && a.subjectName.toLowerCase().includes(q)) ||
          (a.newSubject && a.newSubject.toLowerCase().includes(q))
      );
    }

    return list;
  }, [data.recentActivity, activityFilter, activitySearch]);

  // Filtered Courses
  const filteredCourses = React.useMemo(() => {
    if (!courseSearch.trim()) return data.courses;
    const q = courseSearch.toLowerCase();
    return data.courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.courseCode && c.courseCode.toLowerCase().includes(q)) ||
        c.groupName.toLowerCase().includes(q)
    );
  }, [data.courses, courseSearch]);

  // Empty state if no events exist
  if (!data.event) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-light tracking-display text-fg">Live Registration Monitor</h1>
            <p className="text-fg-muted mt-1 text-sm">
              Real-time surveillance and telemetry for active student elective registrations.
            </p>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-panel p-12 text-center max-w-xl mx-auto my-12">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary-text flex items-center justify-center mx-auto mb-4">
            <Radio className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-medium text-fg">No Active Registration Events Found</h2>
          <p className="text-sm text-fg-muted mt-2 max-w-md mx-auto">
            There are currently no registration events assigned to your portal. Once an event is created or scheduled, you can monitor live student turnout and seat saturation here.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={() => router.push("/faculty/events")} className="bg-primary text-canvas">
              Go to Registration Events
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { event, kpis } = data;
  const isEventOpen = event.status === "OPEN";
  const isEventPaused = event.status === "PAUSED";

  return (
    <div className="space-y-6 pb-16">
      {/* ── Top Header & Real-time Broadcast Toolbar ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-light tracking-display text-fg">Live Registration Monitor</h1>
            <Badge tone="live" dot className="px-2.5 py-0.5 text-xs font-mono font-medium animate-pulse">
              LIVE TELEMETRY
            </Badge>
            <Badge tone="outline" className="border-border text-fg-muted text-xs capitalize">
              {userRole.replace(/_/g, " ").toLowerCase()}
            </Badge>
          </div>
          <p className="text-fg-muted text-sm mt-1.5 flex items-center gap-2">
            <span>Monitoring cohort for</span>
            <span className="font-medium text-fg">{event.name}</span>
            {event.programmeName && (
              <span className="text-xs text-primary-text font-mono">({event.programmeCode || event.programmeName})</span>
            )}
          </p>
        </div>

        {/* Global Monitor Controls Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active Event Selector */}
          <div className="relative">
            <select
              value={event.id}
              onChange={(e) => handleSelectEvent(e.target.value)}
              className="bg-surface-2 border border-border-strong text-fg text-xs rounded-control pl-3 pr-8 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer appearance-none shadow-sm"
            >
              {data.eventsList.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  [{evt.status}] {evt.name} ({evt.totalStudents} students)
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted pointer-events-none" />
          </div>

          {/* Sound Alerts Toggle */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) {
                toast.success("Live submission sound chimes enabled.");
              }
            }}
            className={`border-border ${soundEnabled ? "text-primary-text bg-primary/10 border-primary/30" : "text-fg-muted hover:text-fg"}`}
            title={soundEnabled ? "Disable audio chimes on new registration" : "Enable audio chimes on new registration"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>

          {/* Auto Refresh Toggle & Progress */}
          <div className="flex items-center bg-surface-2 border border-border rounded-control p-1 text-xs">
            <button
              type="button"
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-badge text-xs font-medium transition-all ${
                isAutoRefresh ? "bg-primary/15 text-primary-text" : "text-fg-muted hover:text-fg"
              }`}
            >
              {isAutoRefresh ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
              <span>{isAutoRefresh ? `Live (${countdown}s)` : "Paused"}</span>
            </button>

            {isAutoRefresh && (
              <select
                value={refreshIntervalSec}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRefreshIntervalSec(val);
                  setCountdown(val);
                }}
                className="bg-transparent text-fg-muted text-[11px] px-1.5 focus:outline-none cursor-pointer hover:text-fg font-mono"
              >
                <option value={3} className="bg-surface text-fg">3s</option>
                <option value={5} className="bg-surface text-fg">5s</option>
                <option value={10} className="bg-surface text-fg">10s</option>
                <option value={30} className="bg-surface text-fg">30s</option>
              </select>
            )}
          </div>

          {/* Manual Refresh Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleManualRefresh}
            disabled={isManualRefreshing}
            className="border-border text-fg hover:bg-surface-3"
            title="Poll immediate updates"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isManualRefreshing ? "animate-spin" : ""}`} />
            Sync
          </Button>

          {/* Direct Replay Studio Link */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/faculty/replay/${event.id}`)}
            className="border-border text-fg hover:bg-surface-3 font-medium"
            title="Launch Replay Studio"
          >
            <History className="w-3.5 h-3.5 mr-1.5 text-primary-text" />
            Replay Studio
          </Button>
        </div>
      </div>

      {/* ── Status Banner & Emergency Window Control Bar ── */}
      <div className="bg-surface border border-border rounded-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full shrink-0 ${
              isEventOpen
                ? "bg-emerald-500 ring-4 ring-emerald-500/20"
                : isEventPaused
                ? "bg-amber-500 ring-4 ring-amber-500/20"
                : "bg-zinc-500"
            }`}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-fg uppercase tracking-wider font-mono">
                Status: {event.status}
              </span>
              {event.closeDate && (
                <span className="text-xs text-fg-muted font-mono">
                  · Closes {formatDate(new Date(event.closeDate))}
                </span>
              )}
            </div>
            <p className="text-xs text-fg-muted mt-0.5">
              {isEventOpen
                ? "Portal is actively accepting elective submissions and choice mutations."
                : isEventPaused
                ? "Window is currently on hold. Students cannot submit or alter electives."
                : "Window is closed for new student submissions."}
            </p>
          </div>
        </div>

        {/* Rapid Status Actions */}
        <div className="flex items-center gap-2">
          {isEventOpen ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatusConfirmTarget("PAUSED")}
              className="border-warning/30 text-warning-text hover:bg-warning/10 text-xs font-medium"
            >
              <Pause className="w-3.5 h-3.5 mr-1.5" />
              Pause Window
            </Button>
          ) : isEventPaused ? (
            <Button
              size="sm"
              onClick={() => setStatusConfirmTarget("OPEN")}
              className="bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-medium shadow-sm"
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Resume Window
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatusConfirmTarget("OPEN")}
              className="border-primary/30 text-primary-text hover:bg-primary/10 text-xs font-medium"
            >
              Reopen Window
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleExportLiveSnapshot}
            className="border-border text-fg hover:bg-surface-2 text-xs"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export Stream (CSV)
          </Button>
        </div>
      </div>

      {/* ── Key Performance Telemetry / KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Student Turnout */}
        <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden group hover:border-border-strong transition-all">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="font-medium">Student Turnout</span>
            <Users className="w-4 h-4 text-primary-text" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-light font-mono text-fg">{kpis.registeredStudents}</span>
            <span className="text-xs text-fg-muted">/ {kpis.totalEligibleStudents} eligible</span>
          </div>

          {/* Progress bar */}
          <div className="mt-3 space-y-1">
            <div className="h-2 w-full bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, kpis.completionRate)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-fg-muted pt-0.5">
              <span className="text-primary-text font-medium">{kpis.completionRate}% completed</span>
              <button
                type="button"
                onClick={() => handleOpenUnregisteredModal()}
                className="hover:underline text-fg font-medium"
              >
                {kpis.unregisteredStudents} pending &rarr;
              </button>
            </div>
          </div>
        </div>

        {/* KPI 2: Live Velocity */}
        <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden hover:border-border-strong transition-all">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="font-medium">Submission Velocity</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-light font-mono text-fg">{kpis.velocityRpm}</span>
            <span className="text-xs text-fg-muted">RPM (req/min)</span>
          </div>
          <div className="mt-3 text-[11px] text-fg-muted flex items-center justify-between pt-1">
            <span>Last 5 mins: <strong className="text-fg font-mono">{kpis.registrationsLast5Min}</strong></span>
            <span>Last 1 hr: <strong className="text-fg font-mono">{kpis.registrationsLastHour}</strong></span>
          </div>
        </div>

        {/* KPI 3: Seat Capacity Filled */}
        <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden hover:border-border-strong transition-all">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="font-medium">Seat Saturation</span>
            <Layers className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-light font-mono text-fg">{kpis.filledSeats}</span>
            <span className="text-xs text-fg-muted">/ {kpis.totalCapacity} seats</span>
          </div>
          <div className="mt-3 space-y-1">
            <div className="h-2 w-full bg-surface-3 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  kpis.seatUtilizationRate >= 90
                    ? "bg-rose-500"
                    : kpis.seatUtilizationRate >= 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, kpis.seatUtilizationRate)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-fg-muted pt-0.5">
              <span>{kpis.seatUtilizationRate}% capacity taken</span>
              <span className="text-fg font-mono">{kpis.availableSeats} left</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Full Courses */}
        <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden hover:border-border-strong transition-all">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="font-medium">Full Courses</span>
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-light font-mono text-fg">{kpis.fullCoursesCount}</span>
            <span className="text-xs text-fg-muted">/ {kpis.totalCoursesCount} maxed</span>
          </div>
          <p className="mt-3 pt-1 text-[11px] text-fg-muted">Full courses accept no new registrations.</p>
        </div>
      </div>

      {/* ── Main Layout: Live Stream Feed (Left) & Course Saturation Heatmap (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Real-time Live Activity Feed (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm">
            {/* Live Stream Panel Header */}
            <div className="p-4 border-b border-border bg-surface-2/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h2 className="text-base font-medium text-fg">Live Activity Stream</h2>
                <span className="text-xs text-fg-muted font-mono">
                  ({filteredActivity.length} event{filteredActivity.length !== 1 ? "s" : ""})
                </span>
              </div>

              {/* Activity Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {[
                  { key: "ALL", label: "All" },
                  { key: "SUBMISSIONS", label: "Confirmed" },
                  { key: "SWAPS", label: "Swaps" },
                  { key: "CANCELLATIONS", label: "Cancelled" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActivityFilter(tab.key)}
                    className={`px-2 py-0.5 rounded-control text-xs font-medium transition-all shrink-0 ${
                      activityFilter === tab.key
                        ? "bg-primary/15 text-primary-text border border-primary/30"
                        : "text-fg-muted hover:text-fg hover:bg-surface-2"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stream Search Bar */}
            <div className="p-3 border-b border-border/70 bg-surface">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted" />
                <input
                  type="text"
                  placeholder="Filter by student name, register number, or elective..."
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 bg-surface-2 border border-border rounded-control text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                {activitySearch && (
                  <button
                    onClick={() => setActivitySearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Live Stream Items */}
            <div className="divide-y divide-border/60 max-h-[600px] overflow-y-auto font-sans">
              {filteredActivity.length === 0 ? (
                <div className="p-8 text-center text-fg-muted text-xs">
                  <Clock className="w-8 h-8 text-fg-subtle mx-auto mb-2 opacity-50" />
                  <span>No live events matching the current filter.</span>
                </div>
              ) : (
                filteredActivity.map((item) => {
                  const isNewSubmission = item.eventType === "STUDENT_REGISTERED";
                  const isSwap = item.eventType === "STUDENT_CHANGED_CHOICE";
                  const isCancellation = item.eventType.includes("CANCELLED");

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 hover:bg-surface-2/60 transition-colors flex items-start gap-3 text-xs"
                    >
                      {/* Event Type Icon Indicator */}
                      <div className="mt-0.5 shrink-0">
                        {isNewSubmission && (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {isSwap && (
                          <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {isCancellation && (
                          <div className="w-7 h-7 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-medium text-fg truncate">
                              {item.studentName || "Student"}
                            </span>
                            {item.registerNumber && (
                              <span className="text-[11px] text-fg-muted font-mono">
                                ({item.registerNumber})
                              </span>
                            )}
                            {item.sectionName && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-badge bg-surface-2 border border-border text-fg-muted">
                                {item.sectionName}
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-fg-muted shrink-0 font-mono">
                            {formatTimeAgo(new Date(item.timestamp))}
                          </span>
                        </div>

                        {/* Subject Mutation Description */}
                        <div className="mt-1 text-fg-muted text-[11px]">
                          {isNewSubmission && (
                            <div className="flex items-center gap-1.5 text-emerald-400">
                              <span>Registered for</span>
                              <strong className="text-fg font-normal truncate">
                                {item.subjectName || item.newSubject || "Elective Course"}
                              </strong>
                            </div>
                          )}

                          {isSwap && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-fg-muted">Swapped:</span>
                              <span className="line-through text-fg-subtle truncate max-w-40">
                                {item.oldSubject || "Previous"}
                              </span>
                              <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
                              <strong className="text-fg font-normal truncate max-w-44 text-blue-400">
                                {item.newSubject || item.subjectName}
                              </strong>
                            </div>
                          )}

                          {isCancellation && (
                            <div className="flex items-center gap-1.5 text-rose-400">
                              <span>Cancelled registration choice for</span>
                              <strong className="text-fg font-normal truncate">
                                {item.subjectName || "Elective Course"}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Course Seat Saturation & Section Leaderboard (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Section Participation Breakdown */}
          <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-surface-2/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary-text" />
                <h2 className="text-sm font-medium text-fg">Section Participation</h2>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenUnregisteredModal()}
                className="text-xs text-primary-text hover:underline p-0 h-auto"
              >
                View Pending
              </Button>
            </div>

            <div className="p-4 space-y-3.5">
              {data.sections.length === 0 ? (
                <p className="text-xs text-fg-muted text-center py-2">No sections linked.</p>
              ) : (
                data.sections.map((sec) => (
                  <div key={sec.sectionId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-fg">{sec.sectionName}</span>
                        <span className="text-[11px] text-fg-muted font-mono">
                          ({sec.registeredCount}/{sec.totalStudents})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-fg font-medium">{sec.completionRate}%</span>
                        {sec.unregisteredCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleOpenUnregisteredModal(sec.sectionId)}
                            className="text-[10px] text-primary-text hover:underline"
                          >
                            {sec.unregisteredCount} pending
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${Math.min(100, sec.completionRate)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Elective Course Saturation Matrix */}
          <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border bg-surface-2/40 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary-text" />
                <h2 className="text-sm font-medium text-fg">Seat Saturation by Elective</h2>
              </div>
              <span className="text-xs text-fg-muted font-mono">
                {data.courses.length} courses
              </span>
            </div>

            {/* Quick Course Search */}
            <div className="p-3 border-b border-border/70 bg-surface">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted" />
                <input
                  type="text"
                  placeholder="Filter courses..."
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-border rounded-control text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
              </div>
            </div>

            {/* Course Saturation Cards List */}
            <div className="divide-y divide-border/60 max-h-[500px] overflow-y-auto">
              {filteredCourses.length === 0 ? (
                <div className="p-6 text-center text-xs text-fg-muted">
                  No electives match the search.
                </div>
              ) : (
                filteredCourses.map((c) => {
                  const isCritical = c.fillPercentage >= 95;
                  const isWarning = c.fillPercentage >= 75 && c.fillPercentage < 95;

                  return (
                    <div key={c.id} className="p-3.5 space-y-2 hover:bg-surface-2/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-xs text-fg truncate">{c.name}</span>
                            {c.courseCode && (
                              <span className="text-[10px] px-1 rounded-badge bg-surface-2 border border-border text-fg-muted font-mono">
                                {c.courseCode}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-fg-muted block truncate mt-0.5">
                            {c.groupName}
                          </span>
                        </div>

                        {/* Status Badge */}
                        {c.isFull ? (
                          <Badge tone="danger" className="text-[10px] py-0 px-1 font-mono uppercase">
                            FULL
                          </Badge>
                        ) : isCritical ? (
                          <Badge tone="warning" className="text-[10px] py-0 px-1 font-mono uppercase">
                            ALMOST FULL
                          </Badge>
                        ) : null}
                      </div>

                      {/* Progress Bar & Seat Details */}
                      <div className="space-y-1">
                        <div className="h-1.5 w-full bg-surface-3 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              c.isFull
                                ? "bg-rose-500"
                                : isWarning
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, c.fillPercentage)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-fg-muted font-mono">
                          <span>
                            {c.filledSeats} / {c.maxSeats} taken ({c.fillPercentage}%)
                          </span>
                          <span>
                            {c.availableSeats > 0 ? (
                              <strong className="text-emerald-400 font-normal">{c.availableSeats} open</strong>
                            ) : (
                              <span className="text-rose-400">0 open</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal: Unregistered / Pending Students ── */}
      {unregisteredModalOpen && (
        <Dialog open={true} onOpenChange={() => setUnregisteredModalOpen(false)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-text" />
                Unregistered Students
              </DialogTitle>
              <DialogDescription>
                {selectedSectionName
                  ? `Showing pending students in ${selectedSectionName}.`
                  : "Students in this cohort who have not yet submitted their elective preferences."}
              </DialogDescription>
            </DialogHeader>

            {/* Actions Bar */}
            <div className="flex items-center justify-between gap-3 py-2 border-b border-border">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted" />
                <input
                  type="text"
                  placeholder="Search student or register number..."
                  value={unregisteredSearch}
                  onChange={(e) => setUnregisteredSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-surface-2 border border-border rounded-control text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyEmails}
                  disabled={unregisteredStudents.length === 0}
                  className="border-border text-fg text-xs"
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy Emails ({unregisteredStudents.length})
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportUnregisteredCSV}
                  disabled={unregisteredStudents.length === 0}
                  className="border-border text-fg text-xs"
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Export CSV
                </Button>
              </div>
            </div>

            {/* Students List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60 py-2 min-h-60 max-h-96">
              {isLoadingUnregistered ? (
                <div className="p-8 text-center text-xs text-fg-muted">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-text" />
                  <span>Loading unregistered student roster...</span>
                </div>
              ) : unregisteredStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-fg-muted">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <span className="font-medium text-fg block text-sm">100% Registration Complete!</span>
                  <span>All students in this cohort have submitted their choices.</span>
                </div>
              ) : (
                unregisteredStudents
                  .filter((s) => {
                    if (!unregisteredSearch.trim()) return true;
                    const q = unregisteredSearch.toLowerCase();
                    return (
                      s.name.toLowerCase().includes(q) ||
                      (s.registerNumber && s.registerNumber.toLowerCase().includes(q)) ||
                      s.email.toLowerCase().includes(q)
                    );
                  })
                  .map((s) => (
                    <div key={s.id} className="py-2.5 px-3 flex items-center justify-between text-xs hover:bg-surface-2/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-fg">{s.name}</span>
                          <span className="text-fg-muted font-mono text-[11px]">{s.registerNumber || "No Reg No"}</span>
                        </div>
                        <span className="text-fg-muted text-[11px] block mt-0.5">{s.email}</span>
                      </div>
                      <Badge tone="outline" className="border-border text-fg-muted text-[11px]">
                        {s.sectionName}
                      </Badge>
                    </div>
                  ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm Status Change Dialog ── */}
      {statusConfirmTarget && (
        <ConfirmDialog
          open={true}
          onOpenChange={() => setStatusConfirmTarget(null)}
          title={`Set Registration Window to ${statusConfirmTarget}`}
          tone={statusConfirmTarget === "CLOSED" ? "danger" : "default"}
          confirmLabel={`Confirm ${statusConfirmTarget}`}
          onConfirm={handleConfirmStatusChange}
          description={
            statusConfirmTarget === "PAUSED"
              ? "Pausing the window will temporarily prevent students from submitting choices until you resume it."
              : statusConfirmTarget === "OPEN"
              ? "Reopening or resuming the window will allow eligible students to make elective selections."
              : "Closing the window will seal registrations and mark this session as finalized."
          }
          impact={[
            {
              label: "Registration Event",
              value: event.name,
            },
            {
              label: "Current Status",
              value: event.status,
            },
            {
              label: "New Status",
              value: statusConfirmTarget,
              tone: statusConfirmTarget === "PAUSED" ? "warning" : "neutral",
            },
          ]}
        />
      )}
    </div>
  );
}
