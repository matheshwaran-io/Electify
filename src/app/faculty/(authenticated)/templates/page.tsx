import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTemplatesWithDetails, getAllProgrammes } from "@/app/actions/templates";
import { resolveStaffWorkspace } from "@/lib/workspace";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STUDENT") redirect("/dashboard");

  const [templatesRes, programmes, workspace] = await Promise.all([getTemplatesWithDetails(), getAllProgrammes(), resolveStaffWorkspace()]);

  const templates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  // Templates are programme-level; creating an event from one needs a class in the selected session.
  const ws = workspace.status === "OK" ? workspace.workspace : null;
  const classes = ws
    ? ws.classes.map((c) => ({ sectionId: c.sectionId, label: c.label, stage: c.stage, programmeId: c.programmeId, semester: c.semester }))
    : [];

  return (
    <TemplatesClient
      initialTemplates={templates}
      classes={classes}
      sessionLabel={ws?.session.label ?? null}
      programmes={programmes}
      userRole={session.role}
      currentUserId={session.userId}
      userProgrammeId={session.programmeId}
    />
  );
}
