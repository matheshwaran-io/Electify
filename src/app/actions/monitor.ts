"use server";

import { db } from "@/lib/db";
import {
  registrationEvents,
  eventSections,
  sections,
  academicBatches,
  programmes,
  users,
  registrations,
  electiveGroups,
  electives,
  replayEvents,
  auditLogs,
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { assertClass, assertEventInWorkspace, requireStaffWorkspace, workspaceEventIds } from "@/lib/workspace";
import { eq, and, inArray, desc, asc, count, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(...paths: string[]) {
  try {
    for (const p of paths) {
      revalidatePath(p);
    }
  } catch {
    // Non-HTTP test context
  }
}

/** Monitoring data names students, so it is for staff roles only. */
function isStaff(session: { role: string } | null): session is { role: string } {
  return Boolean(session && (session.role === "SYSTEM_ADMIN" || session.role === "COURSE_COORDINATOR" || session.role === "CLASS_TUTOR"));
}

export interface MonitorEventOption {
  id: string;
  name: string;
  status: string;
  openDate: string | null;
  closeDate: string | null;
  academicYear: string | null;
  programmeName: string | null;
  programmeCode: string | null;
  batchYear: string | null;
  /** Full identity of the classes the event is for, e.g. "MCA F · 2025–2027" */
  classLabels: string[];
  sectionCount: number;
  totalStudents: number;
}

export interface MonitorKPIs {
  totalEligibleStudents: number;
  registeredStudents: number;
  unregisteredStudents: number;
  completionRate: number; // percentage
  totalCapacity: number;
  filledSeats: number;
  availableSeats: number;
  seatUtilizationRate: number; // percentage
  fullCoursesCount: number;
  totalCoursesCount: number;
  registrationsLast5Min: number;
  registrationsLastHour: number;
  velocityRpm: number; // registrations per minute
}

export interface MonitorCourseStat {
  id: string;
  name: string;
  courseCode: string | null;
  credits: number;
  groupId: string;
  groupName: string;
  maxSeats: number;
  availableSeats: number;
  filledSeats: number;
  fillPercentage: number;
  isFull: boolean;
}

export interface MonitorSectionStat {
  sectionId: string;
  sectionName: string;
  totalStudents: number;
  registeredCount: number;
  unregisteredCount: number;
  completionRate: number;
}

export interface MonitorActivityItem {
  id: string;
  eventType: string;
  timestamp: string;
  studentId: string | null;
  studentName: string | null;
  registerNumber: string | null;
  sectionName: string | null;
  subjectName: string | null;
  oldSubject: string | null;
  newSubject: string | null;
  seatBefore: number | null;
  seatAfter: number | null;
  metadata: any;
}

export interface LiveMonitoringData {
  event: {
    id: string;
    name: string;
    status: string;
    openDate: string | null;
    closeDate: string | null;
    autoClose: boolean;
    allowEditing: boolean;
    academicYear: string | null;
    batchYear: string | null;
    programmeName: string | null;
    programmeCode: string | null;
    classLabels: string[];
  } | null;
  eventsList: MonitorEventOption[];
  kpis: MonitorKPIs;
  courses: MonitorCourseStat[];
  sections: MonitorSectionStat[];
  recentActivity: MonitorActivityItem[];
}

/**
 * Fetch all events accessible to the current user for monitoring.
 */
export async function getLiveMonitorEvents(): Promise<{
  success: boolean;
  data?: MonitorEventOption[];
  error?: string;
}> {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.role !== "SYSTEM_ADMIN" &&
        session.role !== "COURSE_COORDINATOR" &&
        session.role !== "CLASS_TUTOR")
    ) {
      return { success: false, error: "Unauthorized access to live monitor." };
    }

    const baseQuery = db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
        academicYear: registrationEvents.academicYear,
        academicBatchId: registrationEvents.academicBatchId,
        programmeId: academicBatches.programmeId,
        programmeName: programmes.name,
        programmeCode: programmes.code,
        batchYear: academicBatches.year,
        createdById: registrationEvents.createdById,
        createdAt: registrationEvents.createdAt,
      })
      .from(registrationEvents)
      .leftJoin(academicBatches, eq(registrationEvents.academicBatchId, academicBatches.id))
      .leftJoin(programmes, eq(academicBatches.programmeId, programmes.id));

    // Only events of the selected academic session for classes this user manages.
    const ws = await requireStaffWorkspace();
    const scopedIds = await workspaceEventIds(ws);
    const allowedEvents = scopedIds.length
      ? await baseQuery.where(inArray(registrationEvents.id, scopedIds)).orderBy(desc(registrationEvents.createdAt))
      : [];
    const managedSections = new Set(ws.classes.map((c) => c.sectionId));
    const labelOf = new Map(ws.classes.map((c) => [c.sectionId, c.label]));

    if (allowedEvents.length === 0) {
      return { success: true, data: [] };
    }

    // Get section and student counts per event
    const eventIds = allowedEvents.map((e) => e.id);
    const eventSecRows = await db
      .select({
        eventId: eventSections.eventId,
        sectionId: eventSections.sectionId,
      })
      .from(eventSections)
      .where(inArray(eventSections.eventId, eventIds));

    const allSectionIds = Array.from(new Set(eventSecRows.map((r) => r.sectionId)));
    const sectionStudents =
      allSectionIds.length > 0
        ? await db
            .select({
              sectionId: users.sectionId,
              studentCount: count(),
            })
            .from(users)
            .where(
              and(
                inArray(users.sectionId, allSectionIds),
                eq(users.role, "STUDENT"),
                eq(users.isActive, true)
              )
            )
            .groupBy(users.sectionId)
        : [];

    const studentCountMap = new Map(sectionStudents.map((s) => [s.sectionId, s.studentCount]));

    const formattedList: MonitorEventOption[] = allowedEvents.map((e) => {
      const eSecs = eventSecRows.filter((r) => r.eventId === e.id && managedSections.has(r.sectionId)).map((r) => r.sectionId);
      const totalStudents = eSecs.reduce(
        (sum, secId) => sum + (studentCountMap.get(secId) || 0),
        0
      );

      return {
        id: e.id,
        name: e.name,
        status: e.status,
        openDate: e.openDate ? e.openDate.toISOString() : null,
        closeDate: e.closeDate ? e.closeDate.toISOString() : null,
        academicYear: e.academicYear,
        programmeName: e.programmeName,
        programmeCode: e.programmeCode,
        batchYear: e.batchYear,
        classLabels: eSecs.map((id) => labelOf.get(id)).filter((l): l is string => Boolean(l)),
        sectionCount: eSecs.length,
        totalStudents,
      };
    });

    // Sort so OPEN / active events are first
    formattedList.sort((a, b) => {
      const order: Record<string, number> = { OPEN: 0, PAUSED: 1, DRAFT: 2, CLOSED: 3 };
      const aOrder = order[a.status] ?? 4;
      const bOrder = order[b.status] ?? 4;
      return aOrder - bOrder;
    });

    return { success: true, data: formattedList };
  } catch (error) {
    console.error("Error fetching live monitor events:", error);
    return { success: false, error: "Failed to load events for monitor." };
  }
}

/**
 * Main telemetry aggregator: Fetches full live monitoring data for a selected event.
 */
export async function getLiveMonitoringData(
  requestedEventId?: string
): Promise<{ success: boolean; data?: LiveMonitoringData; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.role !== "SYSTEM_ADMIN" &&
        session.role !== "COURSE_COORDINATOR" &&
        session.role !== "CLASS_TUTOR")
    ) {
      return { success: false, error: "Unauthorized access to live monitor." };
    }

    // 1. Fetch accessible events list
    const eventsListRes = await getLiveMonitorEvents();
    if (!eventsListRes.success || !eventsListRes.data) {
      return { success: false, error: eventsListRes.error || "Failed to load events." };
    }

    const eventsList = eventsListRes.data;
    if (eventsList.length === 0) {
      return {
        success: true,
        data: {
          event: null,
          eventsList: [],
          kpis: {
            totalEligibleStudents: 0,
            registeredStudents: 0,
            unregisteredStudents: 0,
            completionRate: 0,
            totalCapacity: 0,
            filledSeats: 0,
            availableSeats: 0,
            seatUtilizationRate: 0,
            fullCoursesCount: 0,
            totalCoursesCount: 0,
            registrationsLast5Min: 0,
            registrationsLastHour: 0,
            velocityRpm: 0,
          },
          courses: [],
          sections: [],
          recentActivity: [],
        },
      };
    }

    // Determine target event
    let targetEventOption = eventsList.find((e) => e.id === requestedEventId);
    if (!targetEventOption) {
      // Pick first OPEN event, or first in list
      targetEventOption = eventsList.find((e) => e.status === "OPEN") || eventsList[0];
    }

    const eventId = targetEventOption.id;

    // 2. Query target event details
    const [rawEvent] = await db
      .select({
        id: registrationEvents.id,
        name: registrationEvents.name,
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate,
        autoClose: registrationEvents.autoClose,
        allowEditing: registrationEvents.allowEditing,
        academicYear: registrationEvents.academicYear,
        academicBatchId: registrationEvents.academicBatchId,
        programmeName: programmes.name,
        programmeCode: programmes.code,
        batchYear: academicBatches.year,
      })
      .from(registrationEvents)
      .leftJoin(academicBatches, eq(registrationEvents.academicBatchId, academicBatches.id))
      .leftJoin(programmes, eq(academicBatches.programmeId, programmes.id))
      .where(eq(registrationEvents.id, eventId))
      .limit(1);

    if (!rawEvent) {
      return { success: false, error: "Registration event not found." };
    }

    // 3. Query linked sections
    const linkedSections = await db
      .select({
        id: sections.id,
        name: sections.label,
      })
      .from(eventSections)
      .innerJoin(sections, eq(eventSections.sectionId, sections.id))
      .where(eq(eventSections.eventId, eventId))
      .orderBy(asc(sections.label));

    const sectionIds = linkedSections.map((s) => s.id);

    // 4. Query students in these sections
    const allCohortStudents =
      sectionIds.length > 0
        ? await db
            .select({
              id: users.id,
              name: users.name,
              registerNumber: users.registerNumber,
              sectionId: users.sectionId,
            })
            .from(users)
            .where(
              and(
                inArray(users.sectionId, sectionIds),
                eq(users.role, "STUDENT"),
                eq(users.isActive, true)
              )
            )
        : [];

    const totalEligibleStudents = allCohortStudents.length;

    // 5. Query registrations for this event
    const eventRegistrations = await db
      .select({
        id: registrations.id,
        studentId: registrations.studentId,
        status: registrations.status,
        submittedAt: registrations.submittedAt,
        receiptSnapshot: registrations.receiptSnapshot,
        userSectionId: users.sectionId,
      })
      .from(registrations)
      .leftJoin(users, eq(registrations.studentId, users.id))
      .where(eq(registrations.eventId, eventId));

    const confirmedRegs = eventRegistrations.filter((r) => r.status === "CONFIRMED");

    const registeredStudents = confirmedRegs.length;
    const unregisteredStudents = Math.max(0, totalEligibleStudents - registeredStudents);
    const completionRate =
      totalEligibleStudents > 0
        ? Math.round((registeredStudents / totalEligibleStudents) * 100)
        : 0;

    // Velocity Metrics
    const now = new Date().getTime();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const registrationsLast5Min = confirmedRegs.filter(
      (r) => r.submittedAt && new Date(r.submittedAt).getTime() >= fiveMinutesAgo
    ).length;

    const registrationsLast15Min = confirmedRegs.filter(
      (r) => r.submittedAt && new Date(r.submittedAt).getTime() >= fifteenMinutesAgo
    ).length;

    const registrationsLastHour = confirmedRegs.filter(
      (r) => r.submittedAt && new Date(r.submittedAt).getTime() >= oneHourAgo
    ).length;

    const velocityRpm = Number((registrationsLast15Min / 15).toFixed(1));

    // 6. Query Electives and Groups for this event
    const rawGroups = await db
      .select({
        id: electiveGroups.id,
        name: electiveGroups.name,
      })
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, eventId))
      .orderBy(asc(electiveGroups.sortOrder), asc(electiveGroups.name));

    const groupMap = new Map(rawGroups.map((g) => [g.id, g.name]));
    const groupIds = rawGroups.map((g) => g.id);

    const rawElectives =
      groupIds.length > 0
        ? await db
            .select({
              id: electives.id,
              groupId: electives.groupId,
              name: electives.name,
              courseCode: electives.courseCode,
              credits: electives.credits,
              maxSeats: electives.maxSeats,
              availableSeats: electives.availableSeats,
              isFull: electives.isFull,
            })
            .from(electives)
            .where(inArray(electives.groupId, groupIds))
            .orderBy(asc(electives.courseCode), asc(electives.name))
        : [];

    let totalCapacity = 0;
    let filledSeats = 0;
    let availableSeatsTotal = 0;
    let fullCoursesCount = 0;

    const courses: MonitorCourseStat[] = rawElectives.map((el) => {
      const elFilled = Math.max(0, el.maxSeats - el.availableSeats);
      totalCapacity += el.maxSeats;
      filledSeats += elFilled;
      availableSeatsTotal += el.availableSeats;
      const isActuallyFull = el.isFull || el.availableSeats <= 0;
      if (isActuallyFull) fullCoursesCount++;

      const fillPercentage =
        el.maxSeats > 0 ? Math.min(100, Math.round((elFilled / el.maxSeats) * 100)) : 0;

      return {
        id: el.id,
        name: el.name,
        courseCode: el.courseCode,
        credits: el.credits,
        groupId: el.groupId,
        groupName: groupMap.get(el.groupId) || "Elective Basket",
        maxSeats: el.maxSeats,
        availableSeats: el.availableSeats,
        filledSeats: elFilled,
        fillPercentage,
        isFull: isActuallyFull,
      };
    });

    const seatUtilizationRate =
      totalCapacity > 0 ? Math.round((filledSeats / totalCapacity) * 100) : 0;

    // 7. Calculate Section Participation Breakdown
    const sectionsStats: MonitorSectionStat[] = linkedSections.map((sec) => {
      const secStudents = allCohortStudents.filter((s) => s.sectionId === sec.id);
      const totalSec = secStudents.length;

      const secRegs = eventRegistrations.filter((r) => r.userSectionId === sec.id);
      const secConfirmed = secRegs.filter((r) => r.status === "CONFIRMED").length;
      const secUnregistered = Math.max(0, totalSec - secConfirmed);
      const secRate = totalSec > 0 ? Math.round((secConfirmed / totalSec) * 100) : 0;

      return {
        sectionId: sec.id,
        sectionName: sec.name,
        totalStudents: totalSec,
        registeredCount: secConfirmed,
        unregisteredCount: secUnregistered,
        completionRate: secRate,
      };
    });

    // 8. Query Recent Live Activity Stream (Replay Events)
    const rawLogs = await db
      .select({
        id: replayEvents.id,
        eventType: replayEvents.eventType,
        timestamp: replayEvents.timestamp,
        studentId: replayEvents.studentId,
        studentName: replayEvents.studentName,
        subjectName: replayEvents.subjectName,
        oldSubject: replayEvents.oldSubject,
        newSubject: replayEvents.newSubject,
        seatBefore: replayEvents.seatBefore,
        seatAfter: replayEvents.seatAfter,
        metadata: replayEvents.metadata,
      })
      .from(replayEvents)
      .where(eq(replayEvents.registrationEventId, eventId))
      .orderBy(desc(replayEvents.timestamp))
      .limit(60);

    // Map student details into activity logs
    const studentInfoMap = new Map(
      allCohortStudents.map((s) => [
        s.id,
        {
          registerNumber: s.registerNumber,
          sectionId: s.sectionId,
        },
      ])
    );
    const sectionNameMap = new Map(linkedSections.map((s) => [s.id, s.name]));

    const recentActivity: MonitorActivityItem[] = rawLogs.map((log) => {
      const sInfo = log.studentId ? studentInfoMap.get(log.studentId) : null;
      const sectionName = sInfo?.sectionId ? sectionNameMap.get(sInfo.sectionId) || null : null;

      return {
        id: log.id,
        eventType: log.eventType,
        timestamp: log.timestamp ? log.timestamp.toISOString() : new Date().toISOString(),
        studentId: log.studentId,
        studentName: log.studentName,
        registerNumber: sInfo?.registerNumber || null,
        sectionName,
        subjectName: log.subjectName,
        oldSubject: log.oldSubject,
        newSubject: log.newSubject,
        seatBefore: log.seatBefore,
        seatAfter: log.seatAfter,
        metadata: log.metadata,
      };
    });

    return {
      success: true,
      data: {
        event: {
          id: rawEvent.id,
          name: rawEvent.name,
          status: rawEvent.status,
          openDate: rawEvent.openDate ? rawEvent.openDate.toISOString() : null,
          closeDate: rawEvent.closeDate ? rawEvent.closeDate.toISOString() : null,
          autoClose: rawEvent.autoClose,
          allowEditing: rawEvent.allowEditing,
          academicYear: rawEvent.academicYear,
          batchYear: rawEvent.batchYear,
          programmeName: rawEvent.programmeName,
          programmeCode: rawEvent.programmeCode,
          classLabels: targetEventOption.classLabels,
        },
        eventsList,
        kpis: {
          totalEligibleStudents,
          registeredStudents,
          unregisteredStudents,
          completionRate,
          totalCapacity,
          filledSeats,
          availableSeats: availableSeatsTotal,
          seatUtilizationRate,
          fullCoursesCount,
          totalCoursesCount: courses.length,
          registrationsLast5Min,
          registrationsLastHour,
          velocityRpm,
        },
        courses,
        sections: sectionsStats,
        recentActivity,
      },
    };
  } catch (error) {
    console.error("Error gathering live monitoring data:", error);
    return { success: false, error: "Failed to load live monitoring metrics." };
  }
}

/**
 * Lightweight real-time feed update for auto-refresh polling (e.g. every 5s).
 */
export async function getLiveFeedUpdates(
  eventId: string,
  sinceTimestamp?: string
): Promise<{
  success: boolean;
  data?: {
    newEvents: MonitorActivityItem[];
    kpis: Partial<MonitorKPIs>;
    latestCourseSeats: Array<{ id: string; availableSeats: number; isFull: boolean }>;
    status: string;
  };
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!isStaff(session)) return { success: false, error: "Unauthorized" };
    await assertEventInWorkspace(await requireStaffWorkspace(), eventId);

    const [eventRow] = await db
      .select({ status: registrationEvents.status })
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId))
      .limit(1);

    if (!eventRow) return { success: false, error: "Event not found" };

    // 1. Fetch new events
    const logQuery = db
      .select({
        id: replayEvents.id,
        eventType: replayEvents.eventType,
        timestamp: replayEvents.timestamp,
        studentId: replayEvents.studentId,
        studentName: replayEvents.studentName,
        subjectName: replayEvents.subjectName,
        oldSubject: replayEvents.oldSubject,
        newSubject: replayEvents.newSubject,
        seatBefore: replayEvents.seatBefore,
        seatAfter: replayEvents.seatAfter,
        metadata: replayEvents.metadata,
      })
      .from(replayEvents)
      .where(
        sinceTimestamp
          ? and(
              eq(replayEvents.registrationEventId, eventId),
              gt(replayEvents.timestamp, new Date(sinceTimestamp))
            )
          : eq(replayEvents.registrationEventId, eventId)
      )
      .orderBy(desc(replayEvents.timestamp))
      .limit(30);

    const newLogs = await logQuery;

    // 2. Fetch fresh course seats
    const freshCourses = await db
      .select({
        id: electives.id,
        availableSeats: electives.availableSeats,
        isFull: electives.isFull,
      })
      .from(electives)
      .innerJoin(electiveGroups, eq(electives.groupId, electiveGroups.id))
      .where(eq(electiveGroups.eventId, eventId));

    // 3. Fresh registrations count
    const [confirmedRes] = await db
      .select({ count: count() })
      .from(registrations)
      .where(and(eq(registrations.eventId, eventId), eq(registrations.status, "CONFIRMED")));

    return {
      success: true,
      data: {
        newEvents: newLogs.map((l) => ({
          ...l,
          timestamp: l.timestamp ? l.timestamp.toISOString() : new Date().toISOString(),
          registerNumber: null,
          sectionName: null,
        })),
        kpis: {
          registeredStudents: confirmedRes?.count || 0,
        },
        latestCourseSeats: freshCourses.map((c) => ({
          id: c.id,
          availableSeats: c.availableSeats,
          isFull: c.isFull || c.availableSeats <= 0,
        })),
        status: eventRow.status,
      },
    };
  } catch (error) {
    console.error("Error fetching live feed updates:", error);
    return { success: false, error: "Feed update failed" };
  }
}

/**
 * Returns list of students who haven't registered yet for an event or section.
 */
export async function getUnregisteredStudentsList(
  eventId: string,
  filterSectionId?: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    email: string;
    registerNumber: string | null;
    sectionName: string;
    sectionId: string;
  }>;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!isStaff(session)) return { success: false, error: "Unauthorized" };
    const ws = await requireStaffWorkspace();
    const scopedEvent = await assertEventInWorkspace(ws, eventId);
    if (filterSectionId) assertClass(ws, filterSectionId);
    const managedSectionIds = scopedEvent.classes.map((c) => c.sectionId);

    // Get event sections
    const evSecs = await db
      .select({
        sectionId: eventSections.sectionId,
        sectionName: sections.label,
      })
      .from(eventSections)
      .innerJoin(sections, eq(eventSections.sectionId, sections.id))
      .where(
        filterSectionId
          ? and(
              eq(eventSections.eventId, eventId),
              eq(eventSections.sectionId, filterSectionId)
            )
          : eq(eventSections.eventId, eventId)
      );

    // Only classes of this event that the user manages
    const sectionIds = evSecs.map((s) => s.sectionId).filter((id) => managedSectionIds.includes(id));
    const sectionNameMap = new Map(evSecs.map((s) => [s.sectionId, s.sectionName]));

    if (sectionIds.length === 0) {
      return { success: true, data: [] };
    }

    // Get all students in these sections
    const allStudents = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        registerNumber: users.registerNumber,
        sectionId: users.sectionId,
      })
      .from(users)
      .where(
        and(
          inArray(users.sectionId, sectionIds),
          eq(users.role, "STUDENT"),
          eq(users.isActive, true)
        )
      )
      .orderBy(asc(users.name));

    // Get registered student IDs
    const regs = await db
      .select({ studentId: registrations.studentId })
      .from(registrations)
      .where(
        and(
          eq(registrations.eventId, eventId),
          eq(registrations.status, "CONFIRMED")
        )
      );

    const registeredIds = new Set(regs.map((r) => r.studentId));

    const pending = allStudents
      .filter((s) => !registeredIds.has(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        registerNumber: s.registerNumber,
        sectionId: s.sectionId || "",
        sectionName: s.sectionId ? sectionNameMap.get(s.sectionId) || "Section" : "Section",
      }));

    return { success: true, data: pending };
  } catch (error) {
    console.error("Error fetching unregistered students:", error);
    return { success: false, error: "Failed to fetch unregistered students." };
  }
}

/**
 * Toggles event status directly from the monitor (e.g. Pause, Resume).
 */
export async function toggleEventStatusFromMonitor(
  eventId: string,
  newStatus: "OPEN" | "PAUSED" | "CLOSED"
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.role !== "SYSTEM_ADMIN" &&
        session.role !== "COURSE_COORDINATOR" &&
        session.role !== "CLASS_TUTOR")
    ) {
      return { success: false, error: "Unauthorized" };
    }
    if (!["OPEN", "PAUSED", "CLOSED"].includes(newStatus)) return { success: false, error: "Invalid status." };

    // The event must be in the selected session and for a class this user manages.
    const event = await assertEventInWorkspace(await requireStaffWorkspace(), eventId);

    await db
      .update(registrationEvents)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(registrationEvents.id, eventId));

    await db.insert(auditLogs).values({
      action: `LIVE_MONITOR_SET_STATUS_${newStatus}`,
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      newValue: { eventId, oldStatus: event.status, newStatus },
    });

    safeRevalidatePath("/faculty/monitor", "/faculty/events", "/faculty/window");

    return { success: true, newStatus };
  } catch (error: any) {
    console.error("Error updating event status from monitor:", error);
    return { success: false, error: error.message || "Failed to update status." };
  }
}
