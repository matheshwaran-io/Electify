import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { WindowClient } from "./window-client";

export default async function WindowPage() {
  const session = await getSession();

  // Guard: Must be SUPER_ADMIN
  if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
    redirect("/faculty/login");
  }

  if (session.role !== "SUPER_ADMIN") {
    redirect("/faculty/dashboard");
  }

  const settings = await db.settings.findUnique({
    where: { id: "system" },
  });

  if (!settings) {
    return (
      <div className="p-6 text-center text-rose-500 font-bold">
        System configurations are missing. Seeding may not have run.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          Portal Window
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          Configure the active start and closing window schedules for student registration.
        </p>
      </div>

      <div className="max-w-3xl">
        <WindowClient settings={settings} />
      </div>
    </div>
  );
}
