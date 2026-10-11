"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createInviteCode, revokeInviteCode } from "@/app/actions/admin";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { StatusBadge, statusLabel } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/feedback";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column, type FilterDef } from "@/components/ui/data-table";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InviteCode = {
  id: string;
  code: string;
  role: string;
  status: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  createdAt: Date;
};

type Section = { id: string; label: string };
type Batch = { id: string; year: string; sections: Section[] };
type Programme = { id: string; name: string; code: string; batches: Batch[] };
type Department = { id: string; name: string; programmes: Programme[] };
type Faculty = { id: string; name: string; departments: Department[] };

const ROLES = ["COURSE_COORDINATOR", "CLASS_TUTOR"] as const;

export function InvitesClient({
  codes: initialCodes,
}: {
  codes: InviteCode[];
  tree?: { faculties: Faculty[] };
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<InviteCode | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [role, setRole] = useState<"COURSE_COORDINATOR" | "CLASS_TUTOR">("COURSE_COORDINATOR");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const result = await createInviteCode({
          role,
          maxUses,
          expiresInDays,
        });
        toast.success(`Invite code created: ${result.code}`);
        // Reload codes
        window.location.reload();
      } catch {
        toast.error("Failed to create invite code.");
      }
    });
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    const id = revoking.id;
    try {
      await revokeInviteCode(id);
      setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, status: "REVOKED" } : c)));
      toast.success("Invite code revoked.");
    } catch (err) {
      toast.error("Failed to revoke invite code.");
      throw err;
    }
  };

  const columns: Column<InviteCode>[] = [
    {
      id: "code",
      header: "Code",
      mobile: "title",
      hideable: false,
      cell: (c) => (
        <span className="flex items-center gap-1.5">
          <span className="font-mono font-medium tracking-[0.12em] text-fg">{c.code}</span>
          <Tooltip content={copiedId === c.id ? "Copied" : "Copy code"}>
            <button
              type="button"
              data-inline
              aria-label={`Copy code ${c.code}`}
              onClick={(e) => {
                e.stopPropagation();
                copyCode(c.code, c.id);
              }}
              className="inline-flex size-8 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {copiedId === c.id ? <Check className="size-3.5 text-success-text" /> : <Copy className="size-3.5" />}
            </button>
          </Tooltip>
        </span>
      ),
      searchValue: (c) => c.code,
    },
    { id: "role", header: "Role", mobileWide: true, cell: (c) => <StatusBadge status={c.role} size="sm" />, sortValue: (c) => c.role },
    { id: "status", header: "Status", cell: (c) => <StatusBadge status={c.status} size="sm" />, sortValue: (c) => c.status },
    {
      id: "uses",
      header: "Uses",
      cell: (c) => (
        <span className="font-mono tabular-nums text-fg-muted">
          <span className="text-fg">{c.usedCount}</span> / {c.maxUses}
        </span>
      ),
      sortValue: (c) => c.usedCount,
    },
    {
      id: "expires",
      header: "Expires",
      cell: (c) => <span className="whitespace-nowrap text-fg-muted">{formatDate(c.expiresAt)}</span>,
      sortValue: (c) => new Date(c.expiresAt).getTime(),
    },
    {
      id: "created",
      header: "Created",
      cell: (c) => <span className="whitespace-nowrap text-fg-muted">{formatDate(c.createdAt)}</span>,
      sortValue: (c) => new Date(c.createdAt).getTime(),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (c) =>
        c.status === "ACTIVE" ? (
          <Button
            size="sm"
            variant="destructive-soft"
            disabled={isPending}
            onClick={() => {
              setRevoking(c);
              setRevokeOpen(true);
            }}
          >
            <Trash2 /> Revoke
          </Button>
        ) : null,
    },
  ];

  const statuses = [...new Set(codes.map((c) => c.status))];
  const filters: FilterDef<InviteCode>[] = [
    { id: "role", label: "Role", options: ROLES.map((r) => ({ value: r, label: statusLabel(r) })), predicate: (c, v) => c.role === v },
    ...(statuses.length > 1
      ? [{ id: "status", label: "Status", options: statuses.map((s) => ({ value: s, label: statusLabel(s) })), predicate: (c: InviteCode, v: string) => c.status === v }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Invite codes"
        description="One-time codes that let new staff create an account."
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus /> Generate invite
          </Button>
        }
      />

      <DataTable
        data={codes}
        columns={columns}
        getRowId={(c) => c.id}
        caption="Invite codes"
        searchPlaceholder="Search codes"
        filters={filters}
        empty={
          <EmptyState
            compact
            icon={<Mail />}
            title="No invite codes yet"
            description="Generate a code and share it with a new staff member."
          />
        }
      />

      <Dialog open={showModal} onOpenChange={(o) => !isPending && setShowModal(o)}>
        <DialogContent size="md" showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>Generate invite code</DialogTitle>
            <DialogDescription>The code signs a new staff member up with the role you pick.</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Role</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={role === r}
                    onClick={() => setRole(r)}
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-2 rounded-control border px-3.5 py-2.5 text-left text-sm font-medium transition-colors",
                      role === r ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg"
                    )}
                  >
                    {statusLabel(r)}
                    {role === r ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Max uses" description="1 to 50">
                <Input type="number" inputMode="numeric" min={1} max={50} value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} />
              </Field>
              <Field label="Expires in (days)" description="1 to 90">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleCreate} loading={isPending} loadingText="Generating">
              Generate code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        tone="danger"
        title="Revoke this invite code?"
        description="Anyone holding the code will no longer be able to sign up with it."
        impact={
          revoking
            ? [
                { label: "Code", value: revoking.code },
                { label: "Uses so far", value: `${revoking.usedCount} / ${revoking.maxUses}` },
              ]
            : undefined
        }
        confirmLabel="Revoke code"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
