"use server";

import { db } from "@/lib/db";
import {
  users, electives, electiveGroups, registrationEvents, tutorSections,
  studentRegistrations, eventSections, sections, programmes, academicBatches, auditLogs, registrations, departments,
  replayEvents
} from "@/lib/db/schema";
import { getSession } from "@/lib/auth";
import { eq, and, asc, count, desc, inArray, notInArray, sql } from "drizzle-orm";

async function assertTutor() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) throw new Error("Unauthorized");

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

  return session;
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
    .where(eq(users.sectionId, session.sectionId))
    .orderBy(asc(users.name));
}

// ── Tutor Electives ───────────────────────────────────────────────────────

export async function getTutorElectives() {
  const session = await assertTutor();
  if (!session.sectionId) return [];

  const sectionEvents = await db
    .select({ eventId: eventSections.eventId })
    .from(eventSections)
    .where(eq(eventSections.sectionId, session.sectionId));

  if (sectionEvents.length === 0) return [];

  const eventIds = sectionEvents.map(se => se.eventId);

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

export async function getTutorReports() {
  const session = await assertTutor();
  if (!session.sectionId) return { students: [], totalStudents: 0, registeredCount: 0, sectionLabel: "", programmeName: "", departmentName: "", groups: [] };

  // Fetch section metadata for PDF header and event details
  const [sectionMeta] = await db
    .select({
      sectionLabel: sections.label,
      programmeName: programmes.name,
      departmentName: departments.name,
      eventId: eventSections.eventId,
      eventStatus: registrationEvents.status,
      eventCloseDate: registrationEvents.closeDate,
    })
    .from(sections)
    .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .innerJoin(departments, eq(programmes.departmentId, departments.id))
    .leftJoin(eventSections, eq(sections.id, eventSections.sectionId))
    .leftJoin(registrationEvents, eq(eventSections.eventId, registrationEvents.id))
    .where(eq(sections.id, session.sectionId))
    .limit(1);

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
    .where(and(eq(users.role, "STUDENT"), eq(users.sectionId, session.sectionId)))
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
    .where(eq(users.sectionId, session.sectionId));

  // Fetch confirmed status from registrations table
  const confirmedRegs = await db
    .select({
      studentId: registrations.studentId,
      status: registrations.status,
      receiptNumber: registrations.receiptNumber,
      submittedAt: registrations.submittedAt,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.studentId, users.id))
    .where(eq(users.sectionId, session.sectionId));

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
    eventStatus: effectiveEventStatus || "CLOSED",
    availableElectives,
  };
}

// ── Reg Control Center ─────────────────────────────────────────────────────────

export async function getPortalWindow() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (session.role === "CLASS_TUTOR") {
    const verifiedSession = await assertTutor();
    if (!verifiedSession.sectionId) return [];
  }

  // Fetch event IDs related to sections or overall events depending on role
  let eventIds: string[] = [];

  if (session.role === "CLASS_TUTOR" && session.sectionId) {
    const sectionEvents = await db
      .select({ eventId: eventSections.eventId })
      .from(eventSections)
      .where(eq(eventSections.sectionId, session.sectionId));
    eventIds = sectionEvents.map(se => se.eventId);
  } else {
    // For Admin / Coordinator, fetch all events
    const allEvents = await db.select({ id: registrationEvents.id }).from(registrationEvents);
    eventIds = allEvents.map(e => e.id);
  }

  if (eventIds.length === 0) return [];

  const [events, allGroups] = await Promise.all([
    db.select({
      id: registrationEvents.id,
      name: registrationEvents.name,
      academicYear: registrationEvents.academicYear,
      status: registrationEvents.status,
      openDate: registrationEvents.openDate,
      closeDate: registrationEvents.closeDate,
      description: registrationEvents.description,
    })
    .from(registrationEvents)
    .where(inArray(registrationEvents.id, eventIds)),
    
    db.select({ eventId: electiveGroups.eventId })
      .from(electiveGroups)
      .where(inArray(electiveGroups.eventId, eventIds))
  ]);

  return events.map(event => {
    const groupCount = allGroups.filter(g => g.eventId === event.id).length;
    return { ...event, groupCount };
  });
}

export async function getRegistrationMetrics(eventId: string) {
  const session = await assertTutor();
  if (!session.sectionId) return null;

  // 1. Total students in section vs registered
  const totalStudentsRes = await db.select({ count: count() }).from(users).where(and(eq(users.sectionId, session.sectionId), eq(users.role, "STUDENT"), eq(users.isActive, true)));
  const registeredStudentsRes = await db.select({ count: count() }).from(registrations).where(and(eq(registrations.eventId, eventId), eq(registrations.status, "CONFIRMED")));

  const totalStudents = totalStudentsRes[0].count;
  const registeredStudents = registeredStudentsRes[0].count;

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
    .where(and(eq(registrations.eventId, eventId), eq(registrations.status, "CONFIRMED")));

  const subjectCounts: Record<string, number> = {};
  const hourCounts: Record<string, number> = {};

  for (const reg of allRegistrations) {
    if (reg.submittedAt) {
      const hour = new Date(reg.submittedAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    if (reg.receiptSnapshot && typeof reg.receiptSnapshot === 'object') {
      const snap = reg.receiptSnapshot as any;
      if (snap.electives && Array.isArray(snap.electives)) {
        for (const el of snap.electives) {
          subjectCounts[el.electiveName] = (subjectCounts[el.electiveName] || 0) + 1;
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
      const ampm = h >= 12 ? 'PM' : 'AM';
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
    const c = subjectCounts[name] || 0;
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

export async function createRegistrationWindow(data: { name: string; academicYear: string; description?: string }) {
  const session = await assertTutor();
  if (!session.sectionId || !session.academicBatchId || !session.programmeId || !session.departmentId) {
    throw new Error("Missing assignment data (section/programme/department)");
  }

  // Check if a window already exists for this section to prevent duplicates
  const existing = await db
    .select({ id: eventSections.eventId })
    .from(eventSections)
    .where(eq(eventSections.sectionId, session.sectionId));

  if (existing.length > 0) {
    throw new Error("A registration window already exists for your section.");
  }

  const [newEvent] = await db
    .insert(registrationEvents)
    .values({
      name: data.name,
      academicYear: data.academicYear,
      description: data.description,
      academicBatchId: session.academicBatchId,
      createdById: session.userId,
      status: "DRAFT",
    })
    .returning();

  await db.insert(eventSections).values({
    eventId: newEvent.id,
    sectionId: session.sectionId,
  });

  return newEvent;
}

export async function updateWindowTimers(eventId: string, openDate: Date | null, closeDate: Date | null) {
  const session = await assertTutor();

  // Basic authorization: Verify the event belongs to this tutor's section
  const [eventLink] = await db
    .select()
    .from(eventSections)
    .where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId!)));

  if (!eventLink) throw new Error("Unauthorized to edit this window.");

  // Determine status based on dates relative to now
  const now = new Date();
  let status: string;

  if (!openDate && !closeDate) {
    status = "DRAFT";
  } else if (closeDate && now >= closeDate) {
    status = "CLOSED";
  } else if (openDate && now >= openDate) {
    status = "OPEN";
  } else {
    // openDate is in the future
    status = "PUBLISHED";
  }

  await db
    .update(registrationEvents)
    .set({ openDate, closeDate, status, updatedAt: new Date() })
    .where(eq(registrationEvents.id, eventId));
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

  // Default password is their register number, securely hashed.
  // Note: System architecture enforces server-side validation.
  const hashed = await bcrypt.hash(data.registerNumber.toUpperCase().trim(), 12);

  await db.insert(users).values({
    name: data.name.trim(),
    email: data.email.toLowerCase().trim(),
    registerNumber: data.registerNumber.trim(),
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
  const [student] = await db.select({ email: users.email }).from(users).where(and(eq(users.id, studentId), eq(users.sectionId, session.sectionId!)));
  if (!student) throw new Error("Student not found.");

  // Use a transaction to unlock registrations
  await db.transaction(async (tx) => {
    const conditions = [eq(studentRegistrations.studentId, studentId)];
    if (eventId) {
       const [eventLink] = await tx.select().from(eventSections).where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId!)));
       if (!eventLink) throw new Error("Unauthorized access to this event.");
       conditions.push(eq(studentRegistrations.eventId, eventId));
    }

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
        eventId: eventId || "ALL_EVENTS",
      },
    });
  });
}

export async function resetSectionSubjects(eventId: string) {
  const session = await assertTutor();
  const [eventLink] = await db.select().from(eventSections).where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");
  await db.delete(electiveGroups).where(eq(electiveGroups.eventId, eventId));
}

export async function createElectiveGroup(eventId: string, name: string) {
  const session = await assertTutor();
  const [eventLink] = await db
    .select()
    .from(eventSections)
    .where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

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
  
  // Verify group belongs to tutor's section event
  const [group] = await db
    .select({ eventId: electiveGroups.eventId })
    .from(electiveGroups)
    .where(eq(electiveGroups.id, groupId));
  if (!group) throw new Error("Group not found");

  const [eventLink] = await db
    .select()
    .from(eventSections)
    .where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

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
      registerNumber: s.registerNumber.trim(),
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
  // Ensure the elective belongs to a group managed by the tutor's section event
  const [elective] = await db.select({ groupId: electives.groupId }).from(electives).where(eq(electives.id, id));
  if (!elective) throw new Error("Elective not found.");

  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, elective.groupId));
  if (!group) throw new Error("Group not found.");

  const [eventLink] = await db.select().from(eventSections).where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

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

  const [eventLink] = await db.select().from(eventSections).where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

  // Delete registrations associated with this elective first
  await db.transaction(async (tx) => {
    await tx.delete(studentRegistrations).where(eq(studentRegistrations.electiveId, id));
    await tx.delete(electives).where(eq(electives.id, id));
  });
}

export async function updateElectiveGroup(id: string, name: string) {
  const session = await assertTutor();
  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, id));
  if (!group) throw new Error("Group not found.");

  const [eventLink] = await db.select().from(eventSections).where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

  await db.update(electiveGroups).set({ name: name.trim() }).where(eq(electiveGroups.id, id));
}

export async function deleteElectiveGroup(id: string) {
  const session = await assertTutor();
  const [group] = await db.select({ eventId: electiveGroups.eventId }).from(electiveGroups).where(eq(electiveGroups.id, id));
  if (!group) throw new Error("Group not found.");

  const [eventLink] = await db.select().from(eventSections).where(and(eq(eventSections.eventId, group.eventId), eq(eventSections.sectionId, session.sectionId!)));
  if (!eventLink) throw new Error("Unauthorized");

  // Cascade delete logic: electives have a foreign key to group. 
  // However, we should also clean up registrations.
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
    registerNumber: data.registerNumber.trim(),
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

  // Use a transaction to refund seats and delete registrations before deleting student
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(studentRegistrations).where(eq(studentRegistrations.studentId, id));
    
    // Refund seats
    for (const reg of existing) {
      const [elective] = await tx.select({ availableSeats: electives.availableSeats }).from(electives).where(eq(electives.id, reg.electiveId));
      if (elective) {
        await tx.update(electives).set({ 
          availableSeats: elective.availableSeats + 1,
          isFull: false 
        }).where(eq(electives.id, reg.electiveId));
      }
    }

    await tx.delete(studentRegistrations).where(eq(studentRegistrations.studentId, id));
    await tx.delete(registrations).where(eq(registrations.studentId, id));
    await tx.delete(users).where(eq(users.id, id));
  });
}

export async function deleteMultipleStudentsTutor(ids: string[]) {
  const session = await assertTutor();
  if (!ids || ids.length === 0) return;

  const validStudents = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.sectionId, session.sectionId!), eq(users.role, "STUDENT")));
  const validIds = validStudents.map(s => s.id);
  
  if (validIds.length === 0) return;

  await db.transaction(async (tx) => {
    // We should refund seats before deleting registrations
    const existing = await tx.select().from(studentRegistrations).where(inArray(studentRegistrations.studentId, validIds));
    
    for (const reg of existing) {
      const [elective] = await tx.select({ availableSeats: electives.availableSeats }).from(electives).where(eq(electives.id, reg.electiveId));
      if (elective) {
        await tx.update(electives).set({ 
          availableSeats: elective.availableSeats + 1,
          isFull: false 
        }).where(eq(electives.id, reg.electiveId));
      }
    }

    await tx.delete(studentRegistrations).where(inArray(studentRegistrations.studentId, validIds));
    await tx.delete(registrations).where(inArray(registrations.studentId, validIds));
    await tx.delete(users).where(inArray(users.id, validIds));
  });
}

export async function resetSectionRegistrationEvent(eventIdParam?: string) {
  const session = await assertTutor();
  if (!session.sectionId) throw new Error("No section assigned.");

  await db.transaction(async (tx) => {
    // 1. Fetch all registrations for students in this tutor's section
    const existingRegistrationsQuery = tx
      .select({ 
        studentId: studentRegistrations.studentId, 
        electiveId: studentRegistrations.electiveId,
        eventId: studentRegistrations.eventId 
      })
      .from(studentRegistrations)
      .innerJoin(users, eq(studentRegistrations.studentId, users.id))
      .where(
        eventIdParam 
          ? and(eq(users.sectionId, session.sectionId!), eq(studentRegistrations.eventId, eventIdParam))
          : eq(users.sectionId, session.sectionId!)
      );

    const existingRegistrations = await existingRegistrationsQuery;

    if (existingRegistrations.length === 0) return; // Nothing to reset

    const validStudentIds = existingRegistrations.map(r => r.studentId);
    const uniqueEventIds = Array.from(new Set(existingRegistrations.map(r => r.eventId)));
    
    const events = await tx.select({ id: registrationEvents.id, name: registrationEvents.name }).from(registrationEvents).where(inArray(registrationEvents.id, uniqueEventIds));
    const eventNames = events.map(e => e.name).join(", ");

    // 2. Refund all seats for these electives
    const counts: Record<string, { count: number; eventId: string }> = {};
    for (const reg of existingRegistrations) {
      if (!counts[reg.electiveId]) counts[reg.electiveId] = { count: 0, eventId: reg.eventId };
      counts[reg.electiveId].count += 1;
    }

    for (const [electiveId, data] of Object.entries(counts)) {
      const countToRefund = data.count;
      const eventId = data.eventId;
      const [elective] = await tx.select({ availableSeats: electives.availableSeats, courseCode: electives.courseCode, name: electives.name }).from(electives).where(eq(electives.id, electiveId));
      if (elective) {
        await tx.update(electives).set({ 
          availableSeats: elective.availableSeats + countToRefund,
          isFull: false 
        }).where(eq(electives.id, electiveId));

        await tx.insert(replayEvents).values({
          registrationEventId: eventId,
          eventType: "REGISTRATION_RESET",
          subjectId: electiveId,
          subjectName: elective.courseCode ? `${elective.courseCode} - ${elective.name}` : elective.name,
          seatBefore: elective.availableSeats,
          seatAfter: elective.availableSeats + countToRefund,
          performedBy: session.userId,
          metadata: { countRefunded: countToRefund }
        });
      }
    }

    // 3. Delete all registrations (individual selections) and preserve status
    await tx.delete(studentRegistrations).where(inArray(studentRegistrations.studentId, validStudentIds));

    await tx
      .update(registrations)
      .set({
        status: "RESET_BY_COORDINATOR",
        receiptNumber: null,
        receiptSnapshot: null,
        updatedAt: new Date(),
      })
      .where(and(inArray(registrations.eventId, uniqueEventIds), inArray(registrations.studentId, validStudentIds)));

    // 4. Create an audit log
    await tx.insert(auditLogs).values({
      action: "RESET_SECTION_REGISTRATION_EVENT",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: {
        eventIds: uniqueEventIds,
        eventName: eventNames,
        sectionId: session.sectionId,
        clearedRegistrationsCount: existingRegistrations.length,
      },
    });
  });
}

// ── Self Onboarding ──────────────────────────────────────────────────────

export async function getAllAvailableSections() {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) throw new Error("Unauthorized");

  // Get all assigned sections across the institution
  const assigned = await db.select({ sectionId: tutorSections.sectionId }).from(tutorSections);
  const assignedIds = assigned.map(a => a.sectionId);

  const results = await db
    .select({
      id: sections.id,
      label: sections.label,
      batch: academicBatches.year,
      programme: programmes.name,
    })
    .from(sections)
    .innerJoin(academicBatches, eq(sections.academicBatchId, academicBatches.id))
    .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .where(
      and(
        assignedIds.length > 0 ? notInArray(sections.id, assignedIds) : undefined,
        session.programmeId ? eq(programmes.id, session.programmeId) : undefined,
        session.departmentId && !session.programmeId ? eq(programmes.departmentId, session.departmentId) : undefined
      )
    )
    .orderBy(programmes.name, academicBatches.year, sections.label);

  return results;
}

export async function claimTutorSection(sectionIds: string[]) {
  const session = await getSession();
  if (!session || (session.role !== "CLASS_TUTOR" && session.role !== "COURSE_COORDINATOR")) throw new Error("Unauthorized");

  if (!sectionIds || sectionIds.length === 0) {
    throw new Error("No sections selected");
  }

  // Check how many sections the tutor already has
  const existing = await db
    .select()
    .from(tutorSections)
    .where(eq(tutorSections.tutorId, session.userId));

  if (existing.length + sectionIds.length > 5) {
    throw new Error(`You can only manage up to 5 sections. You currently have ${existing.length}.`);
  }

  // Check if any of these sections are already assigned to someone else
  const alreadyAssigned = await db
    .select()
    .from(tutorSections)
    .where(inArray(tutorSections.sectionId, sectionIds));

  if (alreadyAssigned.length > 0) {
    throw new Error("One or more selected sections have already been claimed by another tutor.");
  }

  const valuesToInsert = sectionIds.map(id => ({
    tutorId: session.userId,
    sectionId: id,
  }));

  await db.insert(tutorSections).values(valuesToInsert);

  // Set the first assigned section as the active one
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  cookieStore.set("electify_active_section", sectionIds[0], {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7200,
  });
}

export async function manualRegisterStudentByTutor(studentId: string, eventId: string, selections: { groupId: string; electiveId: string }[]) {
  const session = await assertTutor();
  if (!session.sectionId) throw new Error("Unauthorized");

  // Verify event is in tutor's section
  const [eventLink] = await db
    .select()
    .from(eventSections)
    .where(and(eq(eventSections.eventId, eventId), eq(eventSections.sectionId, session.sectionId)));
  if (!eventLink) throw new Error("Unauthorized access to this event.");

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

  // Verify student is in section and hasn't registered
  const [student] = await db
    .select({
      name: users.name,
      registerNumber: users.registerNumber,
      email: users.email,
      sectionName: sections.label,
      programmeName: programmes.name,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(sections, eq(users.sectionId, sections.id))
    .leftJoin(academicBatches, eq(users.academicBatchId, academicBatches.id))
    .leftJoin(programmes, eq(academicBatches.programmeId, programmes.id))
    .leftJoin(departments, eq(programmes.departmentId, departments.id))
    .where(and(eq(users.id, studentId), eq(users.sectionId, session.sectionId)))
    .limit(1);

  if (!student) throw new Error("Student not found in your section.");

  await db.transaction(async (tx) => {
    // Check if already registered
    const [existingReg] = await tx
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
      .limit(1);

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

    const selectedElectiveIds = selections.map((s) => s.electiveId);
    
    // Lock chosen electives
    const lockedElectives = await tx
      .select()
      .from(electives)
      .where(inArray(electives.id, selectedElectiveIds))
      .for("update");

    const lockedElectivesMap = new Map(lockedElectives.map((e) => [e.id, e]));
    const electiveSnapshots: { groupName: string; electiveName: string }[] = [];

    for (const sel of selections) {
      const elective = lockedElectivesMap.get(sel.electiveId);
      if (!elective || !elective.isActive) throw new Error("Selected elective is invalid.");
      if (elective.availableSeats <= 0) throw new Error(`Seats are fully booked for elective: ${elective.name}`);

      const [group] = await tx
        .select({ name: electiveGroups.name })
        .from(electiveGroups)
        .where(eq(electiveGroups.id, sel.groupId))
        .limit(1);

      electiveSnapshots.push({
        groupName: group?.name || "Unknown Group",
        electiveName: elective.courseCode ? `${elective.courseCode} - ${elective.name}` : elective.name,
      });

      // Decrement seats
      await tx
        .update(electives)
        .set({
          availableSeats: sql`${electives.availableSeats} - 1`,
          isFull: sql`CASE WHEN ${electives.availableSeats} - 1 <= 0 THEN true ELSE false END`,
        })
        .where(eq(electives.id, sel.electiveId));

      await tx.insert(studentRegistrations).values({
        studentId,
        eventId,
        groupId: sel.groupId,
        electiveId: sel.electiveId,
        isLocked: true,
      });

      // Replay events
      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId,
        studentName: student.name,
        eventType: "MANUAL_REGISTRATION_BY_TUTOR",
        subjectId: sel.electiveId,
        subjectName: elective.courseCode ? `${elective.courseCode} - ${elective.name}` : elective.name,
        seatBefore: elective.availableSeats,
        seatAfter: elective.availableSeats - 1,
        performedBy: session.userId,
      });
    }

    const year = new Date().getFullYear();
    const [seqRow] = await tx
      .select({ maxSeq: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${registrations.receiptNumber} FROM 14) AS INTEGER)), 0)` })
      .from(registrations);
    const nextSeq = (seqRow?.maxSeq || 0) + 1;
    const receiptNumber = `ELC-${year}-MAN-${String(nextSeq).padStart(6, "0")}`; // Distinguish manual receipts

    const receiptSnapshot = {
      receiptNumber,
      submittedAt: new Date().toISOString(),
      student: studentDetails,
      electives: electiveSnapshots,
      registeredByTutor: true,
    };

    if (existingReg) {
      await tx
        .update(registrations)
        .set({
          status: "CONFIRMED",
          receiptNumber,
          receiptSnapshot,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, existingReg.id));
    } else {
      await tx.insert(registrations).values({
        studentId,
        eventId,
        status: "CONFIRMED",
        receiptNumber,
        receiptSnapshot,
        submittedAt: new Date(),
      });
    }
    
    // Audit Log
    await tx.insert(auditLogs).values({
      action: "MANUAL_STUDENT_REGISTRATION",
      userId: session.userId,
      userEmail: session.email,
      userRole: session.role,
      metadata: { studentId, eventId, selections },
    });
  });
}
