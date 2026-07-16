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
import { eq, and, asc, desc, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";

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
    let studentsMap = new Map<
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
