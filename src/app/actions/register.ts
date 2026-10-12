"use server";

import { db } from "@/lib/db";
import {
  users,
  registrationEvents,
  studentRegistrations,
  electives,
  systemSettings,
  registrations,
  sections,
  programmes,
  departments,
  academicBatches,
  electiveGroups,
  electiveSeatAllocations,
  replayEvents,
  auditLogs,
} from "@/lib/db/schema";
import { eq, and, sql, inArray, desc, not } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { promoteWaitlistedStudents, recompactWaitlistPositions } from "@/lib/waitlist";

export interface RegisterResult {
  success: boolean;
  error?: string;
  isWaitlisted?: boolean;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  isWaitlisted?: boolean;
  waitlistPosition?: number | null;
  requiresConfirmation?: boolean;
  message?: string;
}

/**
 * Checks whether an event's registration window is currently open for student actions.
 */
export async function isEventRegistrationOpen(event: {
  openDate: Date | null;
  closeDate: Date | null;
  status: string;
  autoClose?: boolean;
}): Promise<{ isOpen: boolean; reason?: string }> {
  const now = new Date();

  if (event.status === "PAUSED") {
    return { isOpen: false, reason: "Registration is currently paused by faculty." };
  }

  if (
    event.status === "CLOSED" ||
    event.status === "VERIFICATION" ||
    event.status === "FINALIZED" ||
    event.status === "ARCHIVED"
  ) {
    return { isOpen: false, reason: "Registration has closed." };
  }

  const isStarted =
    (event.openDate && now >= event.openDate) ||
    event.status === "OPEN" ||
    event.status === "ACTIVE";

  if (!isStarted) {
    return { isOpen: false, reason: "Registration has not opened yet." };
  }

  const isEnded =
    (event.closeDate && now > event.closeDate && (event.autoClose ?? true)) ||
    event.status === "CLOSED";

  if (isEnded) {
    return { isOpen: false, reason: "The registration deadline has passed. Modifications are closed." };
  }

  return { isOpen: true };
}

/**
 * Handles initial elective registration for the logged-in student.
 */
export async function registerElectives(
  eventId: string,
  selections: { groupId: string; electiveId: string }[]
): Promise<RegisterResult> {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Unauthorized. Please log in as a student." };
    }

    const studentId = session.userId;

    // 2. Fetch system settings
    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
    if (settings?.maintenanceMode) {
      return { success: false, error: "System is currently undergoing maintenance." };
    }

    // 3. Fetch student
    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);

    if (!student) {
      return { success: false, error: "Student record not found." };
    }

    if (!student.isActive) {
      return { success: false, error: "Your account is deactivated." };
    }

    if (!student.isEligible) {
      return { success: false, error: "You are not eligible for registration. Please contact faculty." };
    }

    // 4. Fetch Registration Event
    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);

    if (!event) {
      return { success: false, error: "Registration event not found." };
    }

    const windowCheck = await isEventRegistrationOpen(event);
    if (!windowCheck.isOpen) {
      return { success: false, error: windowCheck.reason || "Registration is currently closed." };
    }

    let hasAnyWaitlisted = false;

    // 5. Execute Transaction
    await db.transaction(async (tx) => {
      // Check existing registrations in the main registrations table
      const [existingReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1)
        .for("update");

      if (existingReg && (existingReg.status === "CONFIRMED" || existingReg.status === "WAITLISTED")) {
        throw new Error("Registration already completed.");
      }

      // Fetch student details with names for snapshot
      const [studentInfo] = await tx
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
        .where(eq(users.id, studentId))
        .limit(1);

      const studentDetails = {
        name: studentInfo?.name || student.name,
        registerNumber: studentInfo?.registerNumber || student.registerNumber || "N/A",
        email: studentInfo?.email || student.email,
        department: studentInfo?.departmentName || "N/A",
        degree: studentInfo?.programmeName || "N/A",
        section: studentInfo?.sectionName || "N/A",
      };

      const selectedElectiveIds = selections.map((s) => s.electiveId);

      // Lock chosen electives using SELECT FOR UPDATE
      const lockedElectives = await tx
        .select()
        .from(electives)
        .where(inArray(electives.id, selectedElectiveIds))
        .for("update");

      const lockedElectivesMap = new Map(lockedElectives.map((e) => [e.id, e]));

      // Validate selections, seats, and capture detailed snapshot data
      const electiveSnapshots: {
        groupId?: string;
        groupName: string;
        electiveId?: string;
        electiveName: string;
        courseCode?: string;
        status?: string;
        isWaitlisted?: boolean;
        waitlistPosition?: number;
      }[] = [];

      for (const sel of selections) {
        const elective = lockedElectivesMap.get(sel.electiveId);

        if (!elective || !elective.isActive) {
          throw new Error("Selected elective is invalid or inactive.");
        }
        if (elective.groupId !== sel.groupId) {
          throw new Error("Elective does not belong to the correct group.");
        }

        let isSeatFull = elective.availableSeats <= 0;
        let secAllocationId: string | null = null;

        // Check section allocation if configured
        if (student.sectionId) {
          const [secAllocation] = await tx
            .select()
            .from(electiveSeatAllocations)
            .where(
              and(
                eq(electiveSeatAllocations.electiveId, sel.electiveId),
                eq(electiveSeatAllocations.sectionId, student.sectionId)
              )
            )
            .for("update");

          if (secAllocation) {
            secAllocationId = secAllocation.id;
            if (secAllocation.availableSeats <= 0) {
              isSeatFull = true;
            }
          }
        }

        const isWaitlistEnabled = Boolean(event.enableWaitlist);

        if (isSeatFull && !isWaitlistEnabled) {
          throw new Error(`Seats are fully booked for elective: ${elective.name}`);
        }

        const isWaitlisted = isSeatFull && isWaitlistEnabled;
        let waitlistPosition: number | null = null;

        if (isWaitlisted) {
          hasAnyWaitlisted = true;
          const [maxPosRow] = await tx
            .select({
              maxPos: sql<number>`COALESCE(MAX(${studentRegistrations.waitlistPosition}), 0)`,
            })
            .from(studentRegistrations)
            .where(
              and(
                eq(studentRegistrations.eventId, eventId),
                eq(studentRegistrations.electiveId, sel.electiveId),
                eq(studentRegistrations.isWaitlisted, true),
                eq(studentRegistrations.status, "WAITLISTED")
              )
            );
          waitlistPosition = (maxPosRow?.maxPos || 0) + 1;
        } else {
          // Decrement general seats
          await tx
            .update(electives)
            .set({
              availableSeats: sql`${electives.availableSeats} - 1`,
              isFull: sql`CASE WHEN ${electives.availableSeats} - 1 <= 0 THEN true ELSE false END`,
              updatedAt: new Date(),
            })
            .where(eq(electives.id, sel.electiveId));

          // Decrement section allotment seats if configured
          if (secAllocationId) {
            await tx
              .update(electiveSeatAllocations)
              .set({
                availableSeats: sql`${electiveSeatAllocations.availableSeats} - 1`,
                isFull: sql`CASE WHEN ${electiveSeatAllocations.availableSeats} - 1 <= 0 THEN true ELSE false END`,
                updatedAt: new Date(),
              })
              .where(eq(electiveSeatAllocations.id, secAllocationId));
          }
        }

        // Fetch group details for snapshot
        const [group] = await tx
          .select({ name: electiveGroups.name })
          .from(electiveGroups)
          .where(eq(electiveGroups.id, sel.groupId))
          .limit(1);

        const baseElectiveName = elective.courseCode
          ? `${elective.courseCode} - ${elective.name}`
          : elective.name;
        const snapshotName = isWaitlisted
          ? `${baseElectiveName} [Waitlisted #${waitlistPosition}]`
          : baseElectiveName;

        electiveSnapshots.push({
          groupId: sel.groupId,
          groupName: group?.name || "Unknown Group",
          electiveId: sel.electiveId,
          electiveName: snapshotName,
          courseCode: elective.courseCode || undefined,
          status: isWaitlisted ? "WAITLISTED" : "CONFIRMED",
          isWaitlisted,
          ...(waitlistPosition ? { waitlistPosition } : {}),
        });

        // Upsert selection choice in case of prior cancelled registration
        await tx
          .insert(studentRegistrations)
          .values({
            studentId,
            eventId,
            groupId: sel.groupId,
            electiveId: sel.electiveId,
            status: isWaitlisted ? "WAITLISTED" : "CONFIRMED",
            isLocked: true,
            isWaitlisted,
            waitlistPosition: waitlistPosition || null,
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              studentRegistrations.studentId,
              studentRegistrations.eventId,
              studentRegistrations.groupId,
            ],
            set: {
              electiveId: sel.electiveId,
              status: isWaitlisted ? "WAITLISTED" : "CONFIRMED",
              isLocked: true,
              isWaitlisted,
              waitlistPosition: waitlistPosition || null,
              submittedAt: new Date(),
              updatedAt: new Date(),
            },
          });

        // Insert replay event
        await tx.insert(replayEvents).values({
          registrationEventId: eventId,
          studentId,
          studentName: studentDetails.name,
          eventType: isWaitlisted ? "STUDENT_WAITLISTED" : "STUDENT_REGISTERED",
          subjectId: sel.electiveId,
          subjectName: baseElectiveName,
          seatBefore: elective.availableSeats,
          seatAfter: isWaitlisted ? elective.availableSeats : elective.availableSeats - 1,
          metadata: isWaitlisted ? { waitlistPosition } : undefined,
        });
      }

      // Generate sequence number for receipt
      const isOdd = event.name.toLowerCase().includes("odd");
      const semester = isOdd ? "ODD" : "EVEN";
      const year = new Date().getFullYear();

      let receiptNumber = existingReg?.receiptNumber;
      if (!receiptNumber) {
        const [seqRow] = await tx
          .select({
            maxSeq: sql<number>`COALESCE(MAX(CAST(NULLIF(SUBSTRING(${registrations.receiptNumber} FROM '^ELC-[0-9]+-[A-Za-z]+-([0-9]+)$'), '') AS BIGINT)), 0)`,
          })
          .from(registrations);

        const nextSeq = Number(seqRow?.maxSeq || 0) + 1;
        receiptNumber = `ELC-${year}-${semester}-${String(nextSeq).padStart(6, "0")}`;
      }

      const receiptSnapshot = {
        receiptNumber,
        submittedAt: new Date().toISOString(),
        student: studentDetails,
        electives: electiveSnapshots,
        isWaitlisted: hasAnyWaitlisted,
      };

      const regStatus = hasAnyWaitlisted ? "WAITLISTED" : "CONFIRMED";

      // Insert/Update registrations table
      if (existingReg) {
        await tx
          .update(registrations)
          .set({
            status: regStatus,
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
          status: regStatus,
          receiptNumber,
          receiptSnapshot,
          submittedAt: new Date(),
        });
      }

      // Audit log
      await tx.insert(auditLogs).values({
        action: "STUDENT_REGISTERED",
        userId: studentId,
        userRole: "STUDENT",
        metadata: {
          eventId,
          receiptNumber,
          isWaitlisted: hasAnyWaitlisted,
          selectionsCount: selections.length,
        },
      });
    });

    return { success: true, isWaitlisted: hasAnyWaitlisted };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to complete registration due to database error. Please try again.";
    console.error("Registration transaction error:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Changes an existing elective choice to a replacement elective.
 *
 * Rules:
 * - Student must own the registration.
 * - Registration window must be open and allow editing.
 * - Replacement elective must belong to the same group and be active.
 * - No duplicate elective selections across groups.
 * - Transactionally reserves replacement seat before releasing current confirmed seat.
 * - If replacement is full and waitlisting is enabled, requires acceptWaitlist=true.
 * - If replacement is full and waitlisting is disabled, rejects the change.
 * - When releasing a confirmed seat, FIFO waitlist promotion is triggered.
 * - Recompaction is triggered if relinquishing a waitlisted position.
 * - Overall registration status and receipt snapshot are updated.
 */
export async function changeStudentElective(
  eventId: string,
  groupId: string,
  currentElectiveId: string,
  replacementElectiveId: string,
  acceptWaitlist: boolean = false
): Promise<MutationResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Unauthorized. Please log in as a student." };
    }
    const studentId = session.userId;

    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
    if (settings?.maintenanceMode) {
      return { success: false, error: "System is currently undergoing maintenance." };
    }

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student || !student.isActive || !student.isEligible) {
      return { success: false, error: "You are not eligible to modify registrations. Please contact faculty." };
    }

    if (currentElectiveId === replacementElectiveId) {
      return { success: false, error: "You already have this elective selected." };
    }

    // Authoritative event checks
    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    if (!event) {
      return { success: false, error: "Registration event not found." };
    }

    const windowCheck = await isEventRegistrationOpen(event);
    if (!windowCheck.isOpen) {
      return { success: false, error: windowCheck.reason || "Registration window is closed." };
    }

    if (!event.allowEditing) {
      return { success: false, error: "Elective modifications are disabled for this registration event." };
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch and lock student's current registration for this group
      const [currentReg] = await tx
        .select()
        .from(studentRegistrations)
        .where(
          and(
            eq(studentRegistrations.studentId, studentId),
            eq(studentRegistrations.eventId, eventId),
            eq(studentRegistrations.groupId, groupId)
          )
        )
        .limit(1)
        .for("update");

      if (!currentReg) {
        throw new Error("No existing elective registration found for this group.");
      }

      if (currentReg.electiveId !== currentElectiveId) {
        throw new Error("Current elective does not match the active registration record.");
      }

      if (currentReg.status === "CANCELLED") {
        throw new Error("This elective registration has been cancelled. Please register anew.");
      }

      // 2. Ensure replacement elective is not already registered in another group
      const [duplicateCheck] = await tx
        .select()
        .from(studentRegistrations)
        .where(
          and(
            eq(studentRegistrations.studentId, studentId),
            eq(studentRegistrations.eventId, eventId),
            eq(studentRegistrations.electiveId, replacementElectiveId),
            eq(studentRegistrations.status, "CONFIRMED")
          )
        )
        .limit(1);

      if (duplicateCheck && duplicateCheck.groupId !== groupId) {
        throw new Error("You are already registered for this elective in another group.");
      }

      // 3. Lock replacement elective row
      const [replacement] = await tx
        .select()
        .from(electives)
        .where(eq(electives.id, replacementElectiveId))
        .for("update");

      if (!replacement || !replacement.isActive) {
        throw new Error("Replacement elective is not available or inactive.");
      }

      if (replacement.groupId !== groupId) {
        throw new Error("Replacement elective belongs to a different elective group.");
      }

      let isReplacementFull = replacement.availableSeats <= 0;
      let replacementSecAllocId: string | null = null;

      if (student.sectionId) {
        const [secAlloc] = await tx
          .select()
          .from(electiveSeatAllocations)
          .where(
            and(
              eq(electiveSeatAllocations.electiveId, replacementElectiveId),
              eq(electiveSeatAllocations.sectionId, student.sectionId)
            )
          )
          .for("update");

        if (secAlloc) {
          replacementSecAllocId = secAlloc.id;
          if (secAlloc.availableSeats <= 0) {
            isReplacementFull = true;
          }
        }
      }

      const isWaitlistEnabled = Boolean(event.enableWaitlist);

      if (isReplacementFull && !isWaitlistEnabled) {
        throw new Error(`Seats are fully booked for ${replacement.name} and waitlisting is disabled.`);
      }

      if (isReplacementFull && !acceptWaitlist) {
        // Require explicit confirmation before releasing current confirmed seat to join waitlist
        return {
          success: false,
          requiresConfirmation: true,
          isWaitlisted: true,
          message: `Seats for ${replacement.name} are currently full. Confirming this change will place you on the waitlist and release your existing seat in ${currentReg.isWaitlisted ? "your previous waitlist position" : "your confirmed course"}.`,
        };
      }

      const isReplacementWaitlisted = isReplacementFull;
      let newWaitlistPos: number | null = null;

      // 4. Reserve replacement seat or queue position transactionally BEFORE releasing old
      if (!isReplacementWaitlisted) {
        // Decrement general seats
        await tx
          .update(electives)
          .set({
            availableSeats: sql`${electives.availableSeats} - 1`,
            isFull: sql`CASE WHEN ${electives.availableSeats} - 1 <= 0 THEN true ELSE false END`,
            updatedAt: new Date(),
          })
          .where(eq(electives.id, replacementElectiveId));

        if (replacementSecAllocId) {
          await tx
            .update(electiveSeatAllocations)
            .set({
              availableSeats: sql`${electiveSeatAllocations.availableSeats} - 1`,
              isFull: sql`CASE WHEN ${electiveSeatAllocations.availableSeats} - 1 <= 0 THEN true ELSE false END`,
              updatedAt: new Date(),
            })
            .where(eq(electiveSeatAllocations.id, replacementSecAllocId));
        }
      } else {
        // Calculate next waitlist position deterministically
        const [maxPosRow] = await tx
          .select({
            maxPos: sql<number>`COALESCE(MAX(${studentRegistrations.waitlistPosition}), 0)`,
          })
          .from(studentRegistrations)
          .where(
            and(
              eq(studentRegistrations.eventId, eventId),
              eq(studentRegistrations.electiveId, replacementElectiveId),
              eq(studentRegistrations.isWaitlisted, true),
              eq(studentRegistrations.status, "WAITLISTED")
            )
          );
        newWaitlistPos = (maxPosRow?.maxPos || 0) + 1;
      }

      // 5. Handle old elective release & FIFO waitlist promotion
      const oldWasConfirmed = !currentReg.isWaitlisted && currentReg.status === "CONFIRMED";
      const [oldElective] = await tx
        .select()
        .from(electives)
        .where(eq(electives.id, currentElectiveId))
        .for("update");

      if (oldWasConfirmed && oldElective) {
        // Release confirmed seat
        await tx
          .update(electives)
          .set({
            availableSeats: sql`${electives.availableSeats} + 1`,
            isFull: false,
            updatedAt: new Date(),
          })
          .where(eq(electives.id, currentElectiveId));

        if (student.sectionId) {
          const [oldSecAlloc] = await tx
            .select()
            .from(electiveSeatAllocations)
            .where(
              and(
                eq(electiveSeatAllocations.electiveId, currentElectiveId),
                eq(electiveSeatAllocations.sectionId, student.sectionId)
              )
            )
            .for("update");

          if (oldSecAlloc) {
            await tx
              .update(electiveSeatAllocations)
              .set({
                availableSeats: sql`${electiveSeatAllocations.availableSeats} + 1`,
                isFull: false,
                updatedAt: new Date(),
              })
              .where(eq(electiveSeatAllocations.id, oldSecAlloc.id));
          }
        }

        // Trigger FIFO waitlist promotion for old elective
        await promoteWaitlistedStudents(tx, currentElectiveId, 1, eventId);
      } else if (currentReg.isWaitlisted) {
        // Student vacated old waitlist slot: recompact remaining waitlist positions
        await recompactWaitlistPositions(tx, currentElectiveId);
      }

      // 6. Update studentRegistrations choice
      await tx
        .update(studentRegistrations)
        .set({
          electiveId: replacementElectiveId,
          status: isReplacementWaitlisted ? "WAITLISTED" : "CONFIRMED",
          isWaitlisted: isReplacementWaitlisted,
          waitlistPosition: newWaitlistPos,
          updatedAt: new Date(),
        })
        .where(eq(studentRegistrations.id, currentReg.id));

      // 7. Update parent registration status and receipt snapshot
      const allStudentRegs = await tx
        .select({
          groupId: studentRegistrations.groupId,
          electiveId: studentRegistrations.electiveId,
          status: studentRegistrations.status,
          isWaitlisted: studentRegistrations.isWaitlisted,
          waitlistPosition: studentRegistrations.waitlistPosition,
        })
        .from(studentRegistrations)
        .where(
          and(
            eq(studentRegistrations.studentId, studentId),
            eq(studentRegistrations.eventId, eventId),
            not(eq(studentRegistrations.status, "CANCELLED"))
          )
        );

      const hasAnyWaitlisted = allStudentRegs.some((r) => r.isWaitlisted || r.status === "WAITLISTED");
      const overallStatus = allStudentRegs.length === 0 ? "CANCELLED" : hasAnyWaitlisted ? "WAITLISTED" : "CONFIRMED";

      const [parentReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1)
        .for("update");

      const oldName = oldElective?.courseCode
        ? `${oldElective.courseCode} - ${oldElective.name}`
        : oldElective?.name || "Previous Elective";
      const replacementName = replacement.courseCode
        ? `${replacement.courseCode} - ${replacement.name}`
        : replacement.name;

      if (parentReg && parentReg.receiptSnapshot) {
        const snapshot = { ...(parentReg.receiptSnapshot as any) };
        if (Array.isArray(snapshot.electives)) {
          snapshot.electives = snapshot.electives.map((e: any) => {
            if (e.groupId === groupId || e.electiveId === currentElectiveId) {
              const formattedName = isReplacementWaitlisted
                ? `${replacementName} [Waitlisted #${newWaitlistPos}]`
                : replacementName;
              return {
                ...e,
                electiveId: replacementElectiveId,
                electiveName: formattedName,
                courseCode: replacement.courseCode || undefined,
                status: isReplacementWaitlisted ? "WAITLISTED" : "CONFIRMED",
                isWaitlisted: isReplacementWaitlisted,
                waitlistPosition: newWaitlistPos || undefined,
              };
            }
            return e;
          });
          snapshot.isWaitlisted = hasAnyWaitlisted;

          await tx
            .update(registrations)
            .set({
              status: overallStatus,
              receiptSnapshot: snapshot,
              updatedAt: new Date(),
            })
            .where(eq(registrations.id, parentReg.id));
        }
      }

      // 8. Replay event and Audit log
      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId,
        studentName: student.name,
        eventType: "STUDENT_CHANGED_CHOICE",
        subjectId: replacementElectiveId,
        subjectName: replacementName,
        oldSubject: oldName,
        newSubject: replacementName,
        seatBefore: replacement.availableSeats,
        seatAfter: isReplacementWaitlisted ? replacement.availableSeats : replacement.availableSeats - 1,
        performedBy: studentId,
        metadata: {
          fromWaitlisted: currentReg.isWaitlisted,
          toWaitlisted: isReplacementWaitlisted,
          newWaitlistPosition: newWaitlistPos,
        },
      });

      await tx.insert(auditLogs).values({
        action: "STUDENT_CHANGED_ELECTIVE",
        userId: studentId,
        userRole: "STUDENT",
        metadata: {
          eventId,
          groupId,
          oldElectiveId: currentElectiveId,
          newElectiveId: replacementElectiveId,
          isWaitlisted: isReplacementWaitlisted,
        },
      });

      return {
        success: true,
        isWaitlisted: isReplacementWaitlisted,
        waitlistPosition: newWaitlistPos,
      };
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to change elective. Please try again.";
    console.error("Change elective error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Cancels a single elective registration for the authenticated student.
 *
 * Rules:
 * - Mark elective registration as CANCELLED (do not hard-delete to preserve receipts/audit).
 * - Release seat only if confirmed; never release a seat for waitlist.
 * - Trigger FIFO waitlist promotion if confirmed seat was released.
 * - Recompact sequential waitlist positions if waitlisted entry was cancelled.
 * - Update overall registration status and receipt snapshot.
 * - Enforce deadline strictly.
 */
export async function cancelStudentElective(
  eventId: string,
  groupId: string,
  electiveId: string
): Promise<MutationResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Unauthorized. Please log in as a student." };
    }
    const studentId = session.userId;

    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
    if (settings?.maintenanceMode) {
      return { success: false, error: "System is currently undergoing maintenance." };
    }

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student || !student.isActive || !student.isEligible) {
      return { success: false, error: "You are not eligible to modify registrations. Please contact faculty." };
    }

    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    if (!event) {
      return { success: false, error: "Registration event not found." };
    }

    const windowCheck = await isEventRegistrationOpen(event);
    if (!windowCheck.isOpen) {
      return { success: false, error: windowCheck.reason || "Registration window is closed." };
    }

    return await db.transaction(async (tx) => {
      // 1. Fetch and lock target choice
      const [currentReg] = await tx
        .select()
        .from(studentRegistrations)
        .where(
          and(
            eq(studentRegistrations.studentId, studentId),
            eq(studentRegistrations.eventId, eventId),
            eq(studentRegistrations.groupId, groupId)
          )
        )
        .limit(1)
        .for("update");

      if (!currentReg) {
        throw new Error("No active elective registration found for this group.");
      }

      if (currentReg.electiveId !== electiveId) {
        throw new Error("Elective selection does not match active registration.");
      }

      if (currentReg.status === "CANCELLED") {
        throw new Error("This elective registration has already been cancelled.");
      }

      const wasConfirmed = !currentReg.isWaitlisted && currentReg.status === "CONFIRMED";
      const [elective] = await tx
        .select()
        .from(electives)
        .where(eq(electives.id, electiveId))
        .for("update");

      // 2. Release seat only if held a confirmed seat
      if (wasConfirmed && elective) {
        await tx
          .update(electives)
          .set({
            availableSeats: sql`${electives.availableSeats} + 1`,
            isFull: false,
            updatedAt: new Date(),
          })
          .where(eq(electives.id, electiveId));

        if (student.sectionId) {
          const [secAlloc] = await tx
            .select()
            .from(electiveSeatAllocations)
            .where(
              and(
                eq(electiveSeatAllocations.electiveId, electiveId),
                eq(electiveSeatAllocations.sectionId, student.sectionId)
              )
            )
            .for("update");

          if (secAlloc) {
            await tx
              .update(electiveSeatAllocations)
              .set({
                availableSeats: sql`${electiveSeatAllocations.availableSeats} + 1`,
                isFull: false,
                updatedAt: new Date(),
              })
              .where(eq(electiveSeatAllocations.id, secAlloc.id));
          }
        }

        // Trigger FIFO waitlist promotion
        await promoteWaitlistedStudents(tx, electiveId, 1, eventId);
      } else if (currentReg.isWaitlisted) {
        // Waitlisted: do not increment seats, recompact remaining positions
        await recompactWaitlistPositions(tx, electiveId);
      }

      // 3. Mark choice as cancelled
      await tx
        .update(studentRegistrations)
        .set({
          status: "CANCELLED",
          isWaitlisted: false,
          waitlistPosition: null,
          updatedAt: new Date(),
        })
        .where(eq(studentRegistrations.id, currentReg.id));

      // 4. Update overall status and receipt snapshot
      const remainingActive = await tx
        .select()
        .from(studentRegistrations)
        .where(
          and(
            eq(studentRegistrations.studentId, studentId),
            eq(studentRegistrations.eventId, eventId),
            not(eq(studentRegistrations.status, "CANCELLED"))
          )
        );

      let overallStatus: "CONFIRMED" | "WAITLISTED" | "CANCELLED" = "CANCELLED";
      if (remainingActive.length > 0) {
        const hasWaitlisted = remainingActive.some((r) => r.isWaitlisted || r.status === "WAITLISTED");
        overallStatus = hasWaitlisted ? "WAITLISTED" : "CONFIRMED";
      }

      const [parentReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1)
        .for("update");

      const electiveName = elective?.courseCode
        ? `${elective.courseCode} - ${elective.name}`
        : elective?.name || "Elective";

      if (parentReg && parentReg.receiptSnapshot) {
        const snapshot = { ...(parentReg.receiptSnapshot as any) };
        if (Array.isArray(snapshot.electives)) {
          snapshot.electives = snapshot.electives.map((e: any) => {
            if (e.groupId === groupId || e.electiveId === electiveId) {
              return {
                ...e,
                status: "CANCELLED",
                isWaitlisted: false,
                electiveName: `${e.electiveName?.replace(/\[Waitlisted #\d+\]/, "").trim()} [Cancelled]`,
              };
            }
            return e;
          });
          snapshot.isWaitlisted = remainingActive.some((r) => r.isWaitlisted || r.status === "WAITLISTED");

          await tx
            .update(registrations)
            .set({
              status: overallStatus,
              receiptSnapshot: snapshot,
              updatedAt: new Date(),
            })
            .where(eq(registrations.id, parentReg.id));
        }
      }

      // 5. Replay and audit log
      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId,
        studentName: student.name,
        eventType: "ELECTIVE_CANCELLED",
        subjectId: electiveId,
        subjectName: electiveName,
        performedBy: studentId,
        metadata: {
          wasWaitlisted: currentReg.isWaitlisted,
          groupId,
        },
      });

      await tx.insert(auditLogs).values({
        action: "STUDENT_CANCELLED_ELECTIVE",
        userId: studentId,
        userRole: "STUDENT",
        metadata: {
          eventId,
          groupId,
          electiveId,
          wasWaitlisted: currentReg.isWaitlisted,
        },
      });

      return { success: true };
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to cancel elective. Please try again.";
    console.error("Cancel elective error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Cancels the student's entire registration for an event.
 *
 * Rules:
 * - Releases all confirmed elective seats.
 * - Promotes eligible waitlisted students for all released electives.
 * - Updates overall registration status to CANCELLED atomically.
 * - Idempotent if already cancelled.
 */
export async function cancelEntireRegistration(eventId: string): Promise<MutationResult> {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Unauthorized. Please log in as a student." };
    }
    const studentId = session.userId;

    const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
    if (settings?.maintenanceMode) {
      return { success: false, error: "System is currently undergoing maintenance." };
    }

    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student || !student.isActive || !student.isEligible) {
      return { success: false, error: "You are not eligible to modify registrations. Please contact faculty." };
    }

    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    if (!event) {
      return { success: false, error: "Registration event not found." };
    }

    const windowCheck = await isEventRegistrationOpen(event);
    if (!windowCheck.isOpen) {
      return { success: false, error: windowCheck.reason || "Registration window is closed." };
    }

    return await db.transaction(async (tx) => {
      // 1. Lock parent registration
      const [parentReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1)
        .for("update");

      if (!parentReg) {
        throw new Error("No registration found to cancel.");
      }

      if (parentReg.status === "CANCELLED") {
        throw new Error("Registration has already been cancelled.");
      }

      // 2. Fetch all active student choices
      const userChoices = await tx
        .select()
        .from(studentRegistrations)
        .where(
          and(
            eq(studentRegistrations.studentId, studentId),
            eq(studentRegistrations.eventId, eventId),
            not(eq(studentRegistrations.status, "CANCELLED"))
          )
        )
        .for("update");

      // 3. For each active choice, release seat if confirmed & promote, or recompact if waitlisted
      for (const choice of userChoices) {
        const wasConfirmed = !choice.isWaitlisted && choice.status === "CONFIRMED";

        if (wasConfirmed) {
          const [elective] = await tx
            .select()
            .from(electives)
            .where(eq(electives.id, choice.electiveId))
            .for("update");

          if (elective) {
            await tx
              .update(electives)
              .set({
                availableSeats: sql`${electives.availableSeats} + 1`,
                isFull: false,
                updatedAt: new Date(),
              })
              .where(eq(electives.id, choice.electiveId));

            if (student.sectionId) {
              const [secAlloc] = await tx
                .select()
                .from(electiveSeatAllocations)
                .where(
                  and(
                    eq(electiveSeatAllocations.electiveId, choice.electiveId),
                    eq(electiveSeatAllocations.sectionId, student.sectionId)
                  )
                )
                .for("update");

              if (secAlloc) {
                await tx
                  .update(electiveSeatAllocations)
                  .set({
                    availableSeats: sql`${electiveSeatAllocations.availableSeats} + 1`,
                    isFull: false,
                    updatedAt: new Date(),
                  })
                  .where(eq(electiveSeatAllocations.id, secAlloc.id));
              }
            }

            // Promote earliest eligible waitlisted student
            await promoteWaitlistedStudents(tx, choice.electiveId, 1, eventId);
          }
        } else if (choice.isWaitlisted) {
          await recompactWaitlistPositions(tx, choice.electiveId);
        }

        // Mark choice as cancelled
        await tx
          .update(studentRegistrations)
          .set({
            status: "CANCELLED",
            isWaitlisted: false,
            waitlistPosition: null,
            updatedAt: new Date(),
          })
          .where(eq(studentRegistrations.id, choice.id));

        // Replay event for elective cancellation
        await tx.insert(replayEvents).values({
          registrationEventId: eventId,
          studentId,
          studentName: student.name,
          eventType: "ELECTIVE_CANCELLED",
          subjectId: choice.electiveId,
          performedBy: studentId,
          metadata: { wasWaitlisted: choice.isWaitlisted },
        });
      }

      // 4. Update parent registrations table
      let snapshot = parentReg.receiptSnapshot as any;
      if (snapshot && Array.isArray(snapshot.electives)) {
        snapshot = {
          ...snapshot,
          status: "CANCELLED",
          isWaitlisted: false,
          electives: snapshot.electives.map((e: any) => ({
            ...e,
            status: "CANCELLED",
            isWaitlisted: false,
            electiveName: `${e.electiveName?.replace(/\[Waitlisted #\d+\]/, "").trim()} [Cancelled]`,
          })),
        };
      }

      await tx
        .update(registrations)
        .set({
          status: "CANCELLED",
          receiptSnapshot: snapshot || parentReg.receiptSnapshot,
          updatedAt: new Date(),
        })
        .where(eq(registrations.id, parentReg.id));

      // 5. Global replay event and audit log
      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId,
        studentName: student.name,
        eventType: "REGISTRATION_CANCELLED",
        performedBy: studentId,
        metadata: {
          releasedChoicesCount: userChoices.length,
          receiptNumber: parentReg.receiptNumber,
        },
      });

      await tx.insert(auditLogs).values({
        action: "STUDENT_CANCELLED_REGISTRATION",
        userId: studentId,
        userRole: "STUDENT",
        metadata: {
          eventId,
          receiptNumber: parentReg.receiptNumber,
          cancelledCount: userChoices.length,
        },
      });

      return { success: true };
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to cancel registration. Please try again.";
    console.error("Cancel entire registration error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetches registration status, receipt, chosen electives, and alternative electives
 * for the student's "My Registration" dashboard.
 */
export async function getStudentRegistrationDetails(eventId?: string) {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, error: "Unauthorized" };
    }

    const studentId = session.userId;
    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
    if (!student || !student.academicBatchId) {
      return { success: false, error: "Student or batch not found" };
    }

    // Resolve event
    let targetEventId = eventId;
    if (!targetEventId) {
      const [latestEvent] = await db
        .select()
        .from(registrationEvents)
        .where(
          and(
            eq(registrationEvents.academicBatchId, student.academicBatchId),
            inArray(registrationEvents.status, [
              "PUBLISHED",
              "OPEN",
              "ACTIVE",
              "CLOSED",
              "VERIFICATION",
              "FINALIZED",
            ])
          )
        )
        .orderBy(desc(registrationEvents.createdAt))
        .limit(1);

      if (!latestEvent) {
        return { success: false, error: "No registration event found." };
      }
      targetEventId = latestEvent.id;
    }

    const [event] = await db
      .select()
      .from(registrationEvents)
      .where(eq(registrationEvents.id, targetEventId))
      .limit(1);

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    const windowCheck = await isEventRegistrationOpen(event);

    // Fetch parent registration
    const [userReg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, event.id)))
      .limit(1);

    if (!userReg) {
      return {
        success: true,
        hasRegistered: false,
        event: {
          id: event.id,
          name: event.name,
          openDate: event.openDate,
          closeDate: event.closeDate,
          status: event.status,
          allowEditing: event.allowEditing,
          enableWaitlist: event.enableWaitlist,
          autoClose: event.autoClose,
          isOpen: windowCheck.isOpen,
          reason: windowCheck.reason,
        },
      };
    }

    // Fetch all studentRegistrations joined with electives and groups
    const studentChoices = await db
      .select({
        id: studentRegistrations.id,
        groupId: studentRegistrations.groupId,
        groupName: electiveGroups.name,
        electiveId: studentRegistrations.electiveId,
        electiveName: electives.name,
        courseCode: electives.courseCode,
        credits: electives.credits,
        status: studentRegistrations.status,
        isWaitlisted: studentRegistrations.isWaitlisted,
        waitlistPosition: studentRegistrations.waitlistPosition,
        submittedAt: studentRegistrations.submittedAt,
        availableSeats: electives.availableSeats,
        maxSeats: electives.maxSeats,
        isFull: electives.isFull,
      })
      .from(studentRegistrations)
      .innerJoin(electives, eq(studentRegistrations.electiveId, electives.id))
      .innerJoin(electiveGroups, eq(studentRegistrations.groupId, electiveGroups.id))
      .where(and(eq(studentRegistrations.studentId, studentId), eq(studentRegistrations.eventId, event.id)))
      .orderBy(electiveGroups.sortOrder);

    // Fetch section allocations for student's section
    const choiceElectiveIds = studentChoices.map((c) => c.electiveId);
    let sectionAllocations: { electiveId: string; availableSeats: number; maxSeats: number; isFull: boolean }[] = [];

    if (student.sectionId && choiceElectiveIds.length > 0) {
      sectionAllocations = await db
        .select({
          electiveId: electiveSeatAllocations.electiveId,
          availableSeats: electiveSeatAllocations.availableSeats,
          maxSeats: electiveSeatAllocations.maxSeats,
          isFull: electiveSeatAllocations.isFull,
        })
        .from(electiveSeatAllocations)
        .where(
          and(
            inArray(electiveSeatAllocations.electiveId, choiceElectiveIds),
            eq(electiveSeatAllocations.sectionId, student.sectionId)
          )
        );
    }

    // Fetch alternative electives for each group to power the "Change Elective" picker
    const groupIds = Array.from(new Set(studentChoices.map((c) => c.groupId)));
    let alternativeElectives: any[] = [];

    if (groupIds.length > 0) {
      alternativeElectives = await db
        .select({
          id: electives.id,
          groupId: electives.groupId,
          name: electives.name,
          courseCode: electives.courseCode,
          credits: electives.credits,
          description: electives.description,
          maxSeats: electives.maxSeats,
          availableSeats: electives.availableSeats,
          isFull: electives.isFull,
          isActive: electives.isActive,
        })
        .from(electives)
        .where(and(inArray(electives.groupId, groupIds), eq(electives.isActive, true)));
    }

    // Adjust seat counts for section allocations
    let allSectionAllocs: { electiveId: string; availableSeats: number; maxSeats: number; isFull: boolean }[] = [];
    if (student.sectionId && alternativeElectives.length > 0) {
      allSectionAllocs = await db
        .select({
          electiveId: electiveSeatAllocations.electiveId,
          availableSeats: electiveSeatAllocations.availableSeats,
          maxSeats: electiveSeatAllocations.maxSeats,
          isFull: electiveSeatAllocations.isFull,
        })
        .from(electiveSeatAllocations)
        .where(
          and(
            inArray(electiveSeatAllocations.electiveId, alternativeElectives.map((a) => a.id)),
            eq(electiveSeatAllocations.sectionId, student.sectionId)
          )
        );
    }

    const alternativesByGroup = new Map<string, any[]>();
    for (const alt of alternativeElectives) {
      const secAlloc = allSectionAllocs.find((s) => s.electiveId === alt.id);
      const effectiveAvailable = secAlloc ? Math.min(alt.availableSeats, secAlloc.availableSeats) : alt.availableSeats;
      const effectiveFull = alt.isFull || (secAlloc ? secAlloc.isFull || secAlloc.availableSeats <= 0 : effectiveAvailable <= 0);

      const item = {
        ...alt,
        availableSeats: Math.max(0, effectiveAvailable),
        isFull: effectiveFull,
        sectionAvailableSeats: secAlloc?.availableSeats,
        sectionMaxSeats: secAlloc?.maxSeats,
      };

      const list = alternativesByGroup.get(alt.groupId) || [];
      list.push(item);
      alternativesByGroup.set(alt.groupId, list);
    }

    const formattedChoices = studentChoices.map((c) => {
      const secAlloc = sectionAllocations.find((s) => s.electiveId === c.electiveId);
      const effectiveAvailable = secAlloc ? Math.min(c.availableSeats, secAlloc.availableSeats) : c.availableSeats;
      const alternatives = (alternativesByGroup.get(c.groupId) || []).filter((a) => a.id !== c.electiveId);

      return {
        ...c,
        availableSeats: Math.max(0, effectiveAvailable),
        sectionAvailableSeats: secAlloc?.availableSeats,
        sectionMaxSeats: secAlloc?.maxSeats,
        alternatives,
      };
    });

    const snapshot = userReg.receiptSnapshot as any;

    return {
      success: true,
      hasRegistered: true,
      event: {
        id: event.id,
        name: event.name,
        openDate: event.openDate,
        closeDate: event.closeDate,
        status: event.status,
        allowEditing: event.allowEditing,
        enableWaitlist: event.enableWaitlist,
        autoClose: event.autoClose,
        isOpen: windowCheck.isOpen,
        reason: windowCheck.reason,
      },
      registration: {
        id: userReg.id,
        status: userReg.status,
        receiptNumber: userReg.receiptNumber,
        submittedAt: userReg.submittedAt,
        receiptSnapshot: snapshot,
      },
      student: {
        name: snapshot?.student?.name || student.name,
        registerNumber: snapshot?.student?.registerNumber || student.registerNumber || "N/A",
        email: snapshot?.student?.email || student.email,
        department: snapshot?.student?.department,
        degree: snapshot?.student?.degree,
        section: snapshot?.student?.section,
      },
      choices: formattedChoices,
    };
  } catch (error: unknown) {
    console.error("Get student registration error:", error);
    return { success: false, error: "Failed to load registration details." };
  }
}
