import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getStudentRegistrationDetails } from "@/app/actions/register";
import { MyRegistrationClient } from "./my-registration-client";
import { StudentStatus } from "@/components/student/student-chrome";
import { AlertCircle } from "lucide-react";
import { withEvent } from "@/lib/student-events";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Registration · Electify" };

export default async function MyRegistrationPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  const { event: requested } = await searchParams;
  const details = await getStudentRegistrationDetails(requested);

  if (!details.success) {
    return (
      <StudentStatus
        icon={<AlertCircle />}
        tone="warning"
        title="Could not load registration"
        next="Please try again or contact your class tutor if the problem persists."
      >
        <p>{details.error || "Failed to load registration details."}</p>
      </StudentStatus>
    );
  }

  if (!details.hasRegistered) {
    redirect(withEvent("/dashboard/electives", details.event?.id ?? requested));
  }

  return (
    <MyRegistrationClient
      event={details.event!}
      registration={details.registration!}
      student={details.student!}
      choices={details.choices!}
      serverNow={Date.now()}
    />
  );
}
