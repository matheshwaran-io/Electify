import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getTemplatesWithDetails,
  getTemplateBatchOptions,
  getAllProgrammes,
} from "@/app/actions/templates";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STUDENT") redirect("/dashboard");

  const [templatesRes, batchesRes, programmes] = await Promise.all([
    getTemplatesWithDetails(),
    getTemplateBatchOptions(),
    getAllProgrammes(),
  ]);

  const templates = templatesRes.success && templatesRes.data ? templatesRes.data : [];
  const batches = batchesRes.success && batchesRes.data ? batchesRes.data : [];

  return (
    <TemplatesClient
      initialTemplates={templates}
      batches={batches}
      programmes={programmes}
      userRole={session.role}
      currentUserId={session.userId}
      userProgrammeId={session.programmeId}
    />
  );
}
