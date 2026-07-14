"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings, Shield, Activity } from "lucide-react";
import { toggleMaintenanceMode } from "@/app/actions/admin";

type SystemSettings = { id: string; maintenanceMode: boolean; createdAt: Date; updatedAt: Date } | null;

export function SettingsClient({ settings }: { settings: SystemSettings }) {
  const [maintenance, setMaintenance] = useState(settings?.maintenanceMode ?? false);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    const next = !maintenance;
    await toggleMaintenanceMode(next);
    setMaintenance(next);
    toast.success(`Maintenance mode ${next ? "enabled" : "disabled"}.`);
    setLoading(false);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-[var(--foreground)]">System Settings</h1>
        <p className="text-[var(--muted-foreground)] mt-1">Manage global system configuration.</p>
      </div>

      {/* Maintenance Mode */}
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
          {maintenance ? "⚠ Maintenance mode is currently ACTIVE" : "✓ System is operating normally"}
        </p>
      </div>

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
