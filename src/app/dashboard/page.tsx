import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CalendarX2, Clock3, PauseCircle, SearchX, UserX, Users } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { StudentStatus } from "@/components/student/student-chrome";
import { EventChooser } from "@/components/student/event-chooser";
import { formatDateTime } from "@/lib/format";
import { relevantEvents, resolveStudentEvent, withEvent } from "@/lib/student-events";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration" };

/**
 * Routes a student to the right place for one registration event. Only events
 * that target the student's own class are considered (lib/student-events).
 */
export default async function StudentDashboardRouterPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/faculty/dashboard");

  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
  if (settings?.maintenanceMode) redirect("/maintenance");

  const { event: requested } = await searchParams;
  const res = await resolveStudentEvent(session.userId, requested ?? null);

  if (res.status === "NO_STUDENT" || res.status === "NOT_STUDENT") {
    return (
      <StudentStatus icon={<UserX />} tone="danger" title="We couldn't find your student record" next="Ask your class tutor to check that your account exists, then sign in again.">
        <p>You&apos;re signed in, but there&apos;s no student profile attached to this account.</p>
      </StudentStatus>
    );
  }

  if (res.status === "NO_CLASS") {
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

  if (res.status === "NOT_ELIGIBLE") {
    return (
      <StudentStatus
        icon={<SearchX />}
        tone="warning"
        title="This registration isn't for your class"
        next={
          <Link href="/dashboard" className="font-medium text-fg underline underline-offset-4">
            See the registrations for {res.studentClass.label}
          </Link>
        }
      >
        <p>The link you followed belongs to another class or cohort.</p>
      </StudentStatus>
    );
  }

  if (res.status === "NO_EVENT") {
    return (
      <StudentStatus icon={<Clock3 />} title="No registration scheduled yet" next="Your class tutor will share the opening time. This page shows a countdown as soon as a window is scheduled.">
        <p>
          There isn&apos;t an elective registration window for <span className="font-medium text-fg">{res.studentClass.label}</span> right now.
        </p>
      </StudentStatus>
    );
  }

  // More than one current registration for this class: let the student pick.
  if (!requested) {
    const current = relevantEvents(res.events);
    if (current.length > 1) return <EventChooser classLabel={res.studentClass.label} events={current} />;
  }

  const event = res.event;
  if (event.registrationStatus === "CONFIRMED") redirect(withEvent("/dashboard/my-registration", event.id));

  const state = event.window.state;
  if (state === "UPCOMING" || state === "UNSCHEDULED") redirect(withEvent("/countdown", event.id));

  if (state === "PAUSED") {
    return (
      <StudentStatus
        icon={<PauseCircle />}
        tone="warning"
        title="Registration is paused"
        next={
          <>
            Your coordinators paused <span className="font-medium text-fg">{event.name}</span>. Nothing you submitted is lost. Come back when it
            resumes, or{" "}
            <Link href={withEvent("/dashboard/subjects", event.id)} className="font-medium text-fg underline underline-offset-4">
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

  if (state === "CLOSED") {
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

  redirect(withEvent("/dashboard/electives", event.id));
}
