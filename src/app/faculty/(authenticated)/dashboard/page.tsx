import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { DashboardClient } from "./dashboard-client";

export default async function FacultyDashboardPage() {
  const session = await getSession();

  // Guard: Double verify auth and role
  if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
    redirect("/faculty/login");
  }

  // Fetch KPI data
  const [totalStudents, registeredStudents, settings, electives] = await Promise.all([
    db.student.count(),
    db.student.count({ where: { hasSubmitted: true } }),
    db.settings.findUnique({ where: { id: "system" } }),
    db.elective.findMany({
      include: {
        _count: {
          select: {
            registrationsAsG1: true,
            registrationsAsG2: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!settings) {
    return (
      <div className="p-6 text-center text-rose-500 font-bold">
        System configurations are missing. Seeding may not have run.
      </div>
    );
  }

  const pendingStudents = totalStudents - registeredStudents;
  const registrationPercentage = totalStudents === 0 ? 0 : (registeredStudents / totalStudents) * 100;

  const electiveStats = electives.map((e) => {
    const booked = e.groupNumber === 1 ? e._count.registrationsAsG1 : e._count.registrationsAsG2;
    return {
      id: e.id,
      name: e.name,
      groupNumber: e.groupNumber,
      totalSeats: e.totalSeats,
      availableSeats: e.availableSeats,
      bookedSeats: booked,
      percentage: e.totalSeats === 0 ? 0 : (booked / e.totalSeats) * 100,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
            Overview Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Real-time enrollment statistics and settings management
          </p>
        </div>
      </div>

      <DashboardClient
        stats={{
          totalStudents,
          registeredStudents,
          pendingStudents,
          registrationPercentage,
        }}
        electives={electiveStats}
        initialRegistrationEnabled={settings.registrationEnabled}
      />
    </div>
  );
}
