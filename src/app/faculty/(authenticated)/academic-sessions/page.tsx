import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getYearServersOverview } from "@/app/actions/year-servers";
import { ErrorState } from "@/components/ui/feedback";
import { YearServersClient } from "./year-servers-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Year Servers · Electify" };

export default async function YearServersPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.role === "STUDENT") redirect("/dashboard");

  const overview = await getYearServersOverview();
  if (!overview.success) {
    return <ErrorState title="Year Servers didn't load" description={overview.error} />;
  }

  return (
    <YearServersClient
      servers={overview.servers}
      isAdmin={overview.isAdmin}
      currentSessionId={overview.currentSessionId}
      unresolvedCount={overview.unresolvedCount}
    />
  );
}

