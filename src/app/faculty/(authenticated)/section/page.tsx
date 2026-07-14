import { getSession } from "@/lib/auth";
import { getSectionStudents } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { SectionClient } from "./section-client";

export default async function SectionPage() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") redirect("/faculty/dashboard");
  const students = await getSectionStudents();
  return <SectionClient students={students} session={session} />;
}
