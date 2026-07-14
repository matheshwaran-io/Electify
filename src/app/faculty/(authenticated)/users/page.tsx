import { getSession } from "@/lib/auth";
import { getStaffUsers, getStudentUsers } from "@/app/actions/admin";
import { redirect } from "next/navigation";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") redirect("/faculty/dashboard");
  const [staff, students] = await Promise.all([getStaffUsers(), getStudentUsers()]);
  return <UsersClient staff={staff} students={students} />;
}
