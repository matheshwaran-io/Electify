import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, registrationEvents, registrations, systemSettings } from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { SuccessView } from "./success-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Registration receipt" };

interface ReceiptSnapshot {
  receiptNumber: string;
  submittedAt: string;
  student: {
    name: string;
    registerNumber: string;
    email: string;
    department?: string;
    degree?: string;
    section?: string;
  };
  // Snapshots written by registerElectives carry `electiveName`; rows written by
  // the seed/fix scripts carry `name` + `courseCode`. Read both.
  electives: {
    groupName: string;
    electiveName?: string;
    name?: string;
    courseCode?: string | null;
    credits?: number;
  }[];
}

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
    redirect("/maintenance");
  }

  const [student] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);

  if (!student) {
    redirect("/login");
  }

  if (!student.academicBatchId) {
    redirect("/dashboard");
  }

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

  // Fetch from the registrations table
  const [userRegistration] = await db.select().from(registrations)
    .where(
      and(
        eq(registrations.studentId, student.id),
        eq(registrations.eventId, event.id)
      )
    ).limit(1);

  if (!userRegistration || userRegistration.status !== "CONFIRMED") {
    redirect("/dashboard/electives");
  }

  // Render directly from the immutable snapshot
  const snapshot = userRegistration.receiptSnapshot as unknown as ReceiptSnapshot;
  
  const formattedRegistrations = (snapshot?.electives || []).map(e => ({
    groupName: e.groupName,
    electiveName: e.electiveName ?? (e.courseCode ? `${e.courseCode} - ${e.name ?? ""}` : e.name ?? ""),
    submittedAt: new Date(snapshot.submittedAt || userRegistration.submittedAt || new Date()),
  }));

  // No editing allowed once confirmed
  const allowRegistrationEdit = false;

  return (
    <SuccessView
      student={{
        name: snapshot?.student?.name || student.name,
        registerNumber: snapshot?.student?.registerNumber || student.registerNumber || "N/A",
        email: snapshot?.student?.email || student.email,
        department: snapshot?.student?.department,
        degree: snapshot?.student?.degree,
        section: snapshot?.student?.section,
      }}
      event={{
        name: event.name,
      }}
      registrations={formattedRegistrations}
      allowRegistrationEdit={allowRegistrationEdit}
      receiptNumber={snapshot?.receiptNumber || userRegistration.receiptNumber || "N/A"}
    />
  );
}
