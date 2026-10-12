import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getReplayHubData } from "@/app/actions/replay";
import { ReplayHubClient } from "./replay-hub-client";

export default async function ReplayIndexPage() {
  const session = await getSession();

  if (
    !session ||
    (session.role !== "SYSTEM_ADMIN" &&
      session.role !== "COURSE_COORDINATOR" &&
      session.role !== "CLASS_TUTOR")
  ) {
    redirect("/login");
  }

  const result = await getReplayHubData();
  const initialData =
    result.success && result.data
      ? result.data
      : {
          events: [],
          kpis: {
            totalSessions: 0,
            activeWindows: 0,
            totalSubmissions: 0,
            totalReplayLogs: 0,
            averageTurnoutRate: 0,
            totalAllocatedSeats: 0,
            totalCapacity: 0,
          },
          recentGlobalEvents: [],
        };

  return <ReplayHubClient initialData={initialData} userRole={session.role} />;
}
