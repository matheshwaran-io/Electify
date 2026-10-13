import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getHistoricalReviewReport } from "@/app/actions/year-servers";
import { ErrorState } from "@/components/ui/feedback";
import { DataReviewClient } from "./data-review-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Historical Data Review · Electify" };

export default async function HistoricalDataReviewPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role !== "SYSTEM_ADMIN") redirect("/faculty/academic-sessions");

  const report = await getHistoricalReviewReport();
  if (!report.success) {
    return <ErrorState title="Could not load review data" description={report.error} />;
  }

  return (
    <DataReviewClient
      unlinkedEvents={report.unlinkedEvents}
      availableYearServers={report.availableYearServers}
    />
  );
}
