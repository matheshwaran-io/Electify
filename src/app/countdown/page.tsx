import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, systemSettings, registrationEvents, registrations } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { CalendarClock, CalendarX2, Clock3, Lock, RadioTower, UserX, Users } from "lucide-react";
import { CountdownTimer } from "./countdown-timer";
import { StudentHeader, StudentStatus } from "@/components/student/student-chrome";
import { formatDateTime, formatOpening } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration opens soon" };

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
      <StudentStatus icon={<UserX />} tone="danger" title="We couldn't find your student record" next="Ask your class tutor to check that your account exists, then sign in again.">
        <p>You&apos;re signed in, but there&apos;s no student profile attached to this account.</p>
      </StudentStatus>
    );
  }

  if (!student.academicBatchId) {
    return (
      <StudentStatus icon={<Users />} tone="warning" title="You're not in a batch yet" next="Ask your class tutor to add you to your section. Once they do, sign in again and the countdown will appear here.">
        <p>Electives are offered per batch, so we can&apos;t show you any until your account is linked to one.</p>
      </StudentStatus>
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
      <StudentStatus icon={<Clock3 />} title="No registration scheduled yet" next="Your class tutor will share the opening time. This page shows a countdown as soon as a window is scheduled.">
        <p>There isn&apos;t an elective registration window for your batch right now.</p>
      </StudentStatus>
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

  if (isRegistrationEnded) {
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

  return (
    <div className="flex min-h-dvh flex-col">
      <StudentHeader />

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[50vh]"
          style={{ background: "radial-gradient(ellipse 50% 70% at 50% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent)" }}
        />

        <div className="w-full max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-fg-muted shadow-1 animate-enter">
            <CalendarClock className="size-4 text-primary-text" />
            {event.openDate ? `Opens ${formatOpening(event.openDate)}` : "Opening time not set yet"}
          </p>

          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-fg sm:text-4xl animate-enter [animation-delay:60ms]">
            {event.name}
          </h1>

          <div className="mt-10 animate-enter [animation-delay:120ms]">
            {event.openDate ? (
              <CountdownTimer
                startDateStr={event.openDate.toISOString()}
                registrationEnabled={event.status === "PUBLISHED" || event.status === "OPEN"}
                serverNow={now.getTime()}
              />
            ) : (
              <p className="text-fg-muted">Your class tutor hasn&apos;t set an opening time. Check back soon.</p>
            )}
          </div>

          <p className="mx-auto mt-10 max-w-md text-sm text-fg-muted animate-enter [animation-delay:180ms]">
            The picker opens on this page automatically when the countdown ends. No need to refresh.
          </p>
        </div>

        <div className="mt-12 grid w-full max-w-3xl gap-3 sm:grid-cols-3 animate-enter [animation-delay:240ms]">
          <div className="rounded-card border border-border bg-surface p-4 text-left shadow-1">
            <p className="text-xs text-fg-muted">Signed in as</p>
            <p className="mt-1 truncate text-sm font-medium text-fg">{student.name}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">{student.registerNumber}</p>
          </div>
          <div className="flex gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-1">
            <RadioTower className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <p className="text-sm text-fg-muted">
              <span className="font-medium text-fg">Seats are live.</span> Counts update as classmates confirm.
            </p>
          </div>
          <div className="flex gap-3 rounded-card border border-border bg-surface p-4 text-left shadow-1">
            <Lock className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
            <p className="text-sm text-fg-muted">
              <span className="font-medium text-fg">Choices are final.</span> You can&apos;t change them after you confirm.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
