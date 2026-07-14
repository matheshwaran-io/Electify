import { getSession } from "@/lib/auth";
import { getTutorReports } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { SectionClient } from "./section-client";

export default async function SectionPage() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") redirect("/faculty/dashboard");

  const reportData = await getTutorReports();

  return <SectionClient 
        reportData={reportData} 
        session={{ name: session.name, sectionId: session.sectionId, role: session.role }} 
      />;
}
