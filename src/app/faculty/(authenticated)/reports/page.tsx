import { getSession } from "@/lib/auth";
import { getCoordinatorReports } from "@/app/actions/coordinator";
import { redirect } from "next/navigation";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") redirect("/faculty/dashboard");
  const report = await getCoordinatorReports();
  return <ReportsClient report={report} />;
}
