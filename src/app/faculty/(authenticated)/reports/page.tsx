import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { ReportsClient } from "./reports-client";

export default async function FacultyReportsPage() {
  const session = await getSession();

  // Guard: Must be faculty or super admin
  if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
    redirect("/faculty/login");
  }

  // Fetch registration records with user and elective relations
  const registrations = await db.registration.findMany({
    include: {
      student: true,
      electiveGroup1: true,
      electiveGroup2: true,
    },
    orderBy: {
      submittedAt: "desc",
    },
  });

  const formattedRecords = registrations.map((r) => ({
    id: r.id,
    studentName: r.student.name,
    registerNumber: r.student.registerNumber,
    elective1: r.electiveGroup1.name,
    elective2: r.electiveGroup2.name,
    timestamp: r.submittedAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          Enrollment Reports
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          Export registration lists and audit logs to CSV or Microsoft Excel spreadsheets.
        </p>
      </div>

      <ReportsClient records={formattedRecords} />
    </div>
  );
}
