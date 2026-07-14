import { getSession } from "@/lib/auth";
import { getCoordinatorStudents } from "@/app/actions/coordinator";
import { redirect } from "next/navigation";
import { StudentsClient } from "./students-client";

export default async function StudentsPage() {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") redirect("/faculty/dashboard");
  const students = await getCoordinatorStudents();
  return <StudentsClient students={students} />;
}
