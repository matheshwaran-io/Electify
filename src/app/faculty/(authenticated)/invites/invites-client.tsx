"use client";

import * as React from "react";
import { toast } from "sonner";
import { 
  KeyRound, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Building, 
  User, 
  Layers,
  Shield,
  ShieldAlert,
  Key
} from "lucide-react";
import { createInviteCode, revokeInviteCode } from "@/app/actions/invites";
import { getStaffMembers, toggleStaffStatus, resetStaffPassword } from "@/app/actions/staff";
import { cn } from "@/lib/utils";

interface InviteData {
  id: string;
  code: string;
  role: string;
  faculty: string;
  department: string;
  degree: string;
  section: string | null;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  status: string;
}

interface StaffMember {
  id: string;
  employeeId: string | null;
  name: string;
  email: string;
  role: string;
  faculty: string | null;
  department: string | null;
  degree: string | null;
  className: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ClientProps {
  initialInvites: InviteData[];
  session: {
    userId: string;
    email: string;
    name: string;
    role: string;
    facultyType?: "COURSE_COORDINATOR" | "CLASS_TUTOR";
  };
}

export function InvitesClient({ initialInvites, session }: ClientProps) {
  const [activeTab, setActiveTab] = React.useState<"invites" | "accounts">("invites");
  const [invites, setInvites] = React.useState<InviteData[]>(initialInvites);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Staff list states
  const [staffList, setStaffList] = React.useState<StaffMember[]>([]);
  const [loadingStaff, setLoadingStaff] = React.useState(false);

  // Form State
  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const [role, setRole] = React.useState<"COURSE_COORDINATOR" | "CLASS_TUTOR">(
    isSuperAdmin ? "COURSE_COORDINATOR" : "CLASS_TUTOR"
  );
  const [section, setSection] = React.useState<string>("");
  const [maxUses, setMaxUses] = React.useState<number>(1);

  // Load staff members list
  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const res = await getStaffMembers();
      if (res.success && res.data) {
        setStaffList(res.data);
      } else {
        toast.error(res.error || "Failed to load staff list.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load staff accounts directory.");
    } finally {
      setLoadingStaff(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === "accounts") {
      loadStaff();
    }
  }, [activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await createInviteCode({
        role,
        faculty: "Faculty of Science & Humanities",
        department: "Computer Applications",
        degree: "MCA",
        maxUses,
      });

      if (res.success && res.data) {
        toast.success("Successfully generated invite code.");
        const newInvite: InviteData = {
          ...res.data,
          createdAt: new Date(res.data.createdAt).toISOString(),
          expiresAt: new Date(res.data.expiresAt).toISOString(),
        };
        setInvites([newInvite, ...invites]);
        setSection("");
        setMaxUses(1);
      } else {
        toast.error(res.error || "Failed to create invite code.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this invite code? It will immediately deny access to new registrants.")) {
      return;
    }

    try {
      const res = await revokeInviteCode(id);
      if (res.success && res.data) {
        toast.success("Successfully revoked invite code.");
        setInvites(invites.map(inv => inv.id === id ? { ...inv, status: "REVOKED" } : inv));
      } else {
        toast.error(res.error || "Failed to revoke invite code.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.");
    }
  };

  const handleToggleStatus = async (id: string, currentActive: boolean) => {
    const actionLabel = currentActive ? "suspend" : "activate";
    if (!confirm(`Are you sure you want to ${actionLabel} this staff member's account?`)) {
      return;
    }

    try {
      const res = await toggleStaffStatus(id, !currentActive);
      if (res.success) {
        toast.success(`Successfully ${currentActive ? "suspended" : "activated"} account.`);
        setStaffList(staffList.map(st => st.id === id ? { ...st, isActive: !currentActive } : st));
      } else {
        toast.error(res.error || "Failed to update staff account status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred updating account status.");
    }
  };

  const handleResetPassword = async (id: string) => {
    const password = prompt("Enter a new password for this staff member (minimum 6 characters):");
    if (password === null) return; // Cancelled
    if (password.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    try {
      const res = await resetStaffPassword(id, password.trim());
      if (res.success) {
        toast.success("Password reset successfully.");
      } else {
        toast.error(res.error || "Failed to reset password.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred resetting password.");
    }
  };

  const getStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    const resolvedStatus = status === "ACTIVE" && isExpired ? "EXPIRED" : status;

    switch (resolvedStatus) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case "USED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400">
            <CheckCircle2 className="w-3 h-3" />
            Used
          </span>
        );
      case "EXPIRED":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Clock className="w-3 h-3" />
            Expired
          </span>
        );
      case "REVOKED":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <XCircle className="w-3 h-3" />
            Revoked
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-white/[0.08] mb-6">
        <button
          onClick={() => setActiveTab("invites")}
          className={cn(
            "py-2 px-4 text-xs font-bold border-b-2 uppercase tracking-wider transition-all",
            activeTab === "invites"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          )}
        >
          Invite Codes
        </button>
        <button
          onClick={() => setActiveTab("accounts")}
          className={cn(
            "py-2 px-4 text-xs font-bold border-b-2 uppercase tracking-wider transition-all",
            activeTab === "accounts"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          )}
        >
          Staff Accounts
        </button>
      </div>

      {activeTab === "invites" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ── Invite Code Generation Form Card ──────────────────── */}
          <div className="lg:col-span-1">
            <div className="bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/[0.08] p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <KeyRound className="w-5 h-5 text-indigo-500" />
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Generate Invite
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Target Role Selector */}
                {isSuperAdmin ? (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Target Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
                    >
                      <option value="COURSE_COORDINATOR">Course Coordinator</option>
                      <option value="CLASS_TUTOR">Class Tutor</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Target Role
                    </label>
                    <div className="px-3 py-2 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 font-semibold uppercase tracking-wider">
                      Class Tutor
                    </div>
                  </div>
                )}



                {/* Maximum Uses */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Max Uses
                  </label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200 dark:border-white/[0.06] rounded-xl text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
                  >
                    <option value={1}>1 Use (Single Use)</option>
                    <option value={5}>5 Uses</option>
                    <option value={10}>10 Uses</option>
                    <option value={999}>Unlimited Uses</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Generate Invite Code</span>
                </button>
              </form>
            </div>
          </div>

          {/* ── Invites List Table ────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/[0.08] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05]">
                <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                  Generated Credentials List
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/30 dark:bg-slate-900/20 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-extrabold">
                      <th className="py-3 px-6">Code / Role</th>
                      <th className="py-3 px-6">Scope / Section</th>
                      <th className="py-3 px-6">Uses</th>
                      <th className="py-3 px-6">Status / Expires</th>
                      <th className="py-3 px-6 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                    {invites.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 px-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-600">
                          No staff invite codes generated yet.
                        </td>
                      </tr>
                    ) : (
                      invites.map((invite) => {
                        const isRevocable = invite.status === "ACTIVE" && new Date(invite.expiresAt) > new Date();
                        
                        return (
                          <tr key={invite.id} className="text-xs hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors">
                            <td className="py-4 px-6 space-y-1">
                              <p className="font-mono font-bold text-slate-800 dark:text-slate-200 select-all">
                                {invite.code}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                {invite.role === "COURSE_COORDINATOR" ? "Coordinator" : "Class Tutor"}
                              </p>
                            </td>
                            <td className="py-4 px-6 font-semibold text-slate-600 dark:text-slate-300">
                              {invite.role === "CLASS_TUTOR" ? (
                                <span className="inline-flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                  Any Section (A-J)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1">
                                  <Building className="w-3.5 h-3.5 text-slate-400" />
                                  Universal (All Depts)
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 font-bold text-slate-700 dark:text-slate-300">
                              {invite.usedCount} / {invite.maxUses > 500 ? "∞" : invite.maxUses}
                            </td>
                            <td className="py-4 px-6 space-y-1">
                              <div>{getStatusBadge(invite.status, invite.expiresAt)}</div>
                              <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                                Expires: {new Date(invite.expiresAt).toLocaleDateString()}
                              </p>
                            </td>
                            <td className="py-4 px-6 text-center">
                              <button
                                onClick={() => handleRevoke(invite.id)}
                                disabled={!isRevocable}
                                title={isRevocable ? "Revoke Invite" : "Revoked or Expired"}
                                className="inline-flex items-center justify-center p-2 rounded-xl text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 active:scale-95 transition-all border border-transparent disabled:opacity-30 disabled:pointer-events-none"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── Staff Accounts Directory View ─────────────────────── */
        <div className="bg-white/70 dark:bg-white/[0.02] backdrop-blur-xl rounded-2xl border border-slate-200/60 dark:border-white/[0.08] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] flex justify-between items-center">
            <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100">
              Administrative Staff List
            </h2>
            {loadingStaff && <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Loading directory...</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/30 dark:bg-slate-900/20 text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-extrabold">
                  <th className="py-3 px-6">Employee ID / Name</th>
                  <th className="py-3 px-6">Official Email</th>
                  <th className="py-3 px-6">Role / Section</th>
                  <th className="py-3 px-6">Account Status</th>
                  <th className="py-3 px-6 text-center">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                {loadingStaff ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-600">
                      Loading registered staff details...
                    </td>
                  </tr>
                ) : staffList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 px-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-600">
                      No administrative staff accounts registered under this scope.
                    </td>
                  </tr>
                ) : (
                  staffList.map((member) => (
                    <tr key={member.id} className="text-xs hover:bg-slate-50/20 dark:hover:bg-slate-900/10 transition-colors">
                      <td className="py-4 px-6 space-y-1">
                        <p className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {member.employeeId || "N/A"}
                        </p>
                        <p className="font-bold text-slate-700 dark:text-slate-300">
                          {member.name}
                        </p>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-500 dark:text-slate-400">
                        {member.email}
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-600 dark:text-slate-300">
                        <div className="flex flex-col gap-0.5">
                          <span className="uppercase text-[10px] font-bold tracking-wider">
                            {member.role === "COURSE_COORDINATOR" ? "Coordinator" : "Class Tutor"}
                          </span>
                          {member.role === "CLASS_TUTOR" && (
                            <span className="text-[9px] text-slate-400 font-semibold inline-flex items-center gap-0.5">
                              <Layers className="w-2.5 h-2.5 text-indigo-400" />
                              Section {member.className}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {member.isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="inline-flex items-center gap-2">
                          {/* Toggle Active / Suspend Account */}
                          <button
                            onClick={() => handleToggleStatus(member.id, member.isActive)}
                            className={cn(
                              "inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all active:scale-95",
                              member.isActive
                                ? "text-rose-500 dark:text-rose-400 border-rose-500/20 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                                : "text-emerald-500 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            )}
                            title={member.isActive ? "Suspend Account" : "Activate Account"}
                          >
                            {member.isActive ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                            <span>{member.isActive ? "Disable" : "Enable"}</span>
                          </button>

                          {/* Password Reset (Super Admin Only) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => handleResetPassword(member.id)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-slate-900/40 active:scale-95 transition-all"
                              title="Reset Password"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Reset Pass</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

