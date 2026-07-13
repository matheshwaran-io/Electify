import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { StudentsClient } from "./students-client";

export default async function FacultyStudentsPage() {
  const session = await getSession();

  // Guard: Must be faculty or super admin
  if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
    redirect("/faculty/login");
  }

  // Fetch student records based on role
  const isTutor = session.role !== "SUPER_ADMIN" && session.facultyType === "CLASS_TUTOR";
  const students = await db.student.findMany({
    where: isTutor ? { className: session.className || undefined } : undefined,
    orderBy: { registerNumber: "asc" },
  });

  const formattedStudents = students.map((s) => ({
    id: s.id,
    name: s.name,
    registerNumber: s.registerNumber,
    email: s.email,
    isActive: s.isActive,
    isEligible: s.isEligible,
    hasSubmitted: s.hasSubmitted,
    className: s.className || undefined,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          Student Directory {isTutor && `(${session.className})`}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          {isTutor 
            ? `Manage students and import rosters specifically for your class section: ${session.className}.`
            : "Course coordinator view. Import and manage student classes, toggle eligibility, and reset credentials."}
        </p>
      </div>

      <StudentsClient students={formattedStudents} session={session} />
    </div>
  );
}
