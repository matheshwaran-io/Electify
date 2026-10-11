import { getSession } from "@/lib/auth";
import { getCoordinatorReports } from "@/app/actions/coordinator";
import { redirect } from "next/navigation";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || (session.role !== "COURSE_COORDINATOR" && session.role !== "SYSTEM_ADMIN")) {
    redirect("/faculty/dashboard");
  }
  const data = await getCoordinatorReports();
  return <ReportsClient data={data} />;
}
