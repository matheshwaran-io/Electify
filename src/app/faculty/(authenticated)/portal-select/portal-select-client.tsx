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
import { spring, transition } from "@/lib/motion";

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
        transition={transition.fade}
        className="relative overflow-hidden rounded-panel bg-surface border border-border p-8 sm:p-10 shadow-3"
      >

        <div className="relative z-10 max-w-2xl space-y-3.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-text text-xs font-semibold uppercase tracking-wider shadow-1">
            <Sparkles className="w-3.5 h-3.5 text-primary-text" />
            Portal Selection Hub
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg">
            Welcome, {session.name}
          </h1>
          <p className="text-fg-muted text-sm sm:text-base leading-relaxed">
            As a Course Coordinator, you have full access to both the high-level <strong className="text-primary-text font-semibold">Course Coordinator Portal</strong> and the section-focused <strong className="text-primary-text font-semibold">Class Tutor Portal</strong>. Select which workspace you wish to launch.
          </p>
        </div>
      </motion.div>

      {/* Dual Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Course Coordinator Portal Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring.gentle, delay: 0.1 }}
          className={`group relative rounded-panel border p-8 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-2 hover:shadow-3 ${
            currentWorkspace === "COORDINATOR"
              ? "bg-surface border-primary ring-2 ring-primary/20"
              : "bg-surface/80 border-border hover:border-primary/40 hover:bg-surface"
          }`}
        >
          
          <div className="space-y-6 relative z-10">
            {/* Header / Icon */}
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-card bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-text group-hover:scale-105 transition-transform shadow-1">
                <GraduationCap className="w-7 h-7" />
              </div>
              {currentWorkspace === "COORDINATOR" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success-text text-xs font-semibold shadow-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Currently Active
                </span>
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-fg group-hover:text-primary-text transition-colors">
                Course Coordinator Portal
              </h2>
              <p className="text-fg-muted text-xs sm:text-sm leading-relaxed">
                Centralized department-wide management. Configure elective catalogs, create registration event templates, manage student databases, and analyze aggregate metrics.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <BookOpen className="w-4 h-4 text-primary-text shrink-0" />
                <span>Elective Course Catalog & Group Allocation</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <Layers className="w-4 h-4 text-primary-text shrink-0" />
                <span>Global Registration Templates & Event Timers</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <Building className="w-4 h-4 text-primary-text shrink-0" />
                <span>Departmental Student Directory & Replay Logs</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <FileText className="w-4 h-4 text-primary-text shrink-0" />
                <span>Master Reports, Database Tools & Audit Controls</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-8 relative z-10">
            <button
              onClick={() => handleSelectPortal("COORDINATOR")}
              disabled={loadingPortal !== null}
              className="w-full py-3.5 px-5 rounded-control font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer bg-primary hover:bg-primary-strong text-primary-fg active:scale-[0.99] disabled:opacity-50"
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
          transition={{ ...spring.gentle, delay: 0.2 }}
          className={`group relative rounded-panel border p-8 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-2 hover:shadow-3 ${
            currentWorkspace === "TUTOR"
              ? "bg-surface border-primary ring-2 ring-primary/20"
              : "bg-surface/80 border-border hover:border-primary/40 hover:bg-surface"
          }`}
        >
          
          <div className="space-y-6 relative z-10">
            {/* Header / Icon */}
            <div className="flex items-center justify-between">
              <div className="w-14 h-14 rounded-card bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-text group-hover:scale-105 transition-transform shadow-1">
                <Users className="w-7 h-7" />
              </div>
              <div className="flex items-center gap-2">
                {assignedSectionsCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary-text text-xs font-semibold shadow-1">
                    {assignedSectionsCount} Section{assignedSectionsCount > 1 ? "s" : ""} Assigned
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 border border-warning/20 text-warning-text text-xs font-semibold shadow-1">
                    Onboarding Ready
                  </span>
                )}
                {currentWorkspace === "TUTOR" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success-text text-xs font-semibold shadow-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Currently Active
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-fg group-hover:text-primary-text transition-colors">
                Class Tutor Portal
              </h2>
              <p className="text-fg-muted text-xs sm:text-sm leading-relaxed">
                Replicated Class Tutor workspace. Manage specific student section rosters, monitor section intake, adjust registration window timers, and view section reports.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <Users className="w-4 h-4 text-primary-text shrink-0" />
                <span>Section Student Directory & Intake Management</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <BookOpen className="w-4 h-4 text-primary-text shrink-0" />
                <span>Section Subject Groups & Capacity Override</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <Clock className="w-4 h-4 text-primary-text shrink-0" />
                <span>Registration Control Center & Window Timers</span>
              </div>
              <div className="flex items-center gap-3 text-xs sm:text-sm text-fg-muted">
                <FileText className="w-4 h-4 text-primary-text shrink-0" />
                <span>Section Performance Reports & Manual Registrations</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-8 relative z-10">
            <button
              onClick={() => handleSelectPortal("TUTOR")}
              disabled={loadingPortal !== null}
              className="w-full py-3.5 px-5 rounded-control font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer bg-primary hover:bg-primary-strong text-primary-fg active:scale-[0.99] disabled:opacity-50"
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
      <div className="rounded-card bg-surface border border-border p-4 text-center text-xs sm:text-sm text-fg-muted flex items-center justify-center gap-2.5 shadow-1">
        <ShieldCheck className="w-4 h-4 text-primary-text shrink-0" />
        <span>
          Select which workspace you wish to launch. You can return to this <strong className="text-fg font-semibold">Portal Selection Hub</strong> at any time from your profile menu.
        </span>
      </div>
    </div>
  );
}
