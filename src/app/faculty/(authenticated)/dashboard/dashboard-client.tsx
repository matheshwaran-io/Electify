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
  ArrowUpRight
} from "lucide-react";
import { format } from "date-fns";

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
  // Animation variants
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

      {/* Role-specific Metrics */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {session.role === "SYSTEM_ADMIN" && (
          <>
            <StatCard 
              title="Total Students" 
              value={metrics.totalStudents} 
              icon={GraduationCap}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <StatCard 
              title="Course Coordinators" 
              value={metrics.totalFaculty} 
              icon={Users}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <StatCard 
              title="Active Events" 
              value={metrics.activeEvents} 
              icon={Calendar}
              color="text-purple-500"
              bgColor="bg-purple-500/10"
            />
            <StatCard 
              title="System Status" 
              value="Healthy" 
              icon={Activity}
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
          </>
        )}

        {session.role === "COURSE_COORDINATOR" && (
          <>
            <StatCard 
              title="Total Events" 
              value={metrics.totalEvents} 
              icon={Calendar}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <StatCard 
              title="Event Templates" 
              value={metrics.totalTemplates} 
              icon={Layers}
              color="text-indigo-500"
              bgColor="bg-indigo-500/10"
            />
            <StatCard 
              title="Total Electives" 
              value="-" 
              icon={BookOpen}
              color="text-purple-500"
              bgColor="bg-purple-500/10"
            />
          </>
        )}

        {session.role === "CLASS_TUTOR" && (
          <>
            <StatCard 
              title="My Section Students" 
              value={metrics.totalStudents} 
              icon={Users}
              color="text-blue-500"
              bgColor="bg-blue-500/10"
            />
            <StatCard 
              title="Completed Registrations" 
              value={metrics.registeredCount} 
              icon={GraduationCap}
              color="text-emerald-500"
              bgColor="bg-emerald-500/10"
            />
          </>
        )}
      </motion.div>

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
        <div className={`absolute top-0 right-0 w-32 h-32 ${bgColor} rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 opacity-50 group-hover:opacity-100 transition-opacity`} />
        
        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="text-sm font-medium text-[var(--muted-foreground)]">{title}</p>
            <h3 className="text-3xl font-bold mt-2 text-[var(--foreground)]">{value}</h3>
          </div>
          <div className={`w-12 h-12 rounded-2xl ${bgColor} flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${color}`} />
          </div>
        </div>
      </motion.div>
    );
  }
}
