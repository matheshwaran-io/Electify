"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings, Shield, Activity, User as UserIcon, Lock, Mail } from "lucide-react";
import { toggleMaintenanceMode } from "@/app/actions/admin";
import { updateProfile } from "@/app/actions/user";

type SystemSettings = { id: string; maintenanceMode: boolean; createdAt: Date; updatedAt: Date } | null;
type UserProfile = { name: string; email: string; role: string };

export function SettingsClient({ settings, user }: { settings: SystemSettings, user: UserProfile }) {
  const [maintenance, setMaintenance] = useState(settings?.maintenanceMode ?? false);
  const [loading, setLoading] = useState(false);
  
  // Profile state
  const [name, setName] = useState(user.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const next = !maintenance;
    await toggleMaintenanceMode(next);
    setMaintenance(next);
    toast.success(`Maintenance mode ${next ? "enabled" : "disabled"}.`);
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) return toast.error("Name cannot be empty");
    if (newPassword && !currentPassword) return toast.error("Current password is required to set a new password");
    if (newPassword && newPassword.length < 8) return toast.error("New password must be at least 8 characters");

    setSavingProfile(true);
    try {
      await updateProfile({
        name,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      toast.success("Profile updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Settings</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Manage your account and system configuration.</p>
      </div>

      {/* Profile Section */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Profile Details</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Update your personal information</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Full Name</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--foreground)]">Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={user.email}
                  disabled
                  className="w-full bg-[var(--accent)] border border-[var(--border)] text-[var(--muted-foreground)] text-sm rounded-lg pl-9 pr-3 py-2.5 opacity-70 cursor-not-allowed"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] opacity-70" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--border)]/50 space-y-4">
            <div>
              <h3 className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                <Lock className="w-4 h-4 text-[var(--muted-foreground)]" />
                Change Password
              </h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">Leave blank if you don't want to change it</p>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <input 
                type="password" 
                placeholder="Current Password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <input 
                type="password" 
                placeholder="New Password (min. 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-[var(--accent)]/30 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile || !name.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-indigo-500/50 focus:outline-none disabled:opacity-50"
          >
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Maintenance Mode (Admins Only) */}
      {user.role === "SYSTEM_ADMIN" && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--foreground)]">Maintenance Mode</h3>
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                When enabled, students and staff will see a maintenance page instead of the portal.
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 cursor-pointer ${maintenance ? "bg-orange-500" : "bg-[var(--accent)]"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${maintenance ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          <p className={`mt-4 text-xs font-medium ${maintenance ? "text-orange-400" : "text-emerald-400"}`}>
            {maintenance ? "System is currently offline for maintenance." : "System is online and operational."}
          </p>
        </div>
      )}

      {/* System Info */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-[var(--foreground)]">System Information</h3>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Application</span>
            <span className="font-medium text-[var(--foreground)]">Electify ERP</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Database</span>
            <span className="font-medium text-[var(--foreground)]">Supabase PostgreSQL</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">ORM</span>
            <span className="font-medium text-[var(--foreground)]">Drizzle ORM</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Framework</span>
            <span className="font-medium text-[var(--foreground)]">Next.js 16</span>
          </div>
        </div>
      </div>
    </div>
  );
}
