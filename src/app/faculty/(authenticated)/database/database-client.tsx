"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, BookOpen, Database, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { resetSectionRegistrationEvent } from "@/app/actions/tutor";
import { deleteAllRegistrations, deleteAllStudents, deleteAllSubjects, resetAllSeats, archiveEvent } from "@/app/actions/database";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/feedback";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog, type ImpactRow } from "@/components/ui/confirm-dialog";

type Action = {
  key: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  tone: "warning" | "danger";
  actionFn: () => Promise<void>;
  requiresEvent?: boolean;
  hidden?: boolean;
};

export function DatabaseClient({ events, role }: { events: any[]; role: string }) {
  const router = useRouter();
  const [active, setActive] = useState<Action | null>(null);
  const [open, setOpen] = useState(false);

  const isAdminOrCoord = role === "SYSTEM_ADMIN" || role === "COURSE_COORDINATOR";

  const event = events[0];

  const actions: Action[] = [
    {
      key: "reset_section",
      title: "Reset section data",
      desc: "Clears all registrations for your assigned section for the current event.",
      icon: Users,
      tone: "warning",
      actionFn: async () => await resetSectionRegistrationEvent(event.id),
    },
    {
      key: "archive_event",
      title: "Archive event",
      desc: "Marks the event as finalized and read-only.",
      icon: Archive,
      tone: "warning",
      actionFn: async () => await archiveEvent(event.id),
    },
    {
      key: "delete_registrations",
      title: "Delete all registrations",
      desc: "Hard deletes all registrations and resets seats across all sections.",
      icon: Trash2,
      tone: "danger",
      actionFn: async () => await deleteAllRegistrations(event.id),
      hidden: !isAdminOrCoord,
    },
    {
      key: "reset_seats",
      title: "Reset all seats",
      desc: "Drops all registrations and resets subject seat limits to maximum.",
      icon: Database,
      tone: "danger",
      actionFn: async () => await resetAllSeats(event.id),
      hidden: !isAdminOrCoord,
    },
    {
      key: "delete_students",
      title: "Delete all students",
      desc: "Hard deletes all student accounts. Cascades to their registrations.",
      icon: Users,
      tone: "danger",
      actionFn: async () => await deleteAllStudents(),
      requiresEvent: false,
      hidden: !isAdminOrCoord,
    },
    {
      key: "delete_subjects",
      title: "Delete all subjects",
      desc: "Hard deletes all electives assigned to this event.",
      icon: BookOpen,
      tone: "danger",
      actionFn: async () => await deleteAllSubjects(event.id),
      hidden: !isAdminOrCoord,
    },
  ];

  function choose(action: Action) {
    if ((action.requiresEvent ?? true) && !event) {
      toast.error("No active registration event found.");
      return;
    }
    setActive(action);
    setOpen(true);
  }

  async function run() {
    if (!active) return;
    try {
      await active.actionFn();
      toast.success("Action successful.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Operation failed.");
      throw err;
    }
  }

  const impact: ImpactRow[] = [];
  if (active && (active.requiresEvent ?? true) && event) impact.push({ label: "Event", value: event.name ?? "Current event" });

  const visible = actions.filter((a) => !a.hidden);

  return (
    <div>
      <PageHeader title="Database" description="Resets and deletions for the current registration event." />

      <div className="space-y-5">
        <Callout tone="danger" icon={<AlertTriangle />} title="Danger zone">
          Everything on this page is permanent. Each action asks you to type CONFIRM first.
        </Callout>

        <section aria-label="Current event" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card bg-surface-2 px-4 py-3.5 sm:px-5">
          <span className="text-sm text-fg-muted">Current event</span>
          {event ? (
            <>
              <span className="text-sm font-medium text-fg">{event.name}</span>
              {event.status ? <StatusBadge status={event.status} size="sm" /> : null}
            </>
          ) : (
            <span className="text-sm text-fg-subtle">None found. Only account-wide actions are available.</span>
          )}
        </section>

        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-1">
          {visible.map((action) => {
            const Icon = action.icon;
            const blocked = (action.requiresEvent ?? true) && !event;
            return (
              <li key={action.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                      action.tone === "danger" ? "bg-danger/10 text-danger-text" : "bg-warning/10 text-warning-text"
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium text-fg">{action.title}</h2>
                    <p className="mt-0.5 text-sm text-fg-muted">{action.desc}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={action.tone === "danger" ? "destructive-soft" : "secondary"}
                  disabled={blocked}
                  onClick={() => choose(action)}
                  className="self-start sm:self-auto"
                >
                  {action.title}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="danger"
        title={active ? `${active.title}?` : "Confirm"}
        description={active?.desc}
        impact={impact}
        requireText="CONFIRM"
        confirmLabel={active?.title ?? "Confirm"}
        onConfirm={run}
      />
    </div>
  );
}
