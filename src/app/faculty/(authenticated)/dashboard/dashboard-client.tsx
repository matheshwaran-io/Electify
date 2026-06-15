"use client";

import * as React from "react";
import { toggleRegistration, resetAllRegistrations, notifyPendingStudents } from "@/app/actions/settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/premium/glass-card";
import { AnimatedCounter } from "@/components/premium/animated-counter";
import { OccupancyRing } from "@/components/premium/occupancy-ring";
import { toast } from "sonner";
import { Users, CheckCircle, Clock, Percent, ShieldCheck, Mail, RotateCcw, Activity, ShieldAlert, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from "recharts";

interface ElectiveStat {
  id: string;
  name: string;
  groupNumber: number;
  totalSeats: number;
  availableSeats: number;
  bookedSeats: number;
  percentage: number;
}

interface DashboardClientProps {
  stats: {
    totalStudents: number;
    registeredStudents: number;
    pendingStudents: number;
    registrationPercentage: number;
  };
  electives: ElectiveStat[];
  initialRegistrationEnabled: boolean;
}

export function DashboardClient({
  stats,
  electives,
  initialRegistrationEnabled,
}: DashboardClientProps) {
  const [regEnabled, setRegEnabled] = React.useState(initialRegistrationEnabled);
  const [isToggling, setIsToggling] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [isSendingReminders, setIsSendingReminders] = React.useState(false);
  const [showConfirmReset, setShowConfirmReset] = React.useState(false);

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const g1Electives = React.useMemo(() => electives.filter((e) => e.groupNumber === 1), [electives]);
  const g2Electives = React.useMemo(() => electives.filter((e) => e.groupNumber === 2), [electives]);

  // Chart data formatting
  const chartData = React.useMemo(() => {
    return electives.map((e) => {
      // Find course code inside parentheses, e.g. "Computer Vision (CV)" -> "CV"
      const nameParts = e.name.split(" (");
      const shortName = nameParts[0];
      let code = shortName;
      if (nameParts[1]) {
        code = nameParts[1].replace(")", "");
      }

      return {
        fullName: e.name,
        code: code,
        booked: e.bookedSeats,
        available: e.availableSeats,
        capacity: e.totalSeats,
      };
    });
  }, [electives]);

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    const result = await toggleRegistration(checked);

    if (result.success) {
      setRegEnabled(checked);
      toast.success(checked ? "Registration is now live!" : "Registration is now paused.");
    } else {
      toast.error(result.error || "Failed to update status.");
    }
    setIsToggling(false);
  };

  const handleReset = async () => {
    setIsResetting(true);
    const result = await resetAllRegistrations();
    if (result.success) {
      toast.success("Successfully reset all student registrations & course capacities.");
      setShowConfirmReset(false);
    } else {
      toast.error(result.error || "Failed to reset database.");
    }
    setIsResetting(false);
  };

  const handleSendReminders = async () => {
    setIsSendingReminders(true);
    const result = await notifyPendingStudents();
    if (result.success) {
      toast.success(`Successfully broadcasted reminder alerts to ${result.count || 0} pending students.`);
    } else {
      toast.error(result.error || "Failed to broadcast notifications.");
    }
    setIsSendingReminders(false);
  };

  const renderProgressChart = (elective: ElectiveStat) => {
    const fillPercent = elective.percentage;
    const isFull = elective.availableSeats <= 0;

    return (
      <div key={elective.id} className="p-4 border border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/10 rounded-inputs hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-all space-y-3">
        <div className="flex justify-between items-start gap-4">
          <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm sm:text-base leading-snug line-clamp-2">
            {elective.name}
          </span>
          <div className="shrink-0">
            <OccupancyRing value={fillPercent} size={42} strokeWidth={4} />
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-400">
            <span>SEATS BOOKED</span>
            <span className={isFull ? "text-rose-500" : "text-slate-600 dark:text-slate-300"}>
              {elective.bookedSeats} / {elective.totalSeats}
            </span>
          </div>

          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(fillPercent, 100)}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${
                isFull
                  ? "from-rose-500 to-rose-600"
                  : fillPercent >= 85
                  ? "from-amber-500 to-amber-600"
                  : "from-indigo-500 to-cyan-500"
              }`}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      
      {/* Administrative Panel Controls & Health Checks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Live Registration Gate & Health Checks */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard glow="cyan" hoverEffect={false} className="border-white/10 p-6 sm:p-8 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold uppercase tracking-wider border border-cyan-500/10">
                  <ShieldCheck className="w-3.5 h-3.5" /> Emergency Controls
                </div>
                
                {/* Active System Health */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/10">
                  <Activity className="w-3 h-3 animate-pulse" /> System Operational
                </div>
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Live Registration Gate
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold leading-relaxed mt-1">
                  Instantly toggle student portal accessibility. Pausing registration immediately overrides scheduled timers, locking the selection forms.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 bg-slate-100/50 dark:bg-slate-900/40 p-4 border border-slate-200/40 dark:border-slate-800/40 rounded-inputs mt-6">
              <div className="flex items-center gap-2.5">
                {regEnabled ? (
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-slate-400 dark:bg-slate-700" />
                )}
                <Label htmlFor="reg-toggle" className="font-extrabold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-widest leading-none">
                  {regEnabled ? "Active / Open" : "Inactive / Closed"}
                </Label>
              </div>
              <Switch
                id="reg-toggle"
                checked={regEnabled}
                onCheckedChange={handleToggle}
                disabled={isToggling}
              />
            </div>
          </GlassCard>
        </div>

        {/* Right 1 Column: Rapid Administrative Actions */}
        <div>
          <GlassCard glow="indigo" hoverEffect={false} className="border-white/10 p-6 sm:p-8 h-full flex flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/10">
                <Activity className="w-3.5 h-3.5" /> Rapid Console Actions
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                  Command Controls
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1">
                  Execute direct database operations and email broadcasts.
                </p>
              </div>
            </div>

            <div className="space-y-3.5 mt-6">
              {/* 1. Broadcast reminders */}
              <button
                onClick={handleSendReminders}
                disabled={isSendingReminders || stats.pendingStudents === 0}
                className="touch-none w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-buttons text-xs font-extrabold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 active:bg-slate-100 transition-all disabled:opacity-50"
              >
                {isSendingReminders ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Broadcasting Alerts...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" /> Notify Pending Students
                  </>
                )}
              </button>

              {/* 2. Reset database */}
              {!showConfirmReset ? (
                <button
                  onClick={() => setShowConfirmReset(true)}
                  disabled={isResetting || stats.registeredStudents === 0}
                  className="touch-none w-full inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] rounded-buttons text-xs font-extrabold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-lg shadow-rose-500/10 transition-all disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset All Registrations
                </button>
              ) : (
                <div className="p-3 border border-rose-500/20 bg-rose-500/5 rounded-inputs space-y-2">
                  <div className="flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-rose-600 dark:text-rose-400 font-extrabold leading-snug">
                      WARNING: This deletes ALL registration records and resets course seats to full capacity.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleReset}
                      disabled={isResetting}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-buttons text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-extrabold transition-all"
                    >
                      {isResetting ? "Resetting..." : "Yes, Reset All"}
                    </button>
                    <button
                      onClick={() => setShowConfirmReset(false)}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-buttons text-[10px] border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 font-extrabold transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Real-time KPI Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* KPI 1: Total Students */}
        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/15">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">MCA Intake</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.totalStudents} />
            </span>
          </div>
        </GlassCard>

        {/* KPI 2: Completed */}
        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/15">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Submitted</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.registeredStudents} />
            </span>
          </div>
        </GlassCard>

        {/* KPI 3: Pending */}
        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/15">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pending</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.pendingStudents} />
            </span>
          </div>
        </GlassCard>

        {/* KPI 4: Completion Rate */}
        <GlassCard hoverEffect className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-buttons bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/15">
            <Percent className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Response Rate</span>
            <span className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-0.5 block">
              <AnimatedCounter value={stats.registrationPercentage} />%
            </span>
          </div>
        </GlassCard>
      </div>

      {/* Visual Analytics Chart */}
      {isMounted && (
        <GlassCard hoverEffect={false} className="border-white/10 p-6 sm:p-8">
          <div className="border-b border-slate-200/60 dark:border-slate-800/60 pb-4 mb-6">
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Real-Time Booking Distribution</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Comparison of seats booked vs total capacity across courses</p>
          </div>

          <div className="h-56 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#80808020" />
                <XAxis 
                  dataKey="code" 
                  tick={{ fill: '#808080', fontSize: 10, fontWeight: 'bold' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fill: '#808080', fontSize: 10, fontWeight: 'bold' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: '#80808008' }}
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderRadius: '12px',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    color: '#ffffff'
                  }}
                  itemStyle={{ color: '#818cf8', fontWeight: 'bold', fontSize: 12 }}
                  labelStyle={{ color: '#ffffff', fontWeight: 'extrabold', fontSize: 13, marginBottom: 4 }}
                  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                  formatter={(value: any, name: any) => {
                    return [value, name === 'booked' ? 'Seats Booked' : 'Remaining Capacity'];
                  }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle"
                  formatter={(value) => <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{value === 'booked' ? 'Booked Seats' : 'Remaining Capacity'}</span>}
                />
                <Bar dataKey="booked" stackId="a" fill="url(#bookedGlow)" radius={[0, 0, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-booked-${index}`} 
                      fill={entry.booked >= entry.capacity ? '#ef4444' : 'url(#bookedGlow)'} 
                    />
                  ))}
                </Bar>
                <Bar dataKey="available" stackId="a" fill="#80808018" radius={[4, 4, 0, 0]} />
                
                {/* SVG gradients definition */}
                <defs>
                  <linearGradient id="bookedGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {/* Grid Allocation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Group 1 list */}
        <GlassCard hoverEffect={false} className="border-white/10 p-6 sm:p-8">
          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800/60 pb-4 mb-6">
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Group 1 Electives</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Real-time seat allocation status</p>
            </div>
            <div className="p-2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase border border-indigo-500/10">
              Group 1
            </div>
          </div>
          <div className="space-y-4">
            {g1Electives.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-8">No courses created in Group 1.</p>
            ) : (
              g1Electives.map(renderProgressChart)
            )}
          </div>
        </GlassCard>

        {/* Group 2 list */}
        <GlassCard hoverEffect={false} className="border-white/10 p-6 sm:p-8">
          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800/60 pb-4 mb-6">
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Group 2 Electives</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Real-time seat allocation status</p>
            </div>
            <div className="p-2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase border border-indigo-500/10">
              Group 2
            </div>
          </div>
          <div className="space-y-4">
            {g2Electives.length === 0 ? (
              <p className="text-xs font-bold text-slate-400 text-center py-8">No courses created in Group 2.</p>
            ) : (
              g2Electives.map(renderProgressChart)
            )}
          </div>
        </GlassCard>
      </div>

    </div>
  );
}
