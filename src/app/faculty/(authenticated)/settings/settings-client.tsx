"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { toggleMaintenanceMode } from "@/app/actions/admin";
import { updateProfile } from "@/app/actions/user";
import { cn } from "@/lib/utils";
import { Avatar, PageHeader } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/status-badge";

type SystemSettings = { id: string; maintenanceMode: boolean; createdAt: Date; updatedAt: Date } | null;
type UserProfile = { name: string; email: string; role: string };

function Panel({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-surface shadow-1">
      <div className="px-4 pt-5 sm:px-6">
        <h2 className="text-base font-medium text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
      </div>
      <div className="px-4 py-5 sm:px-6">{children}</div>
      {footer ? <div className="flex justify-end border-t border-border bg-surface-2/50 px-4 py-3 sm:px-6">{footer}</div> : null}
    </section>
  );
}

export function SettingsClient({ settings, user }: { settings: SystemSettings; user: UserProfile }) {
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
    if (newPassword && !currentPassword) return toast.error("Current password is required to set a new one");
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
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Your account, and system configuration for admins." />

      <div className="space-y-5">
        <div className="flex items-center gap-4 rounded-card bg-surface-2 p-4 sm:p-5">
          <Avatar name={user.name} size="lg" className="size-12 bg-surface text-base" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-fg">{user.name}</p>
            <p className="truncate text-sm text-fg-muted">{user.email}</p>
          </div>
          <div className="hidden sm:block">
            <StatusBadge status={user.role} size="sm" />
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveProfile();
          }}
        >
          <Panel
            title="Profile"
            description="Your name appears on reports and in the audit log."
            footer={
              <Button type="submit" loading={savingProfile} loadingText="Saving" disabled={!name.trim()}>
                Save changes
              </Button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Email" description="Contact an admin to change it.">
                <Input type="email" value={user.email} disabled leading={<Mail />} />
              </Field>
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-medium text-fg">Change password</h3>
              <p className="mt-0.5 text-xs text-fg-muted">Leave both blank to keep your current password.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="Current password">
                  <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                </Field>
                <Field label="New password" description="At least 8 characters.">
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
                </Field>
              </div>
            </div>
          </Panel>
        </form>

        {user.role === "SYSTEM_ADMIN" ? (
          <Panel title="Maintenance mode" description="Students and staff see a maintenance page instead of the portal while this is on.">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2.5 text-sm">
                <span aria-hidden className={cn("size-2 rounded-full", maintenance ? "bg-warning" : "bg-success")} />
                <span className={maintenance ? "font-medium text-warning-text" : "text-fg"}>
                  {maintenance ? "Portal is offline for maintenance" : "Portal is online"}
                </span>
              </span>
              <Switch checked={maintenance} onCheckedChange={handleToggle} disabled={loading} aria-label="Maintenance mode" />
            </div>
          </Panel>
        ) : null}

        <Panel title="About">
          <dl className="divide-y divide-border text-sm">
            {[
              ["Application", "Electify"],
              ["Database", "Supabase PostgreSQL"],
              ["ORM", "Drizzle ORM"],
              ["Framework", "Next.js 16"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
                <dt className="text-fg-muted">{k}</dt>
                <dd className="font-medium text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
