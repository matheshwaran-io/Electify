import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { tutorSections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PortalSelectClient } from "./portal-select-client";

export default async function PortalSelectPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "COURSE_COORDINATOR" && session.role !== "SYSTEM_ADMIN") {
    redirect("/faculty/dashboard");
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const activeWorkspace = cookieStore.get("electify_active_workspace")?.value || "COORDINATOR";

  const userSections = await db
    .select()
    .from(tutorSections)
    .where(eq(tutorSections.tutorId, session.userId));

  return (
    <PortalSelectClient 
      session={session} 
      assignedSectionsCount={userSections.length} 
      currentWorkspace={activeWorkspace} 
    />
  );
}
