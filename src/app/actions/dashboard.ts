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
import { requireStaffWorkspace, workspaceEventIds } from "@/lib/workspace";
import { eq, and, count, desc, inArray, asc, sql } from "drizzle-orm";

export interface DashboardRecentRegistration {
  id: string;
  createdAt: Date | null;
  studentName: string | null;
  studentRegNo: string | null;
  electiveName: string;
  courseCode: string | null;
  groupName: string;
}

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
    // Active events of the selected academic session
    (async () => {
      const ids = await workspaceEventIds(await requireStaffWorkspace());
      return ids.length
        ? db.select({ activeEvents: count() }).from(registrationEvents).where(and(inArray(registrationEvents.id, ids), inArray(registrationEvents.status, ["PUBLISHED", "OPEN", "PAUSED"])))
        : [{ activeEvents: 0 }];
    })(),
    db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(5)
  ]);

  return { totalStudents, totalFaculty, activeEvents, recentLogs };
}

export async function getCourseCoordinatorMetrics() {
  const session = await getSession();
  if (!session || session.role !== "COURSE_COORDINATOR") {
    throw new Error("Unauthorized");
  }

  // Everything below is limited to the selected academic session and the
  // classes this coordinator manages there.
  const ws = await requireStaffWorkspace();
  const eventIds = await workspaceEventIds(ws);
  const none = sql`false`;

  const [
    [{ totalTemplates }],
    [{ totalEvents }],
    [{ activeEventsCount }],
    [{ totalElectives }],
    recentEvents
  ] = await Promise.all([
    db
      .select({ totalTemplates: count() })
      .from(eventTemplates)
      .where(ws.scope.programmeIds.length ? inArray(eventTemplates.programmeId, ws.scope.programmeIds) : undefined),
    db.select({ totalEvents: count() }).from(registrationEvents).where(eventIds.length ? inArray(registrationEvents.id, eventIds) : none),
    db
      .select({ activeEventsCount: count() })
      .from(registrationEvents)
      .where(and(eventIds.length ? inArray(registrationEvents.id, eventIds) : none, inArray(registrationEvents.status, ["PUBLISHED", "OPEN", "PAUSED"]))),
    db
      .select({ totalElectives: count() })
      .from(electives)
      .innerJoin(electiveGroups, eq(electiveGroups.id, electives.groupId))
      .where(eventIds.length ? inArray(electiveGroups.eventId, eventIds) : none),
    db.select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      status: registrationEvents.status,
      openDate: registrationEvents.openDate,
      closeDate: registrationEvents.closeDate,
      createdAt: registrationEvents.createdAt
    })
    .from(registrationEvents)
    .where(eventIds.length ? inArray(registrationEvents.id, eventIds) : none)
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

  // The active class of the selected academic session (validated by the workspace).
  const ws = await requireStaffWorkspace();
  const activeSectionId = ws.activeClass?.sectionId;
  const sessionEventIds = activeSectionId ? await workspaceEventIds(ws, { sectionId: activeSectionId }) : [];

  if (!activeSectionId) {
    return { 
      totalStudents: 0, registeredCount: 0,
      courseOptionsCount: 0, groupsCount: 0, allocationRate: 0,
      activeEvent: null, recentRegistrations: [], pendingStudents: []
    };
  }

  const [
    [{ totalStudents }],
    eventLinks
  ] = await Promise.all([
    db.select({ totalStudents: count() }).from(users).where(and(eq(users.role, "STUDENT"), eq(users.sectionId, activeSectionId))),
    db.select({ 
      eventId: eventSections.eventId,
      status: registrationEvents.status,
      createdAt: registrationEvents.createdAt,
    })
    .from(eventSections)
    .innerJoin(registrationEvents, eq(eventSections.eventId, registrationEvents.id))
    .where(and(eq(eventSections.sectionId, activeSectionId), sessionEventIds.length ? inArray(registrationEvents.id, sessionEventIds) : sql`false`))
    .orderBy(desc(registrationEvents.createdAt))
  ]);

  // Prioritize active or scheduled event over closed ones
  const eventLink =
    eventLinks.find((e) => e.status === "OPEN" || e.status === "PUBLISHED" || e.status === "PAUSED") ||
    eventLinks[0];

  let courseOptionsCount = 0;
  let groupsCount = 0;
  let allocationRate = 0;
  let activeEvent = null;
  let recentRegistrations: DashboardRecentRegistration[] = [];
  let registeredCount = 0;
  let uniqueStudents = new Set<string>();

  if (eventLink) {
    // Fetch Event details, Groups, Registrations, and Recent Regs in parallel
    const [eventRecords, groups, registeredStudents, recent] = await Promise.all([
      db.select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
        allowEditing: registrationEvents.allowEditing,
        autoClose: registrationEvents.autoClose,
      })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventLink.eventId))
      .limit(1),

      db.select({ id: electiveGroups.id })
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventLink.eventId)),

      db.select({ studentId: studentRegistrations.studentId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(and(
        eq(studentRegistrations.eventId, eventLink.eventId),
        eq(users.sectionId, activeSectionId),
        eq(studentRegistrations.status, "CONFIRMED")
      )),

      db.select({
        id: studentRegistrations.id,
        createdAt: studentRegistrations.submittedAt,
        studentName: users.name,
        studentRegNo: users.registerNumber,
        electiveName: electives.name,
        courseCode: electives.courseCode,
        groupName: electiveGroups.name,
      })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
      .innerJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
      .where(and(
        eq(studentRegistrations.eventId, eventLink.eventId),
        eq(users.sectionId, activeSectionId),
        eq(studentRegistrations.status, "CONFIRMED")
      ))
      .orderBy(desc(studentRegistrations.submittedAt))
      .limit(8)
    ]);

    activeEvent = eventRecords[0] || null;
    recentRegistrations = recent;
    groupsCount = groups.length;
    
    // Unique students registered
    uniqueStudents = new Set(registeredStudents.map(r => r.studentId));
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

  // Get list of pending students with email for reminders
  const allStudents = await db
    .select({
      id: users.id,
      name: users.name,
      registerNumber: users.registerNumber,
      email: users.email,
    })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, activeSectionId)))
    .orderBy(asc(users.name));
    
  const pendingStudents = allStudents.filter(s => !uniqueStudents.has(s.id));

  return {
    totalStudents, 
    registeredCount, 
    courseOptionsCount,
    groupsCount,
    allocationRate, 
    activeEvent, 
    recentRegistrations,
    pendingStudents
  };
}
