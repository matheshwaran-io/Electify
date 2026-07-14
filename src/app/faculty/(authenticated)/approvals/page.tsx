import { getSession } from "@/lib/auth";
import { getSectionRegistrations } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { ApprovalsClient } from "./approvals-client";

export default async function ApprovalsPage() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") redirect("/faculty/dashboard");
  const registrations = await getSectionRegistrations();
  return <ApprovalsClient registrations={registrations} />;
}
