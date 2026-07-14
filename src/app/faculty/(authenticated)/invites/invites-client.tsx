"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Plus, X, Copy, Check, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "date-fns";
import { toast } from "sonner";
import { createInviteCode, revokeInviteCode } from "@/app/actions/admin";

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

export function InvitesClient({
  codes: initialCodes,
  tree,
}: {
  codes: InviteCode[];
  tree: { faculties: Faculty[] };
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form state
  const [role, setRole] = useState<"COURSE_COORDINATOR" | "CLASS_TUTOR">("COURSE_COORDINATOR");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success("Code copied to clipboard!");
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
        setLastCreatedCode(result.code);
        toast.success(`Invite code created: ${result.code}`);
        // Reload codes
        window.location.reload();
      } catch {
        toast.error("Failed to create invite code.");
      }
    });
  };

  const handleRevoke = (id: string) => {
    startTransition(async () => {
      try {
        await revokeInviteCode(id);
        setCodes((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: "REVOKED" } : c))
        );
        toast.success("Invite code revoked.");
      } catch {
        toast.error("Failed to revoke invite code.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Invite Codes</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Generate one-time codes to invite staff members.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors cursor-pointer shadow-md shadow-indigo-500/20"
        >
          <Plus className="w-4 h-4" />
          Generate Invite
        </button>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--accent)]/30">
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Code</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Role</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Status</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Uses</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Expires</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Created</th>
                <th className="text-left px-6 py-4 font-semibold text-[var(--muted-foreground)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-[var(--muted-foreground)]">
                    <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No invite codes generated yet.
                  </td>
                </tr>
              ) : (
                codes.map((c, i) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-[var(--accent)]/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--foreground)] tracking-widest">
                          {c.code}
                        </span>
                        <button
                          onClick={() => copyCode(c.code, c.id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--accent)] transition-colors cursor-pointer text-[var(--muted-foreground)]"
                        >
                          {copiedId === c.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.role} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">
                      {c.usedCount} / {c.maxUses}
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">
                      {format(new Date(c.expiresAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4 text-[var(--muted-foreground)]">
                      {format(new Date(c.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      {c.status === "ACTIVE" && (
                        <button
                          onClick={() => handleRevoke(c.id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl shadow-2xl w-full max-w-lg pointer-events-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--foreground)]">Generate Invite Code</h2>
                    <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Configure and generate a staff invite link.</p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="p-2 rounded-xl hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="px-6 py-5 space-y-5">
                  {/* Role */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[var(--foreground)]">Role *</label>
                    <div className="flex gap-3">
                      {(["COURSE_COORDINATOR", "CLASS_TUTOR"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setRole(r)}
                          className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium border transition-all cursor-pointer ${role === r ? "bg-indigo-600 text-white border-indigo-600" : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:border-indigo-500/50"}`}
                        >
                          {r.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  </div>


                  {/* Max Uses + Expiry */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--foreground)]">Max Uses</label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={maxUses}
                        onChange={(e) => setMaxUses(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--foreground)]">Expires In (days)</label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={expiresInDays}
                        onChange={(e) => setExpiresInDays(Number(e.target.value))}
                        className="w-full px-4 py-2.5 bg-[var(--background)] border border-[var(--border)] rounded-xl text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-5 border-t border-[var(--border)] flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isPending}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-500/20"
                  >
                    {isPending ? "Generating…" : "Generate Code"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
