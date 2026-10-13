import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getYearServerWorkspaceDetails } from "@/app/actions/year-servers";
import { resolveStaffWorkspace } from "@/lib/workspace";
import { ErrorState } from "@/components/ui/feedback";
import { YearServerWorkspaceClient } from "./year-server-workspace-client";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return { title: `Academic Year ${year} · Electify` };
}

export default async function YearServerWorkspacePage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/dashboard");

  const { year: yearParam } = await params;
  const year = Number(yearParam);
  if (!Number.isFinite(year)) {
    return <ErrorState title="Invalid Academic Year" description="Please provide a valid year." />;
  }

  const details = await getYearServerWorkspaceDetails(year);
  if (!details.success) {
    return (
      <ErrorState
        title={`Academic Year ${year} not found`}
        description={details.error}
      />
    );
  }

  const ws = await resolveStaffWorkspace();
  const activeSectionId = ws.status === "OK" ? ws.workspace.activeClass?.sectionId : undefined;

  return (
    <YearServerWorkspaceClient
      details={details}
      isAdmin={user.role === "SYSTEM_ADMIN"}
      activeSectionId={activeSectionId}
    />
  );
}
