import { getSession } from "@/lib/auth";
import { getTutorElectives } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { TutorElectivesClient } from "./tutor-electives-client";

export default async function TutorElectivesPage() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") redirect("/faculty/dashboard");
  const electivesData = await getTutorElectives();
  return <TutorElectivesClient electivesData={electivesData} hasActiveSection={!!session.sectionId} />;
}
