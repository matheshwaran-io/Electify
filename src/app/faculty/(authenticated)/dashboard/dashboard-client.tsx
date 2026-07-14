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
  ListPlus
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

export function DashboardClient({ session, metrics }: DashboardClientProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (!metrics) return null;

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

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--card)] p-8 rounded-3xl border border-[var(--border)] shadow-sm relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[var(--primary)]/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        
        <div className="space-y-2 relative z-10">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">
            Welcome back, {session.name.split(" ")[0]}! 👋
          </h1>
          <p className="text-[var(--muted-foreground)]">
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
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <Link href="/faculty/section" className="block group">
              <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-blue-500/40">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">Student Directory</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Manage your intake</p>
                  </div>
                </div>
                <ArrowUpRight className="absolute top-6 right-6 w-5 h-5 text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/tutor-electives" className="block group">
              <div className="bg-gradient-to-br from-indigo-600/10 to-transparent border border-indigo-500/20 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-indigo-500/40">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">Course Catalog</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Configure electives</p>
                  </div>
                </div>
                <ArrowUpRight className="absolute top-6 right-6 w-5 h-5 text-indigo-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/window" className="block group">
              <div className="bg-gradient-to-br from-purple-600/10 to-transparent border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:border-purple-500/40">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Settings className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[var(--foreground)]">Portal Window</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">Adjust timers & rules</p>
                  </div>
                </div>
                <ArrowUpRight className="absolute top-6 right-6 w-5 h-5 text-purple-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="My Section Students" value={metrics.totalStudents} icon={Users} color="text-blue-500" bgColor="bg-blue-500/10" />
            <StatCard title="Course Options" value={metrics.courseOptionsCount} icon={BookOpen} color="text-indigo-500" bgColor="bg-indigo-500/10" />
            <StatCard title="Completed Regs" value={metrics.registeredCount} icon={CheckCircle2} color="text-emerald-500" bgColor="bg-emerald-500/10" />
            <StatCard title="Seat Allocation" value={`${metrics.allocationRate}%`} icon={Percent} color="text-orange-500" bgColor="bg-orange-500/10" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Registration Window Widget */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-sm p-6 flex flex-col">
              <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                <Clock className="w-5 h-5 text-[var(--muted-foreground)]" />
                Portal Status
              </h2>
              {metrics.activeEvent ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    metrics.activeEvent.status === "ACTIVE" || metrics.activeEvent.status === "PUBLISHED" 
                      ? "bg-emerald-500/10 text-emerald-500" 
                      : "bg-orange-500/10 text-orange-500"
                  }`}>
                    {metrics.activeEvent.status}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--foreground)]">{metrics.activeEvent.name}</h3>
                    <p className="text-sm font-mono font-bold text-[var(--muted-foreground)] mt-2">
                      {formatCountdown(metrics.activeEvent.closeDate)}
                    </p>
                  </div>
                  <Link href="/faculty/window" className="text-sm text-indigo-500 hover:underline mt-4">Edit Timers</Link>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--muted-foreground)] opacity-60 p-4">
                  <Calendar className="w-10 h-10 mb-3" />
                  <p className="text-sm">No Registration Window Created</p>
                </div>
              )}
            </motion.div>

            {/* Recent Submissions Feed */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 bg-[var(--card)] rounded-3xl border border-[var(--border)] shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ListPlus className="w-5 h-5 text-[var(--muted-foreground)]" />
                  Recent Submissions
                </h2>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {metrics.recentRegistrations?.length > 0 ? (
                  metrics.recentRegistrations.map((reg: any) => (
                    <div key={reg.id} className="p-6 flex items-start gap-4 hover:bg-[var(--accent)]/30 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {reg.studentName} <span className="text-[var(--muted-foreground)] font-mono text-xs">({reg.studentRegNo})</span>
                        </p>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1 truncate">
                          Registered for <strong className="text-[var(--foreground)]">{reg.electiveName}</strong>
                        </p>
                      </div>
                      <div className="text-xs font-mono text-[var(--muted-foreground)] whitespace-nowrap">
                        {format(new Date(reg.createdAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center text-[var(--muted-foreground)]">
                    No submissions yet.
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

  function StatCard({ title, value, icon: Icon, color, bgColor }: any) {
    return (
      <motion.div 
        variants={itemVariants}
        className="bg-[var(--card)] p-6 rounded-3xl border border-[var(--border)] shadow-sm group hover:shadow-md transition-all duration-300 relative overflow-hidden"
      >
        <div className="flex justify-between items-start mb-4">
          <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-1">{title}</h3>
          <p className="text-3xl font-black text-[var(--foreground)] tracking-tight">
            {value}
          </p>
        </div>
      </motion.div>
    );
  }
}
