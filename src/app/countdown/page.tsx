import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemSettings, registrationEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowRight, CalendarClock, CalendarX2, Clock3, Lock, PauseCircle, RadioTower, UserX, Users } from "lucide-react";
import { CountdownTimer } from "./countdown-timer";
import { StudentHeader, StudentStatus } from "@/components/student/student-chrome";
import { formatDateTime, formatOpening } from "@/lib/format";
import { SeatMark } from "@/components/auth/seat-mark";
import { buttonVariants } from "@/components/ui/button-variants";
import { getRegistrationWindow } from "@/lib/registration-window";
import { resolveStudentEvent, withEvent } from "@/lib/student-events";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration opens soon" };

export default async function CountdownPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
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

  if (resolved.status === "NO_STUDENT" || resolved.status === "NOT_STUDENT") {
    return (
      <StudentStatus icon={<UserX />} tone="danger" title="We couldn't find your student record" next="Ask your class tutor to check that your account exists, then sign in again.">
        <p>You&apos;re signed in, but there&apos;s no student profile attached to this account.</p>
      </StudentStatus>
    );
  }

  if (resolved.status === "NO_CLASS") {
    return (
      <StudentStatus
        icon={<Users />}
        tone="warning"
        title="You're not in a class yet"
        next={
          <span>
            Ask your class tutor for your class code, or{" "}
            <Link href="/join" className="font-medium text-fg underline underline-offset-4">
              enter your class code to join
            </Link>
            .
          </span>
        }
      >
        <p>Electives are offered per class, so we can&apos;t show you any until your account is linked to one.</p>
      </StudentStatus>
    );
  }

  if (resolved.status === "NOT_ELIGIBLE") {
    redirect("/dashboard");
  }

  if (resolved.status === "NO_EVENT") {
    return (
      <StudentStatus icon={<Clock3 />} title="No registration scheduled yet" next="Your class tutor will share the opening time. This page shows a countdown as soon as a window is scheduled.">
        <p>
          There isn&apos;t an elective registration window for <span className="font-medium text-fg">{resolved.studentClass.label}</span> right now.
        </p>
      </StudentStatus>
    );
  }

  const student = resolved.student;
  const studentEvent = resolved.event;
  const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, studentEvent.id)).limit(1);
  if (!event) redirect("/dashboard");

  const hasSubmitted = studentEvent.registrationStatus === "CONFIRMED";

  const now = new Date();
  // Same rule the register action enforces, evaluated on the server clock.
  const regWindow = getRegistrationWindow(event, now);

  if (regWindow.isOpen) {
    redirect(withEvent("/dashboard", event.id));
  }

  // If already confirmed, go to the receipt
  if (hasSubmitted) {
    redirect(withEvent("/dashboard/my-registration", event.id));
  }

  if (regWindow.state === "PAUSED") {
    return (
      <StudentStatus
        icon={<PauseCircle />}
        tone="warning"
        title="Registration is paused"
        next={
          <>
            You can still{" "}
            <Link href={withEvent("/dashboard/subjects", event.id)} className="font-medium text-fg underline underline-offset-4">
              read about the subjects
            </Link>{" "}
            while you wait.
          </>
        }
      >
        <p>
          Your coordinators paused <span className="font-medium text-fg">{event.name}</span>. This page doesn&apos;t update on its own, so check back
          later.
        </p>
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

  return (
    <div className="flex min-h-dvh flex-col">
      <StudentHeader />

      <main className="flex flex-1 flex-col items-center px-5 pb-12 pt-10 sm:pt-16">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          <div className="animate-enter">
            <SeatMark size={148} className="sm:hidden" />
            <SeatMark size={196} className="hidden sm:block" />
          </div>

          <p className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-fg-muted shadow-1 animate-enter [animation-delay:60ms]">
            <CalendarClock className="size-4 text-fg-subtle" />
            {event.openDate ? `Opens ${formatOpening(event.openDate)}` : "Opening time not set yet"}
          </p>

          <h1 className="mt-5 max-w-2xl text-4xl font-light tracking-display text-fg animate-enter [animation-delay:100ms]">
            {event.name}
          </h1>
          <p className="mt-2 text-fg-muted animate-enter [animation-delay:120ms]">
            {resolved.studentClass.label}
            {studentEvent.sessionLabel ? ` · Academic session ${studentEvent.sessionLabel}` : ""}
            {event.semester ? ` · Semester ${event.semester}` : ""}
          </p>

          <div className="mt-10 animate-enter [animation-delay:160ms]">
            {event.openDate ? (
              <CountdownTimer
                startDateStr={event.openDate.toISOString()}
                registrationEnabled={event.status === "PUBLISHED" || event.status === "OPEN"}
                serverNow={now.getTime()}
                targetHref={withEvent("/dashboard", event.id)}
              />
            ) : (
              <p className="text-fg-muted">Your class tutor hasn&apos;t set an opening time. Check back soon.</p>
            )}
          </div>

          <p className="mx-auto mt-8 max-w-md text-fg-muted animate-enter [animation-delay:220ms]">
            The picker opens here automatically when the countdown ends. No need to refresh.
          </p>

          <Link
            href={withEvent("/dashboard/subjects", event.id)}
            className={buttonVariants({ variant: "secondary", size: "lg", className: "mt-6 animate-enter [animation-delay:240ms]" })}
          >
            Explore subjects while you wait <ArrowRight />
          </Link>
        </div>

        <dl className="mt-14 grid w-full max-w-3xl divide-y divide-border rounded-card bg-surface-2 animate-enter [animation-delay:280ms] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-5 text-left">
            <dt className="text-sm text-fg-muted">Signed in as</dt>
            <dd className="mt-1 truncate font-medium text-fg">{student.name}</dd>
            <dd className="mt-0.5 truncate font-mono text-sm text-fg-muted">{student.registerNumber}</dd>
          </div>
          {/* dt/dd must be direct children of the group, so the icon sits inside the dt. */}
          <div className="relative p-5 pl-12 text-left">
            <dt className="font-medium text-fg">
              <RadioTower aria-hidden className="absolute left-5 top-[1.45rem] size-4 text-fg-subtle" />
              Seats are live
            </dt>
            <dd className="mt-0.5 text-sm text-fg-muted">Counts update as classmates confirm.</dd>
          </div>
          <div className="relative p-5 pl-12 text-left">
            <dt className="font-medium text-fg">
              <Lock aria-hidden className="absolute left-5 top-[1.45rem] size-4 text-fg-subtle" />
              {event.allowEditing ? "Changes close with the window" : "Choices are final"}
            </dt>
            <dd className="mt-0.5 text-sm text-fg-muted">
              {event.allowEditing ? "You can change or cancel a pick until registration closes." : "You can't change them after you confirm."}
            </dd>
          </div>
        </dl>
      </main>
    </div>
  );
}
