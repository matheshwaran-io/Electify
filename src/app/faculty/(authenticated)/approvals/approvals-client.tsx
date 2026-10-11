"use client";

import { useState } from "react";
import { FileText, Search, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Avatar, PageHeader } from "@/components/ui/layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";

type Registration = {
  id: string;
  studentId: string;
  studentName: string;
  registerNumber: string | null;
  submittedAt: Date;
  electiveName: string;
  courseCode: string | null;
  groupName: string;
  eventName: string;
  eventStatus: string;
};

export function ApprovalsClient({ registrations }: { registrations: Registration[] }) {
  const [search, setSearch] = useState("");

  // Group by student
  const byStudent = registrations.reduce<Record<string, Registration[]>>((acc, r) => {
    if (!acc[r.studentId]) acc[r.studentId] = [];
    acc[r.studentId].push(r);
    return acc;
  }, {});

  const q = search.trim().toLowerCase();
  const groups = Object.entries(byStudent).filter(
    ([, regs]) => !q || regs[0].studentName.toLowerCase().includes(q) || (regs[0].registerNumber ?? "").toLowerCase().includes(q)
  );

  return (
    <div>
      <PageHeader
        title="Registrations"
        description={`${Object.keys(byStudent).length} students have submitted registrations.`}
      />

      {registrations.length === 0 ? (
        <EmptyState icon={<FileText />} title="No registrations yet" description="Submitted choices appear here as students confirm." />
      ) : (
        <>
          <div className="mb-5 sm:max-w-sm">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or register number"
              aria-label="Search students"
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

          {groups.length === 0 ? (
            <EmptyState compact icon={<Search />} title="No students match" description="Try a different name or register number." />
          ) : (
            <ul className="space-y-3">
              {groups.map(([studentId, regs], i) => (
                <li
                  key={studentId}
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  className="overflow-hidden rounded-card border border-border bg-surface shadow-1 animate-enter"
                >
                  <div className="flex items-center gap-3 bg-surface-2 px-4 py-3.5 sm:px-5">
                    <Avatar name={regs[0].studentName} size="lg" className="bg-surface" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-fg">{regs[0].studentName}</p>
                      <p className="font-mono text-xs text-fg-muted">{regs[0].registerNumber ?? "—"}</p>
                    </div>
                    <Badge tone="success" dot className="shrink-0">
                      <span className="font-mono tabular-nums">{regs.length}</span>
                      <span className="hidden sm:inline">registered</span>
                    </Badge>
                  </div>

                  <ul className="divide-y divide-border">
                    {regs.map((reg) => (
                      <li key={reg.id} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-fg">{reg.electiveName}</p>
                          <p className="text-xs text-fg-muted">
                            {reg.courseCode ? <span className="font-mono">{reg.courseCode} · </span> : null}
                            {reg.groupName} · {reg.eventName}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={reg.eventStatus} size="sm" />
                          <time dateTime={new Date(reg.submittedAt).toISOString()} className="whitespace-nowrap text-xs text-fg-subtle">
                            {formatDateTime(reg.submittedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
