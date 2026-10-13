"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  FileText,
  GraduationCap,
  History,
  Layers,
  Radio,
  Search,
  ShieldCheck,
  UserMinus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cleanDisplayName, formatRemaining, humanizeEnum } from "@/lib/format";
import { useTicker } from "@/lib/use-server-clock";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { AnimatedNumber, Meter } from "@/components/ui/data-display";
import { Avatar } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
}

interface DashboardClientProps {
  session: UserSession;
  metrics: any;
  activeWorkspace?: string;
}

export function DashboardClient({ session, metrics, activeWorkspace = "COORDINATOR" }: DashboardClientProps) {
  if (!metrics) return null;

  const showTutorView = session.role === "CLASS_TUTOR" || (session.role === "COURSE_COORDINATOR" && activeWorkspace === "TUTOR");
  const showCoordinatorView = session.role === "COURSE_COORDINATOR" && activeWorkspace === "COORDINATOR";

  const roleDisplay =
    session.role === "SYSTEM_ADMIN"
      ? { label: "Admin", scope: "Full Control" }
      : session.role === "COURSE_COORDINATOR"
        ? activeWorkspace === "TUTOR"
          ? { label: "Faculty", scope: "Class Control" }
          : { label: "Course Controller", scope: "Semi Control" }
        : session.role === "CLASS_TUTOR"
          ? { label: "Faculty", scope: "Class Control" }
          : { label: "Students", scope: "Elective" };

  return (
    <div className="space-y-10 sm:space-y-12">
      <header className="space-y-3">
        <Badge tone="outline">
          {roleDisplay.label} · {roleDisplay.scope}
        </Badge>
        <h1 className="text-4xl font-light tracking-display text-fg">Welcome back, {cleanDisplayName(session.name)}</h1>
        <p className="max-w-xl text-fg-muted">
          {showTutorView
            ? "Your section at a glance: the live window, who has registered and who hasn't."
            : showCoordinatorView
              ? "Events, templates and electives across your programme."
              : "Accounts, events and the audit trail across Electify."}
        </p>
      </header>

      {showTutorView ? <TutorView m={metrics} /> : null}
      {showCoordinatorView ? <CoordinatorView m={metrics} /> : null}
      {session.role === "SYSTEM_ADMIN" ? <AdminView m={metrics} /> : null}
    </div>
  );
}

/* ─── Shared pieces ────────────────────────────────────────────────────── */

function Stat({ label, value, suffix, hint }: { label: string; value: number; suffix?: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-card bg-surface-2 p-4 sm:p-5">
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="mt-3 flex items-baseline gap-1 text-4xl font-light tracking-display text-fg">
        <AnimatedNumber value={Number(value) || 0} />
        {suffix ? <span className="text-lg text-fg-muted">{suffix}</span> : null}
      </p>
      {hint ? <div className="mt-3">{hint}</div> : null}
    </div>
  );
}

function Shortcuts({ items }: { items: { href: string; label: string; icon: LucideIcon }[] }) {
  return (
    <nav aria-label="Shortcuts" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className={cn(buttonVariants({ variant: "secondary", size: "md" }), "shrink-0 gap-2")}>
          <Icon className="size-4 text-fg-subtle" /> {label}
          <ArrowUpRight className="size-3.5 text-fg-subtle" />
        </Link>
      ))}
    </nav>
  );
}

function ListCard({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-1">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-medium text-fg">
          {title}
          {typeof count === "number" ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg-muted tabular-nums">{count}</span>
          ) : null}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

/* ─── Class tutor ─────────────────────────────────────────────────────── */

function WindowCountdown({ event }: { event: any }) {
  useTicker(true, 1000);
  if (!event) return null;
  const now = new Date();
  const open = event.openDate ? new Date(event.openDate) : null;
  const close = event.closeDate ? new Date(event.closeDate) : null;

  if (event.status === "PAUSED") {
    return <span className="text-warning-text font-medium">Window paused</span>;
  }
  if (event.status === "CLOSED" || (close && now >= close)) {
    return <span className="text-fg-muted">Window closed</span>;
  }
  if (open && now < open) {
    const remaining = Math.max(0, open.getTime() - now.getTime());
    return (
      <span className="text-fg-muted">
        Opens in <span className="font-mono tabular-nums text-fg" suppressHydrationWarning>{formatRemaining(remaining)}</span>
      </span>
    );
  }
  if (close && now < close) {
    const remaining = Math.max(0, close.getTime() - now.getTime());
    return (
      <span className="text-fg-muted">
        Closes in <span className="font-mono tabular-nums text-fg" suppressHydrationWarning>{formatRemaining(remaining)}</span>
      </span>
    );
  }
  if (event.status === "OPEN") {
    return <span className="text-live-text font-medium">Portal is open</span>;
  }
  return <span className="text-fg-muted">Not scheduled</span>;
}

function TutorView({ m }: { m: any }) {
  const event = m.activeEvent;
  const total = Number(m.totalStudents) || 0;
  const registered = Number(m.registeredCount) || 0;
  const pending = React.useMemo(() => m.pendingStudents ?? [], [m.pendingStudents]);
  const recent = m.recentRegistrations ?? [];

  const [searchPending, setSearchPending] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const filteredPending = React.useMemo(() => {
    if (!searchPending.trim()) return pending;
    const q = searchPending.toLowerCase();
    return pending.filter((s: any) =>
      s.name?.toLowerCase().includes(q) || s.registerNumber?.toLowerCase().includes(q)
    );
  }, [pending, searchPending]);

  const handleCopyEmails = React.useCallback(async () => {
    const emails = pending
      .map((s: any) => s.email)
      .filter(Boolean);

    if (emails.length === 0) {
      toast.info("No email addresses found for pending students.");
      return;
    }

    try {
      await navigator.clipboard.writeText(emails.join(", "));
      setCopied(true);
      toast.success(`Copied ${emails.length} student emails to clipboard!`);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy emails to clipboard");
    }
  }, [pending]);

  return (
    <div className="space-y-8">
      {/* Live window hero */}
      <section className="relative overflow-hidden rounded-panel bg-surface-2 p-5 sm:p-8">
        {event ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={event.status} />
                <WindowCountdown event={event} />
                {event.allowEditing ? (
                  <Badge tone="neutral">Edits allowed</Badge>
                ) : null}
              </div>
              <h2 className="max-w-2xl text-3xl font-light tracking-display text-fg">{event.name}</h2>
              <p className="text-sm text-fg-muted">
                {event.openDate ? `Opens ${format(new Date(event.openDate), "d MMM, h:mm a")}` : "Opening time not set"}
                {event.closeDate ? ` · Closes ${format(new Date(event.closeDate), "d MMM, h:mm a")}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/faculty/window" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Open live window <ArrowRight className="size-4" />
              </Link>
              <Link href="/faculty/tutor-reports" className={buttonVariants({ variant: "secondary", size: "lg" })}>
                Reports
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-light tracking-display text-fg">No registration window yet</h2>
              <p className="mt-1 text-sm text-fg-muted">Create one for your section, then set its opening and closing times.</p>
            </div>
            <Link href="/faculty/window" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Set up a window <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Registered"
          value={registered}
          suffix={`/ ${total}`}
          hint={
            <Meter value={registered} max={total} label="Students registered" tone="success" />
          }
        />
        <Stat 
          label="Students in section" 
          value={total} 
          hint={<p className="text-xs text-fg-subtle">{pending.length} yet to register</p>}
        />
        <Stat 
          label="Course options" 
          value={Number(m.courseOptionsCount) || 0} 
          hint={<p className="text-xs text-fg-subtle">{m.groupsCount || 1} elective {m.groupsCount === 1 ? "group" : "groups"}</p>}
        />
        <Stat
          label="Seats allocated"
          value={Number(m.allocationRate) || 0}
          suffix="%"
          hint={<Meter value={Number(m.allocationRate) || 0} max={100} label="Seats allocated" />}
        />
      </div>

      <Shortcuts
        items={[
          { href: "/faculty/monitor", label: "Live monitor", icon: Radio },
          { href: "/faculty/section", label: "Students", icon: GraduationCap },
          { href: "/faculty/tutor-electives", label: "Electives & baskets", icon: BookOpen },
          { href: "/faculty/replay", label: "Replay", icon: History },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard 
          title="Latest registrations" 
          count={recent.length}
          action={
            <Link href="/faculty/tutor-reports" className="text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
              All choices
            </Link>
          }
        >
          {recent.length > 0 ? (
            <ul className="divide-y divide-border">
              {recent.map((reg: any) => (
                <li key={reg.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={reg.studentName ?? "?"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-fg">{reg.studentName}</p>
                      {reg.studentRegNo ? (
                        <span className="font-mono text-2xs text-fg-subtle">{reg.studentRegNo}</span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-fg-muted mt-0.5">
                      {reg.courseCode ? (
                        <span className="font-mono text-fg-subtle mr-1.5 font-medium">{reg.courseCode}</span>
                      ) : null}
                      {reg.electiveName}
                      {reg.groupName ? (
                        <span className="text-fg-subtle ml-1.5">· {reg.groupName}</span>
                      ) : null}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-fg-subtle">
                    {reg.createdAt ? format(new Date(reg.createdAt), "h:mm a") : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={<CheckCircle2 />} title="No registrations yet" description="They'll appear here as students confirm." />
          )}
        </ListCard>

        <ListCard
          title="Yet to register"
          count={pending.length}
          action={
            <div className="flex items-center gap-3">
              {pending.length > 0 ? (
                <button
                  type="button"
                  onClick={handleCopyEmails}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg transition-colors"
                  title="Copy email addresses for all pending students"
                >
                  {copied ? <Check className="size-3.5 text-success-text" /> : <Copy className="size-3.5" />}
                  <span>{copied ? "Copied" : "Copy emails"}</span>
                </button>
              ) : null}
              <Link href="/faculty/tutor-reports" className="text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
                View all
              </Link>
            </div>
          }
        >
          {pending.length > 0 ? (
            <div>
              {/* Search filter for pending students */}
              <div className="border-b border-border bg-surface-2/40 px-3 py-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
                  <input
                    type="text"
                    value={searchPending}
                    onChange={(e) => setSearchPending(e.target.value)}
                    placeholder="Search pending by name or reg no..."
                    className="w-full rounded-control border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-fg placeholder:text-fg-subtle focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
              </div>

              {filteredPending.length > 0 ? (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto scrollbar-thin">
                  {filteredPending.map((s: any) => (
                    <li key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/30 transition-colors">
                      <Avatar name={s.name ?? "?"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{s.name}</p>
                        {s.email ? (
                          <p className="truncate text-2xs text-fg-subtle">{s.email}</p>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-mono text-xs text-fg-muted">{s.registerNumber}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-6 text-center text-xs text-fg-muted">
                  No pending students match &ldquo;{searchPending}&rdquo;
                </div>
              )}
            </div>
          ) : (
            <EmptyState compact icon={<UserMinus />} title="Everyone has registered" description="Nobody in your section is pending." />
          )}
        </ListCard>
      </div>
    </div>
  );
}

/* ─── Course controller ───────────────────────────────────────────────── */

function CoordinatorView({ m }: { m: any }) {
  const events = m.recentEvents ?? [];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registration events" value={Number(m.totalEvents) || 0} />
        <Stat label="Published / Open events" value={Number(m.activeEventsCount) || 0} />
        <Stat label="Event templates" value={Number(m.totalTemplates) || 0} />
        <Stat label="Electives" value={Number(m.totalElectives) || 0} />
      </div>

      <Shortcuts
        items={[
          { href: "/faculty/monitor", label: "Live monitor", icon: Radio },
          { href: "/faculty/events", label: "Registration events", icon: Calendar },
          { href: "/faculty/templates", label: "Event templates", icon: Layers },
          { href: "/faculty/electives", label: "Electives & baskets", icon: BookOpen },
          { href: "/faculty/reports", label: "Reports", icon: FileText },
        ]}
      />

      <ListCard
        title="Recent events"
        count={events.length}
        action={
          <Link href="/faculty/events" className="text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
            All events
          </Link>
        }
      >
        {events.length > 0 ? (
          <ul className="divide-y divide-border">
            {events.map((evt: any) => (
              <li key={evt.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{evt.name}</p>
                  <p className="text-xs text-fg-muted">
                    {evt.openDate ? `Opens ${format(new Date(evt.openDate), "d MMM yyyy")}` : "No opening date"}
                    {evt.closeDate ? ` · Closes ${format(new Date(evt.closeDate), "d MMM yyyy")}` : ""}
                  </p>
                </div>
                <StatusBadge status={evt.status} size="sm" />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<Calendar />} title="No events yet" description="Events created for your programme show up here." />
        )}
      </ListCard>
    </div>
  );
}

/* ─── Admin ───────────────────────────────────────────────────────────── */

function AdminView({ m }: { m: any }) {
  const logs = m.recentLogs ?? [];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 [&>*:first-child]:col-span-2 lg:[&>*:first-child]:col-span-1">
        <Stat label="Students" value={Number(m.totalStudents) || 0} />
        <Stat label="Course controllers" value={Number(m.totalFaculty) || 0} />
        <Stat label="Published / Open events" value={Number(m.activeEvents) || 0} />
      </div>

      <Shortcuts
        items={[
          { href: "/faculty/monitor", label: "Live monitor", icon: Radio },
          { href: "/faculty/users", label: "User access", icon: Users },
          { href: "/faculty/events", label: "Registration events", icon: Calendar },
          { href: "/faculty/audit", label: "Audit logs", icon: ShieldCheck },
          { href: "/faculty/replay", label: "Replay", icon: History },
        ]}
      />

      <ListCard
        title="Recent activity"
        action={
          <Link href="/faculty/audit" className="text-sm font-medium text-fg underline decoration-border-strong underline-offset-4 hover:decoration-fg">
            Audit log
          </Link>
        }
      >
        {logs.length > 0 ? (
          <ul className="divide-y divide-border">
            {logs.map((log: any) => (
              <li key={log.id} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-subtle">
                  <Activity className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{humanizeEnum(log.action)}</p>
                  <p className="truncate text-xs text-fg-muted">{log.userEmail ?? "System"}</p>
                </div>
                <span className="shrink-0 text-xs text-fg-subtle">{format(new Date(log.createdAt), "d MMM, h:mm a")}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<ShieldCheck />} title="No activity yet" />
        )}
      </ListCard>
    </div>
  );
}
