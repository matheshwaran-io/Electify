import { getSession } from "@/lib/auth";
import { getAuditLogs } from "@/app/actions/admin";
import { redirect } from "next/navigation";
import { AuditClient } from "./audit-client";

export default async function AuditPage() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") redirect("/faculty/dashboard");
  const data = await getAuditLogs(1, 25);
  return <AuditClient data={data} />;
}
