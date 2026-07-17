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

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const activeWorkspace = cookieStore.get("electify_active_workspace")?.value || "COORDINATOR";

  let metrics: any = null;

  if (session.role === "SYSTEM_ADMIN") {
    metrics = await getSystemAdminMetrics();
  } else if (session.role === "COURSE_COORDINATOR") {
    if (activeWorkspace === "TUTOR") {
      metrics = await getClassTutorMetrics();
    } else {
      metrics = await getCourseCoordinatorMetrics();
    }
  } else if (session.role === "CLASS_TUTOR") {
    metrics = await getClassTutorMetrics();
  }

  return <DashboardClient session={session} metrics={metrics} activeWorkspace={activeWorkspace} />;
}
