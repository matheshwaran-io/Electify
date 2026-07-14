"use client";

import { motion, Variants } from "framer-motion";
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  Layers, 
  ShieldAlert, 
  BookOpen, 
  Activity,
  ArrowUpRight,
  Settings,
  Percent,
  Clock,
  CheckCircle2,
  ListPlus,
  UserMinus
} from "lucide-react";
import { format, differenceInSeconds } from "date-fns";
import { useEffect, useState } from "react";
import Link from "next/link";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
}

interface DashboardClientProps {
  session: UserSession;
  metrics: any;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

function formatCountdown(closeDate: string | null) {
  if (!closeDate) return "No deadline set";
  const d = new Date(closeDate);
  const now = new Date();
  const diff = differenceInSeconds(d, now);
  if (diff <= 0) return "Window Closed";
  
  const days = Math.floor(diff / (3600 * 24));
  const h = Math.floor((diff % (3600 * 24)) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  
  return `${days}d ${h}h ${m}m ${s}s`;
}

export function DashboardClient({ session, metrics }: DashboardClientProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!metrics) return null;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[var(--border)]/50 relative"
      >
        <div className="space-y-1 relative z-10">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Welcome back, {session.name.split(" ")[0]}
          </h1>
          <p className="text-[13px] text-[var(--muted-foreground)]">
            Here's what's happening with Electify today.
          </p>
        </div>
      </motion.div>

      {/* Class Tutor Specific View */}
      {session.role === "CLASS_TUTOR" && (
        <div className="space-y-8">
          
          {/* Quick Links */}
          <motion.div 
            variants={containerVariants} initial="hidden" animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Link href="/faculty/section" className="block group">
              <div className="bg-[var(--background)] border border-[var(--border)]/50 rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:border-blue-500/30 hover:bg-blue-500/5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[13px] text-[var(--foreground)]">Student Directory</h3>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">Manage your intake and registrations</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/tutor-electives" className="block group">
              <div className="bg-[var(--background)] border border-[var(--border)]/50 rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:border-purple-500/30 hover:bg-purple-500/5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[13px] text-[var(--foreground)]">Course Catalog</h3>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">Configure subjects and capacities</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/window" className="block group">
              <div className="bg-[var(--background)] border border-[var(--border)]/50 rounded-xl p-5 relative overflow-hidden transition-all duration-300 hover:border-amber-500/30 hover:bg-amber-500/5 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[13px] text-[var(--foreground)]">Portal Window</h3>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--muted-foreground)]">Adjust timers and registration rules</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="My Section Students" value={metrics.totalStudents} icon={Users} color="text-blue-500" />
            <StatCard title="Course Options" value={metrics.courseOptionsCount} icon={BookOpen} color="text-indigo-500" />
            <StatCard title="Completed Regs" value={metrics.registeredCount} icon={CheckCircle2} color="text-emerald-500" />
            <StatCard title="Seat Allocation" value={`${metrics.allocationRate}%`} icon={Percent} color="text-orange-500" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Registration Window Widget */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 bg-[var(--background)] rounded-xl border border-[var(--border)]/50 shadow-sm p-5 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl -translate-y-1/2 translate-x-1/2 rounded-full" />
              <h2 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-2 mb-6">
                <Clock className="w-4 h-4 text-[var(--muted-foreground)]" />
                Portal Status
              </h2>
              {metrics.activeEvent ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${
                    metrics.activeEvent.status === "ACTIVE" || metrics.activeEvent.status === "PUBLISHED" 
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                      : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                  }`}>
                    {metrics.activeEvent.status}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">{metrics.activeEvent.name}</h3>
                    <p className="text-[13px] font-mono text-[var(--muted-foreground)] mt-1.5 opacity-80">
                      {formatCountdown(metrics.activeEvent.closeDate)}
                    </p>
                  </div>
                  <Link href="/faculty/window" className="text-[13px] font-medium text-indigo-500 hover:text-indigo-400 transition-colors mt-4 border-b border-indigo-500/30 pb-0.5">Edit Timers</Link>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--muted-foreground)] opacity-60 p-4">
                  <Calendar className="w-8 h-8 mb-3 stroke-[1.5]" />
                  <p className="text-[13px]">No Registration Window</p>
                </div>
              )}
            </motion.div>

            {/* Recent Submissions Feed */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-1 bg-[var(--background)] rounded-xl border border-[var(--border)]/50 shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="flex items-center justify-between p-5 border-b border-[var(--border)]/50">
                <h2 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <ListPlus className="w-4 h-4 text-[var(--muted-foreground)]" />
                  Recent Submissions
                </h2>
              </div>
              <div className="divide-y divide-[var(--border)]/50 overflow-y-auto custom-scrollbar">
                {metrics.recentRegistrations?.length > 0 ? (
                  metrics.recentRegistrations.map((reg: any) => (
                    <div key={reg.id} className="p-4 flex items-start gap-4 hover:bg-[var(--accent)]/30 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--foreground)]">
                          {reg.studentName} <span className="text-[var(--muted-foreground)] font-mono text-[11px] ml-1 opacity-70">({reg.studentRegNo})</span>
                        </p>
                        <p className="text-[13px] text-[var(--muted-foreground)] mt-0.5 truncate flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-emerald-500/50" />
                          Registered for <span className="text-[var(--foreground)] font-medium">{reg.electiveName}</span>
                        </p>
                      </div>
                      <div className="text-[11px] font-mono text-[var(--muted-foreground)] whitespace-nowrap opacity-70">
                        {format(new Date(reg.createdAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-[13px] text-[var(--muted-foreground)]">
                    No submissions yet.
                  </div>
                )}
              </div>
            </motion.div>

            {/* Pending Students */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-1 bg-[var(--background)] rounded-xl border border-[var(--border)]/50 shadow-sm overflow-hidden flex flex-col h-[400px]">
              <div className="flex items-center justify-between p-5 border-b border-[var(--border)]/50">
                <h2 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <UserMinus className="w-4 h-4 text-orange-500" />
                  Pending Students
                  <span className="ml-2 px-2 py-0.5 bg-orange-500/10 text-orange-500 rounded text-[10px] font-mono">
                    {metrics.pendingStudents?.length || 0}
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-[var(--border)]/50 overflow-y-auto custom-scrollbar">
                {metrics.pendingStudents?.length > 0 ? (
                  metrics.pendingStudents.map((student: any) => (
                    <div key={student.id} className="p-4 flex items-center gap-4 hover:bg-[var(--accent)]/30 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[var(--foreground)] truncate">
                          {student.name}
                        </p>
                        <p className="text-[11px] font-mono text-[var(--muted-foreground)] mt-0.5">
                          {student.registerNumber}
                        </p>
                      </div>
                      <div className="text-[10px] font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded">
                        Not Registered
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 flex flex-col items-center text-center text-[var(--muted-foreground)]">
                    <CheckCircle2 className="w-8 h-8 mb-3 text-emerald-500/50" />
                    <p className="text-[13px] font-medium text-[var(--foreground)]">All students registered!</p>
                    <p className="text-[11px] mt-1 opacity-70">100% completion rate</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Role-specific Metrics for SYSTEM_ADMIN and COURSE_COORDINATOR */}
      {session.role !== "CLASS_TUTOR" && (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {session.role === "SYSTEM_ADMIN" && (
            <>
              <StatCard title="Total Students" value={metrics.totalStudents} icon={GraduationCap} color="text-blue-500" bgColor="bg-blue-500/10" />
              <StatCard title="Course Coordinators" value={metrics.totalFaculty} icon={Users} color="text-indigo-500" bgColor="bg-indigo-500/10" />
              <StatCard title="Active Events" value={metrics.activeEvents} icon={Calendar} color="text-purple-500" bgColor="bg-purple-500/10" />
              <StatCard title="System Status" value="Healthy" icon={Activity} color="text-emerald-500" bgColor="bg-emerald-500/10" />
            </>
          )}

          {session.role === "COURSE_COORDINATOR" && (
            <>
              <StatCard title="Total Events" value={metrics.totalEvents} icon={Calendar} color="text-blue-500" bgColor="bg-blue-500/10" />
              <StatCard title="Event Templates" value={metrics.totalTemplates} icon={Layers} color="text-indigo-500" bgColor="bg-indigo-500/10" />
              <StatCard title="Total Electives" value="-" icon={BookOpen} color="text-purple-500" bgColor="bg-purple-500/10" />
            </>
          )}
        </motion.div>
      )}

      {/* Recent Activity (System Admin) */}
      {session.role === "SYSTEM_ADMIN" && metrics.recentLogs && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[var(--card)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[var(--muted-foreground)]" />
              Recent Audit Logs
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {metrics.recentLogs.map((log: any) => (
              <div key={log.id} className="p-6 flex items-start gap-4 hover:bg-[var(--accent)]/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {log.userEmail} ({log.userRole})
                  </p>
                </div>
                <div className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                  {format(new Date(log.createdAt), "MMM d, h:mm a")}
                </div>
              </div>
            ))}
            {metrics.recentLogs.length === 0 && (
              <div className="p-8 text-center text-[var(--muted-foreground)]">
                No recent activity.
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function StatCard({ title, value, icon: Icon, color, bgColor }: any) {
  return (
    <motion.div 
      variants={itemVariants}
      className="bg-[var(--background)] p-5 rounded-xl border border-[var(--border)]/50 shadow-sm group hover:border-[var(--border)] transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-current opacity-[0.03] blur-2xl -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none" style={{ color: 'var(--foreground)' }} />
      
      <div className="flex justify-between items-start mb-6">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent)] flex items-center justify-center border border-[var(--border)]/50 group-hover:scale-105 transition-transform duration-300">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div>
        <h3 className="text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">{title}</h3>
        <p className="text-2xl font-semibold text-[var(--foreground)] tracking-tight">
          {value}
        </p>
      </div>
    </motion.div>
  );
}
