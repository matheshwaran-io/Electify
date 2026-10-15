import { getSession } from "@/lib/auth";
import { getPortalWindow, getRegistrationMetrics } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { requirePageWorkspace } from "@/lib/workspace";
import { WindowClient } from "./window-client";

export default async function WindowPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "CLASS_TUTOR" &&
      session.role !== "COURSE_COORDINATOR" &&
      session.role !== "SYSTEM_ADMIN")
  ) {
    redirect("/faculty/dashboard");
  }
  const ws = await requirePageWorkspace("/faculty/window");
  const events = await getPortalWindow();
  let metrics = null;
  if (events.length > 0) {
    try {
      metrics = await getRegistrationMetrics(events[0].id);
    } catch {
      metrics = null;
    }
  }
  return (
    <WindowClient
      events={events}
      initialMetrics={metrics}
      context={{ classLabel: ws.activeClass?.label ?? null, sessionLabel: ws.session.label, semester: ws.activeClass?.semester ?? null }}
    />
  );
}
