import { getSession } from "@/lib/auth";
import { getPortalWindow } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { WindowClient } from "./window-client";

export default async function WindowPage() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") redirect("/faculty/dashboard");
  const events = await getPortalWindow();
  return <WindowClient events={events} />;
}
