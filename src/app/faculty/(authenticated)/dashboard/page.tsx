import { getSession } from "@/lib/auth";
import { 
  getSystemAdminMetrics, 
  getCourseCoordinatorMetrics, 
  getClassTutorMetrics 
} from "@/app/actions/dashboard";
import { DashboardClient } from "./dashboard-client";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  let metrics: any = null;

  if (session.role === "SYSTEM_ADMIN") {
    metrics = await getSystemAdminMetrics();
  } else if (session.role === "COURSE_COORDINATOR") {
    metrics = await getCourseCoordinatorMetrics();
  } else if (session.role === "CLASS_TUTOR") {
    metrics = await getClassTutorMetrics();
  }

  return <DashboardClient session={session} metrics={metrics} />;
}
