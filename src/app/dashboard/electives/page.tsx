import * as React from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, registrationEvents, electiveGroups, electives, studentRegistrations, registrations, systemSettings } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { RegistrationForm } from "../registration-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { logout } from "@/app/actions/auth";
import { FileCheck, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

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
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="text-center p-8 bg-surface rounded-badge border border-border shadow-1 max-w-md">
          <ShieldAlert className="w-12 h-12 text-danger-text mx-auto mb-4" />
          <h2 className="text-xl font-medium text-fg mb-2">Missing Batch</h2>
          <p className="text-sm text-fg-muted">
            Your account is not assigned to an academic batch.
          </p>
        </div>
      </div>
    );
  }

  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);

  if (settings?.maintenanceMode) {
    redirect("/maintenance");
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
    redirect("/dashboard");
  }

  // Check database registration record
  const [userRegistration] = await db.select().from(registrations)
    .where(and(eq(registrations.studentId, student.id), eq(registrations.eventId, event.id))).limit(1);

  const hasSubmitted = userRegistration?.status === "CONFIRMED";

  if (hasSubmitted) {
    redirect("/dashboard/success");
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
    redirect("/dashboard");
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
    <div className="min-h-screen bg-canvas flex flex-col relative">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center w-8 h-8 rounded-badge bg-surface border border-border p-1">
              <Image src="/logo.png" alt="Electify Logo" width={24} height={24} className="w-full h-full object-contain" />
            </div>
            <span className="font-semibold text-sm text-fg tracking-tight">Electify</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <form action={handleLogoutAction}>
              <button
                type="submit"
                className="text-sm font-medium text-fg-muted hover:text-fg transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 sm:py-10 sm:px-6 space-y-6 sm:space-y-8 relative z-10 pb-20 sm:pb-32">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{student.name}</h1>
            <p className="text-xs sm:text-sm text-fg-muted">
              {student.registerNumber} <span className="mx-2 text-fg-subtle">|</span> {event.name}
            </p>
          </div>

          <div className="w-full sm:w-auto bg-surface rounded-control sm:rounded-full p-3 sm:pr-5 sm:pl-3 border border-border flex items-center gap-3 sm:gap-4 shadow-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-2 text-fg flex items-center justify-center">
              <FileCheck className="w-4 h-4 sm:w-4 sm:h-4" />
            </div>
            <div className="flex-1 flex sm:flex-col sm:items-start items-center justify-between sm:justify-center">
              <p className="text-2xs sm:text-2xs uppercase font-bold tracking-wider text-fg-muted">Status</p>
              <p className="text-sm sm:text-sm font-semibold text-fg">
                Pending Selection
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-8">
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

      <footer className="py-6 border-t border-border text-center text-xs text-fg-muted">
        <p>© {new Date().getFullYear()} Electify. Enterprise Registration System.</p>
      </footer>
    </div>
  );
}
