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

  const [
    [{ totalStudents }],
    [{ totalFaculty }],
    [{ activeEvents }],
    recentLogs
  ] = await Promise.all([
    db.select({ totalStudents: count() }).from(users).where(eq(users.role, "STUDENT")),
    db.select({ totalFaculty: count() }).from(users).where(and(eq(users.isActive, true), eq(users.role, "COURSE_COORDINATOR"))),
    db.select({ activeEvents: count() }).from(registrationEvents).where(eq(registrationEvents.status, "PUBLISHED")),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(5)
  ]);

  return { totalStudents, totalFaculty, activeEvents, recentLogs };
}

export async function getCourseCoordinatorMetrics() {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") {
    throw new Error("Unauthorized");
  }

  const [
    [{ totalTemplates }],
    [{ totalEvents }],
    [{ activeEventsCount }],
    [{ totalElectives }],
    recentEvents
  ] = await Promise.all([
    db.select({ totalTemplates: count() }).from(eventTemplates),
    db.select({ totalEvents: count() }).from(registrationEvents),
    db.select({ activeEventsCount: count() }).from(registrationEvents).where(eq(registrationEvents.status, "PUBLISHED")),
    db.select({ totalElectives: count() }).from(electives),
    db.select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      status: registrationEvents.status,
      openDate: registrationEvents.openDate,
      closeDate: registrationEvents.closeDate,
      createdAt: registrationEvents.createdAt
    })
    .from(registrationEvents)
    .orderBy(desc(registrationEvents.createdAt))
    .limit(5)
  ]);

  return { totalTemplates, totalEvents, activeEventsCount, totalElectives, recentEvents };
}

export async function getClassTutorMetrics() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) {
    throw new Error("Unauthorized");
  }

  if (!session.sectionId) {
    return { 
      totalStudents: 0, registeredCount: 0, courseOptionsCount: 0, 
      allocationRate: 0, activeEvent: null, recentRegistrations: []
    };
  }

  const [
    [{ totalStudents }],
    eventLinks
  ] = await Promise.all([
    db.select({ totalStudents: count() }).from(users).where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId))),
    db.select({ eventId: eventSections.eventId }).from(eventSections).where(eq(eventSections.sectionId, session.sectionId))
  ]);

  const eventLink = eventLinks[0];

  let courseOptionsCount = 0;
  let allocationRate = 0;
  let activeEvent = null;
  let recentRegistrations: any[] = [];
  let registeredCount = 0;

  if (eventLink) {
    // Fetch Event, Groups, Registrations, and Recent Regs in parallel
    const [eventRecords, groups, registeredStudents, recent] = await Promise.all([
      db.select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
      })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventLink.eventId))
      .limit(1),

      db.select({ id: electiveGroups.id })
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventLink.eventId)),

      db.select({ studentId: studentRegistrations.studentId })
      .from(studentRegistrations)
      .where(eq(studentRegistrations.eventId, eventLink.eventId)),

      db.select({
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
      .limit(5)
    ]);

    activeEvent = eventRecords[0] || null;
    recentRegistrations = recent;
    
    // Unique students count
    const uniqueStudents = new Set(registeredStudents.map(r => r.studentId));
    registeredCount = uniqueStudents.size;

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
  }

  // Get list of pending students
  const allStudents = await db
    .select({
      id: users.id,
      name: users.name,
      registerNumber: users.registerNumber,
    })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)));
    
  let pendingStudents = [];
  if (activeEvent) {
    const registeredIds = new Set(
      (await db
        .select({ studentId: studentRegistrations.studentId })
        .from(studentRegistrations)
        .where(eq(studentRegistrations.eventId, activeEvent.id)))
        .map(r => r.studentId)
    );
    pendingStudents = allStudents.filter(s => !registeredIds.has(s.id));
  } else {
    pendingStudents = allStudents;
  }

  return {
    totalStudents, registeredCount, courseOptionsCount,
    allocationRate, activeEvent, recentRegistrations,
    pendingStudents
  };
}
