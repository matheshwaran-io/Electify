import { getSession } from "@/lib/auth";
import { getTutorReports } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { requireStaffWorkspace } from "@/lib/workspace";
import { SectionClient } from "./section-client";

export default async function SectionPage() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) redirect("/faculty/dashboard");

  // The active class comes from the workspace (validated for the selected session).
  const ws = await requireStaffWorkspace();
  const reportData = await getTutorReports();

  return (
    <SectionClient
      reportData={reportData}
      session={{
        name: session.name,
        sectionId: ws.activeClass?.sectionId,
        role: session.role,
        classLabel: ws.activeClass?.label,
        academicSession: ws.session.label,
      }}
    />
  );
}
