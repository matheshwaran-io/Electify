import { getSession } from "@/lib/auth";
import { getPortalWindow, getRegistrationMetrics } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { WindowClient } from "./window-client";

export default async function WindowPage() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) redirect("/faculty/dashboard");
  const events = await getPortalWindow();
  let metrics = null;
  if (events.length > 0) {
    metrics = await getRegistrationMetrics(events[0].id);
  }
  return <WindowClient events={events} initialMetrics={metrics} />;
}
