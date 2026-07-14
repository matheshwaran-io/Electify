import { db } from "@/lib/db";
import { registrationEvents, eventSections } from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { PlayCircle, Clock, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { redirect } from "next/navigation";

export default async function ReplayIndexPage() {
  const session = await getSession();
  
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR" && session.role !== "CLASS_TUTOR")) {
    redirect("/login");
  }

  let events: (typeof registrationEvents.$inferSelect)[] = [];
  if (session.role === "CLASS_TUTOR") {
    if (session.sectionId) {
      const sectionEvents = await db
        .select({ eventId: eventSections.eventId })
        .from(eventSections)
        .where(eq(eventSections.sectionId, session.sectionId));
      
      const eventIds = sectionEvents.map(se => se.eventId);
      if (eventIds.length > 0) {
        events = await db.select()
          .from(registrationEvents)
          .where(inArray(registrationEvents.id, eventIds))
          .orderBy(desc(registrationEvents.createdAt));
      }
    }
  } else {
    events = await db.select().from(registrationEvents).orderBy(desc(registrationEvents.createdAt));
  }

  // If there's only one event for a tutor, skip the selection screen entirely
  if (session.role === "CLASS_TUTOR" && events.length === 1) {
    redirect(`/faculty/replay/${events[0].id}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)]">Registration Replay</h1>
        <p className="text-[var(--muted-foreground)] mt-2">
          Select an event to replay the entire registration session chronologically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <Link key={event.id} href={`/faculty/replay/${event.id}`}>
            <div className="bg-[var(--card)] hover:bg-[var(--accent)] border border-[var(--border)] rounded-2xl p-6 transition-colors group cursor-pointer h-full flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlayCircle className="w-6 h-6 text-indigo-500" />
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${
                  event.status === "OPEN" ? "bg-emerald-500/10 text-emerald-500" :
                  event.status === "CLOSED" ? "bg-red-500/10 text-red-500" :
                  "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}>
                  {event.status}
                </span>
              </div>
              
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2 line-clamp-2">
                {event.name}
              </h3>
              
              <div className="mt-auto pt-4 space-y-2">
                <div className="flex items-center text-sm text-[var(--muted-foreground)]">
                  <CalendarDays className="w-4 h-4 mr-2" />
                  <span>Created {format(new Date(event.createdAt), "MMM d, yyyy")}</span>
                </div>
                {event.openDate && (
                  <div className="flex items-center text-sm text-[var(--muted-foreground)]">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>Opened {format(new Date(event.openDate), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}

        {events.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-[var(--border)] rounded-2xl">
            <p className="text-[var(--muted-foreground)]">No registration events found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
