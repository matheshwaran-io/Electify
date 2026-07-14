import { getSession } from "@/lib/auth";
import { getSystemSettings } from "@/app/actions/admin";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") redirect("/faculty/dashboard");
  const settings = await getSystemSettings();
  return <SettingsClient settings={settings} />;
}
