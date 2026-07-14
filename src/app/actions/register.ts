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
  electiveGroups
} from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth";

interface RegisterResult {
  success: boolean;
  error?: string;
}

/**
 * Handles the registration of electives for the logged-in student.
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

    // Time-based validation (openDate/closeDate are the source of truth)
    const now = new Date();

    const isStarted =
      (event.openDate && now >= event.openDate) ||
      event.status === "OPEN" ||
      event.status === "ACTIVE";

    const isEnded =
      (event.closeDate && now > event.closeDate) ||
      event.status === "CLOSED" ||
      event.status === "VERIFICATION" ||
      event.status === "FINALIZED";

    if (!isStarted || isEnded) {
      return { success: false, error: "Registration is currently closed." };
    }

    // 5. Execute Transaction
    await db.transaction(async (tx) => {
      // Check existing registrations in the main registrations table
      const [existingReg] = await tx
        .select()
        .from(registrations)
        .where(and(eq(registrations.studentId, studentId), eq(registrations.eventId, eventId)))
        .limit(1);

      if (existingReg && existingReg.status === "CONFIRMED") {
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
      const electiveSnapshots: { groupName: string; electiveName: string }[] = [];

      for (const sel of selections) {
        const elective = lockedElectivesMap.get(sel.electiveId);

        if (!elective || !elective.isActive) {
          throw new Error("Selected elective is invalid or inactive.");
        }
        if (elective.groupId !== sel.groupId) {
          throw new Error("Elective does not belong to the correct group.");
        }
        if (elective.availableSeats <= 0) {
          throw new Error(`Seats are fully booked for elective: ${elective.name}`);
        }

        // Fetch group details for snapshot
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

        // Insert selection choice
        await tx.insert(studentRegistrations).values({
          studentId,
          eventId,
          groupId: sel.groupId,
          electiveId: sel.electiveId,
          isLocked: true,
        });
      }

      // Generate sequence number for receipt
      const isOdd = event.name.toLowerCase().includes("odd");
      const semester = isOdd ? "ODD" : "EVEN";
      const year = new Date().getFullYear();

      const [seqRow] = await tx
        .select({
          maxSeq: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${registrations.receiptNumber} FROM 14) AS INTEGER)), 0)`,
        })
        .from(registrations);

      const nextSeq = (seqRow?.maxSeq || 0) + 1;
      const receiptNumber = `ELC-${year}-${semester}-${String(nextSeq).padStart(6, "0")}`;

      const receiptSnapshot = {
        receiptNumber,
        submittedAt: new Date().toISOString(),
        student: studentDetails,
        electives: electiveSnapshots,
      };

      // Insert/Update registrations table setting to CONFIRMED
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
    });

    return { success: true };
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
