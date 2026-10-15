"use server";

import { db } from "@/lib/db";
import {
  users, electives, electiveGroups, registrationEvents, tutorSections,
  studentRegistrations, eventSections, sections, programmes, academicBatches, auditLogs, registrations, departments,
  replayEvents, inviteCodes, passwordResetRequests, eventStudents, systemSettings, academicSessions, cohortSessionTerms
} from "@/lib/db/schema";
import { randomInt } from "node:crypto";
import { getSession, type UserSession } from "@/lib/auth";
import { generateClassSignupCode } from "@/lib/invites";
import { eq, and, asc, desc, count, inArray, ne, or, sql } from "drizzle-orm";
import { assertClass, assertEventInWorkspace, requireStaffWorkspace, workspaceEventIds, type Workspace } from "@/lib/workspace";
import { isStudentEligibleForEvent } from "@/lib/student-events";
import { releaseSeat, SeatTakenError, takeSeat } from "@/lib/seat-ops";
import { cohortLabel, cohortYears } from "@/lib/academic";

type TutorContext = UserSession & { workspace: Workspace };

/**
 * Staff session bound to the selected academic session. sectionId and the
 * hierarchy ids describe the active class of that session, which the
 * workspace has validated against the user's assignments; they are never a
 * raw cookie or client value.
 */
async function assertTutor(): Promise<TutorContext> {
  const ws = await requireStaffWorkspace();
  const active = ws.activeClass;
  return {
    ...ws.user,
    sectionId: active?.sectionId,
    academicBatchId: active?.batchId,
    programmeId: active?.programmeId ?? ws.user.programmeId,
    departmentId: active?.departmentId ?? ws.user.departmentId,
    workspace: ws,
  };
}

/** Staff session for work that is not tied to an academic session (class claims, password resets). */
async function assertStaffBase() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "CLASS_TUTOR" &&
      session.role !== "COURSE_COORDINATOR" &&
      session.role !== "SYSTEM_ADMIN")
  ) {
    throw new Error("Unauthorized");
  }

  // Fetch missing hierarchy details if the session token is incomplete
  if (session.sectionId && (!session.academicBatchId || !session.programmeId || !session.departmentId)) {
    try {
      const [sectionData] = await db
        .select({ 
          academicBatchId: sections.academicBatchId,
          programmeId: academicBatches.programmeId, 
          departmentId: programmes.departmentId 
        })
        .from(sections)
        .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
        .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
        .where(eq(sections.id, session.sectionId));

      if (sectionData) {
        session.academicBatchId = session.academicBatchId || sectionData.academicBatchId;
        session.programmeId = session.programmeId || sectionData.programmeId;
        session.departmentId = session.departmentId || sectionData.departmentId;
      } else {
        // Section ID from cookie doesn't exist in DB — clear it
        session.sectionId = undefined;
      }
    } catch {
      // Query failed (invalid UUID, DB issue, etc.) — clear the stale sectionId
      session.sectionId = undefined;
    }
  }

  // If programmeId or departmentId is still missing, fetch from user record
  if (!session.programmeId || !session.departmentId || !session.academicBatchId) {
    try {
      const [userData] = await db
        .select({
          programmeId: users.programmeId,
          departmentId: users.departmentId,
          academicBatchId: users.academicBatchId,
        })
        .from(users)
        .where(eq(users.id, session.userId));
      if (userData) {
        session.programmeId = session.programmeId || userData.programmeId || undefined;
        session.departmentId = session.departmentId || userData.departmentId || undefined;
        session.academicBatchId = session.academicBatchId || userData.academicBatchId || undefined;
      }
    } catch {
      // ignore
    }
  }

  return session;
}

/** The event must belong to the selected session and to a class this user manages. */
async function assertEventAccess(session: TutorContext, eventId: string) {
  return assertEventInWorkspace(session.workspace, eventId);
}

// ── Section Students ─────────────────────────────────────────────────────

export async function getSectionStudents() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      registerNumber: users.registerNumber,
      isActive: users.isActive,
      isEligible: users.isEligible,
    })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)))
    .orderBy(asc(users.name));
}

// ── Section Registrations (Approvals) ────────────────────────────────────

export async function getSectionRegistrations() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  return db
    .select({
      id: studentRegistrations.id,
      studentId: studentRegistrations.studentId,
      studentName: users.name,
      registerNumber: users.registerNumber,
      submittedAt: studentRegistrations.submittedAt,
      electiveName: electives.name,
      courseCode: electives.courseCode,
      groupName: electiveGroups.name,
      eventName: registrationEvents.name,
      eventStatus: registrationEvents.status,
    })
    .from(studentRegistrations)
    .innerJoin(users, eq(studentRegistrations.studentId, users.id))
    .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
    .innerJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
    .innerJoin(registrationEvents, eq(studentRegistrations.eventId, registrationEvents.id))
    .where(and(eq(users.sectionId, session.sectionId), eq(registrationEvents.academicSessionId, session.workspace.session.id)))
    .orderBy(asc(users.name));
}

// ── Tutor Electives ───────────────────────────────────────────────────────

export async function getTutorElectives() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  // Events of the active class in the selected academic session only.
  const eventIds = await workspaceEventIds(session.workspace, { sectionId: session.sectionId });
  if (eventIds.length === 0) return [];

  const [events, allGroups, allElectives] = await Promise.all([
    db.select({ 
        id: registrationEvents.id, 
        name: registrationEvents.name, 
        status: registrationEvents.status,
        openDate: registrationEvents.openDate,
        closeDate: registrationEvents.closeDate
      })
      .from(registrationEvents)
      .where(inArray(registrationEvents.id, eventIds)),
    
    db.select()
      .from(electiveGroups)
      .where(inArray(electiveGroups.eventId, eventIds))
      .orderBy(asc(electiveGroups.sortOrder)),
    
    db.select()
      .from(electives)
      .where(inArray(electives.groupId, db.select({ id: electiveGroups.id }).from(electiveGroups).where(inArray(electiveGroups.eventId, eventIds))))
      .orderBy(asc(electives.name))
  ]);

  return events.map(event => {
    const eventGroups = allGroups.filter(g => g.eventId === event.id);
    const groupsWithElectives = eventGroups.map(group => ({
      ...group,
      electives: allElectives.filter(e => e.groupId === group.id)
    }));
    return { event, groups: groupsWithElectives };
  });
}

export async function deleteAllSectionStudents() {
  const session = await assertTutor();
  if (!session.sectionId) throw new Error("No section assigned.");
  await db.delete(users).where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)));
}

// ── Tutor Reports ─────────────────────────────────────────────────────────

/**
 * Report for the active class in the selected academic session. Only that
 * class's events in that session are counted, so a class with the same label
 * in another cohort or year never mixes in.
 */
export async function getTutorReports(eventIdParam?: string) {
  const session = await assertTutor();
  const ws = session.workspace;
  const active = ws.activeClass;

  if (!active) return { students: [], totalStudents: 0, registeredCount: 0, sectionLabel: "", programmeName: "", departmentName: "", groups: [], classLabel: "", academicSession: ws.session.label };
  const activeSectionId = active.sectionId;

  const classEventIds = await workspaceEventIds(ws, { sectionId: activeSectionId });
  if (eventIdParam && !classEventIds.includes(eventIdParam)) throw new Error("That event is not for this class in the selected academic session.");
  const classEvents = classEventIds.length
    ? await db
        .select({ id: registrationEvents.id, name: registrationEvents.name, status: registrationEvents.status, closeDate: registrationEvents.closeDate })
        .from(registrationEvents)
        .where(inArray(registrationEvents.id, classEventIds))
        .orderBy(desc(registrationEvents.createdAt))
    : [];
  const currentEvent = (eventIdParam ? classEvents.find((e) => e.id === eventIdParam) : classEvents[0]) ?? null;

  const sectionMeta = {
    sectionLabel: active.sectionLabel,
    programmeName: active.programmeName,
    departmentName: active.departmentName,
    eventId: currentEvent?.id ?? null,
    eventStatus: currentEvent?.status ?? null,
    eventCloseDate: currentEvent?.closeDate ?? null,
  };

  // Compute effective event status based on dates
  let effectiveEventStatus = sectionMeta?.eventStatus;
  if (effectiveEventStatus && sectionMeta?.eventCloseDate && new Date() > sectionMeta.eventCloseDate) {
    effectiveEventStatus = "CLOSED";
  }

  // Fetch all available electives for this event (for manual registration)
  let availableElectives: { id: string; groupId: string; groupName: string; name: string; courseCode: string | null; availableSeats: number; isFull: boolean; }[] = [];
  if (sectionMeta?.eventId) {
    availableElectives = await db
      .select({
        id: electives.id,
        groupId: electives.groupId,
        groupName: electiveGroups.name,
        name: electives.name,
        courseCode: electives.courseCode,
        availableSeats: electives.availableSeats,
        isFull: electives.isFull,
      })
      .from(electives)
      .innerJoin(electiveGroups, eq(electives.groupId, electiveGroups.id))
      .where(eq(electiveGroups.eventId, sectionMeta.eventId));
  }

  const students = await db
    .select({ 
      id: users.id, 
      name: users.name, 
      registerNumber: users.registerNumber, 
      isEligible: users.isEligible,
      isActive: users.isActive,
      email: users.email
    })
    .from(users)
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, activeSectionId)))
    .orderBy(asc(users.name));

  const studentRegs = await db
    .select({
      studentId: studentRegistrations.studentId,
      electiveName: electives.name,
      courseCode: electives.courseCode,
      credits: electives.credits,
      groupName: electiveGroups.name,
      eventName: registrationEvents.name,
    })
    .from(studentRegistrations)
    .innerJoin(users, eq(studentRegistrations.studentId, users.id))
    .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
    .innerJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
    .innerJoin(registrationEvents, eq(studentRegistrations.eventId, registrationEvents.id))
    .where(
      and(
        eq(users.sectionId, activeSectionId),
        eq(studentRegistrations.eventId, currentEvent?.id ?? "00000000-0000-0000-0000-000000000000"),
        eq(studentRegistrations.status, "CONFIRMED")
      )
    );

  // Registration status for this event only
  const confirmedRegs = currentEvent
    ? await db
        .select({
          studentId: registrations.studentId,
          status: registrations.status,
          receiptNumber: registrations.receiptNumber,
          submittedAt: registrations.submittedAt,
        })
        .from(registrations)
        .innerJoin(users, eq(registrations.studentId, users.id))
        .where(and(eq(users.sectionId, activeSectionId), eq(registrations.eventId, currentEvent.id)))
    : [];

  const confirmedMap = new Map(confirmedRegs.map(r => [r.studentId, r]));

  // Build group summary: how many students chose each group/subject
  const groupSummaryMap = new Map<string, { groupName: string; electiveName: string; courseCode: string | null; count: number }>();
  for (const reg of studentRegs) {
    const key = `${reg.groupName}::${reg.electiveName}`;
    const existing = groupSummaryMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      groupSummaryMap.set(key, { groupName: reg.groupName, electiveName: reg.electiveName, courseCode: reg.courseCode, count: 1 });
    }
  }
  const groups = Array.from(groupSummaryMap.values()).sort((a, b) => a.groupName.localeCompare(b.groupName) || b.count - a.count);

  const enriched = students.map((s) => {
    const confirmed = confirmedMap.get(s.id);
    return {
      ...s,
      registrations: studentRegs.filter((r) => r.studentId === s.id),
      registrationStatus: confirmed?.status || "NOT_REGISTERED",
      receiptNumber: confirmed?.receiptNumber || null,
      submittedAt: confirmed?.submittedAt ? confirmed.submittedAt.toISOString() : null,
    };
  });

  return {
    students: enriched,
    totalStudents: students.length,
    registeredCount: enriched.filter((s) => s.registrationStatus === "CONFIRMED").length,
    sectionLabel: sectionMeta?.sectionLabel || "",
    programmeName: sectionMeta?.programmeName || "",
    departmentName: sectionMeta?.departmentName || "",
    groups,
    eventId: sectionMeta?.eventId || null,
    eventName: currentEvent?.name ?? null,
    eventStatus: effectiveEventStatus || "CLOSED",
    classLabel: active.label,
    academicSession: ws.session.label,
    events: classEvents.map((e) => ({ id: e.id, name: e.name, status: e.status })),
    availableElectives,
  };
}

// ── Reg Control Center ─────────────────────────────────────────────────────────

/** Registration windows in the selected academic session for the classes this user manages. */
export async function getPortalWindow() {
  const session = await assertTutor();
  const ws = session.workspace;

  const eventIds = await workspaceEventIds(ws);
  if (eventIds.length === 0) return [];
  // The active class's own events come first.
  const prioritizedEventIds = session.sectionId ? await workspaceEventIds(ws, { sectionId: session.sectionId }) : [];

  const allowedEvents = await db
    .select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      academicYear: registrationEvents.academicYear,
      semester: registrationEvents.semester,
      status: registrationEvents.status,
      openDate: registrationEvents.openDate,
      closeDate: registrationEvents.closeDate,
      description: registrationEvents.description,
      allowEditing: registrationEvents.allowEditing,
      autoClose: registrationEvents.autoClose,
      programmeId: academicBatches.programmeId,
    })
    .from(registrationEvents)
    .leftJoin(academicBatches, eq(registrationEvents.academicBatchId, academicBatches.id))
    .where(inArray(registrationEvents.id, eventIds))
    .orderBy(desc(registrationEvents.createdAt));

  allowedEvents.sort((a, b) => Number(prioritizedEventIds.includes(b.id)) - Number(prioritizedEventIds.includes(a.id)));

  const [allGroups, targets] = await Promise.all([
    db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(inArray(electiveGroups.eventId, eventIds)),
    db.select({ eventId: eventSections.eventId, sectionId: eventSections.sectionId }).from(eventSections).where(inArray(eventSections.eventId, eventIds)),
  ]);
  const labelOf = new Map(ws.classes.map((c) => [c.sectionId, c.label]));

  return allowedEvents.map((event) => ({
    ...event,
    groupCount: allGroups.filter((g) => g.eventId === event.id).length,
    academicSession: ws.session.label,
    classLabels: targets
      .filter((t) => t.eventId === event.id)
      .map((t) => labelOf.get(t.sectionId))
      .filter((l): l is string => Boolean(l)),
  }));
}

export async function getRegistrationMetrics(eventId: string) {
  const session = await assertTutor();
  const event = await assertEventAccess(session, eventId);

  // 1. Students of the event's classes this user manages (the active class when it is one of them)
  const sectionIds =
    session.sectionId && event.targetSectionIds.includes(session.sectionId) ? [session.sectionId] : event.classes.map((c) => c.sectionId);
  let totalStudents = 0;
  if (sectionIds.length) {
    const [totalStudentsRes] = await db
      .select({ count: count() })
      .from(users)
      .where(and(inArray(users.sectionId, sectionIds), eq(users.role, "STUDENT"), eq(users.isActive, true)));
    totalStudents = totalStudentsRes?.count ?? 0;
  }

  const [registeredStudentsRes] = await db
    .select({ count: count() })
    .from(registrations)
    .innerJoin(users, eq(registrations.studentId, users.id))
    .where(
      and(
        eq(registrations.eventId, eventId),
        eq(registrations.status, "CONFIRMED"),
        sectionIds.length ? inArray(users.sectionId, sectionIds) : sql`false`
      )
    );
  const registeredStudents = registeredStudentsRes?.count ?? 0;

  // 2. Seats filled vs total
  const electivesList = await db
    .select({
      id: electives.id,
      name: electives.name,
      courseCode: electives.courseCode,
      maxSeats: electives.maxSeats,
      availableSeats: electives.availableSeats,
      isFull: electives.isFull,
    })
    .from(electives)
    .innerJoin(electiveGroups, eq(electives.groupId, electiveGroups.id))
    .where(eq(electiveGroups.eventId, eventId));

  let totalSeats = 0;
  let filledSeats = 0;
  let fullSubjects = 0;

  for (const el of electivesList) {
    totalSeats += el.maxSeats;
    filledSeats += (el.maxSeats - el.availableSeats);
    if (el.isFull || el.availableSeats <= 0) fullSubjects++;
  }

  // 3. Analytics (Peak Registration, Popular/Least Subject)
  const allRegistrations = await db
    .select({
      submittedAt: registrations.submittedAt,
      receiptSnapshot: registrations.receiptSnapshot,
    })
    .from(registrations)
    .where(
      and(
        eq(registrations.eventId, eventId),
        eq(registrations.status, "CONFIRMED")
      )
    );

  const subjectCounts: Record<string, number> = {};
  const hourCounts: Record<string, number> = {};

  for (const reg of allRegistrations) {
    if (reg.submittedAt) {
      const hour = new Date(reg.submittedAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    if (reg.receiptSnapshot && typeof reg.receiptSnapshot === "object") {
      const snap = reg.receiptSnapshot as any;
      if (snap.electives && Array.isArray(snap.electives)) {
        for (const el of snap.electives) {
          if (el.status === "CANCELLED") continue;
          const cleanName = String(el.electiveName || "").trim();
          if (cleanName) {
            subjectCounts[cleanName] = (subjectCounts[cleanName] || 0) + 1;
          }
        }
      }
    }
  }

  let peakHour = "N/A";
  let maxHourCount = 0;
  for (const [hour, c] of Object.entries(hourCounts)) {
    if (c > maxHourCount) {
      maxHourCount = c;
      const h = parseInt(hour);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      peakHour = `${h12}:00 ${ampm}`;
    }
  }

  let popularSubject = "N/A";
  let leastSubject = "N/A";
  let maxSubCount = -1;
  let minSubCount = Infinity;

  for (const el of electivesList) {
    const name = el.courseCode ? `${el.courseCode} - ${el.name}` : el.name;
    const c = subjectCounts[name] || subjectCounts[el.name] || 0;
    if (c > maxSubCount) {
      maxSubCount = c;
      popularSubject = el.name;
    }
    if (c < minSubCount) {
      minSubCount = c;
      leastSubject = el.name;
    }
  }

  return {
    totalStudents,
    registeredStudents,
    totalSeats,
    filledSeats,
    fullSubjects,
    peakHour,
    popularSubject,
    leastSubject,
    subjectCounts: Object.entries(subjectCounts).map(([name, val]) => ({ name, value: val })),
  };
}

// ── CRUD Actions for Tutor ────────────────────────────────────────────────

/**
 * Creates a registration event for the active class in the selected academic
 * session. One event per class and registration period (semester) in a
 * session; the cohort and session come from the server, never the client.
 */
export async function createRegistrationWindow(data: { name: string; semester?: number | null; description?: string }) {
  const session = await assertTutor();
  const ws = session.workspace;
  const active = ws.activeClass;
  if (!active) throw new Error(`Choose one of your classes in Academic Session ${ws.session.label} first.`);

  const name = data.name?.trim();
  if (!name) throw new Error("Event name is required.");
  if (data.semester != null && !(Number.isInteger(data.semester) && data.semester >= 1 && data.semester <= 12)) {
    throw new Error("Semester must be between 1 and 12.");
  }
  const semester = data.semester ?? active.semester ?? null;

  const existing = await db
    .select({ id: registrationEvents.id, semester: registrationEvents.semester })
    .from(registrationEvents)
    .innerJoin(eventSections, eq(eventSections.eventId, registrationEvents.id))
    .where(
      and(
        eq(eventSections.sectionId, active.sectionId),
        eq(registrationEvents.academicSessionId, ws.session.id),
        ne(registrationEvents.status, "ARCHIVED")
      )
    );
  if (existing.some((e) => (e.semester ?? null) === semester)) {
    throw new Error(
      `${active.label} already has a registration event for ${semester ? `Semester ${semester}` : "this period"} in ${ws.session.label}.`
    );
  }

  return db.transaction(async (tx) => {
    const [newEvent] = await tx
      .insert(registrationEvents)
      .values({
        name,
        academicYear: ws.session.label,
        academicSessionId: ws.session.id,
        semester,
        description: data.description,
        academicBatchId: active.batchId,
        createdById: session.userId,
        status: "DRAFT",
      })
      .returning();

    await tx.insert(eventSections).values({ eventId: newEvent.id, sectionId: active.sectionId, academicBatchId: active.batchId });

    await tx.insert(auditLogs).values({
      action: "CREATE_REGISTRATION_EVENT",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      newValue: { id: newEvent.id, name: newEvent.name, status: newEvent.status },
      metadata: { academicSessionId: ws.session.id, sectionId: active.sectionId, academicBatchId: active.batchId, classLabel: active.label, semester },
    });
    return newEvent;
  });
}

export async function updateWindowTimers(
  eventId: string,
  openDate: Date | null,
  closeDate: Date | null,
  config?: {
    allowEditing?: boolean;
    autoClose?: boolean;
    status?: string;
  }
) {
  const session = await assertTutor();
  await assertEventAccess(session, eventId);

  const [existingEvent] = await db
    .select()
    .from(registrationEvents)
    .where(eq(registrationEvents.id, eventId));

  if (!existingEvent) throw new Error("Registration event not found.");

  const now = new Date();
  let status = existingEvent.status;

  if (config?.status) {
    status = config.status;
  } else {
    // Only update status based on dates if status is not explicitly paused
    if (existingEvent.status === "PAUSED") {
      status = "PAUSED";
    } else if (existingEvent.status === "OPEN") {
      const isAutoClose = config?.autoClose !== undefined ? config.autoClose : existingEvent.autoClose;
      if (isAutoClose && closeDate && now >= closeDate) {
        status = "CLOSED";
      } else {
        status = "OPEN";
      }
    } else if (existingEvent.status === "CLOSED") {
      if (closeDate && now < closeDate && (!openDate || now >= openDate)) {
        status = "OPEN";
      } else {
        status = "CLOSED";
      }
    } else {
      // For DRAFT or PUBLISHED: schedule accordingly
      if (!openDate && !closeDate) {
        status = "DRAFT";
      } else if (closeDate && now >= closeDate) {
        status = "CLOSED";
      } else if (openDate && now >= openDate) {
        status = "OPEN";
      } else {
        status = "PUBLISHED";
      }
    }
  }

  const updateData: Record<string, any> = {
    openDate,
    closeDate,
    status,
    updatedAt: new Date(),
  };

  if (config?.allowEditing !== undefined) {
    updateData.allowEditing = config.allowEditing;
  }
  if (config?.autoClose !== undefined) {
    updateData.autoClose = config.autoClose;
  }

  await db
    .update(registrationEvents)
    .set(updateData)
    .where(eq(registrationEvents.id, eventId));

  // Insert audit log
  await db.insert(auditLogs).values({
    action: "UPDATE_WINDOW_SETTINGS",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: {
      eventId,
      eventName: existingEvent.name,
      openDate,
      closeDate,
      status,
      allowEditing: updateData.allowEditing,
      autoClose: updateData.autoClose,
    },
  });

  // Revalidate caches and paths
  try {
    const cache = await import("next/cache") as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/window");
      cache.revalidatePath("/faculty/events");
      cache.revalidatePath("/faculty/dashboard");
      cache.revalidatePath("/dashboard");
      cache.revalidatePath("/dashboard/electives");
      cache.revalidatePath("/", "layout");
    }
    if (typeof cache.updateTag === "function") {
      cache.updateTag("hierarchy");
    }
    if (typeof cache.revalidateTag === "function") {
      cache.revalidateTag("hierarchy", "max");
    }
  } catch (err) {
    console.warn("Revalidation warning:", err);
  }

  return { success: true, status };
}

export async function toggleWindowStatus(eventId: string, newStatus: "OPEN" | "PAUSED" | "CLOSED") {
  const session = await assertTutor();
  await assertEventAccess(session, eventId);

  const [existingEvent] = await db
    .select()
    .from(registrationEvents)
    .where(eq(registrationEvents.id, eventId));

  if (!existingEvent) throw new Error("Registration event not found.");

  await db
    .update(registrationEvents)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(registrationEvents.id, eventId));

  await db.insert(auditLogs).values({
    action: "UPDATE_WINDOW_STATUS",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: {
      eventId,
      eventName: existingEvent.name,
      oldStatus: existingEvent.status,
      newStatus,
    },
  });

  try {
    const cache = await import("next/cache") as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/window");
      cache.revalidatePath("/faculty/events");
      cache.revalidatePath("/faculty/dashboard");
      cache.revalidatePath("/dashboard");
      cache.revalidatePath("/dashboard/electives");
      cache.revalidatePath("/", "layout");
    }
  } catch (err) {
    console.warn("Revalidation warning:", err);
  }

  return { success: true, status: newStatus };
}

import * as bcrypt from "bcryptjs";
import { z } from "zod";

const createStudentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  registerNumber: z.string().min(1, "Register number is required"),
  email: z.string().email("Invalid email format"),
});

export async function createStudent(formData: { name: string; registerNumber: string; email: string }) {
  const parsed = createStudentSchema.safeParse(formData);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0].message);
  }
  const data = parsed.data;

  const session = await assertTutor();
  if (!session.sectionId || !session.academicBatchId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data");
  }

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email.toLowerCase().trim()))
    .limit(1);

  if (existing) throw new Error("A user with this email already exists.");

  // Temporary password is their register number, securely hashed. It does not
  // meet the password policy, so the student must choose their own at first sign-in.
  const hashed = await bcrypt.hash(data.registerNumber.toUpperCase().trim(), 12);

  await db.insert(users).values({
    name: data.name.trim(),
    email: data.email.toLowerCase().trim(),
    registerNumber: data.registerNumber.trim().toUpperCase(), // students sign in with it; matched upper-case
    passwordHash: hashed,
    role: "STUDENT",
    sectionId: session.sectionId,
    academicBatchId: session.academicBatchId,
    departmentId: session.departmentId,
    isActive: true,
    isEligible: true,
  });
}

export async function unlockStudentRegistration(studentId: string, eventId?: string) {
  const session = await assertTutor();
  const [student] = await db.select({ email: users.email, sectionId: users.sectionId, role: users.role }).from(users).where(eq(users.id, studentId));
  if (!student || student.role !== "STUDENT") throw new Error("Student not found.");
  // The student must be in a class this user manages in the selected session.
  assertClass(session.workspace, student.sectionId);
  const eventIds = eventId ? [(await assertEventAccess(session, eventId)).id] : await workspaceEventIds(session.workspace);
  if (eventIds.length === 0) return;

  // Use a transaction to unlock registrations
  await db.transaction(async (tx) => {
    const conditions = [eq(studentRegistrations.studentId, studentId), inArray(studentRegistrations.eventId, eventIds)];

    await tx.update(studentRegistrations)
      .set({ isLocked: false })
      .where(and(...conditions));

    // Audit log
    await tx.insert(auditLogs).values({
      action: "UNLOCK_STUDENT_REGISTRATION",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: {
        studentId,
        studentEmail: student.email,
        eventId: eventId || "ALL_EVENTS_IN_SESSION",
        academicSessionId: session.workspace.session.id,
      },
    });
  });
}

export async function resetSectionSubjects(eventId: string) {
  const session = await assertTutor();
  await assertEventAccess(session, eventId);
  const [{ n }] = await db.select({ n: count() }).from(studentRegistrations).where(eq(studentRegistrations.eventId, eventId));
  if (n > 0) throw new Error(`Students have already made ${n} choice(s) in this event. Reset the registrations first.`);
  await db.delete(electiveGroups).where(eq(electiveGroups.eventId, eventId));
}

export async function createElectiveGroup(eventId: string, name: string) {
  const session = await assertTutor();
  await assertEventAccess(session, eventId);

  const existingGroups = await db.select().from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
  const sortOrder = existingGroups.length;

  const [newGroup] = await db.insert(electiveGroups).values({
    eventId,
    name: name.trim(),
    sortOrder,
  }).returning({ id: electiveGroups.id });
  return newGroup;
}

export async function createElective(groupId: string, data: { name: string; maxSeats: number; credits: number; courseCode?: string }) {
  const session = await assertTutor();
  
  // Verify group belongs to accessible event
  const [group] = await db
    .select({ eventId: electiveGroups.eventId })
    .from(electiveGroups)
    .where(eq(electiveGroups.id, groupId));
  if (!group) throw new Error("Group not found");

  await assertEventAccess(session, group.eventId);
  if (!Number.isInteger(data.maxSeats) || data.maxSeats < 1) throw new Error("Capacity must be at least 1 seat.");

  await db.insert(electives).values({
    groupId,
    name: data.name.trim(),
    courseCode: data.courseCode || null,
    maxSeats: data.maxSeats,
    availableSeats: data.maxSeats,
    credits: data.credits,
    isFull: false,
  });
}

export async function importStudentsCSV(studentsData: { name: string; registerNumber: string; email: string }[]) {
  const session = await assertTutor();
  if (!session.sectionId || !session.academicBatchId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data");
  }

  const valuesToInsert = await Promise.all(studentsData.map(async (s) => {
    const hashed = await bcrypt.hash(s.registerNumber.toUpperCase().trim(), 12);
    return {
      name: s.name.trim(),
      email: s.email.toLowerCase().trim(),
      registerNumber: s.registerNumber.trim().toUpperCase(),
      passwordHash: hashed,
      role: "STUDENT" as const,
      sectionId: session.sectionId,
      academicBatchId: session.academicBatchId,
      departmentId: session.departmentId,
      isActive: true,
      isEligible: true,
    };
  }));

  // Simple loop or batch insert. Let's do a batch insert with ON CONFLICT DO NOTHING.
  // Wait, Drizzle pg doesn't have a simple generic ON CONFLICT DO NOTHING for all rows without specifying columns easily in this setup, 
  // so we'll just check existing emails first to avoid failing the whole batch if one exists.
  
  const existingUsers = await db.select({ email: users.email }).from(users);
  const existingEmails = new Set(existingUsers.map(u => u.email));

  const newUsers = valuesToInsert.filter(u => !existingEmails.has(u.email));
  if (newUsers.length === 0) return { imported: 0, skipped: valuesToInsert.length };

  await db.insert(users).values(newUsers);
  
  return { imported: newUsers.length, skipped: valuesToInsert.length - newUsers.length };
}

export async function updateElective(id: string, data: { name: string; maxSeats: number; credits: number; courseCode?: string }) {
  const session = await assertTutor();
  // Ensure the elective belongs to an accessible group/event
  const [elective] = await db.select({ groupId: electives.groupId }).from(electives).where(eq(electives.id, id));
  if (!elective) throw new Error("Elective not found.");

  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, elective.groupId));
  if (!group) throw new Error("Group not found.");

  await assertEventAccess(session, group.eventId);

  // Adjust availableSeats based on the new maxSeats
  // We need to know how many seats are already taken.
  const [current] = await db.select({ maxSeats: electives.maxSeats, availableSeats: electives.availableSeats }).from(electives).where(eq(electives.id, id));
  const bookedSeats = current.maxSeats - current.availableSeats;
  const newAvailable = data.maxSeats - bookedSeats;

  if (newAvailable < 0) {
    throw new Error("Cannot reduce seats below the number of currently booked seats.");
  }

  await db.update(electives).set({
    name: data.name.trim(),
    courseCode: data.courseCode || null,
    maxSeats: data.maxSeats,
    credits: data.credits,
    availableSeats: newAvailable,
    isFull: newAvailable === 0,
    updatedAt: new Date(),
  }).where(eq(electives.id, id));
}

export async function deleteElective(id: string) {
  const session = await assertTutor();
  
  const [elective] = await db.select({ groupId: electives.groupId }).from(electives).where(eq(electives.id, id));
  if (!elective) throw new Error("Elective not found.");

  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, elective.groupId));
  if (!group) throw new Error("Group not found.");

  await assertEventAccess(session, group.eventId);

  // Never silently drop a student's confirmed choice.
  const [{ n }] = await db
    .select({ n: count() })
    .from(studentRegistrations)
    .where(and(eq(studentRegistrations.electiveId, id), eq(studentRegistrations.status, "CONFIRMED")));
  if (n > 0) throw new Error(`${n} student(s) hold a seat in this subject. Reset their registrations before deleting it.`);

  await db.transaction(async (tx) => {
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.electiveId, id));
    await tx.delete(electives).where(eq(electives.id, id));
  });
}

export async function updateElectiveGroup(id: string, name: string) {
  const session = await assertTutor();
  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, id));
  if (!group) throw new Error("Group not found.");

  await assertEventAccess(session, group.eventId);

  await db.update(electiveGroups).set({ name: name.trim() }).where(eq(electiveGroups.id, id));
}

export async function deleteElectiveGroup(id: string) {
  const session = await assertTutor();
  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, id));
  if (!group) throw new Error("Group not found.");

  await assertEventAccess(session, group.eventId);

  // Never silently drop a student's confirmed choice.
  const [{ n }] = await db
    .select({ n: count() })
    .from(studentRegistrations)
    .where(and(eq(studentRegistrations.groupId, id), eq(studentRegistrations.status, "CONFIRMED")));
  if (n > 0) throw new Error(`${n} student(s) hold a seat in this basket. Reset their registrations before deleting it.`);

  await db.transaction(async (tx) => {
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.groupId, id));
    await tx.delete(electives).where(eq(electives.groupId, id));
    await tx.delete(electiveGroups).where(eq(electiveGroups.id, id));
  });
}

export async function updateStudent(id: string, data: { name: string; registerNumber: string; email: string }) {
  const session = await assertTutor();
  
  // Verify student belongs to tutor's section
  const [student] = await db.select({ sectionId: users.sectionId }).from(users).where(and(eq(users.id, id), eq(users.role, "STUDENT")));
  if (!student || student.sectionId !== session.sectionId) {
    throw new Error("Unauthorized or student not found.");
  }

  // Check if email already exists on another user
  const [existing] = await db.select().from(users).where(and(eq(users.email, data.email.toLowerCase().trim())));
  if (existing && existing.id !== id) {
    throw new Error("A user with this email already exists.");
  }

  await db.update(users).set({
    name: data.name.trim(),
    registerNumber: data.registerNumber.trim().toUpperCase(), // students sign in with it; matched upper-case
    email: data.email.toLowerCase().trim(),
    updatedAt: new Date(),
  }).where(eq(users.id, id));
}

export async function deleteStudent(id: string) {
  const session = await assertTutor();
  
  const [student] = await db.select({ sectionId: users.sectionId }).from(users).where(and(eq(users.id, id), eq(users.role, "STUDENT")));
  if (!student || student.sectionId !== session.sectionId) {
    throw new Error("Unauthorized or student not found.");
  }

  await deleteStudentsWithSeatReturn(session, [id]);
}

export async function deleteMultipleStudentsTutor(ids: string[]) {
  const session = await assertTutor();
  if (!ids || ids.length === 0) return;
  if (!session.sectionId) throw new Error("Choose one of your classes first.");

  const validStudents = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.sectionId, session.sectionId), eq(users.role, "STUDENT")));
  const validIds = validStudents.map(s => s.id);
  
  if (validIds.length === 0) return;

  await deleteStudentsWithSeatReturn(session, validIds);
}

/**
 * Deletes students and returns the seats they actually held (CONFIRMED
 * choices only, subject and class quota, never above capacity).
 */
async function deleteStudentsWithSeatReturn(session: TutorContext, ids: string[]) {
  await db.transaction(async (tx) => {
    const held = await tx
      .select({ electiveId: studentRegistrations.electiveId, sectionId: users.sectionId })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(and(inArray(studentRegistrations.studentId, ids), eq(studentRegistrations.status, "CONFIRMED")));

    const electiveIds = Array.from(new Set(held.map((h) => h.electiveId))).sort();
    if (electiveIds.length) {
      await tx.select({ id: electives.id }).from(electives).where(inArray(electives.id, electiveIds)).orderBy(asc(electives.id)).for("update");
    }
    for (const h of held) await releaseSeat(tx, h.electiveId, h.sectionId);

    await tx.delete(studentRegistrations).where(inArray(studentRegistrations.studentId, ids));
    await tx.delete(registrations).where(inArray(registrations.studentId, ids));
    await tx.delete(eventStudents).where(inArray(eventStudents.studentId, ids));
    await tx.delete(users).where(inArray(users.id, ids));

    await tx.insert(auditLogs).values({
      action: "DELETE_STUDENTS",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: { studentIds: ids, seatsReturned: held.length, sectionId: session.sectionId, academicSessionId: session.workspace.session.id },
    });
  });
}

/**
 * Clears the active class's registrations for one event of the selected
 * session (by default the class's most recent event there). Only seats that
 * were actually held are returned, and other events are never touched.
 */
export async function resetSectionRegistrationEvent(eventIdParam?: string) {
  const session = await assertTutor();
  if (!session.sectionId) throw new Error("No section assigned.");
  const sectionId = session.sectionId;

  let eventId = eventIdParam;
  if (!eventId) {
    const classEventIds = await workspaceEventIds(session.workspace, { sectionId });
    const [latest] = classEventIds.length
      ? await db.select({ id: registrationEvents.id }).from(registrationEvents).where(inArray(registrationEvents.id, classEventIds)).orderBy(desc(registrationEvents.createdAt)).limit(1)
      : [];
    if (!latest) return;
    eventId = latest.id;
  }
  const event = await assertEventAccess(session, eventId);
  if (!event.targetSectionIds.includes(sectionId)) throw new Error("That event is not for your active class.");

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ studentId: studentRegistrations.studentId, electiveId: studentRegistrations.electiveId, status: studentRegistrations.status })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(and(eq(users.sectionId, sectionId), eq(studentRegistrations.eventId, event.id)));
    if (existing.length === 0) return; // Nothing to reset

    const studentIds = Array.from(new Set(existing.map((r) => r.studentId)));
    const held = existing.filter((r) => r.status === "CONFIRMED");
    const electiveIds = Array.from(new Set(held.map((h) => h.electiveId))).sort();
    const locked = electiveIds.length
      ? await tx.select().from(electives).where(inArray(electives.id, electiveIds)).orderBy(asc(electives.id)).for("update")
      : [];

    for (const elective of locked) {
      const returned = held.filter((h) => h.electiveId === elective.id).length;
      for (let i = 0; i < returned; i++) await releaseSeat(tx, elective.id, sectionId);
      await tx.insert(replayEvents).values({
        registrationEventId: event.id,
        eventType: "REGISTRATION_RESET",
        subjectId: elective.id,
        subjectName: elective.courseCode ? `${elective.courseCode} - ${elective.name}` : elective.name,
        seatBefore: elective.availableSeats,
        seatAfter: Math.min(elective.availableSeats + returned, elective.maxSeats),
        performedBy: session.userId,
        metadata: { countRefunded: returned, sectionId },
      });
    }

    // Only this event's choices for these students
    await tx
      .delete(studentRegistrations)
      .where(and(eq(studentRegistrations.eventId, event.id), inArray(studentRegistrations.studentId, studentIds)));

    await tx
      .update(registrations)
      .set({
        status: "RESET_BY_COORDINATOR",
        receiptNumber: null,
        receiptSnapshot: null,
        updatedAt: new Date(),
      })
      .where(and(eq(registrations.eventId, event.id), inArray(registrations.studentId, studentIds)));

    await tx.insert(auditLogs).values({
      action: "RESET_SECTION_REGISTRATION_EVENT",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: {
        eventIds: [event.id],
        eventName: event.name,
        sectionId,
        academicSessionId: session.workspace.session.id,
        clearedRegistrationsCount: existing.length,
        seatsReturned: held.length,
      },
    });
  });
}

// ── Self Onboarding ──────────────────────────────────────────────────────

// ── Self Onboarding & Multi-Programme Class Management ─────────────────────

export type AssignedSectionCard = {
  id: string;
  label: string;
  batch: string; // for compatibility: e.g. "2026"
  batchId: string;
  batchYear: string;
  admissionYear: number | null;
  expectedEndYear: number | null;
  cohortYears: string; // e.g. "2026–2028"
  programme: string; // for compatibility: e.g. "MCA GenAI"
  programmeId: string;
  programmeName: string;
  programmeCode: string;
  department: string; // for compatibility: e.g. "Department of Computer Applications"
  departmentId: string;
  departmentName: string;
  studentCount: number;
  classLabel: string; // e.g. "MCA GenAI F · 2026–2028"
  activeSessions: { id: string; label: string; studyYear: number | null; semester: number | null }[];
};

export type AvailableSectionCard = {
  id: string;
  label: string;
  batch: string;
  batchId: string;
  batchYear: string;
  admissionYear: number | null;
  expectedEndYear: number | null;
  cohortYears: string;
  programme: string;
  programmeId: string;
  programmeName: string;
  programmeCode: string;
  department: string;
  departmentId: string;
  departmentName: string;
  studentCount: number;
  classLabel: string;
  status: "ASSIGNED_TO_ME" | "AVAILABLE" | "CLAIMED_BY_OTHER";
  claimedByTutorName?: string;
  activeSessions: { id: string; label: string; studyYear: number | null; semester: number | null }[];
};

export type AvailableSectionsResult = {
  sections: AvailableSectionCard[];
  maxAllowed: number;
  currentCount: number;
};

export async function getMaxTutorSectionsLimit(): Promise<number> {
  try {
    const [setting] = await db
      .select({ maxTutorSections: systemSettings.maxTutorSections })
      .from(systemSettings)
      .where(eq(systemSettings.id, "system"))
      .limit(1);
    return setting?.maxTutorSections ?? 10;
  } catch {
    return 10;
  }
}

export async function getAllAvailableSections(): Promise<AvailableSectionsResult> {
  const session = await assertStaffBase();
  const maxAllowed = await getMaxTutorSectionsLimit();

  const isAdmin = session.role === "SYSTEM_ADMIN";
  let targetDepartmentId = session.departmentId;

  if (!isAdmin && !targetDepartmentId) {
    const [userRow] = await db
      .select({ departmentId: users.departmentId, programmeId: users.programmeId })
      .from(users)
      .where(eq(users.id, session.userId));
    if (userRow?.departmentId) {
      targetDepartmentId = userRow.departmentId;
    } else if (userRow?.programmeId) {
      const [progRow] = await db
        .select({ departmentId: programmes.departmentId })
        .from(programmes)
        .where(eq(programmes.id, userRow.programmeId));
      targetDepartmentId = progRow?.departmentId;
    }
  }

  // Get current assignments of this tutor
  const myAssigned = await db
    .select({ sectionId: tutorSections.sectionId })
    .from(tutorSections)
    .where(eq(tutorSections.tutorId, session.userId));
  const mySectionIds = myAssigned.map((a) => a.sectionId);

  // Department scoping: tutors see classes across all programmes within their authorized department.
  // Also include any section explicitly assigned to this tutor even if outside department.
  const deptCondition = isAdmin
    ? undefined
    : targetDepartmentId
      ? mySectionIds.length > 0
        ? or(eq(programmes.departmentId, targetDepartmentId), inArray(sections.id, mySectionIds))
        : eq(programmes.departmentId, targetDepartmentId)
      : undefined;

  const allSections = await db
    .select({
      id: sections.id,
      label: sections.label,
      batchId: academicBatches.id,
      batchYear: academicBatches.year,
      admissionYear: academicBatches.admissionYear,
      expectedEndYear: academicBatches.expectedEndYear,
      programmeId: programmes.id,
      programmeName: programmes.name,
      programmeCode: programmes.code,
      departmentId: departments.id,
      departmentName: departments.name,
    })
    .from(sections)
    .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .innerJoin(departments, eq(programmes.departmentId, departments.id))
    .where(and(eq(sections.isActive, true), deptCondition))
    .orderBy(programmes.name, desc(academicBatches.admissionYear), sections.label);

  if (allSections.length === 0) {
    return { sections: [], maxAllowed, currentCount: mySectionIds.length };
  }

  const sectionIds = allSections.map((s) => s.id);
  const batchIds = Array.from(new Set(allSections.map((s) => s.batchId)));

  // Tutor assignments for these sections
  const assignments = await db
    .select({
      sectionId: tutorSections.sectionId,
      tutorId: tutorSections.tutorId,
      tutorName: users.name,
    })
    .from(tutorSections)
    .innerJoin(users, eq(tutorSections.tutorId, users.id))
    .where(inArray(tutorSections.sectionId, sectionIds));

  const assignedMap = new Map<string, { tutorId: string; tutorName: string }>();
  for (const a of assignments) {
    assignedMap.set(a.sectionId, { tutorId: a.tutorId, tutorName: a.tutorName });
  }

  // Student counts
  const studentCountRows = await db
    .select({
      sectionId: users.sectionId,
      count: count(),
    })
    .from(users)
    .where(
      and(
        eq(users.role, "STUDENT"),
        eq(users.isActive, true),
        inArray(users.sectionId, sectionIds)
      )
    )
    .groupBy(users.sectionId);

  const studentCountMap = new Map(
    studentCountRows
      .filter((r): r is { sectionId: string; count: number } => Boolean(r.sectionId))
      .map((r) => [r.sectionId, r.count])
  );

  // Active sessions / Year Servers for these cohorts
  const sessionTermRows = await db
    .select({
      batchId: cohortSessionTerms.academicBatchId,
      sessionId: academicSessions.id,
      startYear: academicSessions.startYear,
      endYear: academicSessions.endYear,
      status: academicSessions.status,
      studyYear: cohortSessionTerms.studyYear,
      semester: cohortSessionTerms.currentSemester,
    })
    .from(cohortSessionTerms)
    .innerJoin(academicSessions, eq(cohortSessionTerms.academicSessionId, academicSessions.id))
    .where(
      and(
        inArray(cohortSessionTerms.academicBatchId, batchIds),
        ne(academicSessions.status, "ARCHIVED")
      )
    );

  const sessionTermsByBatch = new Map<string, typeof sessionTermRows>();
  for (const row of sessionTermRows) {
    const list = sessionTermsByBatch.get(row.batchId) || [];
    list.push(row);
    sessionTermsByBatch.set(row.batchId, list);
  }

  const resultCards: AvailableSectionCard[] = allSections.map((s) => {
    const activeTerms = sessionTermsByBatch.get(s.batchId) || [];
    const activeSessions = activeTerms.map((t) => ({
      id: t.sessionId,
      label: `${t.startYear} Academic Timeline`,
      studyYear: t.studyYear,
      semester: t.semester,
    }));

    const years = cohortYears({
      admissionYear: s.admissionYear,
      expectedEndYear: s.expectedEndYear,
      legacyYear: s.batchYear,
    });

    const label = cohortLabel({
      programmeName: s.programmeName,
      programmeCode: s.programmeCode,
      sectionLabel: s.label,
      admissionYear: s.admissionYear,
      expectedEndYear: s.expectedEndYear,
      legacyYear: s.batchYear,
    });

    const assignment = assignedMap.get(s.id);
    let status: "ASSIGNED_TO_ME" | "AVAILABLE" | "CLAIMED_BY_OTHER" = "AVAILABLE";
    if (assignment) {
      if (assignment.tutorId === session.userId) {
        status = "ASSIGNED_TO_ME";
      } else {
        status = "CLAIMED_BY_OTHER";
      }
    }

    return {
      id: s.id,
      label: s.label,
      batch: s.batchYear,
      batchId: s.batchId,
      batchYear: s.batchYear,
      admissionYear: s.admissionYear,
      expectedEndYear: s.expectedEndYear,
      cohortYears: years,
      programme: s.programmeName,
      programmeId: s.programmeId,
      programmeName: s.programmeName,
      programmeCode: s.programmeCode,
      department: s.departmentName,
      departmentId: s.departmentId,
      departmentName: s.departmentName,
      studentCount: studentCountMap.get(s.id) ?? 0,
      classLabel: label,
      status,
      claimedByTutorName: assignment && assignment.tutorId !== session.userId ? assignment.tutorName : undefined,
      activeSessions,
    };
  });

  return {
    sections: resultCards,
    maxAllowed,
    currentCount: mySectionIds.length,
  };
}

export async function claimTutorSection(sectionIds: string[]) {
  const session = await assertStaffBase();

  if (!sectionIds || sectionIds.length === 0) {
    throw new Error("No sections selected");
  }

  const uniqueIds = Array.from(new Set(sectionIds));

  // Check how many sections the tutor already has
  const existing = await db
    .select({ sectionId: tutorSections.sectionId })
    .from(tutorSections)
    .where(eq(tutorSections.tutorId, session.userId));

  const existingIds = new Set(existing.map((e) => e.sectionId));
  const newIds = uniqueIds.filter((id) => !existingIds.has(id));

  if (newIds.length === 0) {
    return; // Already assigned to all requested
  }

  const maxAllowed = await getMaxTutorSectionsLimit();
  if (existing.length + newIds.length > maxAllowed) {
    throw new Error(
      `You can manage up to ${maxAllowed} classes total. You currently have ${existing.length} assigned and cannot add ${newIds.length} more.`
    );
  }

  // Verify that the sections exist
  const targetSections = await db
    .select({
      id: sections.id,
      label: sections.label,
      departmentId: programmes.departmentId,
      programmeName: programmes.name,
    })
    .from(sections)
    .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .where(inArray(sections.id, newIds));

  if (targetSections.length !== newIds.length) {
    throw new Error("One or more selected sections were not found.");
  }

  // Department check for non-administrators
  if (session.role !== "SYSTEM_ADMIN") {
    let tutorDeptId = session.departmentId;
    if (!tutorDeptId) {
      const [userRow] = await db
        .select({ departmentId: users.departmentId, programmeId: users.programmeId })
        .from(users)
        .where(eq(users.id, session.userId));
      tutorDeptId = userRow?.departmentId ?? undefined;
      if (!tutorDeptId && userRow?.programmeId) {
        const [progRow] = await db
          .select({ departmentId: programmes.departmentId })
          .from(programmes)
          .where(eq(programmes.id, userRow.programmeId));
        tutorDeptId = progRow?.departmentId ?? undefined;
      }
    }

    if (tutorDeptId) {
      const foreign = targetSections.filter((s) => s.departmentId !== tutorDeptId);
      if (foreign.length > 0) {
        throw new Error(
          `You are only authorized to manage classes within your department. ${foreign[0].programmeName} is outside your authorized scope.`
        );
      }
    }
  }

  // Check if any of these sections are already assigned to another tutor
  const alreadyAssigned = await db
    .select({
      sectionId: tutorSections.sectionId,
      tutorName: users.name,
    })
    .from(tutorSections)
    .innerJoin(users, eq(tutorSections.tutorId, users.id))
    .where(and(inArray(tutorSections.sectionId, newIds), ne(tutorSections.tutorId, session.userId)));

  if (alreadyAssigned.length > 0) {
    throw new Error(
      `One or more selected sections have already been claimed by another tutor (${alreadyAssigned[0].tutorName}).`
    );
  }

  const valuesToInsert = newIds.map((id) => ({
    tutorId: session.userId,
    sectionId: id,
  }));

  await db.insert(tutorSections).values(valuesToInsert);

  await db.insert(auditLogs).values({
    action: "CLAIM_TUTOR_SECTIONS",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: {
      sectionIds: newIds,
      totalCount: existing.length + newIds.length,
      maxAllowed,
    },
  });

  // Set the first assigned section as active if no active section is currently selected
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const currentActive = cookieStore.get("electify_active_section")?.value;
    if (!currentActive || !existingIds.has(currentActive)) {
      cookieStore.set("electify_active_section", newIds[0], {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7200,
      });
    }
  } catch {}

  try {
    const cache = (await import("next/cache")) as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/assign-sections");
      cache.revalidatePath("/faculty/dashboard");
      cache.revalidatePath("/faculty", "layout");
    }
  } catch {}
}

export async function getMyAssignedSections(): Promise<AssignedSectionCard[]> {
  const session = await assertStaffBase();

  const assignments = await db
    .select({
      id: sections.id,
      label: sections.label,
      batchId: academicBatches.id,
      batchYear: academicBatches.year,
      admissionYear: academicBatches.admissionYear,
      expectedEndYear: academicBatches.expectedEndYear,
      programmeId: programmes.id,
      programmeName: programmes.name,
      programmeCode: programmes.code,
      departmentId: departments.id,
      departmentName: departments.name,
    })
    .from(tutorSections)
    .innerJoin(sections, eq(tutorSections.sectionId, sections.id))
    .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .innerJoin(departments, eq(programmes.departmentId, departments.id))
    .where(eq(tutorSections.tutorId, session.userId))
    .orderBy(programmes.name, desc(academicBatches.admissionYear), sections.label);

  if (assignments.length === 0) return [];

  const sectionIds = assignments.map((a) => a.id);
  const batchIds = Array.from(new Set(assignments.map((a) => a.batchId)));

  // Student counts
  const studentCountRows = await db
    .select({
      sectionId: users.sectionId,
      count: count(),
    })
    .from(users)
    .where(
      and(
        eq(users.role, "STUDENT"),
        eq(users.isActive, true),
        inArray(users.sectionId, sectionIds)
      )
    )
    .groupBy(users.sectionId);

  const studentCountMap = new Map(
    studentCountRows
      .filter((r): r is { sectionId: string; count: number } => Boolean(r.sectionId))
      .map((r) => [r.sectionId, r.count])
  );

  // Active sessions / Year Servers for these cohorts
  const sessionTermRows = await db
    .select({
      batchId: cohortSessionTerms.academicBatchId,
      sessionId: academicSessions.id,
      startYear: academicSessions.startYear,
      endYear: academicSessions.endYear,
      status: academicSessions.status,
      studyYear: cohortSessionTerms.studyYear,
      semester: cohortSessionTerms.currentSemester,
    })
    .from(cohortSessionTerms)
    .innerJoin(academicSessions, eq(cohortSessionTerms.academicSessionId, academicSessions.id))
    .where(
      and(
        inArray(cohortSessionTerms.academicBatchId, batchIds),
        ne(academicSessions.status, "ARCHIVED")
      )
    );

  const sessionTermsByBatch = new Map<string, typeof sessionTermRows>();
  for (const row of sessionTermRows) {
    const list = sessionTermsByBatch.get(row.batchId) || [];
    list.push(row);
    sessionTermsByBatch.set(row.batchId, list);
  }

  return assignments.map((a) => {
    const activeTerms = sessionTermsByBatch.get(a.batchId) || [];
    const activeSessions = activeTerms.map((t) => ({
      id: t.sessionId,
      label: `${t.startYear} Academic Timeline`,
      studyYear: t.studyYear,
      semester: t.semester,
    }));

    const years = cohortYears({
      admissionYear: a.admissionYear,
      expectedEndYear: a.expectedEndYear,
      legacyYear: a.batchYear,
    });

    const label = cohortLabel({
      programmeName: a.programmeName,
      programmeCode: a.programmeCode,
      sectionLabel: a.label,
      admissionYear: a.admissionYear,
      expectedEndYear: a.expectedEndYear,
      legacyYear: a.batchYear,
    });

    return {
      id: a.id,
      label: a.label,
      batch: a.batchYear,
      batchId: a.batchId,
      batchYear: a.batchYear,
      admissionYear: a.admissionYear,
      expectedEndYear: a.expectedEndYear,
      cohortYears: years,
      programme: a.programmeName,
      programmeId: a.programmeId,
      programmeName: a.programmeName,
      programmeCode: a.programmeCode,
      department: a.departmentName,
      departmentId: a.departmentId,
      departmentName: a.departmentName,
      studentCount: studentCountMap.get(a.id) ?? 0,
      classLabel: label,
      activeSessions,
    };
  });
}

export async function exitTutorSection(sectionId: string) {
  const session = await assertStaffBase();

  // Verify that the tutor actually manages this section
  const [existing] = await db
    .select()
    .from(tutorSections)
    .where(
      and(
        eq(tutorSections.tutorId, session.userId),
        eq(tutorSections.sectionId, sectionId)
      )
    );

  if (!existing) {
    throw new Error("You are not assigned to this section.");
  }

  // Remove the assignment
  await db
    .delete(tutorSections)
    .where(
      and(
        eq(tutorSections.tutorId, session.userId),
        eq(tutorSections.sectionId, sectionId)
      )
    );

  // If this was their primary user section, clear or update it
  const [userRecord] = await db.select({ sectionId: users.sectionId }).from(users).where(eq(users.id, session.userId));
  if (userRecord?.sectionId === sectionId) {
    const remaining = await db
      .select({ sectionId: tutorSections.sectionId })
      .from(tutorSections)
      .where(eq(tutorSections.tutorId, session.userId))
      .limit(1);

    await db
      .update(users)
      .set({ sectionId: remaining[0]?.sectionId || null })
      .where(eq(users.id, session.userId));
  }

  // Handle active cookie
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const activeSectionCookie = cookieStore.get("electify_active_section")?.value;

    if (activeSectionCookie === sectionId) {
      const remaining = await db
        .select({ sectionId: tutorSections.sectionId })
        .from(tutorSections)
        .where(eq(tutorSections.tutorId, session.userId))
        .limit(1);

      if (remaining.length > 0) {
        cookieStore.set("electify_active_section", remaining[0].sectionId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 7200,
        });
      } else {
        cookieStore.delete("electify_active_section");
      }
    }
  } catch {}

  // Audit log
  await db.insert(auditLogs).values({
    action: "EXIT_TUTOR_SECTION",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: {
      sectionId,
    },
  });

  try {
    const cache = (await import("next/cache")) as any;
    if (typeof cache.revalidatePath === "function") {
      cache.revalidatePath("/faculty/assign-sections");
      cache.revalidatePath("/faculty/dashboard");
      cache.revalidatePath("/faculty", "layout");
    }
  } catch {}

  return { success: true };
}

export async function updateMaxTutorSectionsLimit(newLimit: number) {
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") {
    throw new Error("Unauthorized. Only administrators can configure tutor section limits.");
  }
  if (!Number.isInteger(newLimit) || newLimit < 1 || newLimit > 50) {
    throw new Error("Limit must be an integer between 1 and 50.");
  }
  // Upsert: on a fresh database the settings row may not exist yet, and a plain
  // UPDATE would silently change nothing.
  await db
    .insert(systemSettings)
    .values({ id: "system", maxTutorSections: newLimit })
    .onConflictDoUpdate({ target: systemSettings.id, set: { maxTutorSections: newLimit, updatedAt: new Date() } });

  await db.insert(auditLogs).values({
    action: "UPDATE_SYSTEM_SETTINGS",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { maxTutorSections: newLimit },
  });

  return { success: true, maxTutorSections: newLimit };
}

export async function manualRegisterStudentByTutor(studentId: string, eventId: string, selections: { groupId: string; electiveId: string }[]) {
  const session = await assertTutor();
  const scopedEvent = await assertEventAccess(session, eventId);

  // Verify event is closed
  const [event] = await db
    .select()
    .from(registrationEvents)
    .where(eq(registrationEvents.id, eventId))
    .limit(1);
    
  if (!event) throw new Error("Event not found.");
  
  const now = new Date();
  const isEnded = 
    (event.closeDate && now > event.closeDate) || 
    event.status === "CLOSED" || 
    event.status === "VERIFICATION" || 
    event.status === "FINALIZED";

  if (!isEnded) {
    throw new Error("Manual registration is only allowed after the registration window has closed.");
  }

  // The student must be in a class of this event that the user manages.
  const [student] = await db
    .select({
      name: users.name,
      role: users.role,
      registerNumber: users.registerNumber,
      email: users.email,
      sectionId: users.sectionId,
      sectionName: sections.label,
      programmeName: programmes.name,
      departmentName: departments.name,
      admissionYear: academicBatches.admissionYear,
      expectedEndYear: academicBatches.expectedEndYear,
      legacyYear: academicBatches.year,
    })
    .from(users)
    .leftJoin(sections, eq(users.sectionId, sections.id))
    .leftJoin(academicBatches, eq(users.academicBatchId, academicBatches.id))
    .leftJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .leftJoin(departments, eq(programmes.departmentId, departments.id))
    .where(eq(users.id, studentId))
    .limit(1);

  if (!student || student.role !== "STUDENT" || !student.sectionId || !scopedEvent.classes.some((c) => c.sectionId === student.sectionId)) {
    throw new Error("Student not found in a class of this event that you manage.");
  }
  const studentSectionId = student.sectionId;

  // Selections: in this event, one per basket, no duplicates
  const eventGroups = await db.select().from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
  const groupById = new Map(eventGroups.map((g) => [g.id, g]));
  const seenGroups = new Set<string>();
  const seenElectives = new Set<string>();
  if (!Array.isArray(selections) || selections.length === 0) throw new Error("Choose at least one elective.");
  for (const sel of selections) {
    if (!groupById.has(sel.groupId)) throw new Error("A choice does not belong to this registration event.");
    if (seenGroups.has(sel.groupId) || seenElectives.has(sel.electiveId)) throw new Error("Choose one elective per basket.");
    seenGroups.add(sel.groupId);
    seenElectives.add(sel.electiveId);
  }

  const classLabel = cohortLabel({
    programmeName: student.programmeName ?? "Class",
    sectionLabel: student.sectionName ?? "",
    admissionYear: student.admissionYear,
    expectedEndYear: student.expectedEndYear,
    legacyYear: student.legacyYear,
  });

  await db.transaction(async (tx) => {
    // Re-check eligibility on the transaction snapshot
    if (!(await isStudentEligibleForEvent(tx, studentId, eventId))) {
      throw new Error("This registration event is not open to the student's class.");
    }

    const [existingReg] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
      .limit(1)
      .for("update");

    if (existingReg && existingReg.status === "CONFIRMED") {
      throw new Error("Student is already registered.");
    }

    const studentDetails = {
      name: student.name,
      registerNumber: student.registerNumber || "N/A",
      email: student.email,
      department: student.departmentName || "N/A",
      degree: student.programmeName || "N/A",
      section: student.sectionName || "N/A",
    };

    // Lock chosen electives in id order (same order as student registration)
    const ordered = [...selections].sort((a, b) => a.electiveId.localeCompare(b.electiveId));
    const lockedElectives = await tx
      .select()
      .from(electives)
      .where(inArray(electives.id, ordered.map((s) => s.electiveId)))
      .orderBy(asc(electives.id))
      .for("update");

    const lockedElectivesMap = new Map(lockedElectives.map((e) => [e.id, e]));
    const electiveSnapshots: { groupName: string; electiveName: string; status: "CONFIRMED" }[] = [];

    for (const sel of ordered) {
      const elective = lockedElectivesMap.get(sel.electiveId);
      if (!elective || !elective.isActive) throw new Error("Selected elective is invalid.");
      if (elective.groupId !== sel.groupId) throw new Error("Elective does not belong to the chosen basket.");

      try {
        await takeSeat(tx, elective, studentSectionId);
      } catch (err) {
        if (err instanceof SeatTakenError) throw new Error(`No seats are left in ${elective.name} for this class.`);
        throw err;
      }

      const name = elective.courseCode ? `${elective.courseCode} - ${elective.name}` : elective.name;
      electiveSnapshots.push({ groupName: groupById.get(sel.groupId)?.name || "Unknown Group", electiveName: name, status: "CONFIRMED" });

      // A previously cancelled choice for this basket is reused.
      await tx
        .insert(studentRegistrations)
        .values({ studentId, eventId, groupId: sel.groupId, electiveId: sel.electiveId, status: "CONFIRMED", isLocked: true })
        .onConflictDoUpdate({
          target: [studentRegistrations.studentId, studentRegistrations.eventId, studentRegistrations.groupId],
          set: { electiveId: sel.electiveId, status: "CONFIRMED", isLocked: true, submittedAt: new Date(), updatedAt: new Date() },
        });

      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId,
        studentName: student.name,
        eventType: "MANUAL_REGISTRATION_BY_TUTOR",
        subjectId: sel.electiveId,
        subjectName: name,
        seatBefore: elective.availableSeats,
        seatAfter: elective.availableSeats - 1,
        performedBy: session.userId,
      });
    }

    // Manual receipts have their own sequence; the lock prevents duplicates.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('electify_manual_receipt_number'))`);
    const year = new Date().getFullYear();
    const [seqRow] = await tx
      .select({ maxSeq: sql<number>`COALESCE(MAX(CAST(NULLIF(SUBSTRING(${registrations.receiptNumber} FROM '^ELC-[0-9]+-MAN-([0-9]+)$'), '') AS BIGINT)), 0)` })
      .from(registrations);
    const nextSeq = Number(seqRow?.maxSeq || 0) + 1;
    const receiptNumber = `ELC-${year}-MAN-${String(nextSeq).padStart(6, "0")}`;

    const receiptSnapshot = {
      receiptNumber,
      submittedAt: new Date().toISOString(),
      student: studentDetails,
      academic: {
        eventId,
        eventName: scopedEvent.name,
        classLabel,
        sectionId: studentSectionId,
        academicBatchId: scopedEvent.academicBatchId,
        academicSession: session.workspace.session.label,
        academicSessionId: scopedEvent.academicSessionId,
        semester: scopedEvent.semester,
      },
      electives: electiveSnapshots,
      registeredByTutor: true,
    };

    if (existingReg) {
      await tx
        .update(registrations)
        .set({ status: "CONFIRMED", receiptNumber, receiptSnapshot, submittedAt: new Date(), updatedAt: new Date() })
        .where(eq(registrations.id, existingReg.id));
    } else {
      await tx.insert(registrations).values({ studentId, eventId, status: "CONFIRMED", receiptNumber, receiptSnapshot, submittedAt: new Date() });
    }

    await tx.insert(auditLogs).values({
      action: "MANUAL_STUDENT_REGISTRATION",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: { studentId, eventId, selections, sectionId: studentSectionId, academicSessionId: scopedEvent.academicSessionId },
    });
  });
}

// ────────────────────────────────────────────────────────────────────
// CLASS SIGNUP CODE MANAGEMENT & PASSWORD RESET AUTHORIZATIONS
// ────────────────────────────────────────────────────────────────────

/**
 * Creates an illustrative, secure Class Signup Code for the tutor's section (e.g. EF-MCA-F-7X9K).
 * Hard server-side limit of 100 successful activations.
 */
export async function createClassSignupCode(params?: {
  sectionId?: string;
  maxActivations?: number;
  expiryDays?: number;
}) {
  const session = await assertTutor();
  // The code is scoped to exactly one class the user manages in the selected session.
  const target = assertClass(session.workspace, params?.sectionId || session.sectionId);
  const targetSectionId = target.sectionId;

  // Fetch section hierarchy
  const [sectionData] = await db
    .select({
      sectionId: sections.id,
      sectionLabel: sections.label,
      academicBatchId: sections.academicBatchId,
      programmeId: academicBatches.programmeId,
      programmeName: programmes.name,
      programmeCode: programmes.code,
      departmentId: programmes.departmentId,
      facultyId: departments.facultyId,
    })
    .from(sections)
    .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .innerJoin(departments, eq(programmes.departmentId, departments.id))
    .where(eq(sections.id, targetSectionId))
    .limit(1);

  if (!sectionData) {
    throw new Error("Section record not found.");
  }

  // Hard server-side limit: default 100, capped at 100
  const maxActivations = Math.min(Math.max(1, params?.maxActivations || 100), 100);
  const expiryDays = Math.max(1, Math.min(90, params?.expiryDays || 14));
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  // Generate unique code in format EF-[PROG]-[SEC]-[RAND4]
  let generatedCode = "";
  let isUnique = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateClassSignupCode(sectionData.programmeCode, sectionData.sectionLabel);
    const [existing] = await db
      .select({ id: inviteCodes.id })
      .from(inviteCodes)
      .where(eq(inviteCodes.code, candidate))
      .limit(1);
    if (!existing) {
      generatedCode = candidate;
      isUnique = true;
      break;
    }
  }

  if (!isUnique || !generatedCode) {
    generatedCode = generateClassSignupCode(sectionData.programmeCode, sectionData.sectionLabel) + Math.floor(Math.random() * 90 + 10);
  }

  const [newCode] = await db
    .insert(inviteCodes)
    .values({
      code: generatedCode,
      role: "STUDENT",
      facultyId: sectionData.facultyId,
      departmentId: sectionData.departmentId,
      programmeId: sectionData.programmeId,
      academicBatchId: sectionData.academicBatchId,
      sectionId: sectionData.sectionId,
      createdById: session.userId,
      expiresAt,
      maxUses: maxActivations,
      usedCount: 0,
      status: "ACTIVE",
    })
    .returning();

  // Audit log
  await db.insert(auditLogs).values({
    action: "CLASS_CODE_CREATED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: {
      code: newCode.code,
      sectionId: targetSectionId,
      academicBatchId: target.batchId,
      classLabel: target.label,
      programme: sectionData.programmeName,
      maxActivations,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return {
    success: true,
    code: newCode.code,
    id: newCode.id,
    maxUses: newCode.maxUses,
    expiresAt: newCode.expiresAt,
  };
}

/**
 * Returns class signup codes created for or associated with the tutor's section.
 */
/** Class signup codes for the classes this user manages in the selected academic session. */
export async function getClassSignupCodesForTutor(sectionId?: string) {
  const session = await assertTutor();
  const ws = session.workspace;
  const authorizedSectionIds = sectionId ? [assertClass(ws, sectionId).sectionId] : ws.classes.map((c) => c.sectionId);
  if (authorizedSectionIds.length === 0) return [];

  const list = await db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      role: inviteCodes.role,
      status: inviteCodes.status,
      maxUses: inviteCodes.maxUses,
      usedCount: inviteCodes.usedCount,
      expiresAt: inviteCodes.expiresAt,
      createdAt: inviteCodes.createdAt,
      sectionId: inviteCodes.sectionId,
      createdById: inviteCodes.createdById,
      sectionLabel: sections.label,
      programmeName: programmes.name,
      programmeCode: programmes.code,
      departmentName: departments.name,
      tutorName: users.name,
    })
    .from(inviteCodes)
    .leftJoin(sections, eq(inviteCodes.sectionId, sections.id))
    .leftJoin(programmes, eq(inviteCodes.programmeId, programmes.id))
    .leftJoin(departments, eq(inviteCodes.departmentId, departments.id))
    .leftJoin(users, eq(inviteCodes.createdById, users.id))
    .where(and(eq(inviteCodes.role, "STUDENT"), inArray(inviteCodes.sectionId, authorizedSectionIds)))
    .orderBy(desc(inviteCodes.createdAt));

  const now = new Date();
  const labelOf = new Map(ws.classes.map((c) => [c.sectionId, c.label]));

  // Auto-mark expired records
  return list.map((item) => {
    let effectiveStatus = item.status;
    if (item.status === "ACTIVE" && item.expiresAt < now) {
      effectiveStatus = "EXPIRED";
    } else if (item.status === "ACTIVE" && item.usedCount >= item.maxUses) {
      effectiveStatus = "USED";
    }
    return {
      ...item,
      classLabel: (item.sectionId && labelOf.get(item.sectionId)) || item.sectionLabel,
      status: effectiveStatus,
    };
  });
}

/**
 * Revokes a class signup code so no more students can use it. Only for codes
 * of a class the user manages in the selected academic session.
 */
export async function revokeClassSignupCode(codeId: string) {
  const session = await assertTutor();

  const [code] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.id, codeId))
    .limit(1);

  if (!code || code.role !== "STUDENT") {
    throw new Error("Class code not found.");
  }
  assertClass(session.workspace, code.sectionId);

  await db
    .update(inviteCodes)
    .set({ status: "REVOKED" })
    .where(eq(inviteCodes.id, codeId));

  await db.insert(auditLogs).values({
    action: "CLASS_CODE_REVOKED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: { codeId, code: code.code, sectionId: code.sectionId },
  });

  return { success: true };
}

/** Sections whose students this staff member may manage password resets for. */
async function resetSectionScope(session: Awaited<ReturnType<typeof assertStaffBase>>) {
  if (session.role === "SYSTEM_ADMIN") return { all: true, sectionIds: [] as string[] };
  const assigned = await db
    .select({ sectionId: tutorSections.sectionId })
    .from(tutorSections)
    .where(eq(tutorSections.tutorId, session.userId));
  const sectionIds = assigned.map((s) => s.sectionId);
  if (session.sectionId && !sectionIds.includes(session.sectionId)) sectionIds.push(session.sectionId);
  return { all: false, sectionIds };
}

/** Loads a reset request and checks it belongs to a section this staff member manages. */
async function loadAuthorizedResetRequest(session: Awaited<ReturnType<typeof assertStaffBase>>, requestId: string) {
  const [req] = await db
    .select()
    .from(passwordResetRequests)
    .where(eq(passwordResetRequests.id, requestId))
    .limit(1);

  if (!req) throw new Error("Password reset request not found.");

  const scope = await resetSectionScope(session);
  if (!scope.all && (!req.sectionId || !scope.sectionIds.includes(req.sectionId))) {
    // Same message as a missing request, so ids from other sections reveal nothing.
    throw new Error("Password reset request not found.");
  }
  return req;
}

/**
 * Retrieves password reset requests for the tutor's sections.
 */
export async function getPendingPasswordResetsForTutor(sectionId?: string) {
  const session = await assertStaffBase();
  const targetSectionId = sectionId || session.sectionId;

  const { ensureDatabaseReady } = await import("@/lib/db");
  await ensureDatabaseReady();

  // Tutors see every section they manage; admins see the section they are looking at.
  const scope = await resetSectionScope(session);
  const sectionIds = scope.all ? (targetSectionId ? [targetSectionId] : []) : scope.sectionIds;
  if (sectionIds.length === 0) return [];

  const requests = await db
    .select({
      id: passwordResetRequests.id,
      studentId: passwordResetRequests.studentId,
      sectionId: passwordResetRequests.sectionId,
      tutorId: passwordResetRequests.tutorId,
      status: passwordResetRequests.status,
      resetToken: passwordResetRequests.resetToken,
      tokenExpiresAt: passwordResetRequests.tokenExpiresAt,
      authorizedAt: passwordResetRequests.authorizedAt,
      completedAt: passwordResetRequests.completedAt,
      createdAt: passwordResetRequests.createdAt,
      studentName: users.name,
      studentEmail: users.email,
      registerNumber: users.registerNumber,
      sectionLabel: sections.label,
    })
    .from(passwordResetRequests)
    .innerJoin(users, eq(passwordResetRequests.studentId, users.id))
    .leftJoin(sections, eq(passwordResetRequests.sectionId, sections.id))
    .where(inArray(passwordResetRequests.sectionId, sectionIds))
    .orderBy(desc(passwordResetRequests.createdAt));

  return requests;
}

/** RST- plus 6 characters from an unambiguous alphabet, from a cryptographic source. */
function generateResetCode() {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[randomInt(chars.length)];
  return `RST-${code}`;
}

/**
 * Authorizes a student's password reset request and generates an expiring authorization code.
 * Only for requests from a section the caller manages (any section for admins).
 */
export async function authorizeStudentPasswordReset(requestId: string) {
  const session = await assertStaffBase();

  const { ensureDatabaseReady } = await import("@/lib/db");
  await ensureDatabaseReady();

  const req = await loadAuthorizedResetRequest(session, requestId);

  if (req.status !== "PENDING" && req.status !== "AUTHORIZED") {
    throw new Error(`Cannot authorize request in status: ${req.status}`);
  }

  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  let resetToken = "";
  for (let attempt = 0; ; attempt++) {
    resetToken = generateResetCode();
    try {
      await db
        .update(passwordResetRequests)
        .set({
          status: "AUTHORIZED",
          tutorId: session.userId,
          resetToken,
          tokenExpiresAt,
          authorizedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(passwordResetRequests.id, requestId));
      break;
    } catch (err) {
      // reset_token is unique; try a fresh code on the rare collision
      if (attempt >= 2) throw err;
    }
  }

  await db.insert(auditLogs).values({
    action: "PASSWORD_RESET_AUTHORIZED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    // The code itself is a credential and is not logged.
    metadata: {
      requestId,
      studentId: req.studentId,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
    },
  });

  return { success: true, resetToken, expiresAt: tokenExpiresAt };
}

/**
 * Rejects an unverified student password reset request.
 */
export async function rejectStudentPasswordReset(requestId: string, reason?: string) {
  const session = await assertStaffBase();

  const { ensureDatabaseReady } = await import("@/lib/db");
  await ensureDatabaseReady();

  const req = await loadAuthorizedResetRequest(session, requestId);

  await db
    .update(passwordResetRequests)
    .set({
      status: "REJECTED",
      tutorId: session.userId,
      updatedAt: new Date(),
    })
    .where(eq(passwordResetRequests.id, requestId));

  await db.insert(auditLogs).values({
    action: "PASSWORD_RESET_REJECTED",
    userId: session.userId,
    userEmail: session.email,
    userRole: session.role,
    metadata: {
      requestId,
      studentId: req.studentId,
      reason: reason || "Identity not verified",
    },
  });

  return { success: true };
}
