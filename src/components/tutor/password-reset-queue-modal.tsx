"use client";

import * as React from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserX,
} from "lucide-react";
import {
  getPendingPasswordResetsForTutor,
  authorizeStudentPasswordReset,
  rejectStudentPasswordReset,
} from "@/app/actions/tutor";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

type PasswordResetItem = {
  id: string;
  studentId: string;
  sectionId: string | null;
  tutorId: string | null;
  status: string;
  resetToken: string | null;
  tokenExpiresAt: Date | null;
  authorizedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  studentName: string | null;
  studentEmail: string | null;
  registerNumber: string | null;
  sectionLabel: string | null;
};

export function PasswordResetQueueModal({
  open,
  onOpenChange,
  sectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId?: string;
}) {
  const [requests, setRequests] = React.useState<PasswordResetItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [copiedToken, setCopiedToken] = React.useState<string | null>(null);

  const fetchRequests = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingPasswordResetsForTutor(sectionId);
      setRequests(data as any);
    } catch (err: any) {
      toast.error(err.message || "Failed to load password reset queue.");
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  React.useEffect(() => {
    if (open) {
      fetchRequests();
    }
  }, [open, fetchRequests]);

  const handleAuthorize = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const res = await authorizeStudentPasswordReset(requestId);
      if (res.success) {
        toast.success(`Authorization code generated: ${res.resetToken}`);
        await fetchRequests();
      }
    } catch (err: any) {
      toast.error(err.message || "Could not authorize password reset.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      await rejectStudentPasswordReset(requestId);
      toast.success("Password reset request rejected.");
      await fetchRequests();
    } catch (err: any) {
      toast.error(err.message || "Could not reject request.");
    } finally {
      setProcessingId(null);
    }
  };

  const copyToClipboard = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopiedToken(token);
    toast.success("Authorization code copied! Provide this code to the student.");
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const authorizedRequests = requests.filter((r) => r.status === "AUTHORIZED");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-control bg-brand/10 text-brand">
              <KeyRound className="size-5" />
            </div>
            <div>
              <DialogTitle>Student password resets</DialogTitle>
              <DialogDescription>
                Verify student identity in person or via university communication before giving them a password reset code.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-6 pt-2">
          {loading && requests.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="size-5 animate-spin text-fg-subtle" />
            </div>
          ) : pendingRequests.length === 0 && authorizedRequests.length === 0 ? (
            <div className="rounded-card border border-border bg-surface-2 p-8 text-center">
              <ShieldCheck className="mx-auto size-10 text-emerald-500 mb-2" />
              <h4 className="font-medium text-base text-fg">All clear — no pending password resets</h4>
              <p className="mt-1 text-sm text-fg-muted max-w-sm mx-auto">
                When students from your section request a password reset, they will appear here for verification and authorization.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
                      Pending Identity Verification ({pendingRequests.length})
                    </h4>
                    <Button variant="ghost" size="sm" onClick={fetchRequests} loading={loading}>
                      <RefreshCw className="size-3" /> Refresh
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="rounded-card border border-amber-500/25 bg-amber-500/5 p-4 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-base text-fg">{req.studentName}</span>
                              <Badge tone="warning" size="sm">Pending</Badge>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
                              <span>
                                Reg No: <strong className="font-mono text-fg">{req.registerNumber}</strong>
                              </span>
                              <span>Email: {req.studentEmail}</span>
                              <span>Section: {req.sectionLabel || "F"}</span>
                              <span>Requested: {formatDateTime(new Date(req.createdAt))}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReject(req.id)}
                              disabled={processingId === req.id}
                            >
                              <UserX className="size-3.5" /> Reject
                            </Button>
                            <Button
                              variant="brand"
                              size="sm"
                              onClick={() => handleAuthorize(req.id)}
                              loading={processingId === req.id}
                              loadingText="Authorizing..."
                            >
                              <CheckCircle2 className="size-3.5" /> Authorize Reset
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Authorized Codes Ready for Hand-off */}
              {authorizedRequests.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-fg-subtle">
                    Active Authorization Codes ({authorizedRequests.length})
                  </h4>
                  <div className="divide-y divide-border rounded-card border border-brand/20 bg-surface-2">
                    {authorizedRequests.map((req) => (
                      <div key={req.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-fg">{req.studentName}</span>
                            <span className="font-mono text-xs text-fg-subtle">({req.registerNumber})</span>
                            <Badge tone="primary" size="sm">Authorized</Badge>
                          </div>
                          <p className="mt-1 text-xs text-fg-muted">
                            Expires: {req.tokenExpiresAt ? formatDateTime(new Date(req.tokenExpiresAt)) : "24 hours"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="rounded-control border border-brand/30 bg-brand/10 px-3 py-1 font-mono font-semibold tracking-widest text-brand text-sm">
                            {req.resetToken}
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => req.resetToken && copyToClipboard(req.resetToken)}
                          >
                            {copiedToken === req.resetToken ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            Copy code
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
