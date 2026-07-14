import * as React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { RegistrationForm } from "./registration-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/actions/auth";
import { LogOut, User, FileCheck, ShieldAlert } from "lucide-react";
import { ClientRedirect } from "@/components/client-redirect";
import { GlassCard } from "@/components/premium/glass-card";
import { DashboardGlowBackground } from "@/components/ui/background-components";

export default async function StudentDashboardPage() {
  const session = await getSession();

  // Route guarding
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  // Fetch settings & student data
  const [settings, student, electives] = await Promise.all([
    db.settings.findUnique({ where: { id: "system" } }),
    db.student.findUnique({
      where: { id: session.userId },
      include: { registration: true },
    }),
    db.elective.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-cards border border-rose-500/20 shadow-xl max-w-md">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Configuration Required</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            System settings are not configured. Please contact the administrator.
          </p>
        </div>
      </div>
    );
  }

  if (settings.maintenanceMode) {
    return <ClientRedirect to="/maintenance" />;
  }

  if (!student) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-cards border border-rose-500/20 shadow-xl max-w-md">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Account Error</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your student account is not found in the system.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  
  // If registration has not started, redirect to countdown page
  if (!settings.registrationEnabled || now < settings.registrationStart) {
    return <ClientRedirect to="/countdown" />;
  }

  // If registration has ended and user has not registered
  const isRegistrationEnded = now > settings.registrationEnd;
  if (isRegistrationEnded && !student.hasSubmitted) {
    return <ClientRedirect to="/countdown" />;
  }

  // If already registered and editing is disabled, redirect to success receipt
  if (student.hasSubmitted && !settings.allowRegistrationEdit) {
    return <ClientRedirect to="/dashboard/success" />;
  }

  async function handleLogoutAction() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Radial Glow Animated Backgrounds */}
      <DashboardGlowBackground />

      {/* Decorative background glows */}
      <div className="absolute top-[-25%] left-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808007_1px,transparent_1px),linear-gradient(to_bottom,#80808007_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-white/70 dark:bg-slate-950/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-buttons overflow-hidden bg-white dark:bg-slate-900 shadow-lg p-0.5">
              <Image src="/logo.png" alt="Electify Logo" width={36} height={36} className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">Electify</span>
              <span className="hidden sm:inline-block text-[10px] font-bold text-indigo-500 dark:text-indigo-400 ml-2 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full">
                MCA F Batch
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={handleLogoutAction}>
              <button
                type="submit"
                className="touch-none inline-flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-buttons text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 active:bg-slate-200 dark:active:bg-slate-800 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-8 relative z-10">
        
        {/* Student Welcome Header Card */}
        <GlassCard glow="indigo" className="p-5 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden" hoverEffect={false}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <User className="w-4 h-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider">Student Registration Portal</p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">{student.name}</h1>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {student.registerNumber} <span className="text-slate-300 dark:text-slate-700 mx-1.5">•</span> SRMIST MCA F
            </p>
          </div>

          <div className="w-full sm:w-auto bg-slate-100/50 dark:bg-slate-900/50 rounded-cards p-4 border border-slate-200/50 dark:border-slate-800/50 flex items-center gap-3">
            <div className="w-9 h-9 rounded-inputs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[9px] uppercase font-bold tracking-widest text-slate-400 leading-none">Selection Status</p>
              <p className="text-sm font-bold mt-1 text-slate-800 dark:text-slate-200">
                {student.hasSubmitted ? "Choices Submitted" : "Pending Selection"}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Dynamic Form Area */}
        <div className="relative">
          <RegistrationForm
            student={{
              id: student.id,
              name: student.name,
              registerNumber: student.registerNumber,
              isEligible: student.isEligible,
              hasSubmitted: student.hasSubmitted,
            }}
            electives={electives.map((e) => ({
              id: e.id,
              groupNumber: e.groupNumber,
              name: e.name,
              totalSeats: e.totalSeats,
              availableSeats: e.availableSeats,
              isActive: e.isActive,
              isFull: e.isFull,
            }))}
            settings={{
              showLiveSeats: settings.showLiveSeats,
              allowRegistrationEdit: settings.allowRegistrationEdit,
            }}
            initialRegistration={student.registration}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-white/5 text-center text-xs font-semibold text-slate-400 dark:text-slate-600 relative z-10">
        <p>© {new Date().getFullYear()} Electify. SRMIST MCA F Batch.</p>
      </footer>
    </div>
  );
}
