import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, systemSettings, registrationEvents, registrations } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import Link from "next/link";
import { CalendarX2, Clock3, PauseCircle, UserX, Users } from "lucide-react";
import { StudentStatus } from "@/components/student/student-chrome";
import { formatDateTime } from "@/lib/format";
import { getRegistrationWindow, STUDENT_VISIBLE_EVENT_STATUSES } from "@/lib/registration-window";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration" };

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
      <StudentStatus icon={<UserX />} tone="danger" title="We couldn't find your student record" next="Ask your class tutor to check that your account exists, then sign in again.">
        <p>You&apos;re signed in, but there&apos;s no student profile attached to this account.</p>
      </StudentStatus>
    );
  }

  if (!student.academicBatchId) {
    return (
      <StudentStatus icon={<Users />} tone="warning" title="You're not in a batch yet" next="Ask your class tutor to add you to your section. Once they do, sign in again and registration will appear here.">
        <p>Electives are offered per batch, so we can&apos;t show you any until your account is linked to one.</p>
      </StudentStatus>
    );
  }

  // Fetch current registration event for the batch
  const [event] = await db.select().from(registrationEvents)
    .where(
      and(
        eq(registrationEvents.academicBatchId, student.academicBatchId),
        inArray(registrationEvents.status, [...STUDENT_VISIBLE_EVENT_STATUSES])
      )
    ).orderBy(desc(registrationEvents.createdAt)).limit(1);

  if (!event) {
    return (
      <StudentStatus icon={<Clock3 />} title="No registration scheduled yet" next="Your class tutor will share the opening time. This page shows a countdown as soon as a window is scheduled.">
        <p>There isn&apos;t an elective registration window for your batch right now.</p>
      </StudentStatus>
    );
  }

  // Check database registration record
  const [userRegistration] = await db.select().from(registrations)
    .where(and(eq(registrations.studentId, student.id), eq(registrations.eventId, event.id))).limit(1);

  const hasSubmitted = userRegistration?.status === "CONFIRMED";

  if (hasSubmitted) {
    redirect("/dashboard/my-registration");
  }

  // Same rule the register action enforces, evaluated on the server clock.
  const regWindow = getRegistrationWindow(event, new Date());

  if (regWindow.state === "UPCOMING" || regWindow.state === "UNSCHEDULED") {
    redirect("/countdown");
  }

  if (regWindow.state === "PAUSED") {
    return (
      <StudentStatus
        icon={<PauseCircle />}
        tone="warning"
        title="Registration is paused"
        next={
          <>
            Your coordinators paused <span className="font-medium text-fg">{event.name}</span>. Nothing you submitted is lost. Come back when it
            resumes, or{" "}
            <Link href="/dashboard/subjects" className="font-medium text-fg underline underline-offset-4">
              read about the subjects
            </Link>{" "}
            in the meantime.
          </>
        }
      >
        <p>Choosing electives is switched off for now.</p>
      </StudentStatus>
    );
  }

  if (regWindow.state === "CLOSED") {
    return (
      <StudentStatus
        icon={<CalendarX2 />}
        title="Registration has closed"
        next="If you missed the window, contact your class tutor. Tutors can register you manually after it closes."
      >
        <p>
          The window for <span className="font-medium text-fg">{event.name}</span> ended
          {event.closeDate ? ` on ${formatDateTime(event.closeDate)}` : ""}.
        </p>
      </StudentStatus>
    );
  }

  // If active and student has not registered yet, redirect to selecting electives
  redirect("/dashboard/electives");
}
