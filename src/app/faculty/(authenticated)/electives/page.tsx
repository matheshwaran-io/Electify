import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { ElectivesClient } from "./electives-client";

export default async function FacultyElectivesPage() {
  const session = await getSession();

  // Guard: Must be faculty or super admin
  if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
    redirect("/faculty/login");
  }

  // Fetch settings & electives list
  const [settings, electives] = await Promise.all([
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

  const formattedElectives = electives.map((e) => {
    const booked = e.groupNumber === 1 ? e._count.registrationsAsG1 : e._count.registrationsAsG2;
    return {
      id: e.id,
      name: e.name,
      groupNumber: e.groupNumber,
      totalSeats: e.totalSeats,
      availableSeats: e.availableSeats,
      bookedSeats: booked,
      isActive: e.isActive,
      isFull: e.isFull,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          Course Configurations
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          Review elective listings, customize caps, and toggle visibility.
        </p>
      </div>

      <ElectivesClient
        electives={formattedElectives}
        allowFacultyEditing={settings.allowFacultyEditing}
      />
    </div>
  );
}
