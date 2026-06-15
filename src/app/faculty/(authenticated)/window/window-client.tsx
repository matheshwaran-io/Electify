"use client";

import * as React from "react";
import { updateSystemSettings } from "@/app/actions/settings";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Save, CalendarRange, Clock, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/premium/glass-card";
import { PremiumButton } from "@/components/premium/premium-button";

// Convert Date to local YYYY-MM-DDTHH:MM string for input[type="datetime-local"]
function toLocalISOString(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  return localISOTime;
}

interface WindowClientProps {
  settings: {
    maintenanceMode: boolean;
    showLiveSeats: boolean;
    allowFacultyEditing: boolean;
    allowRegistrationEdit: boolean;
    registrationStart: Date;
    registrationEnd: Date;
  };
}

const timingsSchema = z.object({
  registrationStart: z.string().min(1, "Start time is required"),
  registrationEnd: z.string().min(1, "End time is required"),
}).refine((data) => {
  return new Date(data.registrationStart) < new Date(data.registrationEnd);
}, {
  message: "End time must be after start time",
  path: ["registrationEnd"],
});

type TimingsFormValues = z.infer<typeof timingsSchema>;

export function WindowClient({ settings }: WindowClientProps) {
  const [isUpdatingTimings, setIsUpdatingTimings] = React.useState(false);
  const [timeLeft, setTimeLeft] = React.useState("");
  const [windowStatus, setWindowStatus] = React.useState<"WAITING" | "OPEN" | "CLOSED">("CLOSED");
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  // Live Timer calculations
  React.useEffect(() => {
    const start = new Date(settings.registrationStart).getTime();
    const end = new Date(settings.registrationEnd).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();

      if (now < start) {
        setWindowStatus("WAITING");
        const diff = start - now;
        setTimeLeft(formatTimeDiff(diff));
      } else if (now >= start && now < end) {
        setWindowStatus("OPEN");
        const diff = end - now;
        setTimeLeft(formatTimeDiff(diff));
      } else {
        setWindowStatus("CLOSED");
        setTimeLeft("Closed");
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [settings.registrationStart, settings.registrationEnd]);

  function formatTimeDiff(diffMs: number): string {
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
  }

  // Timings Form
  const {
    register: registerTimings,
    handleSubmit: handleSubmitTimings,
    formState: { errors: timingsErrors },
  } = useForm<TimingsFormValues>({
    resolver: zodResolver(timingsSchema),
    defaultValues: {
      registrationStart: toLocalISOString(new Date(settings.registrationStart)),
      registrationEnd: toLocalISOString(new Date(settings.registrationEnd)),
    },
  });

  const onUpdateTimings = async (data: TimingsFormValues) => {
    setIsUpdatingTimings(true);
    const response = await updateSystemSettings({
      maintenanceMode: settings.maintenanceMode,
      showLiveSeats: settings.showLiveSeats,
      allowFacultyEditing: settings.allowFacultyEditing,
      allowRegistrationEdit: settings.allowRegistrationEdit,
      registrationStart: new Date(data.registrationStart),
      registrationEnd: new Date(data.registrationEnd),
    });

    if (response.success) {
      toast.success("Registration window timers saved successfully.");
    } else {
      toast.error(response.error || "Failed to save settings.");
    }
    setIsUpdatingTimings(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Real-time Status Tracker Card */}
      {isMounted && (
        <GlassCard hoverEffect={false} className="border-white/10 p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent blur-2xl rounded-full pointer-events-none" />
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-1.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                windowStatus === "OPEN" 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                  : windowStatus === "WAITING" 
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" 
                  : "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
              }`}>
                {windowStatus === "OPEN" ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Registration Live
                  </>
                ) : windowStatus === "WAITING" ? (
                  <>
                    <Clock className="w-3.5 h-3.5" /> Pending Opening
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3.5 h-3.5" /> Registration Closed
                  </>
                )}
              </span>

              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {windowStatus === "OPEN" 
                  ? "Student Submissions Active" 
                  : windowStatus === "WAITING" 
                  ? "Portal Window Configured" 
                  : "Student Gate Sealed"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                {windowStatus === "OPEN" 
                  ? "The registration gate is currently open and students are submitting course selections." 
                  : windowStatus === "WAITING" 
                  ? "The registration window schedule is loaded. The student portal will unlock automatically." 
                  : "The registration deadline has passed. Forms are currently locked."}
              </p>
            </div>

            {/* Countdown Display */}
            {windowStatus !== "CLOSED" && (
              <div className="p-4 border border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/40 rounded-inputs w-full md:w-auto shrink-0 flex items-center justify-between gap-6">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                    {windowStatus === "OPEN" ? "CLOSING IN" : "OPENING IN"}
                  </span>
                  <span className="text-xl font-mono font-extrabold text-slate-800 dark:text-white mt-1 block">
                    {timeLeft}
                  </span>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                  windowStatus === "OPEN" 
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/10" 
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/10"
                }`}>
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          {/* Stepper Timeline Visualizer */}
          <div className="grid grid-cols-3 gap-2 mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="flex flex-col items-center text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <span className="text-[9px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Schedule Configured</span>
              <span className="text-[8px] text-slate-400 font-semibold mt-1">Ready</span>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 border ${
                windowStatus === "OPEN" || windowStatus === "CLOSED"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600"
                  : "bg-amber-500/15 border-amber-500/30 text-amber-600 animate-pulse"
              }`}>
                {windowStatus === "OPEN" || windowStatus === "CLOSED" ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Clock className="w-4.5 h-4.5" />}
              </div>
              <span className="text-[9px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Opens At</span>
              <span className="text-[8px] text-slate-400 font-semibold mt-1">
                {new Date(settings.registrationStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 border ${
                windowStatus === "CLOSED"
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600"
                  : windowStatus === "OPEN"
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-600 animate-pulse"
                  : "bg-slate-100 dark:bg-slate-900 border-slate-200/50 dark:border-slate-800/50 text-slate-400"
              }`}>
                {windowStatus === "CLOSED" ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Calendar className="w-4.5 h-4.5" />}
              </div>
              <span className="text-[9px] font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Closes At</span>
              <span className="text-[8px] text-slate-400 font-semibold mt-1">
                {new Date(settings.registrationEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Settings Form Card */}
      <form onSubmit={handleSubmitTimings(onUpdateTimings)}>
        <GlassCard hoverEffect={false} className="border-white/10 p-0 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-violet-500" /> Scheduled Window Timers
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <Label htmlFor="registrationStart" className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Portal Opens At
                </Label>
                <input
                  id="registrationStart"
                  type="datetime-local"
                  className="w-full h-11 border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm rounded-inputs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-semibold"
                  {...registerTimings("registrationStart")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="registrationEnd" className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Portal Closes At
                </Label>
                <input
                  id="registrationEnd"
                  type="datetime-local"
                  className="w-full h-11 border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm rounded-inputs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 font-semibold"
                  {...registerTimings("registrationEnd")}
                />
                {timingsErrors.registrationEnd && (
                  <p className="text-xs font-semibold text-rose-500 mt-1">{timingsErrors.registrationEnd.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 dark:bg-slate-950/20 px-6 sm:px-8 py-4 flex justify-end border-t border-slate-200/60 dark:border-slate-800/60">
            <PremiumButton
              type="submit"
              disabled={isUpdatingTimings}
              variant="primary"
              className="shadow-lg shadow-violet-500/10 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-none"
            >
              {isUpdatingTimings ? (
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
  );
}
