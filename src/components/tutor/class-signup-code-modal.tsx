"use client";

import * as React from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import {
  createClassSignupCode,
  getClassSignupCodesForTutor,
  revokeClassSignupCode,
} from "@/app/actions/tutor";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Meter } from "@/components/ui/data-display";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

type ClassCodeItem = {
  id: string;
  code: string;
  role: string;
  status: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  createdAt: Date;
  sectionLabel: string | null;
  programmeName: string | null;
  programmeCode: string | null;
  departmentName: string | null;
  tutorName: string | null;
};

export function ClassSignupCodeModal({
  open,
  onOpenChange,
  sectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionId?: string;
}) {
  const [codes, setCodes] = React.useState<ClassCodeItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const fetchCodes = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClassSignupCodesForTutor(sectionId);
      setCodes(data as any);
    } catch (err: any) {
      toast.error(err.message || "Failed to load class codes.");
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  React.useEffect(() => {
    if (open) {
      fetchCodes();
    }
  }, [open, fetchCodes]);

  const activeCode = codes.find((c) => c.status === "ACTIVE");

  const handleCreateCode = async () => {
    setCreating(true);
    try {
      const res = await createClassSignupCode({
        sectionId,
        maxActivations: 100, // Hard limit of 100 students
        expiryDays: 14,
      });
      if (res.success) {
        toast.success(`Class code ${res.code} created with 100 student limit!`);
        await fetchCodes();
      }
    } catch (err: any) {
      toast.error(err.message || "Could not generate class code.");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (codeId: string) => {
    try {
      await revokeClassSignupCode(codeId);
      toast.success("Class signup code revoked.");
      await fetchCodes();
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke code.");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    toast.success(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-control bg-brand/10 text-brand">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle>Class Signup Code</DialogTitle>
              <DialogDescription>
                Onboard up to 100 students directly without manual account creation.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-6 pt-2">
          {loading && codes.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="size-5 animate-spin text-fg-subtle" />
            </div>
          ) : activeCode ? (
            <div className="space-y-5">
              {/* Illustrative Active Configuration Card */}
              <div className="rounded-card border border-brand/25 bg-surface-2 p-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <span className="text-[11px] font-mono uppercase tracking-wider text-fg-subtle">
                      CLASS CODE · ACTIVE
                    </span>
                    <h3 className="mt-0.5 text-2xl font-mono font-semibold tracking-wider text-brand">
                      {activeCode.code}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => copyToClipboard(activeCode.code, "Class code")}
                    >
                      {copiedCode === activeCode.code ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      Copy code
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const joinUrl = `${window.location.origin}/join?code=${activeCode.code}`;
                        copyToClipboard(joinUrl, "Student join link");
                      }}
                    >
                      <ExternalLink className="size-3.5" /> Copy join link
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-y-3 sm:grid-cols-3">
                  <div>
                    <span className="text-xs text-fg-subtle">Department</span>
                    <p className="font-medium text-sm text-fg">{activeCode.departmentName || "Computer Applications"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-fg-subtle">Programme</span>
                    <p className="font-medium text-sm text-fg">{activeCode.programmeName || "MCA"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-fg-subtle">Assigned class</span>
                    <p className="font-medium text-sm text-fg">
                      {activeCode.programmeCode || "MCA"} {activeCode.sectionLabel || "Section"}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-fg-subtle">Class tutor</span>
                    <p className="font-medium text-sm text-fg truncate">{activeCode.tutorName || "Assigned tutor"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-fg-subtle">Maximum activations</span>
                    <p className="font-medium text-sm text-fg">{activeCode.maxUses} students</p>
                  </div>
                  <div>
                    <span className="text-xs text-fg-subtle">Expiry</span>
                    <p className="font-medium text-sm text-fg">{formatDateTime(new Date(activeCode.expiresAt))}</p>
                  </div>
                </div>

                <div className="mt-5 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-xs text-fg-muted mb-1.5">
                    <span>Enrolled unique students</span>
                    <span className="font-mono font-medium text-fg">
                      {activeCode.usedCount} / {activeCode.maxUses}
                    </span>
                  </div>
                  <Meter value={activeCode.usedCount} max={activeCode.maxUses} label="Enrolled students" />
                </div>

                <div className="mt-4 flex items-center justify-between pt-2">
                  <p className="text-xs text-fg-subtle">
                    Students strictly derive department, class, and tutor from this code.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRevoke(activeCode.id)}
                  >
                    <Trash2 className="size-3.5" /> Revoke code
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-card border border-border bg-surface-2 p-6 text-center">
              <Users className="mx-auto size-10 text-fg-subtle mb-3" />
              <h4 className="font-medium text-base text-fg">No active class signup code</h4>
              <p className="mt-1 text-sm text-fg-muted max-w-sm mx-auto">
                Generate an onboarding code for your section. Students use this code to create their account and choose their own password.
              </p>
              <Button
                variant="brand"
                size="md"
                className="mt-4"
                onClick={handleCreateCode}
                loading={creating}
                loadingText="Generating code..."
              >
                <Plus className="size-4" /> Generate class signup code
              </Button>
            </div>
          )}

          {/* Past / Revoked Codes History */}
          {codes.filter((c) => c.status !== "ACTIVE").length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-fg-subtle">Code History</h4>
              <div className="divide-y divide-border rounded-control border border-border bg-surface-1">
                {codes
                  .filter((c) => c.status !== "ACTIVE")
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-medium text-fg">{item.code}</span>
                        <Badge
                          tone={item.status === "REVOKED" ? "danger" : "neutral"}
                          size="sm"
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-fg-muted">
                        <span>
                          {item.usedCount} / {item.maxUses} enrolled
                        </span>
                        <span>Expired {formatDateTime(new Date(item.expiresAt))}</span>
                      </div>
                    </div>
                  ))}
              </div>
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
