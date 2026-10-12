import { getSession } from "@/lib/auth";
import { getEvents, getBatchesForEvents } from "@/app/actions/admin";
import { getTemplatesWithDetails } from "@/app/actions/templates";
import { redirect } from "next/navigation";
import { EventsClient } from "./events-client";

export default async function EventsPage() {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
    redirect("/faculty/dashboard");
  }

  const [events, batches, templatesRes] = await Promise.all([
    getEvents(),
    getBatchesForEvents(),
    getTemplatesWithDetails(),
  ]);

  const templates = templatesRes.success && templatesRes.data ? templatesRes.data : [];

  return <EventsClient events={events} batches={batches} templates={templates} />;
}
