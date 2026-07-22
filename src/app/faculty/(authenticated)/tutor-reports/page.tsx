import { getSession } from "@/lib/auth";
import { getTutorReports } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { TutorReportsClient } from "./tutor-reports-client";

export default async function TutorReportsPage() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) redirect("/faculty/dashboard");
  const reportData = await getTutorReports();
  return <TutorReportsClient reportData={reportData} hasActiveSection={!!session.sectionId} />;
}
