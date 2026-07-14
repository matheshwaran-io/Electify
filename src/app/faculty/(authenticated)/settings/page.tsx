import { getSession } from "@/lib/auth";
import { getSystemSettings } from "@/app/actions/admin";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) redirect("/login");

  let settings = null;
  if (session.role === "SYSTEM_ADMIN") {
    settings = await getSystemSettings();
  }

  return (
    <SettingsClient 
      settings={settings} 
      user={{ name: user.name, email: user.email, role: session.role }} 
    />
  );
}
