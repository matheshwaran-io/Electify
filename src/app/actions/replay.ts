"use server";

import { db } from "@/lib/db";
import {
  registrations,
  registrationEvents,
  studentRegistrations,
  electives,
  electiveGroups,
  users,
  replayEvents,
} from "@/lib/db/schema";
import { eq, asc, desc, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { assertEventInWorkspace, requireStaffWorkspace, workspaceEventIds } from "@/lib/workspace";

/** Null when the event is in the selected session and for a class this user manages; otherwise the reason. */
async function replayAccessError(eventId: string): Promise<string | null> {
  try {
    await assertEventInWorkspace(await requireStaffWorkspace(), eventId);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Unauthorized";
  }
}

export interface ReplayRegistration {
  id: string;
  rank: number;
  studentId: string;
  studentName: string;
  registerNumber: string | null;
  submittedAt: string; // ISO string
  isManual: boolean;
  status: string;
  receiptNumber: string | null;
  selections: {
    groupName: string;
    electiveName: string;
    courseCode: string | null;
  }[];
}

export async function getReplayEvents(registrationEventId: string) {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.role !== "SYSTEM_ADMIN" &&
        session.role !== "COURSE_COORDINATOR" &&
        session.role !== "CLASS_TUTOR")
    ) {
      return { success: false, error: "Unauthorized access to replay events." };
    }
    const denied = await replayAccessError(registrationEventId);
    if (denied) return { success: false, error: denied };

    // 1. Get event details
    const eventDetails = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.id, registrationEventId))
      .limit(1);

    if (!eventDetails.length) {
      return { success: false, error: "Registration event not found." };
    }

    // 2. Get ALL confirmed registrations for this event, ordered by submittedAt
    const allRegistrations = await db
      .select({
        id: registrations.id,
        studentId: registrations.studentId,
        status: registrations.status,
        receiptNumber: registrations.receiptNumber,
        receiptSnapshot: registrations.receiptSnapshot,
        submittedAt: registrations.submittedAt,
        createdAt: registrations.createdAt,
      })
      .from(registrations)
      .where(eq(registrations.eventId, registrationEventId))
      .orderBy(asc(registrations.submittedAt));

    // Only include confirmed registrations (those who actually submitted)
    const confirmedRegistrations = allRegistrations.filter(
      (r) => r.status === "CONFIRMED" && r.submittedAt
    );

    // 3. Get all student details for these registrations
    const studentIds = confirmedRegistrations.map((r) => r.studentId);
    const studentsMap = new Map<
      string,
      { name: string; registerNumber: string | null }
    >();

    if (studentIds.length > 0) {
      const studentData = await db
        .select({
          id: users.id,
          name: users.name,
          registerNumber: users.registerNumber,
        })
        .from(users)
        .where(inArray(users.id, studentIds));

      studentData.forEach((s) => {
        studentsMap.set(s.id, {
          name: s.name,
          registerNumber: s.registerNumber,
        });
      });
    }

    // 4. Get all student_registrations (individual elective selections) for this event
    const allSelections = await db
      .select({
        studentId: studentRegistrations.studentId,
        electiveId: studentRegistrations.electiveId,
        groupId: studentRegistrations.groupId,
      })
      .from(studentRegistrations)
      .where(eq(studentRegistrations.eventId, registrationEventId));

    // 5. Get all electives and groups for this event
    const allElectives = await db
      .select({
        id: electives.id,
        name: electives.name,
        courseCode: electives.courseCode,
        maxSeats: electives.maxSeats,
        availableSeats: electives.availableSeats,
        groupId: electives.groupId,
      })
      .from(electives)
      .innerJoin(electiveGroups, eq(electives.groupId, electiveGroups.id))
      .where(eq(electiveGroups.eventId, registrationEventId));

    const allGroups = await db
      .select({
        id: electiveGroups.id,
        name: electiveGroups.name,
      })
      .from(electiveGroups)
      .where(eq(electiveGroups.eventId, registrationEventId));

    const electiveMap = new Map(allElectives.map((e) => [e.id, e]));
    const groupMap = new Map(allGroups.map((g) => [g.id, g]));

    // 6. Build selection map per student
    const selectionsByStudent = new Map<
      string,
      { groupId: string; electiveId: string }[]
    >();
    allSelections.forEach((sel) => {
      const existing = selectionsByStudent.get(sel.studentId) || [];
      existing.push({ groupId: sel.groupId, electiveId: sel.electiveId });
      selectionsByStudent.set(sel.studentId, existing);
    });

    // 7. Assemble the replay list with ranks
    const replayList: ReplayRegistration[] = confirmedRegistrations.map(
      (reg, index) => {
        const student = studentsMap.get(reg.studentId);
        const selections = selectionsByStudent.get(reg.studentId) || [];

        // Determine if manual registration (check receiptSnapshot or receipt number pattern)
        const snapshot = reg.receiptSnapshot as any;
        const isManual =
          snapshot?.registeredByTutor === true ||
          (reg.receiptNumber && reg.receiptNumber.includes("-MAN-")) ||
          false;

        return {
          id: reg.id,
          rank: index + 1,
          studentId: reg.studentId,
          studentName: student?.name || "Unknown Student",
          registerNumber: student?.registerNumber || null,
          submittedAt: reg.submittedAt
            ? reg.submittedAt.toISOString()
            : reg.createdAt.toISOString(),
          isManual,
          status: reg.status,
          receiptNumber: reg.receiptNumber,
          selections: selections.map((sel) => {
            const elective = electiveMap.get(sel.electiveId);
            const group = groupMap.get(sel.groupId);
            return {
              groupName: group?.name || "Unknown Group",
              electiveName: elective?.name || "Unknown Elective",
              courseCode: elective?.courseCode || null,
            };
          }),
        };
      }
    );

    return {
      success: true,
      data: {
        eventDetails: eventDetails[0],
        registrations: replayList,
        electives: allElectives,
        totalRegistered: replayList.length,
        totalManual: replayList.filter((r) => r.isManual).length,
        totalSelfRegistered: replayList.filter((r) => !r.isManual).length,
      },
    };
  } catch (error) {
    console.error("Error fetching replay events:", error);
    return { success: false, error: "Failed to fetch replay events." };
  }
}

/**
 * Returns raw replay_events for the Live Activity Feed in the control center.
 * This uses the replay_events table (event-level logs) rather than registrations.
 */
export async function getLiveActivityEvents(registrationEventId: string) {
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
    const denied = await replayAccessError(registrationEventId);
    if (denied) return { success: false, error: denied };

    const events = await db
      .select()
      .from(replayEvents)
      .where(eq(replayEvents.registrationEventId, registrationEventId))
      .orderBy(desc(replayEvents.timestamp))
      .limit(50);

    return {
      success: true,
      data: { events },
    };
  } catch (error) {
    console.error("Error fetching live activity events:", error);
    return { success: false, error: "Failed to fetch live activity events." };
  }
}

export interface ReplayEventSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  academicYear: string | null;
  openDate: string | null;
  closeDate: string | null;
  createdAt: string;
  allowEditing: boolean;
  confirmedCount: number;
  cancelledCount: number;
  totalSubmissions: number;
  manualCount: number;
  selfCount: number;
  electiveCount: number;
  groupCount: number;
  totalCapacity: number;
  allocatedSeats: number;
  capacityUtilization: number;
  firstSubmissionAt: string | null;
  lastSubmissionAt: string | null;
  secondsToFirstSubmission: number | null;
  replayEventCount: number;
  latestActivity: {
    eventType: string;
    studentName: string | null;
    subjectName: string | null;
    timestamp: string;
  } | null;
}

export interface RecentGlobalEvent {
  id: string;
  eventId: string;
  eventName: string;
  timestamp: string;
  studentName: string | null;
  eventType: string;
  subjectName: string | null;
  seatBefore: number | null;
  seatAfter: number | null;
}

export interface ReplayHubData {
  events: ReplayEventSummary[];
  kpis: {
    totalSessions: number;
    activeWindows: number;
    totalSubmissions: number;
    totalReplayLogs: number;
    averageTurnoutRate: number;
    totalAllocatedSeats: number;
    totalCapacity: number;
  };
  recentGlobalEvents: RecentGlobalEvent[];
}

/**
 * Fetches comprehensive metrics and summaries for all replayable registration events.
 */
export async function getReplayHubData(): Promise<{ success: boolean; data?: ReplayHubData; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.role !== "SYSTEM_ADMIN" &&
        session.role !== "COURSE_COORDINATOR" &&
        session.role !== "CLASS_TUTOR")
    ) {
      return { success: false, error: "Unauthorized access to replay hub." };
    }

    // Events of the selected academic session for classes this user manages.
    const scopedIds = await workspaceEventIds(await requireStaffWorkspace());
    const eventsList: (typeof registrationEvents.$inferSelect)[] = scopedIds.length
      ? await db.select().from(registrationEvents).where(inArray(registrationEvents.id, scopedIds)).orderBy(desc(registrationEvents.createdAt))
      : [];

    if (eventsList.length === 0) {
      return {
        success: true,
        data: {
          events: [],
          kpis: {
            totalSessions: 0,
            activeWindows: 0,
            totalSubmissions: 0,
            totalReplayLogs: 0,
            averageTurnoutRate: 0,
            totalAllocatedSeats: 0,
            totalCapacity: 0,
          },
          recentGlobalEvents: [],
        },
      };
    }

    const eventIds = eventsList.map((e) => e.id);

    // 1. Registration stats per event
    const regStats = await db
      .select({
        eventId: registrations.eventId,
        confirmedCount: sql<number>`count(*) filter (where ${registrations.status} = 'CONFIRMED')::int`,
        cancelledCount: sql<number>`count(*) filter (where ${registrations.status} = 'CANCELLED')::int`,
        manualCount: sql<number>`count(*) filter (where (${registrations.receiptSnapshot}->>'registeredByTutor')::boolean = true or ${registrations.receiptNumber} like '%-MAN-%')::int`,
        firstSubmittedAt: sql<string | null>`min(${registrations.submittedAt})::text`,
        lastSubmittedAt: sql<string | null>`max(${registrations.submittedAt})::text`,
      })
      .from(registrations)
      .where(inArray(registrations.eventId, eventIds))
      .groupBy(registrations.eventId);

    const regMap = new Map(regStats.map((r) => [r.eventId, r]));

    // 2. Electives and Capacity stats
    const electiveStats = await db
      .select({
        eventId: electiveGroups.eventId,
        electiveCount: sql<number>`count(distinct ${electives.id})::int`,
        groupCount: sql<number>`count(distinct ${electiveGroups.id})::int`,
        totalCapacity: sql<number>`coalesce(sum(${electives.maxSeats}), 0)::int`,
        allocatedSeats: sql<number>`coalesce(sum(${electives.maxSeats} - ${electives.availableSeats}), 0)::int`,
      })
      .from(electiveGroups)
      .leftJoin(electives, eq(electives.groupId, electiveGroups.id))
      .where(inArray(electiveGroups.eventId, eventIds))
      .groupBy(electiveGroups.eventId);

    const electiveMap = new Map(electiveStats.map((e) => [e.eventId, e]));

    // 3. Replay event counts
    const replayStats = await db
      .select({
        eventId: replayEvents.registrationEventId,
        replayCount: sql<number>`count(*)::int`,
      })
      .from(replayEvents)
      .where(inArray(replayEvents.registrationEventId, eventIds))
      .groupBy(replayEvents.registrationEventId);

    const replayMap = new Map(replayStats.map((r) => [r.eventId, r]));

    // 4. Latest replay event per event
    const latestReplay = await db
      .selectDistinctOn([replayEvents.registrationEventId], {
        eventId: replayEvents.registrationEventId,
        eventType: replayEvents.eventType,
        studentName: replayEvents.studentName,
        subjectName: replayEvents.subjectName,
        timestamp: replayEvents.timestamp,
      })
      .from(replayEvents)
      .where(inArray(replayEvents.registrationEventId, eventIds))
      .orderBy(replayEvents.registrationEventId, desc(replayEvents.timestamp));

    const latestReplayMap = new Map(latestReplay.map((l) => [l.eventId, l]));

    // 5. Recent global activity stream (latest 25 events across all accessible events)
    const recentGlobalEventsRaw = await db
      .select({
        id: replayEvents.id,
        eventId: replayEvents.registrationEventId,
        eventName: registrationEvents.name,
        timestamp: replayEvents.timestamp,
        studentName: replayEvents.studentName,
        eventType: replayEvents.eventType,
        subjectName: replayEvents.subjectName,
        seatBefore: replayEvents.seatBefore,
        seatAfter: replayEvents.seatAfter,
      })
      .from(replayEvents)
      .innerJoin(registrationEvents, eq(replayEvents.registrationEventId, registrationEvents.id))
      .where(inArray(replayEvents.registrationEventId, eventIds))
      .orderBy(desc(replayEvents.timestamp))
      .limit(25);

    const recentGlobalEvents: RecentGlobalEvent[] = recentGlobalEventsRaw.map((e) => ({
      id: e.id,
      eventId: e.eventId,
      eventName: e.eventName,
      timestamp: e.timestamp ? e.timestamp.toISOString() : new Date().toISOString(),
      studentName: e.studentName,
      eventType: e.eventType,
      subjectName: e.subjectName,
      seatBefore: e.seatBefore,
      seatAfter: e.seatAfter,
    }));

    // 6. Build event summaries
    const summaries: ReplayEventSummary[] = eventsList.map((evt) => {
      const reg = regMap.get(evt.id);
      const el = electiveMap.get(evt.id);
      const rep = replayMap.get(evt.id);
      const latest = latestReplayMap.get(evt.id);

      const confirmedCount = reg?.confirmedCount || 0;
      const cancelledCount = reg?.cancelledCount || 0;
      const manualCount = reg?.manualCount || 0;
      const selfCount = Math.max(0, confirmedCount - manualCount);
      const totalSubmissions = confirmedCount + cancelledCount;

      const electiveCount = el?.electiveCount || 0;
      const groupCount = el?.groupCount || 0;
      const totalCapacity = el?.totalCapacity || 0;
      const allocatedSeats = el?.allocatedSeats || 0;
      const capacityUtilization =
        totalCapacity > 0 ? Math.round((allocatedSeats / totalCapacity) * 100) : 0;

      const firstSubmissionAt = reg?.firstSubmittedAt || null;
      const lastSubmissionAt = reg?.lastSubmittedAt || null;

      let secondsToFirstSubmission: number | null = null;
      if (evt.openDate && firstSubmissionAt) {
        const diffMs =
          new Date(firstSubmissionAt).getTime() - new Date(evt.openDate).getTime();
        secondsToFirstSubmission = Math.max(0, Math.round(diffMs / 1000));
      }

      return {
        id: evt.id,
        name: evt.name,
        description: evt.description,
        status: evt.status,
        academicYear: evt.academicYear,
        openDate: evt.openDate ? evt.openDate.toISOString() : null,
        closeDate: evt.closeDate ? evt.closeDate.toISOString() : null,
        createdAt: evt.createdAt.toISOString(),
        allowEditing: evt.allowEditing,
        confirmedCount,
        cancelledCount,
        totalSubmissions,
        manualCount,
        selfCount,
        electiveCount,
        groupCount,
        totalCapacity,
        allocatedSeats,
        capacityUtilization,
        firstSubmissionAt,
        lastSubmissionAt,
        secondsToFirstSubmission,
        replayEventCount: rep?.replayCount || 0,
        latestActivity: latest
          ? {
              eventType: latest.eventType,
              studentName: latest.studentName,
              subjectName: latest.subjectName,
              timestamp: latest.timestamp ? latest.timestamp.toISOString() : new Date().toISOString(),
            }
          : null,
      };
    });

    // 7. Calculate aggregate KPIs
    const totalSessions = summaries.length;
    const activeWindows = summaries.filter((e) => e.status === "OPEN").length;
    const totalSubmissions = summaries.reduce((acc, e) => acc + e.confirmedCount, 0);
    const totalReplayLogs = summaries.reduce((acc, e) => acc + e.replayEventCount, 0);
    const totalAllocatedSeats = summaries.reduce((acc, e) => acc + e.allocatedSeats, 0);
    const totalCapacity = summaries.reduce((acc, e) => acc + e.totalCapacity, 0);
    const eventsWithCap = summaries.filter((e) => e.totalCapacity > 0);
    const averageTurnoutRate =
      eventsWithCap.length > 0
        ? Math.round(
            eventsWithCap.reduce((acc, e) => acc + e.capacityUtilization, 0) /
              eventsWithCap.length
          )
        : 0;

    return {
      success: true,
      data: {
        events: summaries,
        kpis: {
          totalSessions,
          activeWindows,
          totalSubmissions,
          totalReplayLogs,
          averageTurnoutRate,
          totalAllocatedSeats,
          totalCapacity,
        },
        recentGlobalEvents,
      },
    };
  } catch (error) {
    console.error("Error fetching replay hub data:", error);
    return { success: false, error: "Failed to generate replay hub data." };
  }
}

/**
 * Returns latest activity stream for a specific event or globally.
 */
export async function getEventActivityStream(eventId?: string) {
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

    const query = db
      .select({
        id: replayEvents.id,
        eventId: replayEvents.registrationEventId,
        eventName: registrationEvents.name,
        timestamp: replayEvents.timestamp,
        studentName: replayEvents.studentName,
        eventType: replayEvents.eventType,
        subjectName: replayEvents.subjectName,
        oldSubject: replayEvents.oldSubject,
        newSubject: replayEvents.newSubject,
        seatBefore: replayEvents.seatBefore,
        seatAfter: replayEvents.seatAfter,
      })
      .from(replayEvents)
      .innerJoin(registrationEvents, eq(replayEvents.registrationEventId, registrationEvents.id));

    if (eventId) {
      const denied = await replayAccessError(eventId);
      if (denied) return { success: false, error: denied };
    }
    const scopedIds = eventId ? [eventId] : await workspaceEventIds(await requireStaffWorkspace());
    const events = scopedIds.length
      ? await query
          .where(inArray(replayEvents.registrationEventId, scopedIds))
          .orderBy(desc(replayEvents.timestamp))
          .limit(100)
      : [];

    return {
      success: true,
      data: events.map((e) => ({
        ...e,
        timestamp: e.timestamp ? e.timestamp.toISOString() : new Date().toISOString(),
      })),
    };
  } catch (error) {
    console.error("Error fetching event activity stream:", error);
    return { success: false, error: "Failed to fetch event activity stream." };
  }
}

/**
 * Generates exportable CSV or JSON data for a specific replay event.
 */
export async function exportReplaySessionData(
  eventId: string,
  format: "rankings" | "audit_trail" | "json"
): Promise<{ success: boolean; content?: string; filename?: string; mimeType?: string; error?: string }> {
  try {
    const session = await getSession();
    if (
      !session ||
      (session.role !== "SYSTEM_ADMIN" &&
        session.role !== "COURSE_COORDINATOR" &&
        session.role !== "CLASS_TUTOR")
    ) {
      return { success: false, error: "Unauthorized access." };
    }
    const denied = await replayAccessError(eventId);
    if (denied) return { success: false, error: denied };

    const eventResult = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.id, eventId))
      .limit(1);

    if (!eventResult.length) {
      return { success: false, error: "Event not found." };
    }

    const event = eventResult[0];
    const safeName = event.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
    const dateStamp = new Date().toISOString().split("T")[0];

    if (format === "json") {
      const fullReplay = await getReplayEvents(eventId);
      if (!fullReplay.success || !fullReplay.data) {
        return { success: false, error: "Could not retrieve replay session data." };
      }

      const rawLogs = await db
        .select()
        .from(replayEvents)
        .where(eq(replayEvents.registrationEventId, eventId))
        .orderBy(asc(replayEvents.timestamp));

      const payload = {
        event: fullReplay.data.eventDetails,
        registrations: fullReplay.data.registrations,
        auditLogs: rawLogs,
        exportedAt: new Date().toISOString(),
        exportedBy: session.name,
      };

      return {
        success: true,
        content: JSON.stringify(payload, null, 2),
        filename: `replay_${safeName}_${dateStamp}.json`,
        mimeType: "application/json",
      };
    }

    if (format === "rankings") {
      const fullReplay = await getReplayEvents(eventId);
      if (!fullReplay.success || !fullReplay.data) {
        return { success: false, error: "Could not retrieve replay registrations." };
      }

      const rows = fullReplay.data.registrations;
      const firstTime = rows[0] ? new Date(rows[0].submittedAt).getTime() : 0;

      const header = [
        "Rank",
        "Student Name",
        "Register Number",
        "Submitted At (UTC)",
        "Delta From First (seconds)",
        "Type",
        "Receipt Number",
        "Selected Electives",
      ];

      const csvLines = [
        header.join(","),
        ...rows.map((r) => {
          const deltaSec = firstTime
            ? Math.round((new Date(r.submittedAt).getTime() - firstTime) / 1000)
            : 0;
          const choicesStr = r.selections
            .map((s) => (s.courseCode ? `[${s.courseCode}] ${s.electiveName}` : s.electiveName))
            .join(" | ");

          return [
            r.rank,
            `"${(r.studentName || "").replace(/"/g, '""')}"`,
            `"${(r.registerNumber || "").replace(/"/g, '""')}"`,
            `"${r.submittedAt}"`,
            deltaSec,
            r.isManual ? "Manual (Tutor)" : "Self (Student)",
            `"${r.receiptNumber || ""}"`,
            `"${choicesStr.replace(/"/g, '""')}"`,
          ].join(",");
        }),
      ];

      return {
        success: true,
        content: csvLines.join("\n"),
        filename: `replay_rankings_${safeName}_${dateStamp}.csv`,
        mimeType: "text/csv",
      };
    }

    if (format === "audit_trail") {
      const logs = await db
        .select()
        .from(replayEvents)
        .where(eq(replayEvents.registrationEventId, eventId))
        .orderBy(asc(replayEvents.timestamp));

      const header = [
        "Timestamp (UTC)",
        "Event Type",
        "Student Name",
        "Subject / Elective",
        "Previous Subject",
        "Seat Before",
        "Seat After",
        "Seat Change",
      ];

      const csvLines = [
        header.join(","),
        ...logs.map((l) => {
          const change =
            l.seatBefore != null && l.seatAfter != null
              ? l.seatAfter - l.seatBefore
              : "";
          return [
            `"${l.timestamp ? l.timestamp.toISOString() : ""}"`,
            `"${l.eventType}"`,
            `"${(l.studentName || "").replace(/"/g, '""')}"`,
            `"${(l.subjectName || l.newSubject || "").replace(/"/g, '""')}"`,
            `"${(l.oldSubject || "").replace(/"/g, '""')}"`,
            l.seatBefore ?? "",
            l.seatAfter ?? "",
            change,
          ].join(",");
        }),
      ];

      return {
        success: true,
        content: csvLines.join("\n"),
        filename: `replay_audit_trail_${safeName}_${dateStamp}.csv`,
        mimeType: "text/csv",
      };
    }

    return { success: false, error: "Invalid export format specified." };
  } catch (error) {
    console.error("Error exporting replay session data:", error);
    return { success: false, error: "Failed to export replay session data." };
  }
}
