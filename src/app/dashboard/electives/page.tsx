import * as React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, registrationEvents, electiveGroups, electives, studentRegistrations, registrations } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { RegistrationForm } from "../registration-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/actions/auth";
import { FileCheck, ShieldAlert, ArrowRight } from "lucide-react";
import { ClientRedirect } from "@/components/client-redirect";
import Link from "next/link";

export default async function StudentElectivesPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  const [student] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  if (!student) {
    redirect("/login");
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

  // Fetch active or recently closed registration event
  const [event] = await db.select().from(registrationEvents)
    .where(
      and(
        eq(registrationEvents.academicBatchId, student.academicBatchId),
        inArray(registrationEvents.status, ["PUBLISHED", "OPEN", "ACTIVE", "CLOSED", "VERIFICATION", "FINALIZED"])
      )
    ).orderBy(desc(registrationEvents.createdAt)).limit(1);

  if (!event) {
    return <ClientRedirect to="/dashboard" />;
  }

  // Check database registration record
  const [userRegistration] = await db.select().from(registrations)
    .where(and(eq(registrations.studentId, student.id), eq(registrations.eventId, event.id))).limit(1);

  const hasSubmitted = userRegistration?.status === "CONFIRMED";

  if (hasSubmitted) {
    return <ClientRedirect to="/dashboard/success" />;
  }

  // Verify time boundaries (openDate/closeDate are the source of truth)
  const now = new Date();

  const isRegistrationStarted =
    (event.openDate && now >= event.openDate) ||
    event.status === "OPEN" ||
    event.status === "ACTIVE";

  const isRegistrationEnded =
    (event.closeDate && now > event.closeDate) ||
    event.status === "CLOSED" ||
    event.status === "VERIFICATION" ||
    event.status === "FINALIZED";

  if (!isRegistrationStarted || isRegistrationEnded) {
    return <ClientRedirect to="/dashboard" />;
  }

  const groups = await db.select().from(electiveGroups)
    .where(eq(electiveGroups.eventId, event.id))
    .orderBy(electiveGroups.sortOrder);

  const groupIds = groups.map(g => g.id);
  const allElectives = groupIds.length > 0 
    ? await db.select().from(electives).where(inArray(electives.groupId, groupIds))
    : [];

  const currentRegistrations = await db.select().from(studentRegistrations)
    .where(and(eq(studentRegistrations.studentId, student.id), eq(studentRegistrations.eventId, event.id)));

  async function handleLogoutAction() {
    "use server";
    await logout();
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000] flex flex-col relative">
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#000]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-1.5">
              <Image src="/logo.png" alt="Electify Logo" width={24} height={24} className="w-full h-full object-contain invert dark:invert-0" />
            </div>
            <span className="font-semibold text-sm text-slate-900 dark:text-white tracking-tight">Electify</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <form action={handleLogoutAction}>
              <button
                type="submit"
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-10 space-y-6 sm:space-y-8 relative z-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{student.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {student.registerNumber} <span className="mx-2 text-slate-300 dark:text-slate-700">|</span> {event.name}
            </p>
          </div>

          <div className="w-full sm:w-auto bg-white dark:bg-[#111] rounded-xl sm:rounded-md p-4 border border-slate-200 dark:border-white/10 flex items-center gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white flex items-center justify-center border border-slate-200 dark:border-white/10">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase font-medium tracking-wider text-slate-500 dark:text-slate-400">Status</p>
              <p className="text-sm font-medium text-slate-900 dark:text-white">
                Pending Selection
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-white/10 pt-8">
          <RegistrationForm
            event={{
              id: event.id,
              name: event.name,
              openDate: event.openDate,
              closeDate: event.closeDate,
              status: event.status,
            }}
            student={{
              id: student.id,
              name: student.name,
              registerNumber: student.registerNumber || "",
              isEligible: student.isEligible,
              hasSubmitted: false,
            }}
            groups={groups}
            electives={allElectives}
            initialRegistrations={currentRegistrations}
          />
        </div>
      </main>

      <footer className="py-6 border-t border-slate-200 dark:border-white/10 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} Electify. Enterprise Registration System.</p>
      </footer>
    </div>
  );
}
