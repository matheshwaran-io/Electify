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
import { eq, and, sql, inArray, desc, not, asc } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getRegistrationWindow, STUDENT_VISIBLE_EVENT_STATUSES } from "@/lib/registration-window";

export type RegisterErrorCode =
  | "UNAUTHORIZED"
  | "MAINTENANCE"
  | "INELIGIBLE"
  | "NOT_FOUND"
  | "WRONG_EVENT"
  | "WINDOW_CLOSED"
  | "INVALID_SELECTION"
  | "SEAT_TAKEN"
  | "ALREADY_REGISTERED"
  | "SERVER_ERROR";

export interface RegisterResult {
  success: boolean;
  error?: string;
  /** Machine-readable reason, so the UI never has to parse `error`. */
  code?: RegisterErrorCode;
  /** For SEAT_TAKEN: the elective that ran out of seats. */
  electiveId?: string;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  message?: string;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** A student may submit a fresh registration only from one of these states. */
const REREGISTERABLE_STATUSES = new Set(["NOT_REGISTERED", "CANCELLED", "RESET_BY_COORDINATOR"]);

/**
 * Checks whether an event's registration window is currently open for student actions.
 * Thin wrapper over the shared rule in lib/registration-window.
 */
export async function isEventRegistrationOpen(event: {
  openDate: Date | null;
  closeDate: Date | null;
  status: string;
  autoClose?: boolean;
}): Promise<{ isOpen: boolean; reason?: string }> {
  const window = getRegistrationWindow(event, new Date());
  return window.isOpen ? { isOpen: true } : { isOpen: false, reason: window.reason };
}

function displayName(e: { courseCode: string | null; name: string }) {
  return e.courseCode ? `${e.courseCode} - ${e.name}` : e.name;
}

/** Thrown when a seat ran out between the student opening the page and submitting. */
class SeatTakenError extends Error {
  constructor(readonly electiveId: string, name: string) {
    super(`The last seat in ${name} was just taken. Please choose another elective.`);
  }
}

class RegistrationRuleError extends Error {
  constructor(readonly code: RegisterErrorCode, message: string) {
    super(message);
  }
}

/** Returns one confirmed seat to the elective and, if configured, the student's section quota. */
async function releaseSeat(tx: Tx, electiveId: string, sectionId: string | null) {
  await tx
    .update(electives)
    .set({ availableSeats: sql`${electives.availableSeats} + 1`, isFull: false, updatedAt: new Date() })
    .where(eq(electives.id, electiveId));

  if (sectionId) {
    const [secAlloc] = await tx
      .select()
      .from(electiveSeatAllocations)
      .where(and(eq(electiveSeatAllocations.electiveId, electiveId), eq(electiveSeatAllocations.sectionId, sectionId)))
      .for("update");
    if (secAlloc) {
      await tx
        .update(electiveSeatAllocations)
        .set({ availableSeats: sql`${electiveSeatAllocations.availableSeats} + 1`, isFull: false, updatedAt: new Date() })
        .where(eq(electiveSeatAllocations.id, secAlloc.id));
    }
  }
}

/**
 * Takes one seat for the student, checking the elective and the student's section quota
 * on rows the caller has locked. Throws if either is full.
 */
async function takeSeat(tx: Tx, elective: typeof electives.$inferSelect, sectionId: string | null) {
  if (elective.availableSeats <= 0) throw new SeatTakenError(elective.id, elective.name);

  let secAllocId: string | null = null;
  if (sectionId) {
    const [secAlloc] = await tx
      .select()
      .from(electiveSeatAllocations)
      .where(and(eq(electiveSeatAllocations.electiveId, elective.id), eq(electiveSeatAllocations.sectionId, sectionId)))
      .for("update");
    if (secAlloc) {
      if (secAlloc.availableSeats <= 0) throw new SeatTakenError(elective.id, elective.name);
      secAllocId = secAlloc.id;
    }
  }

  await tx
    .update(electives)
    .set({
      availableSeats: sql`${electives.availableSeats} - 1`,
      isFull: sql`CASE WHEN ${electives.availableSeats} - 1 <= 0 THEN true ELSE false END`,
      updatedAt: new Date(),
    })
    .where(eq(electives.id, elective.id));

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
}

/** Loads and validates the student for a registration mutation. */
async function loadStudent(studentId: string) {
  const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1);
  return student ?? null;
}

async function maintenanceOn() {
  const [settings] = await db.select().from(systemSettings).where(eq(systemSettings.id, "system")).limit(1);
  return Boolean(settings?.maintenanceMode);
}

/**
 * Handles initial elective registration for the logged-in student.
 *
 * Everything is re-checked here on the server at submit time; the countdown and
 * disabled buttons in the UI are conveniences only.
 */
export async function registerElectives(
  eventId: string,
  selections: { groupId: string; electiveId: string }[]
): Promise<RegisterResult> {
  try {
    // 1. Authenticate user
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return { success: false, code: "UNAUTHORIZED", error: "Unauthorized. Please log in as a student." };
    }

    const studentId = session.userId;

    // 2. Maintenance mode
    if (await maintenanceOn()) {
      return { success: false, code: "MAINTENANCE", error: "System is currently undergoing maintenance." };
    }

    // 3. Student
    const student = await loadStudent(studentId);
    if (!student) {
      return { success: false, code: "NOT_FOUND", error: "Student record not found." };
    }
    if (!student.isActive) {
      return { success: false, code: "INELIGIBLE", error: "Your account is deactivated." };
    }
    if (!student.isEligible) {
      return { success: false, code: "INELIGIBLE", error: "You are not eligible for registration. Please contact faculty." };
    }

    // 4. Event: exists, is for this student's batch, and is open right now (server clock)
    const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
    if (!event) {
      return { success: false, code: "NOT_FOUND", error: "Registration event not found." };
    }
    if (!student.academicBatchId || event.academicBatchId !== student.academicBatchId) {
      return { success: false, code: "WRONG_EVENT", error: "This registration event is not open to your batch." };
    }

    const window = getRegistrationWindow(event, new Date());
    if (!window.isOpen) {
      return { success: false, code: "WINDOW_CLOSED", error: window.reason || "Registration is currently closed." };
    }

    // 5. Selections: well formed, in this event, within limits
    if (!Array.isArray(selections) || selections.length === 0) {
      return { success: false, code: "INVALID_SELECTION", error: "Choose at least one elective before submitting." };
    }

    const eventGroups = await db.select().from(electiveGroups).where(eq(electiveGroups.eventId, eventId));
    const groupsById = new Map(eventGroups.map((g) => [g.id, g]));
    const perGroup = new Map<string, number>();
    const seenElectives = new Set<string>();

    for (const sel of selections) {
      const group = groupsById.get(sel.groupId);
      if (!group) {
        return { success: false, code: "INVALID_SELECTION", error: "One of your choices does not belong to this registration event." };
      }
      if (seenElectives.has(sel.electiveId)) {
        return { success: false, code: "INVALID_SELECTION", error: "The same elective was selected more than once." };
      }
      seenElectives.add(sel.electiveId);
      const count = (perGroup.get(sel.groupId) ?? 0) + 1;
      perGroup.set(sel.groupId, count);
      // One stored choice per group (unique student/event/group), and never above the group's limit.
      if (count > Math.min(group.maxChoices, 1)) {
        return { success: false, code: "INVALID_SELECTION", error: `Too many choices for ${group.name}.` };
      }
    }

    // 6. Transaction: locks, seat checks, records, receipt
    await db.transaction(async (tx) => {
      const [existingReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1)
        .for("update");

      if (existingReg && !REREGISTERABLE_STATUSES.has(existingReg.status)) {
        throw new RegistrationRuleError("ALREADY_REGISTERED", "Registration already completed.");
      }

      // Student details for the receipt snapshot
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

      // Lock chosen electives in a stable order so concurrent submissions cannot deadlock.
      const ordered = [...selections].sort((a, b) => a.electiveId.localeCompare(b.electiveId));
      const lockedElectives = await tx
        .select()
        .from(electives)
        .where(inArray(electives.id, ordered.map((s) => s.electiveId)))
        .orderBy(asc(electives.id))
        .for("update");
      const lockedById = new Map(lockedElectives.map((e) => [e.id, e]));

      const electiveSnapshots: {
        groupId: string;
        groupName: string;
        electiveId: string;
        electiveName: string;
        courseCode?: string;
        status: "CONFIRMED";
      }[] = [];

      for (const sel of ordered) {
        const elective = lockedById.get(sel.electiveId);
        if (!elective || !elective.isActive) {
          throw new RegistrationRuleError("INVALID_SELECTION", "Selected elective is invalid or inactive.");
        }
        if (elective.groupId !== sel.groupId) {
          throw new RegistrationRuleError("INVALID_SELECTION", "Elective does not belong to the correct group.");
        }

        await takeSeat(tx, elective, student.sectionId);

        const name = displayName(elective);
        electiveSnapshots.push({
          groupId: sel.groupId,
          groupName: groupsById.get(sel.groupId)?.name || "Unknown Group",
          electiveId: sel.electiveId,
          electiveName: name,
          courseCode: elective.courseCode || undefined,
          status: "CONFIRMED",
        });

        // Upsert: a previously cancelled choice for this group is reused.
        await tx
          .insert(studentRegistrations)
          .values({
            studentId,
            eventId,
            groupId: sel.groupId,
            electiveId: sel.electiveId,
            status: "CONFIRMED",
            isLocked: true,
            submittedAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [studentRegistrations.studentId, studentRegistrations.eventId, studentRegistrations.groupId],
            set: {
              electiveId: sel.electiveId,
              status: "CONFIRMED",
              isLocked: true,
              submittedAt: new Date(),
              updatedAt: new Date(),
            },
          });

        await tx.insert(replayEvents).values({
          registrationEventId: eventId,
          studentId,
          studentName: studentDetails.name,
          eventType: "STUDENT_REGISTERED",
          subjectId: sel.electiveId,
          subjectName: name,
          seatBefore: elective.availableSeats,
          seatAfter: elective.availableSeats - 1,
        });
      }

      // Keep the snapshot in the event's group order for a readable receipt.
      const groupOrder = new Map(eventGroups.map((g) => [g.id, g.sortOrder]));
      electiveSnapshots.sort((a, b) => (groupOrder.get(a.groupId) ?? 0) - (groupOrder.get(b.groupId) ?? 0));

      // Receipt number. The advisory lock serialises allocation so two simultaneous
      // confirmations can never compute the same number.
      const isOdd = event.name.toLowerCase().includes("odd");
      const semester = isOdd ? "ODD" : "EVEN";
      const year = new Date().getFullYear();

      let receiptNumber = existingReg?.receiptNumber;
      if (!receiptNumber) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('electify_receipt_number'))`);
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
      };

      if (existingReg) {
        await tx
          .update(registrations)
          .set({ status: "CONFIRMED", receiptNumber, receiptSnapshot, submittedAt: new Date(), updatedAt: new Date() })
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

      await tx.insert(auditLogs).values({
        action: "STUDENT_REGISTERED",
        userId: studentId,
        userRole: "STUDENT",
        metadata: { eventId, receiptNumber, selectionsCount: selections.length },
      });
    });

    return { success: true };
  } catch (error: unknown) {
    if (error instanceof SeatTakenError) {
      return { success: false, code: "SEAT_TAKEN", error: error.message, electiveId: error.electiveId };
    }
    if (error instanceof RegistrationRuleError) {
      return { success: false, code: error.code, error: error.message };
    }
    console.error("Registration transaction error:", error instanceof Error ? error.message : error);
    return {
      success: false,
      code: "SERVER_ERROR",
      error: "Registration didn't go through because of a server error. Nothing was registered. Please try again.",
    };
  }
}

/** Shared guard for change/cancel: session, maintenance, eligibility, window. */
async function authorizeModification(eventId: string, requireEditing: boolean) {
  const session = await getSession();
  if (!session || session.role !== "STUDENT") {
    return { error: "Unauthorized. Please log in as a student." } as const;
  }

  if (await maintenanceOn()) {
    return { error: "System is currently undergoing maintenance." } as const;
  }

  const student = await loadStudent(session.userId);
  if (!student || !student.isActive || !student.isEligible) {
    return { error: "You are not eligible to modify registrations. Please contact faculty." } as const;
  }

  const [event] = await db.select().from(registrationEvents).where(eq(registrationEvents.id, eventId)).limit(1);
  if (!event) {
    return { error: "Registration event not found." } as const;
  }

  const window = getRegistrationWindow(event, new Date());
  if (!window.isOpen) {
    return { error: window.reason || "Registration window is closed." } as const;
  }

  if (requireEditing && !event.allowEditing) {
    return { error: "Elective modifications are disabled for this registration event." } as const;
  }

  return { student, event } as const;
}

/** Recomputes the parent registration's status from its active choices. */
async function activeChoices(tx: Tx, studentId: string, eventId: string) {
  return tx
    .select()
    .from(studentRegistrations)
    .where(
      and(
        eq(studentRegistrations.studentId, studentId),
        eq(studentRegistrations.eventId, eventId),
        not(eq(studentRegistrations.status, "CANCELLED"))
      )
    );
}

function markCancelled(name: string | undefined) {
  const base = (name ?? "Elective").trim();
  return base.endsWith("[Cancelled]") ? base : `${base} [Cancelled]`;
}

/**
 * Changes an existing elective choice to another elective in the same group.
 *
 * Rules:
 * - Student must own the registration; window must be open and allow editing.
 * - Replacement must be active, in the same group, and have a seat for this student.
 * - The replacement seat is taken before the old seat is released, in one transaction.
 * - A full replacement is rejected; the student keeps their current seat.
 */
export async function changeStudentElective(
  eventId: string,
  groupId: string,
  currentElectiveId: string,
  replacementElectiveId: string
): Promise<MutationResult> {
  try {
    if (currentElectiveId === replacementElectiveId) {
      return { success: false, error: "You already have this elective selected." };
    }

    const auth = await authorizeModification(eventId, true);
    if ("error" in auth) return { success: false, error: auth.error };
    const { student } = auth;
    const studentId = student.id;

    return await db.transaction(async (tx) => {
      // 1. Lock the student's current choice for this group
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

      // 2. Not already held in another group
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

      // 3. Lock both electives in a stable order, then validate the replacement
      const lockedPair = await tx
        .select()
        .from(electives)
        .where(inArray(electives.id, [currentElectiveId, replacementElectiveId]))
        .orderBy(asc(electives.id))
        .for("update");
      const replacement = lockedPair.find((e) => e.id === replacementElectiveId);
      const oldElective = lockedPair.find((e) => e.id === currentElectiveId);

      if (!replacement || !replacement.isActive) {
        throw new Error("Replacement elective is not available or inactive.");
      }
      if (replacement.groupId !== groupId) {
        throw new Error("Replacement elective belongs to a different elective group.");
      }

      // 4. Take the replacement seat first (throws if full: current seat is kept)
      try {
        await takeSeat(tx, replacement, student.sectionId);
      } catch (err) {
        if (err instanceof SeatTakenError) {
          throw new Error(`${replacement.name} is full. Your current elective has not been changed.`);
        }
        throw err;
      }

      // 5. Release the old seat if it was confirmed
      if (currentReg.status === "CONFIRMED" && oldElective) {
        await releaseSeat(tx, currentElectiveId, student.sectionId);
      }

      // 6. Update the choice
      await tx
        .update(studentRegistrations)
        .set({ electiveId: replacementElectiveId, status: "CONFIRMED", updatedAt: new Date() })
        .where(eq(studentRegistrations.id, currentReg.id));

      // 7. Parent status and receipt snapshot
      const remaining = await activeChoices(tx, studentId, eventId);
      const overallStatus = remaining.length === 0 ? "CANCELLED" : "CONFIRMED";

      const [parentReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1)
        .for("update");

      const oldName = oldElective ? displayName(oldElective) : "Previous Elective";
      const replacementName = displayName(replacement);

      if (parentReg && parentReg.receiptSnapshot) {
        const snapshot = { ...(parentReg.receiptSnapshot as Record<string, unknown>) } as { electives?: Record<string, unknown>[] };
        if (Array.isArray(snapshot.electives)) {
          snapshot.electives = snapshot.electives.map((e) =>
            e.groupId === groupId || e.electiveId === currentElectiveId
              ? {
                  ...e,
                  electiveId: replacementElectiveId,
                  electiveName: replacementName,
                  courseCode: replacement.courseCode || undefined,
                  status: "CONFIRMED",
                }
              : e
          );
          await tx
            .update(registrations)
            .set({ status: overallStatus, receiptSnapshot: snapshot, updatedAt: new Date() })
            .where(eq(registrations.id, parentReg.id));
        }
      }

      // 8. Replay event and audit log
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
        seatAfter: replacement.availableSeats - 1,
        performedBy: studentId,
      });

      await tx.insert(auditLogs).values({
        action: "STUDENT_CHANGED_ELECTIVE",
        userId: studentId,
        userRole: "STUDENT",
        metadata: { eventId, groupId, oldElectiveId: currentElectiveId, newElectiveId: replacementElectiveId },
      });

      return { success: true };
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to change elective. Please try again.";
    console.error("Change elective error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Cancels a single elective registration for the authenticated student.
 *
 * Rules:
 * - The choice is marked CANCELLED, never deleted, so receipts and audit stay intact.
 * - A confirmed seat is released back to the elective (and section quota).
 * - Overall registration status and receipt snapshot are updated.
 * - The deadline is enforced on the server.
 */
export async function cancelStudentElective(eventId: string, groupId: string, electiveId: string): Promise<MutationResult> {
  try {
    const auth = await authorizeModification(eventId, false);
    if ("error" in auth) return { success: false, error: auth.error };
    const { student } = auth;
    const studentId = student.id;

    return await db.transaction(async (tx) => {
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

      const [elective] = await tx.select().from(electives).where(eq(electives.id, electiveId)).for("update");

      if (currentReg.status === "CONFIRMED" && elective) {
        await releaseSeat(tx, electiveId, student.sectionId);
      }

      await tx
        .update(studentRegistrations)
        .set({ status: "CANCELLED", updatedAt: new Date() })
        .where(eq(studentRegistrations.id, currentReg.id));

      const remaining = await activeChoices(tx, studentId, eventId);
      const overallStatus = remaining.length > 0 ? "CONFIRMED" : "CANCELLED";

      const [parentReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1)
        .for("update");

      const electiveName = elective ? displayName(elective) : "Elective";

      if (parentReg) {
        const snapshot = parentReg.receiptSnapshot ? ({ ...(parentReg.receiptSnapshot as Record<string, unknown>) } as { electives?: Record<string, unknown>[] }) : null;
        if (snapshot && Array.isArray(snapshot.electives)) {
          snapshot.electives = snapshot.electives.map((e) =>
            e.groupId === groupId || e.electiveId === electiveId
              ? { ...e, status: "CANCELLED", electiveName: markCancelled(e.electiveName as string | undefined) }
              : e
          );
        }
        await tx
          .update(registrations)
          .set({ status: overallStatus, receiptSnapshot: snapshot ?? parentReg.receiptSnapshot, updatedAt: new Date() })
          .where(eq(registrations.id, parentReg.id));
      }

      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId,
        studentName: student.name,
        eventType: "ELECTIVE_CANCELLED",
        subjectId: electiveId,
        subjectName: electiveName,
        performedBy: studentId,
        metadata: { groupId },
      });

      await tx.insert(auditLogs).values({
        action: "STUDENT_CANCELLED_ELECTIVE",
        userId: studentId,
        userRole: "STUDENT",
        metadata: { eventId, groupId, electiveId },
      });

      return { success: true };
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel elective. Please try again.";
    console.error("Cancel elective error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Cancels the student's entire registration for an event.
 *
 * Rules:
 * - Releases every confirmed seat.
 * - Marks every choice and the parent registration CANCELLED atomically.
 * - Rejected if already cancelled.
 */
export async function cancelEntireRegistration(eventId: string): Promise<MutationResult> {
  try {
    const auth = await authorizeModification(eventId, false);
    if ("error" in auth) return { success: false, error: auth.error };
    const { student } = auth;
    const studentId = student.id;

    return await db.transaction(async (tx) => {
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
        .orderBy(asc(studentRegistrations.electiveId))
        .for("update");

      for (const choice of userChoices) {
        if (choice.status === "CONFIRMED") {
          const [elective] = await tx.select().from(electives).where(eq(electives.id, choice.electiveId)).for("update");
          if (elective) {
            await releaseSeat(tx, choice.electiveId, student.sectionId);
          }
        }

        await tx
          .update(studentRegistrations)
          .set({ status: "CANCELLED", updatedAt: new Date() })
          .where(eq(studentRegistrations.id, choice.id));

        await tx.insert(replayEvents).values({
          registrationEventId: eventId,
          studentId,
          studentName: student.name,
          eventType: "ELECTIVE_CANCELLED",
          subjectId: choice.electiveId,
          performedBy: studentId,
        });
      }

      let snapshot = parentReg.receiptSnapshot as { electives?: Record<string, unknown>[] } | null;
      if (snapshot && Array.isArray(snapshot.electives)) {
        snapshot = {
          ...snapshot,
          status: "CANCELLED",
          electives: snapshot.electives.map((e) => ({
            ...e,
            status: "CANCELLED",
            electiveName: markCancelled(e.electiveName as string | undefined),
          })),
        } as typeof snapshot;
      }

      await tx
        .update(registrations)
        .set({ status: "CANCELLED", receiptSnapshot: snapshot ?? parentReg.receiptSnapshot, updatedAt: new Date() })
        .where(eq(registrations.id, parentReg.id));

      await tx.insert(replayEvents).values({
        registrationEventId: eventId,
        studentId,
        studentName: student.name,
        eventType: "REGISTRATION_CANCELLED",
        performedBy: studentId,
        metadata: { releasedChoicesCount: userChoices.length, receiptNumber: parentReg.receiptNumber },
      });

      await tx.insert(auditLogs).values({
        action: "STUDENT_CANCELLED_REGISTRATION",
        userId: studentId,
        userRole: "STUDENT",
        metadata: { eventId, receiptNumber: parentReg.receiptNumber, cancelledCount: userChoices.length },
      });

      return { success: true };
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel registration. Please try again.";
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

    // Resolve event (only events for this student's batch)
    let targetEventId = eventId;
    if (!targetEventId) {
      const [latestEvent] = await db
        .select()
        .from(registrationEvents)
        .where(
          and(
            eq(registrationEvents.academicBatchId, student.academicBatchId),
            inArray(registrationEvents.status, [...STUDENT_VISIBLE_EVENT_STATUSES])
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
      .where(and(eq(registrationEvents.id, targetEventId), eq(registrationEvents.academicBatchId, student.academicBatchId)))
      .limit(1);

    if (!event) {
      return { success: false, error: "Event not found" };
    }

    const windowCheck = getRegistrationWindow(event, new Date());
    const eventSummary = {
      id: event.id,
      name: event.name,
      openDate: event.openDate,
      closeDate: event.closeDate,
      status: event.status,
      allowEditing: event.allowEditing,
      autoClose: event.autoClose,
      isOpen: windowCheck.isOpen,
      reason: windowCheck.reason,
    };

    const [userReg] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, event.id)))
      .limit(1);

    if (!userReg) {
      return { success: true, hasRegistered: false, event: eventSummary };
    }

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
        .where(and(inArray(electiveSeatAllocations.electiveId, choiceElectiveIds), eq(electiveSeatAllocations.sectionId, student.sectionId)));
    }

    // Alternatives per group for the "Change elective" picker
    const groupIds = Array.from(new Set(studentChoices.map((c) => c.groupId)));
    let alternativeElectives: {
      id: string;
      groupId: string;
      name: string;
      courseCode: string | null;
      credits: number;
      description: string | null;
      maxSeats: number;
      availableSeats: number;
      isFull: boolean;
      isActive: boolean;
    }[] = [];

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

    const alternativesByGroup = new Map<string, (typeof alternativeElectives[number] & { sectionAvailableSeats?: number; sectionMaxSeats?: number })[]>();
    for (const alt of alternativeElectives) {
      const secAlloc = allSectionAllocs.find((s) => s.electiveId === alt.id);
      const effectiveAvailable = secAlloc ? Math.min(alt.availableSeats, secAlloc.availableSeats) : alt.availableSeats;
      const item = {
        ...alt,
        availableSeats: Math.max(0, effectiveAvailable),
        isFull: effectiveAvailable <= 0,
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

    const snapshot = userReg.receiptSnapshot as { student?: Record<string, string> } | null;

    return {
      success: true,
      hasRegistered: true,
      event: eventSummary,
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
