"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { setWorkspacePortal } from "@/app/actions/auth";
import { toast } from "sonner";
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  Layers, 
  Clock, 
  FileText, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck,
  Building
} from "lucide-react";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
}

interface PortalSelectClientProps {
  session: UserSession;
  assignedSectionsCount: number;
  currentWorkspace: string;
}

export function PortalSelectClient({
  session,
  assignedSectionsCount,
  currentWorkspace,
}: PortalSelectClientProps) {
  const router = useRouter();
  const [loadingPortal, setLoadingPortal] = useState<"COORDINATOR" | "TUTOR" | null>(null);

  const handleSelectPortal = async (workspace: "COORDINATOR" | "TUTOR") => {
    try {
      setLoadingPortal(workspace);
      toast.loading(`Switching to ${workspace === "COORDINATOR" ? "Coordinator" : "Class Tutor"} Portal...`, { id: "portal-select" });
      
      const res = await setWorkspacePortal(workspace);
      if (res.success) {
        toast.success(`Active portal set to ${workspace === "COORDINATOR" ? "Coordinator" : "Class Tutor"}`, { id: "portal-select" });
        router.push("/faculty/dashboard");
        router.refresh();
      } else {
        throw new Error("Failed to switch workspace portal");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to switch portal", { id: "portal-select" });
      setLoadingPortal(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 py-4">
      {/* Top Welcome Banner */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-3xl bg-white/90 dark:bg-slate-900/80 border border-slate-200/90 dark:border-indigo-500/20 p-8 sm:p-10 shadow-xl dark:shadow-2xl backdrop-blur-xl"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/10 dark:bg-purple-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold uppercase tracking-wider shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Portal Selection Hub
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome, {session.name}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            As a Course Coordinator, you have full access to both the high-level <strong className="text-indigo-600 dark:text-indigo-300 font-semibold">Course Coordinator Portal</strong> and the section-focused <strong className="text-purple-600 dark:text-purple-300 font-semibold">Class Tutor Portal</strong>. Select which workspace you wish to launch.
          </p>
        </div>
      </motion.div>

      {/* Dual Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Course Coordinator Portal Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={`group relative rounded-3xl border p-8 transition-all duration-300 flex flex-col justify-between overflow-hidden backdrop-blur-xl shadow-lg hover:shadow-2xl ${
            currentWorkspace === "COORDINATOR"
              ? "bg-white dark:bg-slate-900/90 border-indigo-500 dark:border-indigo-500/60 shadow-indigo-500/10 ring-2 ring-indigo-500/20 dark:ring-indigo-500/30"
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-slate-900/80"
          }`}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/10 dark:group-hover:bg-indigo-500/20 transition-colors pointer-events-none" />
          
          <div className="space-y-6 relative z-10">
            {/* Header / Icon */}
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform shadow-xs">
                <GraduationCap className="w-7 h-7" />
              </div>
              {currentWorkspace === "COORDINATOR" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Currently Active
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                Course Coordinator Portal
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                Centralized department-wide management. Configure elective catalogs, create registration event templates, manage student databases, and analyze aggregate metrics.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Elective Course Catalog & Group Allocation</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Global Registration Templates & Event Timers</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Departmental Student Directory & Replay Logs</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Master Reports, Database Tools & Audit Controls</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-8 relative z-10">
            <button
              onClick={() => handleSelectPortal("COORDINATOR")}
              disabled={loadingPortal !== null}
              className="w-full py-3.5 px-5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 dark:bg-linear-to-r dark:from-indigo-600 dark:to-indigo-500 dark:hover:from-indigo-500 dark:hover:to-indigo-400 text-white shadow-md shadow-indigo-600/25 active:scale-[0.99] disabled:opacity-50"
            >
              {loadingPortal === "COORDINATOR" ? (
                "Launching Coordinator Portal..."
              ) : (
                <>
                  <span>Enter Coordinator Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Class Tutor Portal Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className={`group relative rounded-3xl border p-8 transition-all duration-300 flex flex-col justify-between overflow-hidden backdrop-blur-xl shadow-lg hover:shadow-2xl ${
            currentWorkspace === "TUTOR"
              ? "bg-white dark:bg-slate-900/90 border-purple-500 dark:border-purple-500/60 shadow-purple-500/10 ring-2 ring-purple-500/20 dark:ring-purple-500/30"
              : "bg-white/80 dark:bg-slate-900/60 border-slate-200/90 dark:border-slate-800 hover:border-purple-500/40 hover:bg-white dark:hover:bg-slate-900/80"
          }`}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/10 dark:group-hover:bg-purple-500/20 transition-colors pointer-events-none" />
          
          <div className="space-y-6 relative z-10">
            {/* Header / Icon */}
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-500/15 border border-purple-200/80 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform shadow-xs">
                <Users className="w-7 h-7" />
              </div>
              <div className="flex items-center gap-2">
                {assignedSectionsCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-semibold shadow-xs">
                    {assignedSectionsCount} Section{assignedSectionsCount > 1 ? "s" : ""} Assigned
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-xs">
                    Onboarding Ready
                  </span>
                )}
                {currentWorkspace === "TUTOR" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Currently Active
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors">
                Class Tutor Portal
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                Replicated Class Tutor workspace. Manage specific student section rosters, monitor section intake, adjust registration window timers, and view section reports.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Section Student Directory & Intake Management</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Section Subject Groups & Capacity Override</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Registration Control Center & Window Timers</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Section Performance Reports & Manual Registrations</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-8 relative z-10">
            <button
              onClick={() => handleSelectPortal("TUTOR")}
              disabled={loadingPortal !== null}
              className="w-full py-3.5 px-5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer bg-purple-600 hover:bg-purple-700 dark:bg-linear-to-r dark:from-purple-600 dark:to-purple-500 dark:hover:from-purple-500 dark:hover:to-purple-400 text-white shadow-md shadow-purple-600/25 active:scale-[0.99] disabled:opacity-50"
            >
              {loadingPortal === "TUTOR" ? (
                "Launching Class Tutor Portal..."
              ) : (
                <>
                  <span>Enter Class Tutor Portal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </motion.div>

      </div>

      {/* Switching Note Footer */}
      <div className="rounded-2xl bg-white/90 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 p-4 text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2.5 shadow-sm backdrop-blur-sm">
        <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span>
          Select which workspace you wish to launch. You can return to this <strong className="text-slate-800 dark:text-slate-200 font-semibold">Portal Selection Hub</strong> at any time from your profile menu.
        </span>
      </div>
    </div>
  );
}
