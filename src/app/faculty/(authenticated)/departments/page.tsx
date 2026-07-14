import { getSession } from "@/lib/auth";
import { getDepartmentsTree } from "@/app/actions/admin";
import { redirect } from "next/navigation";
import { DepartmentsClient } from "./departments-client";

export default async function DepartmentsPage() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") redirect("/faculty/dashboard");
  const tree = await getDepartmentsTree();
  return <DepartmentsClient tree={tree} />;
}
