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
import { spring } from "@/lib/motion";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
}

interface DashboardClientProps {
  session: UserSession;
  metrics: any;
  activeWorkspace?: string;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
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

export function DashboardClient({ session, metrics, activeWorkspace = "COORDINATOR" }: DashboardClientProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!metrics) return null;

  const tutorMetrics = metrics;
  const coordinatorMetrics = metrics;

  const showTutorView = session.role === "CLASS_TUTOR" || (session.role === "COURSE_COORDINATOR" && activeWorkspace === "TUTOR");
  const showCoordinatorView = session.role === "COURSE_COORDINATOR" && activeWorkspace === "COORDINATOR";

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/50 relative"
      >
        <div className="space-y-1 relative z-10">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Welcome back, {session.name.split(" ")[0]}
          </h1>
          <p className="text-sm text-fg-muted">
            Here's what's happening with Electify today.
          </p>
        </div>
      </motion.div>

      {/* Class Tutor Specific View */}
      {showTutorView && (
        <div className="space-y-8 animate-enter">
          
          {/* Quick Links */}
          <motion.div 
            variants={containerVariants} initial="hidden" animate="show"
            className="grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <Link href="/faculty/section" className="block group">
              <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 shadow-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-control bg-primary/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-primary-text" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-fg">Student Directory</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted">Manage your intake and registrations</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-primary-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/tutor-electives" className="block group">
              <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 shadow-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-control bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary-text" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-fg">Course Catalog</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted">Configure subjects and capacities</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-primary-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/window" className="block group">
              <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden transition-all duration-300 hover:border-warning/30 hover:bg-warning/5 shadow-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-control bg-warning/10 flex items-center justify-center">
                    <Settings className="w-4 h-4 text-warning-text" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-fg">Reg Control Center</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted">Adjust timers and registration rules</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-warning-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </motion.div>

          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="My Section Students" value={tutorMetrics.totalStudents} icon={Users} color="text-primary-text" />
            <StatCard title="Course Options" value={tutorMetrics.courseOptionsCount} icon={BookOpen} color="text-primary-text" />
            <StatCard title="Completed Regs" value={tutorMetrics.registeredCount} icon={CheckCircle2} color="text-success-text" />
            <StatCard title="Seat Allocation" value={`${tutorMetrics.allocationRate}%`} icon={Percent} color="text-warning-text" />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Registration Window Widget */}
            <div className="lg:col-span-1 bg-surface rounded-card border border-border shadow-1 p-5 flex flex-col relative overflow-hidden">
              <h2 className="text-sm font-semibold text-fg flex items-center gap-2 mb-6">
                <Clock className="w-4 h-4 text-fg-muted" />
                Portal Status
              </h2>
              {tutorMetrics.activeEvent ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-2xs font-semibold uppercase tracking-wider border ${
                    tutorMetrics.activeEvent.status === "ACTIVE" || tutorMetrics.activeEvent.status === "PUBLISHED" 
                      ? "bg-success/10 text-success-text border-success/20" 
                      : "bg-warning/10 text-warning-text border-warning/20"
                  }`}>
                    {tutorMetrics.activeEvent.status}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-fg">{tutorMetrics.activeEvent.name}</h3>
                    <p className="text-sm font-mono text-fg-muted mt-1.5 opacity-80">
                      {formatCountdown(tutorMetrics.activeEvent.closeDate)}
                    </p>
                  </div>
                  <Link href="/faculty/window" className="text-sm font-medium text-primary-text hover:text-primary-text transition-colors mt-4 border-b border-primary/30 pb-0.5">Edit Timers</Link>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-fg-muted opacity-60 p-4">
                  <Calendar className="w-8 h-8 mb-3 stroke-[1.5]" />
                  <p className="text-sm">No Registration Window</p>
                </div>
              )}
            </div>

            {/* Recent Submissions Feed */}
            <div className="lg:col-span-1 bg-surface rounded-card border border-border shadow-1 overflow-hidden flex flex-col h-100">
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <ListPlus className="w-4 h-4 text-fg-muted" />
                  Recent Submissions
                </h2>
              </div>
              <div className="divide-y divide-border/50 overflow-y-auto scrollbar-thin">
                {tutorMetrics.recentRegistrations?.length > 0 ? (
                  tutorMetrics.recentRegistrations.map((reg: any) => (
                    <div key={reg.id} className="p-4 flex items-start gap-4 hover:bg-surface-2/30 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg">
                          {reg.studentName} <span className="text-fg-muted font-mono text-xs ml-1 opacity-70">({reg.studentRegNo})</span>
                        </p>
                        <p className="text-sm text-fg-muted mt-0.5 truncate flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-success/50" />
                          Registered for <span className="text-fg font-medium">{reg.electiveName}</span>
                        </p>
                      </div>
                      <div className="text-xs font-mono text-fg-muted whitespace-nowrap opacity-70">
                        {format(new Date(reg.createdAt), "MMM d, h:mm a")}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-sm text-fg-muted">
                    No submissions yet.
                  </div>
                )}
              </div>
            </div>

            {/* Pending Students */}
            <div className="lg:col-span-1 bg-surface rounded-card border border-border shadow-1 overflow-hidden flex flex-col h-100">
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <UserMinus className="w-4 h-4 text-warning-text" />
                  Pending Students
                  <span className="ml-2 px-2 py-0.5 bg-warning/10 text-warning-text rounded-badge text-2xs font-mono">
                    {tutorMetrics.pendingStudents?.length || 0}
                  </span>
                </h2>
              </div>
              <div className="divide-y divide-border/50 overflow-y-auto scrollbar-thin">
                {tutorMetrics.pendingStudents?.length > 0 ? (
                  tutorMetrics.pendingStudents.map((student: any) => (
                    <div key={student.id} className="p-4 flex items-center gap-4 hover:bg-surface-2/30 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-fg truncate">
                          {student.name}
                        </p>
                        <p className="text-xs font-mono text-fg-muted mt-0.5">
                          {student.registerNumber}
                        </p>
                      </div>
                      <div className="text-2xs font-medium text-warning-text bg-warning/10 px-2 py-1 rounded-badge">
                        Not Registered
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 flex flex-col items-center text-center text-fg-muted">
                    <CheckCircle2 className="w-8 h-8 mb-3 text-success-text/50" />
                    <p className="text-sm font-medium text-fg">All students registered!</p>
                    <p className="text-xs mt-1 opacity-70">100% completion rate</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course Coordinator Specific View */}
      {showCoordinatorView && (
        <div className="space-y-8 animate-enter">
          
          {/* Quick Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/faculty/events" className="block group">
              <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 shadow-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-control bg-primary/10 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-primary-text" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-fg">Registration Events</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted">Create and manage registration timelines</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-primary-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/templates" className="block group">
              <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 shadow-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-control bg-primary/10 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-primary-text" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-fg">Event Templates</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted">Reusable structures and rulesets</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-primary-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/electives" className="block group">
              <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 shadow-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-control bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary-text" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-fg">Master Catalog</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted">Manage master elective courses</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-primary-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>

            <Link href="/faculty/reports" className="block group">
              <div className="bg-surface border border-border rounded-card p-5 relative overflow-hidden transition-all duration-300 hover:border-success/30 hover:bg-success/5 shadow-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-control bg-success/10 flex items-center justify-center">
                    <ListPlus className="w-4 h-4 text-success-text" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-fg">Coordinator Reports</h3>
                  </div>
                </div>
                <p className="text-xs text-fg-muted">Export registrations & print PDF/CSV</p>
                <ArrowUpRight className="absolute top-5 right-5 w-4 h-4 text-success-text opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Events" value={coordinatorMetrics.totalEvents} icon={Calendar} color="text-primary-text" />
            <StatCard title="Active Events" value={coordinatorMetrics.activeEventsCount} icon={Activity} color="text-success-text" />
            <StatCard title="Event Templates" value={coordinatorMetrics.totalTemplates} icon={Layers} color="text-primary-text" />
            <StatCard title="Master Electives" value={coordinatorMetrics.totalElectives} icon={BookOpen} color="text-primary-text" />
          </div>

          {/* Recent Events Widget */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-surface rounded-card border border-border shadow-1 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h2 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <Activity className="w-4 h-4 text-fg-muted" />
                  Recent Registration Events
                </h2>
              </div>
              <div className="divide-y divide-border/50 overflow-y-auto max-h-75 scrollbar-thin">
                {coordinatorMetrics.recentEvents?.length > 0 ? (
                  coordinatorMetrics.recentEvents.map((evt: any) => (
                    <div key={evt.id} className="p-4 flex items-center justify-between gap-4 hover:bg-surface-2/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg truncate">{evt.name}</p>
                        <p className="text-xs text-fg-muted mt-0.5 flex items-center gap-2">
                          <span>Open: {evt.openDate ? format(new Date(evt.openDate), "MMM d, yyyy") : "N/A"}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>Close: {evt.closeDate ? format(new Date(evt.closeDate), "MMM d, yyyy") : "N/A"}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider border ${
                          evt.status === "PUBLISHED" || evt.status === "OPEN"
                            ? "bg-success/10 text-success-text border-success/20"
                            : evt.status === "DRAFT"
                            ? "bg-warning/10 text-warning-text border-warning/20"
                            : "bg-fg-subtle/10 text-fg-muted border-border-strong"
                        }`}>
                          {evt.status}
                        </span>
                        <Link 
                          href="/faculty/events" 
                          className="p-1 hover:bg-border/50 rounded-badge text-fg-muted hover:text-fg transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-sm text-fg-muted">
                    No registration events created yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role-specific Metrics for SYSTEM_ADMIN */}
      {session.role === "SYSTEM_ADMIN" && (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <StatCard title="Total Students" value={metrics.totalStudents} icon={GraduationCap} color="text-primary-text" bgColor="bg-primary/10" />
          <StatCard title="Course Coordinators" value={metrics.totalFaculty} icon={Users} color="text-primary-text" bgColor="bg-primary/10" />
          <StatCard title="Active Events" value={metrics.activeEvents} icon={Calendar} color="text-primary-text" bgColor="bg-primary/10" />
          <StatCard title="System Status" value="Healthy" icon={Activity} color="text-success-text" bgColor="bg-success/10" />
        </motion.div>
      )}

      {/* Recent Activity (System Admin) */}
      {session.role === "SYSTEM_ADMIN" && metrics.recentLogs && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.gentle, delay: 0.3 }}
          className="bg-surface rounded-panel border border-border overflow-hidden shadow-1"
        >
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-fg-muted" />
              Recent Audit Logs
            </h2>
          </div>
          <div className="divide-y divide-border">
            {metrics.recentLogs.map((log: any) => (
              <div key={log.id} className="p-6 flex items-start gap-4 hover:bg-surface-2/30 transition-colors">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-primary-text" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg">
                    {log.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-fg-muted mt-1">
                    {log.userEmail} ({log.userRole})
                  </p>
                </div>
                <div className="text-xs text-fg-muted whitespace-nowrap">
                  {format(new Date(log.createdAt), "MMM d, h:mm a")}
                </div>
              </div>
            ))}
            {metrics.recentLogs.length === 0 && (
              <div className="p-8 text-center text-fg-muted">
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
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: spring.gentle }
};

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <motion.div 
      variants={itemVariants}
      className="bg-surface p-5 rounded-card border border-border shadow-1 group hover:border-border transition-all duration-300 relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="w-8 h-8 rounded-control bg-surface-2 flex items-center justify-center border border-border/50 group-hover:scale-105 transition-transform duration-300">
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
      </div>
      <div>
        <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-1">{title}</h3>
        <p className="text-2xl font-semibold text-fg tracking-tight">
          {value}
        </p>
      </div>
    </motion.div>
  );
}
