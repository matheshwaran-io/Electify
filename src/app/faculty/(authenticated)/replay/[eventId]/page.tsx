import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReplayEngine } from "@/components/replay/replay-engine";

export default async function ReplayEventPage({ params }: { params: { eventId: string } }) {
  const session = await getSession();
  
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR" && session.role !== "CLASS_TUTOR")) {
    redirect("/login");
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <ReplayEngine eventId={params.eventId} />
    </div>
  );
}
