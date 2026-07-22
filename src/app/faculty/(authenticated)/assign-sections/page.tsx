import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TutorSectionOnboarding } from "@/components/tutor-section-onboarding";

export default async function AssignSectionsPage() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) redirect("/faculty/dashboard");

  return <TutorSectionOnboarding isManageMode={true} />;
}
