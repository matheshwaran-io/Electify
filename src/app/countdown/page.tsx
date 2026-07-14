import * as React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { CountdownTimer } from "./countdown-timer";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/actions/auth";
import { LogOut, Clock, Calendar, AlertCircle } from "lucide-react";
import { ClientRedirect } from "@/components/client-redirect";
import { GlassCard } from "@/components/premium/glass-card";

export default async function CountdownPage() {
  const session = await getSession();

  // Route guarding
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  // Fetch settings & student data
  const [settings, student] = await Promise.all([
    db.settings.findUnique({ where: { id: "system" } }),
    db.student.findUnique({ where: { id: session.userId } }),
  ]);

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-cards border border-rose-500/20 shadow-xl max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Configuration Pending</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            System settings have not been configured yet. Please ask the administrator to initialize the portal.
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
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Account Not Found</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your student record could not be found. Please check your credentials or contact the admin.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const isRegistrationStarted = settings.registrationEnabled && now >= settings.registrationStart;
  const isRegistrationEnded = now > settings.registrationEnd;

  // If registration is active, redirect to dashboard
  if (isRegistrationStarted && !isRegistrationEnded) {
    return <ClientRedirect to="/dashboard" />;
  }

  // If already registered and cannot edit, redirect to success receipt
  if (student.hasSubmitted && !settings.allowRegistrationEdit) {
    return <ClientRedirect to="/dashboard/success" />;
  }

  async function handleLogoutAction() {
    "use server";
    await logout();
    redirect("/login");
  }

  const formattedStart = settings.registrationStart.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Decorative Aurora Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

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

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-xl">
          <GlassCard glow="indigo" className="text-center p-8 sm:p-12" hoverEffect={false}>
            {isRegistrationEnded ? (
              <div className="space-y-6">
                <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 mb-2">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Registration Ended
                </h1>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                  The elective registration window is closed. If you did not submit your choices in time, please contact the faculty coordinator.
                </p>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-inputs border border-slate-200/50 dark:border-slate-800/50 text-left">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Student Profile</h3>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400">{student.name}</span>
                    <span className="font-semibold text-slate-500">{student.registerNumber}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 mb-2">
                    <Clock className="w-3.5 h-3.5" /> Scheduled Registration
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Opening Soon
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    The Smart Elective Registration portal will open automatically at the specified start time. Keep this tab open.
                  </p>
                </div>

                <div className="py-4">
                  <CountdownTimer
                    startDateStr={settings.registrationStart.toISOString()}
                    registrationEnabled={settings.registrationEnabled}
                  />
                </div>

                <div className="border-t border-slate-200/50 dark:border-slate-800/50 pt-6 mt-4 text-left space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-buttons bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Start</h4>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{formattedStart}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-inputs border border-slate-200/50 dark:border-slate-800/50">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Logged In As</h3>
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">{student.name}</span>
                        <span className="text-slate-400 block mt-0.5">{student.email}</span>
                      </div>
                      <span className="font-mono bg-slate-200/50 dark:bg-slate-800/50 px-2.5 py-1 rounded text-slate-600 dark:text-slate-400 font-bold">
                        {student.registerNumber}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-white/5 text-center text-xs font-semibold text-slate-400 dark:text-slate-600 relative z-10">
        <p>© {new Date().getFullYear()} Electify. SRMIST MCA F Batch.</p>
      </footer>
    </div>
  );
}
