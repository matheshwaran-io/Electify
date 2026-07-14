import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, registrationEvents, studentRegistrations, electives, electiveGroups, systemSettings } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { SuccessView } from "./success-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClientRedirect } from "@/components/client-redirect";

export default async function RegistrationSuccessPage() {
  const session = await getSession();

  // Route guarding
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
  if (settings?.maintenanceMode) {
    return <ClientRedirect to="/maintenance" />;
  }

  const [student] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  if (!student) {
    return <ClientRedirect to="/login" />;
  }

  if (!student.academicBatchId) {
    return <ClientRedirect to="/dashboard" />;
  }

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

  const registrations = await db.select({
    registration: studentRegistrations,
    elective: electives,
    group: electiveGroups,
  })
    .from(studentRegistrations)
    .leftJoin(electives, eq(studentRegistrations.electiveId, electives.id))
    .leftJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
    .where(and(eq(studentRegistrations.studentId, student.id), eq(studentRegistrations.eventId, event.id)))
    .orderBy(electiveGroups.sortOrder);

  if (registrations.length === 0) {
    return <ClientRedirect to="/dashboard" />;
  }

  // Determine if editing is allowed based on event status and lock
  const now = new Date();
  const isLocked = registrations.some(r => r.registration.isLocked);
  const allowRegistrationEdit = !isLocked && (event.status === "OPEN" || event.status === "ACTIVE") && (!event.closeDate || now <= event.closeDate);

  const formattedRegistrations = registrations.map(r => ({
    groupName: r.group?.name || "Unknown Group",
    electiveName: r.elective?.courseCode ? `${r.elective.courseCode} - ${r.elective.name}` : r.elective?.name || "Unknown Elective",
    submittedAt: r.registration.submittedAt,
  }));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center relative bg-slate-50 dark:bg-slate-950 p-4 overflow-hidden print:bg-white print:dark:bg-white print:p-0">
      <div className="absolute top-[-25%] left-[-15%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[130px] pointer-events-none print:hidden" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-500/10 blur-[120px] pointer-events-none print:hidden" />

      {/* Header Utilities */}
      <div className="absolute top-4 right-4 print:hidden z-50">
        <ThemeToggle />
      </div>

      <SuccessView
        student={{
          name: student.name,
          registerNumber: student.registerNumber || "N/A",
          email: student.email,
        }}
        event={{
          name: event.name,
        }}
        registrations={formattedRegistrations}
        allowRegistrationEdit={allowRegistrationEdit}
      />
    </main>
  );
}
