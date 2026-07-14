import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { SuccessView } from "./success-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClientRedirect } from "@/components/client-redirect";

export default async function RegistrationSuccessPage() {
  const session = await getSession();

  // Route guarding
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "STUDENT") {
    redirect("/faculty/dashboard");
  }

  // Fetch settings & registration
  const [settings, student] = await Promise.all([
    db.settings.findUnique({ where: { id: "system" } }),
    db.student.findUnique({
      where: { id: session.userId },
      include: {
        registration: {
          include: {
            electiveGroup1: true,
            electiveGroup2: true,
          },
        },
      },
    }),
  ]);

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm font-semibold text-rose-500">System settings not configured. Please contact administration.</p>
      </div>
    );
  }

  if (settings.maintenanceMode) {
    return <ClientRedirect to="/maintenance" />;
  }

  if (!student) {
    return <ClientRedirect to="/login" />;
  }

  // If student has not submitted or has no registration, redirect back to dashboard
  if (!student.hasSubmitted || !student.registration) {
    return <ClientRedirect to="/dashboard" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center relative bg-mist dark:bg-slate-950 p-4 overflow-hidden print:bg-white print:dark:bg-white print:p-0">
      {/* Decorative Blur Spheres (Calendly signature watercolor blobs) */}
      <div className="gradient-blob blob-magenta top-[-10%] left-[-10%] opacity-35 dark:opacity-10 print:hidden" />
      <div className="gradient-blob blob-ultraviolet bottom-[-10%] right-[-10%] opacity-25 dark:opacity-10 print:hidden" />
      <div className="gradient-blob blob-cyan top-[25%] right-[-15%] w-96 h-96 opacity-25 dark:opacity-10 print:hidden" />

      {/* Header Utilities */}
      <div className="absolute top-4 right-4 print:hidden">
        <ThemeToggle />
      </div>

      <SuccessView
        student={{
          name: student.name,
          registerNumber: student.registerNumber,
          email: student.email,
        }}
        registration={student.registration}
        allowRegistrationEdit={settings.allowRegistrationEdit}
      />
    </main>
  );
}
