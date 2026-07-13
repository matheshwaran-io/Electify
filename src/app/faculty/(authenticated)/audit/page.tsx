import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { AuditLogsClient } from "./audit-client";

export default async function AuditPage() {
  const session = await getSession();

  // Guard: Must be SUPER_ADMIN
  if (!session || session.role !== "SUPER_ADMIN") {
    redirect("/faculty/login");
  }

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const serializedLogs = logs.map(log => ({
    id: log.id,
    action: log.action,
    userId: log.userId,
    userEmail: log.userEmail,
    ipAddress: log.ipAddress,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString()
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          System Audit Logs
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          Historical record of all privileged administrative events and system actions.
        </p>
      </div>

      <AuditLogsClient initialLogs={serializedLogs} />
    </div>
  );
}
