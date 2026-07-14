"use server";

import { db } from "@/lib/db";
import { 
  users, 
  registrationEvents, 
  auditLogs,
  eventTemplates,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, count, desc } from "drizzle-orm";

export async function getSystemAdminMetrics() {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") {
    throw new Error("Unauthorized");
  }

  const [{ totalStudents }] = await db
    .select({ totalStudents: count() })
    .from(users)
    .where(eq(users.role, "STUDENT"));

  const [{ totalFaculty }] = await db
    .select({ totalFaculty: count() })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.role, "COURSE_COORDINATOR")));

  const [{ activeEvents }] = await db
    .select({ activeEvents: count() })
    .from(registrationEvents)
    .where(eq(registrationEvents.status, "PUBLISHED"));

  const recentLogs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(5);

  return {
    totalStudents,
    totalFaculty,
    activeEvents,
    recentLogs
  };
}

export async function getCourseCoordinatorMetrics() {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") {
    throw new Error("Unauthorized");
  }

  const [{ totalTemplates }] = await db
    .select({ totalTemplates: count() })
    .from(eventTemplates);

  const [{ totalEvents }] = await db
    .select({ totalEvents: count() })
    .from(registrationEvents);

  return {
    totalTemplates,
    totalEvents,
  };
}

export async function getClassTutorMetrics() {
  const session = await getSession();
  if (!session || session.role !== "CLASS_TUTOR") {
    throw new Error("Unauthorized");
  }

  if (!session.sectionId) {
    return { totalStudents: 0, registeredCount: 0 };
  }

  const [{ totalStudents }] = await db
    .select({ totalStudents: count() })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)));

  return {
    totalStudents,
    registeredCount: 0,
  };
}
