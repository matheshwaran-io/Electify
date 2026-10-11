"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { resetRegistrationEvent } from "@/app/actions/coordinator";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";

type Event = {
  id: string;
  name: string;
  academicYear: string | null;
  status: string;
  openDate: Date | null;
  closeDate: Date | null;
  createdAt: Date;
  programmeName: string | null;
  programmeCode: string | null;
};

export function EventsClient({ events }: { events: Event[] }) {
  const router = useRouter();
  const [resetting, setResetting] = useState<Event | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleReset = async () => {
    if (!resetting) return;
    try {
      await resetRegistrationEvent(resetting.id);
      router.refresh();
      toast.success(`Reset ${resetting.name}. All students must register again.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset event");
      throw err;
    }
  };

  const columns: Column<Event>[] = [
    {
      id: "name",
      header: "Event",
      mobile: "title",
      hideable: false,
      cell: (e) => <span className="font-medium text-fg">{e.name}</span>,
      sortValue: (e) => e.name,
      searchValue: (e) => e.name,
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
    { id: "year", header: "Academic year", cell: (e) => <span className="text-fg-muted">{e.academicYear ?? "—"}</span>, sortValue: (e) => e.academicYear },
    { id: "status", header: "Status", cell: (e) => <StatusBadge status={e.status} size="sm" />, sortValue: (e) => e.status },
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
        <Button
          size="sm"
          variant="destructive-soft"
          onClick={() => {
            setResetting(e);
            setConfirmOpen(true);
          }}
        >
          <RotateCcw /> Reset data
        </Button>
      ),
    },
  ];

  const statuses = [...new Set(events.map((e) => e.status))];
  const filters: FilterDef<Event>[] =
    statuses.length > 1
      ? [{ id: "status", label: "Status", options: statuses.map((s) => ({ value: s, label: statusLabel(s) })), predicate: (e, v) => e.status === v }]
      : [];

  return (
    <div>
      <PageHeader title="Registration events" description="Every registration event across all programmes." />

      <DataTable
        data={events}
        columns={columns}
        getRowId={(e) => e.id}
        caption="Registration events"
        searchPlaceholder="Search events or programmes"
        filters={filters}
        empty={<EmptyState compact icon={<Calendar />} title="No events found" description="Events created by course controllers show up here." />}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
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
    </div>
  );
}
