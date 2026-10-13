import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrationEvents, electiveGroups, electives, electiveSeatAllocations, studentRegistrations, registrations, systemSettings } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { RegistrationForm } from "../registration-form";
import { Users } from "lucide-react";
import Link from "next/link";
import { StudentHeader, StudentStatus } from "@/components/student/student-chrome";
import { getRegistrationWindow } from "@/lib/registration-window";
import { resolveStudentEvent, withEvent } from "@/lib/student-events";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose your electives" };

export default async function StudentElectivesPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
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

  // Only an event that targets this student's class (lib/student-events).
  const { event: requested } = await searchParams;
  const resolved = await resolveStudentEvent(session.userId, requested ?? null);

  if (resolved.status === "NO_CLASS") {
    return (
      <StudentStatus icon={<Users />} tone="warning" title="You're not in a class yet" next="Ask your class tutor to add you to your class. Once they do, sign in again.">
        <p>Electives are offered per class, so we can&apos;t show you any until your account is linked to one.</p>
      </StudentStatus>
    );
  }
  if (resolved.status !== "OK") {
    redirect(withEvent("/dashboard", requested));
  }

  const student = resolved.student;
  const studentEvent = resolved.event;
  const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, studentEvent.id)).limit(1);
  if (!event) redirect("/dashboard");

  const [userRegistration] = await db.select().from(registrations)
    .where(and(eq(registrations.studentId, student.id), eq(registrations.eventId, event.id))).limit(1);

  if (userRegistration?.status === "CONFIRMED") {
    redirect(withEvent("/dashboard/my-registration", event.id));
  }

  // Same rule the register action enforces; /dashboard explains every closed state.
  const now = new Date();
  if (!getRegistrationWindow(event, now).isOpen) {
    redirect(withEvent("/dashboard", event.id));
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
      <StudentHeader>
        <Link
          href={withEvent("/dashboard/subjects", event.id)}
          className="inline-flex h-8 items-center rounded-control px-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          Subjects
        </Link>
        {userRegistration ? (
          <Link
            href={withEvent("/dashboard/my-registration", event.id)}
            className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border px-2.5 text-xs font-medium text-fg hover:bg-surface-2 transition-colors"
          >
            My Registration
          </Link>
        ) : null}
      </StudentHeader>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-2 flex flex-col gap-1 animate-enter">
          <p className="text-sm text-fg-muted">
            {event.name}
            <span aria-hidden className="mx-2 text-border-strong">/</span>
            {resolved.studentClass.label}
            {studentEvent.sessionLabel ? ` · Academic session ${studentEvent.sessionLabel}` : ""}
          </p>
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
