import { getSession } from "@/lib/auth";
import { getInviteCodes, getDepartmentsTree } from "@/app/actions/admin";
import { redirect } from "next/navigation";
import { InvitesClient } from "./invites-client";

export default async function InvitesPage() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") redirect("/faculty/dashboard");

  const [codes, tree] = await Promise.all([getInviteCodes(), getDepartmentsTree()]);

  return <InvitesClient codes={codes} tree={tree} />;
}
