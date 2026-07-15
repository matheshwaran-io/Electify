import * as React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, systemSettings, registrationEvents, registrations } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/actions/auth";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentDashboardRouterPage() {
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#000]">
        <div className="text-center p-8 bg-white dark:bg-[#111] rounded-md border border-slate-200 dark:border-white/10 shadow-sm max-w-md">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-2">Account Error</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your student account is not found in the system.
          </p>
        </div>
      </div>
    );
  }

  if (!student.academicBatchId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#000]">
        <div className="text-center p-8 bg-white dark:bg-[#111] rounded-md border border-slate-200 dark:border-white/10 shadow-sm max-w-md">
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-2">Missing Batch</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your account is not assigned to an academic batch.
          </p>
        </div>
      </div>
    );
  }

  // Fetch current registration event for the batch
  const [event] = await db.select().from(registrationEvents)
    .where(
      and(
        eq(registrationEvents.academicBatchId, student.academicBatchId),
        inArray(registrationEvents.status, ["PUBLISHED", "OPEN", "ACTIVE", "CLOSED", "VERIFICATION", "FINALIZED"])
      )
    ).orderBy(desc(registrationEvents.createdAt)).limit(1);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#000]">
        <div className="text-center p-8 bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm max-w-md relative overflow-hidden">
          <div className="absolute top-4 right-4"><ThemeToggle /></div>
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-2">No Active Registration</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Elective registration is currently closed.
          </p>
          <form action={async () => {
            "use server";
            await logout();
            redirect("/login");
          }} className="mt-6">
            <button type="submit" className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Check database registration record
  const [userRegistration] = await db.select().from(registrations)
    .where(and(eq(registrations.studentId, student.id), eq(registrations.eventId, event.id))).limit(1);

  const hasSubmitted = userRegistration?.status === "CONFIRMED";

  if (hasSubmitted) {
    redirect("/dashboard/success");
  }

  // ── Time-based checks (openDate/closeDate are the source of truth) ──
  const now = new Date();

  // Registration has started if:
  // 1. openDate exists and current time is past it, OR
  // 2. status is explicitly OPEN or ACTIVE (manual override by coordinator)
  const isRegistrationStarted =
    (event.openDate && now >= event.openDate) ||
    event.status === "OPEN" ||
    event.status === "ACTIVE";

  // Registration has ended if:
  // 1. closeDate exists and current time is past it, OR
  // 2. status is explicitly CLOSED/VERIFICATION/FINALIZED (manual override)
  const isRegistrationEnded =
    (event.closeDate && now > event.closeDate) ||
    event.status === "CLOSED" ||
    event.status === "VERIFICATION" ||
    event.status === "FINALIZED";

  if (!isRegistrationStarted) {
    redirect("/countdown");
  }

  if (isRegistrationEnded && !hasSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#000]">
        <div className="text-center p-8 bg-white dark:bg-[#111] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm max-w-md relative overflow-hidden">
          <div className="absolute top-4 right-4"><ThemeToggle /></div>
          <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-2">Registration Closed</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registration period has ended.
          </p>
          <form action={async () => {
            "use server";
            await logout();
            redirect("/login");
          }} className="mt-6">
            <button type="submit" className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If active and student has not registered yet, redirect to selecting electives
  redirect("/dashboard/electives");
}
