import { getSession } from "@/lib/auth";
import { getEvents } from "@/app/actions/admin";
import { redirect } from "next/navigation";
import { EventsClient } from "./events-client";

export default async function EventsPage() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") redirect("/faculty/dashboard");
  const events = await getEvents();
  return <EventsClient events={events} />;
}
