import { getSession } from "@/lib/auth";
import { getTemplates } from "@/app/actions/admin";
import { getCoordinatorTemplates } from "@/app/actions/coordinator";
import { redirect } from "next/navigation";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STUDENT") redirect("/dashboard");

  const templates =
    session.role === "SYSTEM_ADMIN"
      ? await getTemplates()
      : await getCoordinatorTemplates();

  return <TemplatesClient templates={templates} />;
}
