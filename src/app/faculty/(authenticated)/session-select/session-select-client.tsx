"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, Server, Settings2 } from "lucide-react";
import { selectAcademicSession } from "@/app/actions/workspace";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { buttonVariants } from "@/components/ui/button";

export type SessionCard = {
  id: string;
  year?: number;
  label: string;
  status: string;
  classCount: number;
  programmes: string[];
  classes: { label: string; stage: string }[];
  moreClasses: number;
};

const STATUS: Record<string, { label: string; tone: "success" | "neutral" | "outline" }> = {
  ACTIVE: { label: "Active", tone: "success" },
  PLANNED: { label: "Planned", tone: "neutral" },
  ARCHIVED: { label: "Archived", tone: "outline" },
};

export function SessionSelectClient({
  sessions,
  currentId,
  destination,
  isAdmin,
  canManage,
}: {
  sessions: SessionCard[];
  currentId: string | null;
  destination: string;
  isAdmin: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);

  const choose = async (s: SessionCard) => {
    if (!isAdmin && s.classCount === 0) {
      toast.error(`No classes have been assigned to you in ${s.label} yet.`);
      return;
    }
    setPending(s.id);
    try {
      const res = await selectAcademicSession(s.id);
      if (!res.success) throw new Error(res.error);
      toast.success(`Working in ${s.label}`);
      router.push(destination);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open that year server");
      setPending(null);
    }
  };

  return (
    <div className="w-full max-w-4xl">
      <div className="mb-8 text-center animate-enter">
        <span className="mx-auto inline-flex size-11 items-center justify-center rounded-control border border-border bg-surface text-primary shadow-1">
          <Server className="size-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-3xl font-light tracking-display text-fg sm:text-4xl">Choose a Year Server</h1>
        <p className="mx-auto mt-2 max-w-lg text-fg-muted">
          Each year server is an isolated workspace containing its own programmes, classes, students and registrations.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-card border border-border bg-surface p-6 text-center shadow-1">
          <p className="font-medium text-fg">No Year Server includes your classes yet</p>
          <p className="mt-1 text-sm text-fg-muted">
            {isAdmin
              ? "Create a Year Server to start managing programmes and classes."
              : "An administrator needs to configure your classes in a Year Server. You can still manage your class assignments."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {canManage ? (
              <Link href="/faculty/academic-sessions" className={buttonVariants({ size: "sm" })}>
                <Settings2 className="size-4" /> Manage Year Servers
              </Link>
            ) : (
              <Link href="/faculty/assign-sections" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Manage my classes
              </Link>
            )}
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2" aria-label="Year Servers">
          {sessions.map((s) => {
            const status = STATUS[s.status] ?? STATUS.ACTIVE;
            const archived = s.status === "ARCHIVED";
            const isCurrent = s.id === currentId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={archived || pending !== null}
                  onClick={() => choose(s)}
                  aria-label={`${s.label}, ${status.label}${isCurrent ? ", current" : ""}`}
                  className={cn(
                    "group flex h-full w-full flex-col rounded-card border bg-surface p-5 text-left shadow-1 transition-colors cursor-pointer",
                    isCurrent ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
                    archived ? "cursor-not-allowed opacity-60" : "hover:border-border-strong"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-fg-subtle">YEAR SERVER</p>
                      <p className="mt-1 text-2xl font-light tabular-nums tracking-display text-fg">{s.label}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCurrent ? (
                        <Badge size="sm" tone="primary">
                          <Check className="size-3" /> Current
                        </Badge>
                      ) : null}
                      <Badge size="sm" tone={status.tone}>
                        {status.label}
                      </Badge>
                    </div>
                  </div>

                  {archived ? (
                    <p className="mt-4 text-sm text-fg-muted">Archived sessions can&apos;t be opened. Ask an administrator to reactivate it if needed.</p>
                  ) : s.classCount === 0 ? (
                    <p className="mt-4 text-sm text-fg-muted">No classes have been added to this session yet.</p>
                  ) : (
                    <div className="mt-4 space-y-1.5">
                      <p className="text-sm text-fg-muted">
                        {s.classCount} {s.classCount === 1 ? "class" : "classes"}
                        {s.programmes.length ? ` · ${s.programmes.join(", ")}` : ""}
                      </p>
                      <ul className="space-y-1">
                        {s.classes.map((c) => (
                          <li key={c.label} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                            <span className="font-medium text-fg">{c.label}</span>
                            <span className="text-xs text-fg-subtle">{c.stage}</span>
                          </li>
                        ))}
                        {s.moreClasses > 0 ? <li className="text-xs text-fg-subtle">and {s.moreClasses} more</li> : null}
                      </ul>
                    </div>
                  )}

                  {!archived ? (
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-medium text-fg">
                      {pending === s.id ? <Spinner className="size-4" /> : null}
                      {isCurrent ? "Continue" : "Open this session"}
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {canManage && sessions.length > 0 ? (
        <p className="mt-6 text-center text-sm text-fg-muted">
          <Link href="/faculty/academic-sessions" className="font-medium text-fg underline underline-offset-4">
            Manage academic sessions and cohorts
          </Link>
        </p>
      ) : null}
    </div>
  );
}
