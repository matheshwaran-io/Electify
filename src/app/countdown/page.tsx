import * as React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, systemSettings, registrationEvents, registrations } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { CountdownTimer } from "./countdown-timer";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/actions/auth";
import { LogOut, AlertCircle, Calendar } from "lucide-react";
import { GlassCard } from "@/components/premium/glass-card";

export const dynamic = "force-dynamic";

export default async function CountdownPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);

  if (settings?.maintenanceMode) {
    redirect("/maintenance");
  }

  const [student] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

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

  if (!student.academicBatchId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-cards border border-rose-500/20 shadow-xl max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Missing Batch</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your account is not assigned to an academic batch.
          </p>
        </div>
      </div>
    );
  }

  const [event] = await db.select().from(registrationEvents)
    .where(
      and(
        eq(registrationEvents.academicBatchId, student.academicBatchId),
        inArray(registrationEvents.status, ["PUBLISHED", "OPEN", "ACTIVE", "CLOSED", "VERIFICATION", "FINALIZED"])
      )
    ).orderBy(desc(registrationEvents.createdAt)).limit(1);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center p-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-cards border border-rose-500/20 shadow-xl max-w-md">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Active Registration</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            There are no registration events configured for your batch at this time.
          </p>
        </div>
      </div>
    );
  }

  // Check confirmed registration status from registrations table
  const [userRegistration] = await db.select().from(registrations)
    .where(and(eq(registrations.studentId, student.id), eq(registrations.eventId, event.id))).limit(1);
  
  const hasSubmitted = userRegistration?.status === "CONFIRMED";

  const now = new Date();

  // Time-based checks (openDate/closeDate are the source of truth)
  const isRegistrationStarted =
    (event.openDate && now >= event.openDate) ||
    event.status === "OPEN" ||
    event.status === "ACTIVE";

  const isRegistrationEnded =
    (event.closeDate && now > event.closeDate) ||
    event.status === "CLOSED" ||
    event.status === "VERIFICATION" ||
    event.status === "FINALIZED";

  // If registration is currently open, redirect to dashboard
  if (isRegistrationStarted && !isRegistrationEnded) {
    redirect("/dashboard");
  }

  // If already confirmed, go to success
  if (hasSubmitted) {
    redirect("/dashboard/success");
  }

  async function handleLogoutAction() {
    "use server";
    await logout();
    redirect("/login");
  }

  const formattedStart = event.openDate ? event.openDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) : "TBD";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />

      <header className="absolute top-0 w-full z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center justify-center w-9 h-9 rounded-buttons overflow-hidden bg-white dark:bg-slate-900 shadow-lg p-0.5 border border-white/20 dark:border-white/5">
              <Image src="/logo.png" alt="Electify Logo" width={36} height={36} className="w-full h-full object-contain" />
            </div>
            <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">Electify</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={handleLogoutAction}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-buttons text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 relative z-10">
        <div className="w-full max-w-2xl text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {isRegistrationEnded ? "Registration Closed" : "Registration Begins Soon"}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
              {isRegistrationEnded 
                ? "The elective registration window has closed. If you missed the deadline, please contact your Class Tutor."
                : `Get ready to choose your electives for ${event.name}. The portal will automatically open when the countdown reaches zero.`
              }
            </p>
          </div>

          <GlassCard glow={isRegistrationEnded ? "none" : "indigo"} className="p-8 sm:p-10 border-white/20 dark:border-white/5 shadow-2xl">
            {isRegistrationEnded ? (
              <div className="flex flex-col items-center justify-center space-y-4 py-8">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20 mb-2">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Event Concluded</h2>
                <p className="text-slate-500 dark:text-slate-400 text-center max-w-sm">
                  The registration window ended on {event.closeDate ? event.closeDate.toLocaleDateString() : "unknown date"}. 
                  Your faculty administrator is currently reviewing the submissions.
                </p>
              </div>
            ) : (
              <>
                {event.openDate ? (
                  <CountdownTimer
                    startDateStr={event.openDate.toISOString()}
                    registrationEnabled={event.status === "PUBLISHED" || event.status === "OPEN"}
                  />
                ) : (
                  <div className="py-8 text-slate-500">Opening date is not yet scheduled.</div>
                )}

              </>
            )}
          </GlassCard>
        </div>
      </main>

      <footer className="py-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-600 relative z-10">
        <p>© {new Date().getFullYear()} Electify. SRMIST MCA F Batch.</p>
      </footer>
    </div>
  );
}
