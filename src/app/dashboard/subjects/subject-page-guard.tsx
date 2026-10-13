import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Clock3, Users, UserX } from "lucide-react";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { StudentHeader, StudentStatus } from "@/components/student/student-chrome";
import type { StudentContext } from "@/lib/subjects/queries";

/** Session + maintenance checks shared by the subject pages. Returns the student's id. */
export async function requireStudent(): Promise<string> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "STUDENT") redirect("/faculty/dashboard");

  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
  if (settings?.maintenanceMode) redirect("/maintenance");

  return session.userId;
}

/** Header used on every subject page: back to registration, theme, sign out. */
export function SubjectsHeader() {
  return (
    <StudentHeader>
      <nav aria-label="Student" className="mr-1 flex items-center gap-1">
        <Link
          href="/dashboard/subjects"
          className="inline-flex h-10 items-center rounded-full px-2 text-sm sm:px-3 font-medium text-fg hover:bg-surface-2"
        >
          Subjects
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-full px-2 text-sm sm:px-3 font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          Registration
        </Link>
      </nav>
    </StudentHeader>
  );
}

/** Screens for students who can't see a catalogue yet. */
export function ContextBlocked({ status }: { status: Exclude<StudentContext["status"], "OK"> }) {
  if (status === "NO_BATCH") {
    return (
      <StudentStatus icon={<Users />} tone="warning" title="You're not in a batch yet" next="Ask your class tutor to add you to your section, then sign in again.">
        <p>Subjects are offered per batch, so we can&apos;t show any until your account is linked to one.</p>
      </StudentStatus>
    );
  }
  if (status === "NO_EVENT") {
    return (
      <StudentStatus icon={<Clock3 />} title="No subjects to show yet" next="Subjects appear here as soon as your coordinators publish a registration event for your batch.">
        <p>There isn&apos;t a registration event for your batch right now.</p>
      </StudentStatus>
    );
  }
  return (
    <StudentStatus icon={<UserX />} tone="danger" title="We couldn't find your student record" next="Ask your class tutor to check that your account exists, then sign in again.">
      <p>You&apos;re signed in, but there&apos;s no student profile attached to this account.</p>
    </StudentStatus>
  );
}
