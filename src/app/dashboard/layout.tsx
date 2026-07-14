import * as React from "react";
import { getSession } from "@/lib/auth";
import { PresenceTracker } from "@/components/presence-tracker";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <>
      {session && session.role === "STUDENT" && (
        <PresenceTracker userId={session.userId} />
      )}
      {children}
    </>
  );
}
