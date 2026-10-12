import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLiveMonitoringData } from "@/app/actions/monitor";
import { MonitorClient } from "./monitor-client";

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ eventId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STUDENT") redirect("/dashboard");

  const resolvedParams = await searchParams;
  const monitoringRes = await getLiveMonitoringData(resolvedParams?.eventId);

  const initialData =
    monitoringRes.success && monitoringRes.data
      ? monitoringRes.data
      : {
          event: null,
          eventsList: [],
          kpis: {
            totalEligibleStudents: 0,
            registeredStudents: 0,
            unregisteredStudents: 0,
            completionRate: 0,
            totalCapacity: 0,
            filledSeats: 0,
            availableSeats: 0,
            seatUtilizationRate: 0,
            fullCoursesCount: 0,
            totalCoursesCount: 0,
            registrationsLast5Min: 0,
            registrationsLastHour: 0,
            velocityRpm: 0,
          },
          courses: [],
          sections: [],
          recentActivity: [],
        };

  return (
    <MonitorClient
      initialData={initialData}
      userRole={session.role}
      userEmail={session.email}
    />
  );
}
