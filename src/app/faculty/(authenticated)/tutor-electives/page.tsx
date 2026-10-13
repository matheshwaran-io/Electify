import { getSession } from "@/lib/auth";
import { getTutorElectives } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { requireStaffWorkspace } from "@/lib/workspace";
import { TutorElectivesClient } from "./tutor-electives-client";

export default async function TutorElectivesPage() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) redirect("/faculty/dashboard");
  const ws = await requireStaffWorkspace();
  const electivesData = await getTutorElectives();
  const active = ws.activeClass;
  return (
    <TutorElectivesClient
      electivesData={electivesData}
      hasActiveSection={Boolean(active)}
      classContext={active ? { classLabel: active.label, sessionLabel: ws.session.label, semester: active.semester } : null}
    />
  );
}
