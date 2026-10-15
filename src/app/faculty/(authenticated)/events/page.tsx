import { getSession } from "@/lib/auth";
import { getEvents } from "@/app/actions/admin";
import { getTemplatesWithDetails } from "@/app/actions/templates";
import { redirect } from "next/navigation";
import { requirePageWorkspace } from "@/lib/workspace";
import { EventsClient } from "./events-client";

export default async function EventsPage() {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
    redirect("/faculty/dashboard");
  }

  // The layout guarantees a selected academic session on this page.
  const ws = await requirePageWorkspace("/faculty/events");
  const [events, templatesRes] = await Promise.all([getEvents(), getTemplatesWithDetails()]);
  const templates = templatesRes.success && templatesRes.data ? templatesRes.data : [];

  return (
    <EventsClient
      events={events}
      classes={ws.classes.map((c) => ({ sectionId: c.sectionId, label: c.label, stage: c.stage, programmeId: c.programmeId, semester: c.semester }))}
      sessionLabel={ws.session.label}
      templates={templates}
    />
  );
}
