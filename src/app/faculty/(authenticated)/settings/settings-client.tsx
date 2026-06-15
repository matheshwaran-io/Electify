"use client";

import * as React from "react";
import { updateSystemSettings, createFacultyAccount } from "@/app/actions/settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Settings2, UserPlus, Save, Database } from "lucide-react";
import { GlassCard } from "@/components/premium/glass-card";
import { PremiumButton } from "@/components/premium/premium-button";
import { PremiumInput } from "@/components/premium/premium-input";


interface SettingsClientProps {
  settings: {
    maintenanceMode: boolean;
    showLiveSeats: boolean;
    allowFacultyEditing: boolean;
    allowRegistrationEdit: boolean;
    registrationStart: Date;
    registrationEnd: Date;
  };
}

// Validation schemas
const togglesSchema = z.object({
  maintenanceMode: z.boolean(),
  showLiveSeats: z.boolean(),
  allowFacultyEditing: z.boolean(),
  allowRegistrationEdit: z.boolean(),
});

const createFacultySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["FACULTY", "SUPER_ADMIN"]),
});

type CreateFacultyFormValues = z.infer<typeof createFacultySchema>;

export function SettingsClient({ settings }: SettingsClientProps) {
  const [isUpdatingToggles, setIsUpdatingToggles] = React.useState(false);
  const [isCreatingFaculty, setIsCreatingFaculty] = React.useState(false);

  // Toggles Form
  const {
    handleSubmit: handleSubmitToggles,
    setValue: setTogglesValue,
    watch: watchToggles,
  } = useForm<z.infer<typeof togglesSchema>>({
    resolver: zodResolver(togglesSchema),
    defaultValues: {
      maintenanceMode: settings.maintenanceMode,
      showLiveSeats: settings.showLiveSeats,
      allowFacultyEditing: settings.allowFacultyEditing,
      allowRegistrationEdit: settings.allowRegistrationEdit,
    },
  });

  // Create Faculty Form
  const {
    register: registerFaculty,
    handleSubmit: handleSubmitFaculty,
    setValue: setFacultyValue,
    reset: resetFaculty,
    watch: watchFaculty,
    formState: { errors: facultyErrors },
  } = useForm<CreateFacultyFormValues>({
    resolver: zodResolver(createFacultySchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "FACULTY",
    },
  });

  const onUpdateToggles = async (data: z.infer<typeof togglesSchema>) => {
    setIsUpdatingToggles(true);

    const response = await updateSystemSettings({
      maintenanceMode: data.maintenanceMode,
      showLiveSeats: data.showLiveSeats,
      allowFacultyEditing: data.allowFacultyEditing,
      allowRegistrationEdit: data.allowRegistrationEdit,
      registrationStart: new Date(settings.registrationStart),
      registrationEnd: new Date(settings.registrationEnd),
    });

    if (response.success) {
      toast.success("System configurations saved successfully.");
    } else {
      toast.error(response.error || "Failed to save settings.");
    }
    setIsUpdatingToggles(false);
  };

  const onCreateFaculty = async (data: CreateFacultyFormValues) => {
    setIsCreatingFaculty(true);
    const response = await createFacultyAccount({
      name: data.name,
      email: data.email,
      passwordHash: data.password, // Plain password, Server Action hashes it
      role: data.role,
    });

    if (response.success) {
      toast.success(`Faculty account created for ${data.name}`);
      resetFaculty();
    } else {
      toast.error(response.error || "Failed to create account.");
    }
    setIsCreatingFaculty(false);
  };

  // Watch toggles for state styling
  const maintenanceModeWatch = watchToggles("maintenanceMode");
  const showLiveSeatsWatch = watchToggles("showLiveSeats");
  const allowFacultyEditingWatch = watchToggles("allowFacultyEditing");
  const allowRegistrationEditWatch = watchToggles("allowRegistrationEdit");
  const roleWatch = watchFaculty("role");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Settings Form Column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Card 1: Administrative Toggles */}
        <form onSubmit={handleSubmitToggles(onUpdateToggles)}>
          <GlassCard hoverEffect={false} className="border-white/10 p-0 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-200/60 dark:border-slate-800/60">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5">
                <Settings2 className="w-5 h-5 text-indigo-500" /> System Configurations
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                Manage registration window, display controls, and override limits.
              </p>
            </div>

            <div className="p-6 sm:p-8 space-y-4">
              {/* Feature Toggles */}
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <Database className="w-4 h-4 text-indigo-500" /> Administrative Toggles
              </h3>
              
              {/* 1. Maintenance Mode */}
              <div className="flex items-center justify-between p-4.5 border border-slate-200/50 dark:border-slate-800/40 rounded-inputs bg-slate-50/50 dark:bg-slate-950/20 transition-all">
                <div className="space-y-1 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="maintenanceMode" className="font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm uppercase tracking-wider cursor-pointer">
                      Maintenance Lockdown
                    </Label>
                    {maintenanceModeWatch ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/10 animate-pulse">
                        Lockdown Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/10">
                        System Operational
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold leading-relaxed">
                    Lends full lockdown. Redirects students to a holding placeholder.
                  </p>
                </div>
                <Switch
                  id="maintenanceMode"
                  checked={maintenanceModeWatch}
                  onCheckedChange={(checked) => setTogglesValue("maintenanceMode", checked)}
                />
              </div>

              {/* 2. Show Live Seats */}
              <div className="flex items-center justify-between p-4.5 border border-slate-200/50 dark:border-slate-800/40 rounded-inputs bg-slate-50/50 dark:bg-slate-950/20 transition-all">
                <div className="space-y-1 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="showLiveSeats" className="font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm uppercase tracking-wider cursor-pointer">
                      Show Realtime Quotas
                    </Label>
                    {showLiveSeatsWatch ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-cyan-500 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/10">
                        Live Quotas
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-slate-400 bg-slate-500/10 px-2.5 py-0.5 rounded-full border border-slate-500/10">
                        Muted
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold leading-relaxed">
                    Display remaining seat capacity count numbers to student interface pages.
                  </p>
                </div>
                <Switch
                  id="showLiveSeats"
                  checked={showLiveSeatsWatch}
                  onCheckedChange={(checked) => setTogglesValue("showLiveSeats", checked)}
                />
              </div>

              {/* 3. Allow Faculty Editing */}
              <div className="flex items-center justify-between p-4.5 border border-slate-200/50 dark:border-slate-800/40 rounded-inputs bg-slate-50/50 dark:bg-slate-950/20 transition-all">
                <div className="space-y-1 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="allowFacultyEditing" className="font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm uppercase tracking-wider cursor-pointer">
                      Faculty Editing Access
                    </Label>
                    {allowFacultyEditingWatch ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-violet-500 bg-violet-500/10 px-2.5 py-0.5 rounded-full border border-violet-500/10">
                        Faculty Grants On
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/10">
                        Super Admin Only
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold leading-relaxed">
                    Allow standard faculty privileges to modify lists and override student counts.
                  </p>
                </div>
                <Switch
                  id="allowFacultyEditing"
                  checked={allowFacultyEditingWatch}
                  onCheckedChange={(checked) => setTogglesValue("allowFacultyEditing", checked)}
                />
              </div>

              {/* 4. Allow Registration Edit */}
              <div className="flex items-center justify-between p-4.5 border border-slate-200/50 dark:border-slate-800/40 rounded-inputs bg-slate-50/50 dark:bg-slate-950/20 transition-all">
                <div className="space-y-1 pr-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor="allowRegistrationEdit" className="font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm uppercase tracking-wider cursor-pointer">
                      Allow Amendment Requests
                    </Label>
                    {allowRegistrationEditWatch ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/10">
                        Amendments Open
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest text-rose-500 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/10">
                        Amendments Locked
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold leading-relaxed">
                    Allow student submit actions to release seats and switch course selections.
                  </p>
                </div>
                <Switch
                  id="allowRegistrationEdit"
                  checked={allowRegistrationEditWatch}
                  onCheckedChange={(checked) => setTogglesValue("allowRegistrationEdit", checked)}
                />
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-950/20 px-6 sm:px-8 py-4 flex justify-end border-t border-slate-200/60 dark:border-slate-800/60">
              <PremiumButton
                type="submit"
                disabled={isUpdatingToggles}
                variant="primary"
                className="shadow-lg shadow-indigo-500/10"
              >
                {isUpdatingToggles ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving Configuration...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" /> Save System Properties
                  </>
                )}
              </PremiumButton>
            </div>
          </GlassCard>
        </form>
      </div>

      {/* RBAC Create Faculty Account Column */}
      <div>
        <form onSubmit={handleSubmitFaculty(onCreateFaculty)}>
          <GlassCard hoverEffect={false} className="border-white/10 p-0 overflow-hidden">
            <div className="p-6 border-b border-slate-200/60 dark:border-slate-800/60">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-rose-500" /> Provision Account
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 font-semibold">
                Provision new admin or faculty accounts.
              </p>
            </div>

            <div className="p-6 space-y-4.5">
              <PremiumInput
                id="fac-name"
                label="Full Name"
                placeholder="Prof. John Doe"
                error={facultyErrors.name?.message}
                disabled={isCreatingFaculty}
                {...registerFaculty("name")}
              />

              <PremiumInput
                id="fac-email"
                type="email"
                label="Staff Email Address"
                placeholder="doe@electify.edu"
                error={facultyErrors.email?.message}
                disabled={isCreatingFaculty}
                {...registerFaculty("email")}
              />

              <PremiumInput
                id="fac-pass"
                type="password"
                label="Secure Password"
                placeholder="••••••••"
                error={facultyErrors.password?.message}
                disabled={isCreatingFaculty}
                {...registerFaculty("password")}
              />

              <div className="space-y-1.5">
                <Label htmlFor="fac-role" className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Administrative Privilege
                </Label>
                <Select
                  value={roleWatch}
                  onValueChange={(val: "FACULTY" | "SUPER_ADMIN" | null) => {
                    if (val) setFacultyValue("role", val);
                  }}
                >
                  <SelectTrigger id="fac-role" className="w-full h-11 border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm rounded-inputs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-semibold">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-cards bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/50">
                    <SelectItem value="FACULTY">Faculty (Standard CRUD)</SelectItem>
                    <SelectItem value="SUPER_ADMIN">Super Admin (System Settings)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-950/20 px-6 py-4 border-t border-slate-200/60 dark:border-slate-800/60">
              <PremiumButton
                type="submit"
                disabled={isCreatingFaculty}
                variant="accent"
                className="w-full shadow-lg shadow-rose-500/10 justify-center bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isCreatingFaculty ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Provisioning User...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" /> Add Staff Account
                  </>
                )}
              </PremiumButton>
            </div>
          </GlassCard>
        </form>
      </div>
    </div>
  );
}
