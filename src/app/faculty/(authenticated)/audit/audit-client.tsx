"use client";

import { Activity } from "lucide-react";
import { formatDateTime, humanizeEnum } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";

type AuditLog = { id: string; action: string; userId: string | null; userEmail: string | null; userRole: string | null; ipAddress: string | null; createdAt: Date };
type Data = { logs: AuditLog[]; total: number; pages: number; page: number };

const columns: Column<AuditLog>[] = [
  {
    id: "action",
    header: "Action",
    mobile: "title",
    hideable: false,
    cell: (log) => (
      <span className="flex items-center gap-2.5">
        <span aria-hidden className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
          <Activity className="size-3.5" />
        </span>
        <span className="font-medium text-fg">{humanizeEnum(log.action)}</span>
      </span>
    ),
    sortValue: (log) => log.action,
    searchValue: (log) => humanizeEnum(log.action),
  },
  {
    id: "user",
    header: "User",
    mobile: "subtitle",
    cell: (log) => <span className="text-fg-muted">{log.userEmail ?? "System"}</span>,
    sortValue: (log) => log.userEmail,
    searchValue: (log) => log.userEmail,
  },
  {
    id: "role",
    header: "Role",
    mobileWide: true,
    cell: (log) => (log.userRole ? <StatusBadge status={log.userRole} size="sm" /> : <span className="text-fg-subtle">—</span>),
  },
  {
    id: "ip",
    header: "IP address",
    cell: (log) => <span className="font-mono text-xs text-fg-muted">{log.ipAddress ?? "—"}</span>,
    searchValue: (log) => log.ipAddress,
  },
  {
    id: "at",
    header: "Time",
    cell: (log) => <span className="whitespace-nowrap text-fg-muted">{formatDateTime(log.createdAt)}</span>,
    sortValue: (log) => new Date(log.createdAt).getTime(),
  },
];

export function AuditClient({ data }: { data: Data }) {
  const actions = [...new Set(data.logs.map((l) => l.action))].sort();
  const filters: FilterDef<AuditLog>[] =
    actions.length > 1
      ? [{ id: "action", label: "Action", options: actions.map((a) => ({ value: a, label: humanizeEnum(a) })), predicate: (l, v) => l.action === v }]
      : [];

  return (
    <div>
      <PageHeader
        title="Audit log"
        description={
          data.total > data.logs.length
            ? `${data.total} events recorded. Showing the most recent ${data.logs.length}.`
            : `${data.total} events recorded.`
        }
        actions={
          data.pages > 1 ? (
            <Badge tone="outline" className="font-mono tabular-nums">
              Page {data.page} of {data.pages}
            </Badge>
          ) : null
        }
      />

      <DataTable
        data={data.logs}
        columns={columns}
        getRowId={(l) => l.id}
        caption="Audit log entries"
        searchPlaceholder="Search action, user or IP"
        filters={filters}
        pageSize={25}
        empty={<EmptyState compact icon={<Activity />} title="No audit events yet" description="Sign-ins and admin actions will appear here." />}
      />
    </div>
  );
}
