import * as React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import { InviteCode } from "@prisma/client";
import { InvitesClient } from "./invites-client";

export default async function InvitesPage() {
  const session = await getSession();

  // Guard: Must be SUPER_ADMIN or COURSE_COORDINATOR
  if (!session || (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN")) {
    redirect("/faculty/login");
  }

  const isSuperAdmin = session.role === "SUPER_ADMIN";
  const isCoordinator = session.facultyType === "COURSE_COORDINATOR";

  if (!isSuperAdmin && !isCoordinator) {
    redirect("/faculty/dashboard");
  }

  let initialInvites: InviteCode[] = [];
  try {
    if (isSuperAdmin) {
      initialInvites = await db.inviteCode.findMany({
        orderBy: { createdAt: "desc" },
      });
    } else {
      // Course Coordinator can see CLASS_TUTOR invites for their MCA degree
      initialInvites = await db.inviteCode.findMany({
        where: {
          role: "CLASS_TUTOR",
          degree: "MCA",
        },
        orderBy: { createdAt: "desc" },
      });
    }
  } catch (error) {
    console.error("Failed to query initial invites:", error);
  }

  // Serialize dates for Client Component
  const serializedInvites = initialInvites.map(invite => ({
    ...invite,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100">
          Staff Invite Codes
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
          Generate, verify, and revoke access credentials for Course Coordinators and Class Tutors.
        </p>
      </div>

      <InvitesClient initialInvites={serializedInvites} session={session} />
    </div>
  );
}
