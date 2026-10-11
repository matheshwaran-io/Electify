import { getSession } from "@/lib/auth";
import { getCoordinatorElectives, getAcademicHierarchyForAllocations } from "@/app/actions/coordinator";
import { redirect } from "next/navigation";
import { ElectivesClient } from "./electives-client";

export default async function ElectivesPage() {
  const session = await getSession();
  if (!session || (session.role !== "COURSE_COORDINATOR" && session.role !== "SYSTEM_ADMIN")) {
    redirect("/faculty/dashboard");
  }
  const [electives, hierarchy] = await Promise.all([
    getCoordinatorElectives(),
    getAcademicHierarchyForAllocations(),
  ]);
  return <ElectivesClient initialGroups={electives} hierarchy={hierarchy} userRole={session.role} />;
}
