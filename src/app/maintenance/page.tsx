import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MaintenanceView } from "./maintenance-view";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);

  // If maintenance mode is NOT enabled, redirect back to the home router page
  if (!settings?.maintenanceMode) {
    redirect("/dashboard"); // This will auto-route students to selection, and faculty to their dashboard
  }

  return <MaintenanceView />;
}
