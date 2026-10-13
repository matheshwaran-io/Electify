"use client";

import { useState, useTransition, useEffect } from "react";
import { Check, Copy, Mail, Plus, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createInviteCode, revokeInviteCode, deleteInviteCode } from "@/app/actions/admin";
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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_CONFIGS, generateRoleBasedCode, type InviteRole } from "@/lib/invites";

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

const AVAILABLE_ROLES: InviteRole[] = [
  "CLASS_TUTOR",
  "COURSE_COORDINATOR",
  "SYSTEM_ADMIN",
  "STUDENT",
];

export function InvitesClient({
  codes: initialCodes,
}: {
  codes: InviteCode[];
  tree?: any;
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Revoke state
  const [revoking, setRevoking] = useState<InviteCode | null>(null);
  const [revokeOpen, setRevokeOpen] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState<InviteCode | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Modal Form state
  const [role, setRole] = useState<InviteRole>("CLASS_TUTOR");
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [customCode, setCustomCode] = useState<string>("");
  const [useCustomCode, setUseCustomCode] = useState<boolean>(false);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);

  // Update generated code when role changes or modal opens
  useEffect(() => {
    setGeneratedCode(generateRoleBasedCode(role));
  }, [role, showModal]);

  const handleRegenerateCode = () => {
    setGeneratedCode(generateRoleBasedCode(role));
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = () => {
    startTransition(async () => {
      try {
        const finalCode = useCustomCode ? customCode.trim().toUpperCase() : generatedCode;
        const result = await createInviteCode({
          role,
          customCode: useCustomCode ? finalCode : undefined,
          maxUses,
          expiresInDays,
        });
        toast.success(`Created unique invite code: ${result.code}`);
        setShowModal(false);
        setCustomCode("");
        setUseCustomCode(false);
        window.location.reload();
      } catch (err: any) {
        toast.error(err.message || "Failed to create invite code.");
      }
    });
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    const id = revoking.id;
    try {
      await revokeInviteCode(id);
      setCodes((prev) => prev.map((c) => (c.id === id ? { ...c, status: "REVOKED" } : c)));
      toast.success(`Invite code ${revoking.code} revoked.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke invite code.");
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const id = deleting.id;
    try {
      await deleteInviteCode(id);
      setCodes((prev) => prev.filter((c) => c.id !== id));
      toast.success(`Permanently deleted invite code ${deleting.code}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete invite code.");
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
        <span className="flex items-center gap-2">
          <span className="rounded-control bg-surface-2 px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-fg border border-border">
            {c.code}
          </span>
          <Tooltip content={copiedId === c.id ? "Copied" : "Copy code"}>
            <button
              type="button"
              data-inline
              aria-label={`Copy code ${c.code}`}
              onClick={(e) => {
                e.stopPropagation();
                copyCode(c.code, c.id);
              }}
              className="inline-flex size-7 items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {copiedId === c.id ? <Check className="size-3.5 text-success-text" /> : <Copy className="size-3.5" />}
            </button>
          </Tooltip>
        </span>
      ),
      searchValue: (c) => c.code,
    },
    {
      id: "role",
      header: "Role",
      mobileWide: true,
      cell: (c) => {
        const config = ROLE_CONFIGS[c.role as InviteRole];
        return (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={c.role} size="sm" />
            {config ? (
              <span className="text-[11px] font-mono text-fg-muted">
                ({config.prefix})
              </span>
            ) : null}
          </div>
        );
      },
      sortValue: (c) => c.role,
    },
    {
      id: "status",
      header: "Status",
      cell: (c) => <StatusBadge status={c.status} size="sm" />,
      sortValue: (c) => c.status,
    },
    {
      id: "uses",
      header: "Uses",
      cell: (c) => (
        <span className="font-mono tabular-nums text-fg-muted">
          <span className="text-fg font-medium">{c.usedCount}</span> / {c.maxUses}
        </span>
      ),
      sortValue: (c) => c.usedCount,
    },
    {
      id: "expires",
      header: "Expires",
      cell: (c) => <span className="whitespace-nowrap text-fg-muted text-xs">{formatDate(c.expiresAt)}</span>,
      sortValue: (c) => new Date(c.expiresAt).getTime(),
    },
    {
      id: "created",
      header: "Created",
      cell: (c) => <span className="whitespace-nowrap text-fg-muted text-xs">{formatDate(c.createdAt)}</span>,
      sortValue: (c) => new Date(c.createdAt).getTime(),
    },
    {
      id: "actions",
      header: "Actions",
      align: "right",
      mobile: "actions",
      hideable: false,
      cell: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          {c.status === "ACTIVE" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => {
                setRevoking(c);
                setRevokeOpen(true);
              }}
              className="text-xs text-warning-text hover:bg-warning/10"
            >
              Revoke
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="destructive-soft"
            disabled={isPending}
            onClick={() => {
              setDeleting(c);
              setDeleteOpen(true);
            }}
            aria-label={`Delete invite code ${c.code}`}
            className="text-xs text-danger-text hover:bg-danger/10"
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  const statuses = [...new Set(codes.map((c) => c.status))];
  const filters: FilterDef<InviteCode>[] = [
    {
      id: "role",
      label: "Role",
      options: AVAILABLE_ROLES.map((r) => ({
        value: r,
        label: `${ROLE_CONFIGS[r].label} (${ROLE_CONFIGS[r].prefix})`,
      })),
      predicate: (c, v) => c.role === v,
    },
    ...(statuses.length > 1
      ? [
          {
            id: "status",
            label: "Status",
            options: statuses.map((s) => ({ value: s, label: statusLabel(s) })),
            predicate: (c: InviteCode, v: string) => c.status === v,
          },
        ]
      : []),
  ];

  const activeRoleConfig = ROLE_CONFIGS[role];

  return (
    <div>
      <PageHeader
        title="Invite codes"
        description="Role-based unique invite codes for staff and department access."
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
        searchPlaceholder="Search codes by prefix or name"
        filters={filters}
        empty={
          <EmptyState
            compact
            icon={<Mail />}
            title="No invite codes yet"
            description="Generate a unique role-based code and share it with a new staff member."
          />
        }
      />

      {/* Generate Invite Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !isPending && setShowModal(o)}>
        <DialogContent size="lg" showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>Generate role-based invite code</DialogTitle>
            <DialogDescription>
              Each code uses a dedicated role prefix (e.g. <code>FAC</code>, <code>COORD</code>, <code>ADM</code>) to guarantee consistency and security.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {/* Role Selection */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-fg">Select Role</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_ROLES.map((r) => {
                  const cfg = ROLE_CONFIGS[r];
                  const isSelected = role === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setRole(r)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-control border p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/10 text-primary-text shadow-sm"
                          : "border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-semibold text-sm text-fg">
                          {cfg.label}
                        </span>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-3 text-fg">
                          {cfg.prefix}
                        </span>
                      </div>
                      <p className="text-xs text-fg-muted mt-0.5 leading-snug">
                        {cfg.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Generated Code Preview Strip */}
            <div className="rounded-panel border border-border bg-surface-2/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
                    Role-Based Unique Code
                  </span>
                  <p className="text-xs text-fg-muted mt-0.5">
                    Pre-formatted for {activeRoleConfig?.label} with prefix <strong>{activeRoleConfig?.prefix}</strong>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateCode}
                  disabled={useCustomCode}
                  title="Generate another code"
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="size-3.5" /> Regenerate
                </Button>
              </div>

              {!useCustomCode ? (
                <div className="flex items-center justify-between gap-3 rounded-control border border-primary/30 bg-surface px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary shrink-0" />
                    <span className="font-mono text-lg font-bold tracking-widest text-fg">
                      {generatedCode}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseCustomCode(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Custom code?
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-fg">Enter Custom Code</span>
                    <button
                      type="button"
                      onClick={() => setUseCustomCode(false)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Use auto-generated
                    </button>
                  </div>
                  <Input
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    placeholder={`e.g. ${activeRoleConfig?.prefix}-SPECIAL-2026`}
                    className="font-mono uppercase font-semibold"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Constraints */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Max uses" description="1 to 100 uses allowed">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value)))}
                />
              </Field>
              <Field label="Expires in (days)" description="1 to 90 days validity">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Math.max(1, Number(e.target.value)))}
                />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              loading={isPending}
              loadingText="Creating"
              disabled={useCustomCode && customCode.trim().length < 4}
            >
              Generate {activeRoleConfig?.label} Code
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        tone="danger"
        title="Revoke this invite code?"
        description="Anyone holding the code will immediately lose the ability to register with it."
        impact={
          revoking
            ? [
                { label: "Code", value: revoking.code },
                { label: "Role", value: statusLabel(revoking.role) },
                { label: "Uses so far", value: `${revoking.usedCount} / ${revoking.maxUses}` },
              ]
            : undefined
        }
        confirmLabel="Revoke code"
        onConfirm={handleRevoke}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        tone="danger"
        title="Permanently delete invite code?"
        description="This will permanently delete this code from the database. It cannot be used or restored."
        impact={
          deleting
            ? [
                { label: "Code", value: deleting.code },
                { label: "Role", value: statusLabel(deleting.role) },
                { label: "Status", value: deleting.status, tone: "danger" },
              ]
            : undefined
        }
        requireText="DELETE"
        confirmLabel="Delete permanently"
        onConfirm={handleDelete}
      />
    </div>
  );
}
