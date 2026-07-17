import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { tutorSections as dbTutorSections, sections, academicBatches, programmes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Double check that students don't access this layout
  if (session.role === "STUDENT") {
    redirect("/dashboard");
  }

  // Check for maintenance mode
  const { systemSettings } = await import("@/lib/db/schema");
  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);

  if (settings?.maintenanceMode) {
    // We must read headers/request details to know if the admin is on the settings page
    // Next.js Server Components don't easily get the pathname unless we pass it,
    // but we can import headers and check the Referer/request url or use a client-side route check.
    // However, we can simply redirect everyone unless they are a SYSTEM_ADMIN.
    // If they are a SYSTEM_ADMIN, we let them proceed so they can reach the settings page.
    if (session.role !== "SYSTEM_ADMIN") {
      redirect("/maintenance");
    }
  }

  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const activeWorkspace = cookieStore.get("electify_active_workspace")?.value || "COORDINATOR";

  let assignedSections: any[] = [];
  if (session.role === "CLASS_TUTOR" || session.role === "COURSE_COORDINATOR") {
    assignedSections = await db
      .select({
        id: sections.id,
        label: sections.label,
        batch: academicBatches.year,
        programme: programmes.name,
      })
      .from(dbTutorSections)
      .innerJoin(sections, eq(dbTutorSections.sectionId, sections.id))
      .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
      .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
      .where(eq(dbTutorSections.tutorId, session.userId));
  }

  return <AppShell session={session} assignedSections={assignedSections} activeWorkspace={activeWorkspace}>{children}</AppShell>;
}
