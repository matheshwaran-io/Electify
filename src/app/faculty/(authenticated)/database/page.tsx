import { getSession } from "@/lib/auth";
import { getPortalWindow } from "@/app/actions/tutor";
import { redirect } from "next/navigation";
import { DatabaseClient } from "./database-client";

export default async function DatabasePage() {
  const session = await getSession();
  if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR" && session.role !== "CLASS_TUTOR")) {
    redirect("/faculty/dashboard");
  }
  
  const events = await getPortalWindow();
  
  return <DatabaseClient events={events} role={session.role} />;
}
