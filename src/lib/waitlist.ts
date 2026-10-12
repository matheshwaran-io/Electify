import {
  studentRegistrations,
  electives,
  electiveSeatAllocations,
  registrations,
  users,
  replayEvents,
  auditLogs,
} from "./db/schema";
import { eq, and, asc, sql, count } from "drizzle-orm";

export interface PromotionResult {
  promotedCount: number;
  promotedStudentIds: string[];
}

/**
 * Recompacts waitlist positions for an elective sequentially (1, 2, 3...)
 * after a cancellation, change, or promotion.
 */
export async function recompactWaitlistPositions(
  tx: any,
  electiveId: string
): Promise<number> {
  const remaining = await tx
    .select({
      id: studentRegistrations.id,
      studentId: studentRegistrations.studentId,
      eventId: studentRegistrations.eventId,
      waitlistPosition: studentRegistrations.waitlistPosition,
    })
    .from(studentRegistrations)
    .where(
      and(
        eq(studentRegistrations.electiveId, electiveId),
        eq(studentRegistrations.isWaitlisted, true),
        eq(studentRegistrations.status, "WAITLISTED")
      )
    )
    .orderBy(
      asc(studentRegistrations.waitlistPosition),
      asc(studentRegistrations.submittedAt),
      asc(studentRegistrations.id)
    )
    .for("update");

  let updatedCount = 0;

  for (let i = 0; i < remaining.length; i++) {
    const newPos = i + 1;
    if (remaining[i].waitlistPosition !== newPos) {
      await tx
        .update(studentRegistrations)
        .set({
          waitlistPosition: newPos,
          updatedAt: new Date(),
        })
        .where(eq(studentRegistrations.id, remaining[i].id));

      // Also update position in parent registration receiptSnapshot if present
      const [parentReg] = await tx
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.studentId, remaining[i].studentId),
            eq(registrations.eventId, remaining[i].eventId)
          )
        )
        .limit(1)
        .for("update");

      if (parentReg && parentReg.receiptSnapshot) {
        const snapshot = { ...(parentReg.receiptSnapshot as any) };
        if (Array.isArray(snapshot.electives)) {
          snapshot.electives = snapshot.electives.map((e: any) => {
            if (
              e.electiveId === electiveId ||
              (e.isWaitlisted && e.waitlistPosition === remaining[i].waitlistPosition)
            ) {
              return {
                ...e,
                waitlistPosition: newPos,
                electiveName: e.electiveName
                  ? e.electiveName.replace(/\[Waitlisted #\d+\]/, `[Waitlisted #${newPos}]`)
                  : e.electiveName,
              };
            }
            return e;
          });
          await tx
            .update(registrations)
            .set({
              receiptSnapshot: snapshot,
              updatedAt: new Date(),
            })
            .where(eq(registrations.id, parentReg.id));
        }
      }

      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Reusable server-side FIFO waitlist promotion function.
 *
 * Rules:
 * - Promotes the earliest eligible active waitlisted student first.
 * - Uses deterministic ordering: waitlist_position ASC, submitted_at ASC, id ASC.
 * - Skips cancelled, deactivated, or ineligible students.
 * - Locks elective and seat-allocation records with FOR UPDATE.
 * - Promotes no more students than the seats available to allocate.
 * - Updates student's elective status, waitlist fields, receipt and parent registration status consistently.
 * - Records replay event and audit log for each promotion.
 * - Recompacts remaining waitlist positions sequentially.
 */
export async function promoteWaitlistedStudents(
  tx: any,
  electiveId: string,
  seatsToAllocate: number = 1,
  registrationEventId?: string
): Promise<PromotionResult> {
  if (seatsToAllocate <= 0) {
    return { promotedCount: 0, promotedStudentIds: [] };
  }

  // 1. Lock the elective row to prevent concurrent race conditions
  const [elective] = await tx
    .select()
    .from(electives)
    .where(eq(electives.id, electiveId))
    .for("update");

  if (!elective) {
    return { promotedCount: 0, promotedStudentIds: [] };
  }

  // Authoritative check on available seats
  const availableSeats = elective.availableSeats;
  if (availableSeats <= 0) {
    return { promotedCount: 0, promotedStudentIds: [] };
  }

  const maxToPromote = Math.min(seatsToAllocate, availableSeats);
  let promotedCount = 0;
  const promotedStudentIds: string[] = [];

  // 2. Fetch active waitlisted candidates in deterministic FIFO order
  const candidates = await tx
    .select({
      registrationId: studentRegistrations.id,
      studentId: studentRegistrations.studentId,
      eventId: studentRegistrations.eventId,
      groupId: studentRegistrations.groupId,
      electiveId: studentRegistrations.electiveId,
      waitlistPosition: studentRegistrations.waitlistPosition,
      submittedAt: studentRegistrations.submittedAt,
      userName: users.name,
      userIsActive: users.isActive,
      userIsEligible: users.isEligible,
      userSectionId: users.sectionId,
    })
    .from(studentRegistrations)
    .innerJoin(users, eq(studentRegistrations.studentId, users.id))
    .where(
      and(
        eq(studentRegistrations.electiveId, electiveId),
        eq(studentRegistrations.isWaitlisted, true),
        eq(studentRegistrations.status, "WAITLISTED")
      )
    )
    .orderBy(
      asc(studentRegistrations.waitlistPosition),
      asc(studentRegistrations.submittedAt),
      asc(studentRegistrations.id)
    )
    .for("update");

  for (const candidate of candidates) {
    if (promotedCount >= maxToPromote) break;

    // Check account eligibility
    if (!candidate.userIsActive || !candidate.userIsEligible) {
      continue;
    }

    // Check section allocation quota if student belongs to a section
    let secAllocId: string | null = null;
    if (candidate.userSectionId) {
      const [secAlloc] = await tx
        .select()
        .from(electiveSeatAllocations)
        .where(
          and(
            eq(electiveSeatAllocations.electiveId, electiveId),
            eq(electiveSeatAllocations.sectionId, candidate.userSectionId)
          )
        )
        .for("update");

      if (secAlloc) {
        if (secAlloc.availableSeats <= 0) {
          // Section quota is full for this student's class, skip to next candidate
          continue;
        }
        secAllocId = secAlloc.id;
      }
    }

    // Allocate the seat: decrement elective general capacity
    await tx
      .update(electives)
      .set({
        availableSeats: sql`${electives.availableSeats} - 1`,
        isFull: sql`CASE WHEN ${electives.availableSeats} - 1 <= 0 THEN true ELSE false END`,
        updatedAt: new Date(),
      })
      .where(eq(electives.id, electiveId));

    // Decrement section allotment capacity if applicable
    if (secAllocId) {
      await tx
        .update(electiveSeatAllocations)
        .set({
          availableSeats: sql`${electiveSeatAllocations.availableSeats} - 1`,
          isFull: sql`CASE WHEN ${electiveSeatAllocations.availableSeats} - 1 <= 0 THEN true ELSE false END`,
          updatedAt: new Date(),
        })
        .where(eq(electiveSeatAllocations.id, secAllocId));
    }

    // Promote candidate: update student_registrations record
    await tx
      .update(studentRegistrations)
      .set({
        status: "CONFIRMED",
        isWaitlisted: false,
        waitlistPosition: null,
        updatedAt: new Date(),
      })
      .where(eq(studentRegistrations.id, candidate.registrationId));

    // Check if candidate still has any other active waitlisted choices
    const [otherWaitlisted] = await tx
      .select({ count: count() })
      .from(studentRegistrations)
      .where(
        and(
          eq(studentRegistrations.studentId, candidate.studentId),
          eq(studentRegistrations.eventId, candidate.eventId),
          eq(studentRegistrations.isWaitlisted, true),
          eq(studentRegistrations.status, "WAITLISTED")
        )
      );

    const isStillWaitlisted = (otherWaitlisted?.count || 0) > 0;
    const parentStatus = isStillWaitlisted ? "WAITLISTED" : "CONFIRMED";

    // Update parent registrations record & receipt snapshot
    const [parentReg] = await tx
      .select()
      .from(registrations)
      .where(
        and(
          eq(registrations.studentId, candidate.studentId),
          eq(registrations.eventId, candidate.eventId)
        )
      )
      .limit(1)
      .for("update");

    const baseElectiveName = elective.courseCode
      ? `${elective.courseCode} - ${elective.name}`
      : elective.name;

    if (parentReg) {
      let snapshot = parentReg.receiptSnapshot as any;
      if (snapshot && Array.isArray(snapshot.electives)) {
        snapshot = {
          ...snapshot,
          isWaitlisted: isStillWaitlisted,
          electives: snapshot.electives.map((e: any) => {
            if (
              e.electiveId === electiveId ||
              (elective.courseCode && e.electiveName?.includes(elective.courseCode)) ||
              e.electiveName?.includes(elective.name)
            ) {
              return {
                ...e,
                electiveName: baseElectiveName,
                status: "CONFIRMED",
                isWaitlisted: false,
                waitlistPosition: undefined,
              };
            }
            return e;
          }),
        };
      }

      await tx
        .update(registrations)
        .set({
          status: parentStatus,
          receiptSnapshot: snapshot || parentReg.receiptSnapshot,
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, parentReg.id));
    }

    // Insert replay event
    const eventId = candidate.eventId || registrationEventId;
    if (eventId) {
      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId: candidate.studentId,
        studentName: candidate.userName,
        eventType: "WAITLIST_PROMOTED",
        subjectId: electiveId,
        subjectName: baseElectiveName,
        metadata: {
          promotedFromWaitlistPosition: candidate.waitlistPosition,
          promotedAt: new Date().toISOString(),
        },
      });
    }

    // Insert audit log
    await tx.insert(auditLogs).values({
      action: "WAITLIST_PROMOTED",
      userId: candidate.studentId,
      userRole: "STUDENT",
      metadata: {
        electiveId,
        previousPosition: candidate.waitlistPosition,
      },
    });

    promotedCount++;
    promotedStudentIds.push(candidate.studentId);
  }

  // 3. Recompact remaining waitlist positions sequentially (1, 2, 3...)
  await recompactWaitlistPositions(tx, electiveId);

  return { promotedCount, promotedStudentIds };
}
