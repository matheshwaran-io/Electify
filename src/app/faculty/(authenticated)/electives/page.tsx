import { getSession } from "@/lib/auth";
import { getCoordinatorElectives } from "@/app/actions/coordinator";
import { redirect } from "next/navigation";
import { ElectivesClient } from "./electives-client";

export default async function ElectivesPage() {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") redirect("/faculty/dashboard");
  const electives = await getCoordinatorElectives();
  return <ElectivesClient groups={electives} />;
}
