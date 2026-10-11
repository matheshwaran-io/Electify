import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, registrationEvents, electiveGroups, electives, electiveSeatAllocations, studentRegistrations, registrations, systemSettings } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { RegistrationForm } from "../registration-form";
import { Users } from "lucide-react";
import { StudentHeader, StudentStatus } from "@/components/student/student-chrome";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose your electives" };

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
      <StudentStatus icon={<Users />} tone="warning" title="You're not in a batch yet" next="Ask your class tutor to add you to your section. Once they do, sign in again.">
        <p>Electives are offered per batch, so we can&apos;t show you any until your account is linked to one.</p>
      </StudentStatus>
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

  const hasSubmitted = userRegistration?.status === "CONFIRMED" || userRegistration?.status === "WAITLISTED";

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

  let sectionAllocations: { electiveId: string; maxSeats: number; availableSeats: number; isFull: boolean }[] = [];
  if (student.sectionId && allElectives.length > 0) {
    sectionAllocations = await db
      .select({
        electiveId: electiveSeatAllocations.electiveId,
        maxSeats: electiveSeatAllocations.maxSeats,
        availableSeats: electiveSeatAllocations.availableSeats,
        isFull: electiveSeatAllocations.isFull,
      })
      .from(electiveSeatAllocations)
      .where(
        and(
          inArray(electiveSeatAllocations.electiveId, allElectives.map((e) => e.id)),
          eq(electiveSeatAllocations.sectionId, student.sectionId)
        )
      );
  }

  const electivesWithSection = allElectives.map((e) => {
    const secAlloc = sectionAllocations.find((a) => a.electiveId === e.id);
    if (secAlloc) {
      return {
        ...e,
        availableSeats: Math.min(e.availableSeats, secAlloc.availableSeats),
        isFull: e.isFull || secAlloc.isFull || secAlloc.availableSeats <= 0,
        sectionAvailableSeats: secAlloc.availableSeats,
        sectionMaxSeats: secAlloc.maxSeats,
      };
    }
    return e;
  });

  const currentRegistrations = await db.select().from(studentRegistrations)
    .where(and(eq(studentRegistrations.studentId, student.id), eq(studentRegistrations.eventId, event.id)));

  return (
    <div className="flex min-h-dvh flex-col">
      <StudentHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-2 flex flex-col gap-1 animate-enter">
          <p className="text-sm text-fg-muted">{event.name}</p>
          <h1 className="text-4xl font-light tracking-display text-fg">Choose your electives</h1>
          <p className="text-sm text-fg-muted">
            {student.name}
            <span aria-hidden className="mx-2 text-border-strong">/</span>
            <span className="font-mono">{student.registerNumber}</span>
          </p>
        </div>

        <RegistrationForm
          event={{
            id: event.id,
            name: event.name,
            openDate: event.openDate,
            closeDate: event.closeDate,
            status: event.status,
            enableWaitlist: event.enableWaitlist,
          }}
          student={{
            id: student.id,
            name: student.name,
            registerNumber: student.registerNumber || "",
            isEligible: student.isEligible,
            hasSubmitted: false,
          }}
          groups={groups}
          electives={electivesWithSection}
          initialRegistrations={currentRegistrations}
          serverNow={now.getTime()}
        />
      </main>
    </div>
  );
}
