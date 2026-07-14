"use server";

import { db } from "@/lib/db";
import { 
  users, 
  registrationEvents, 
  auditLogs,
  eventTemplates,
  eventSections,
  electiveGroups,
  electives,
  studentRegistrations
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, count, desc, inArray } from "drizzle-orm";

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
    return { 
      totalStudents: 0, 
      registeredCount: 0, 
      courseOptionsCount: 0, 
      allocationRate: 0,
      activeEvent: null,
      recentRegistrations: []
    };
  }

  const [{ totalStudents }] = await db
    .select({ totalStudents: count() })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)));

  // Find the event for this section
  const [eventLink] = await db
    .select({ eventId: eventSections.eventId })
    .from(eventSections)
    .where(eq(eventSections.sectionId, session.sectionId));

  let courseOptionsCount = 0;
  let allocationRate = 0;
  let activeEvent = null;
  let recentRegistrations: any[] = [];
  let registeredCount = 0;

  if (eventLink) {
    // 1. Fetch Event Info
    const [eventRecord] = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
      })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventLink.eventId))
      .limit(1);
    activeEvent = eventRecord || null;

    // 2. Fetch Electives Stats
    const groups = await db
      .select({ id: electiveGroups.id })
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventLink.eventId));

    if (groups.length > 0) {
      const groupIds = groups.map(g => g.id);
      
      const electivesList = await db
        .select({
          maxSeats: electives.maxSeats,
          availableSeats: electives.availableSeats,
        })
        .from(electives)
        .where(inArray(electives.groupId, groupIds));
        
      courseOptionsCount = electivesList.length;
      let totalMax = 0;
      let totalAvailable = 0;
      electivesList.forEach(e => {
        totalMax += e.maxSeats;
        totalAvailable += e.availableSeats;
      });
      const filled = totalMax - totalAvailable;
      allocationRate = totalMax > 0 ? Math.round((filled / totalMax) * 100) : 0;
    }

    // 3. Fetch Registered Count
    // To get registeredCount, we just need to count unique students in studentRegistrations for this event
    const registeredStudents = await db
      .select({ studentId: studentRegistrations.studentId })
      .from(studentRegistrations)
      .where(eq(studentRegistrations.eventId, eventLink.eventId));
      
    // Count unique students
    const uniqueStudents = new Set(registeredStudents.map(r => r.studentId));
    registeredCount = uniqueStudents.size;

    // 4. Fetch Recent Registrations
    const recent = await db
      .select({
        id: studentRegistrations.id,
        createdAt: studentRegistrations.submittedAt,
        studentName: users.name,
        studentRegNo: users.registerNumber,
        electiveName: electives.name,
      })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
      .where(eq(studentRegistrations.eventId, eventLink.eventId))
      .orderBy(desc(studentRegistrations.submittedAt))
      .limit(5);
      
    recentRegistrations = recent;
  }

  return {
    totalStudents,
    registeredCount,
    courseOptionsCount,
    allocationRate,
    activeEvent,
    recentRegistrations,
  };
}
