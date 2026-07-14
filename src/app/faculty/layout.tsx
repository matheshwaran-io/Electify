import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { db } from "@/lib/db";
import { tutorSections as dbTutorSections, sections, academicBatches, programmes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  let assignedSections: any[] = [];
  if (session.role === "CLASS_TUTOR") {
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

  return <AppShell session={session} assignedSections={assignedSections}>{children}</AppShell>;
}
