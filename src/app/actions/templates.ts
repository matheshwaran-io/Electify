"use server";

import { db } from "@/lib/db";
import {
  eventTemplates,
  templateGroups,
  templateElectives,
  registrationEvents,
  eventSections,
  electiveGroups,
  electives,
  electiveSeatAllocations,
  programmes,
  academicBatches,
  sections,
  users,
  auditLogs,
} from "@/lib/db/schema";
import { eq, asc, desc, inArray, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function safeRevalidatePath(...paths: string[]) {
  try {
    for (const p of paths) {
      revalidatePath(p);
    }
  } catch {
    // Non-HTTP or test runner context without static generation store
  }
}

export interface TemplateElectiveItem {
  id: string;
  courseCode: string | null;
  name: string;
  credits: number;
  description: string | null;
  defaultMaxSeats: number;
}

export interface TemplateGroupItem {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
  sortOrder: number;
  electives: TemplateElectiveItem[];
}

export interface DetailedTemplate {
  id: string;
  name: string;
  description: string | null;
  programmeId: string;
  programmeName: string | null;
  programmeCode: string | null;
  createdById: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
  groupCount: number;
  electiveCount: number;
  groups: TemplateGroupItem[];
  canDelete?: boolean;
  deleteRestrictionReason?: string;
}

export interface TemplateBatchOption {
  id: string;
  year: string;
  programmeId: string;
  programmeName: string | null;
  programmeCode: string | null;
  sectionCount: number;
}

export async function getAllProgrammes(): Promise<{ id: string; name: string; code: string }[]> {
  return await db
    .select({
      id: programmes.id,
      name: programmes.name,
      code: programmes.code,
    })
    .from(programmes)
    .where(eq(programmes.isActive, true))
    .orderBy(asc(programmes.name));
}

/**
 * Fetch all event templates with complete details and nested groups/electives.
 * Populates role-scoped permissions (canDelete) based on user role and programme assignment.
 */
export async function getTemplatesWithDetails(): Promise<{
  success: boolean;
  data?: DetailedTemplate[];
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
      return { success: false, error: "Unauthorized access to templates." };
    }

    // 1. Fetch templates
    const templatesQuery = db
      .select({
        id: eventTemplates.id,
        name: eventTemplates.name,
        description: eventTemplates.description,
        programmeId: eventTemplates.programmeId,
        programmeName: programmes.name,
        programmeCode: programmes.code,
        createdById: eventTemplates.createdById,
        creatorName: users.name,
        createdAt: eventTemplates.createdAt,
        updatedAt: eventTemplates.updatedAt,
      })
      .from(eventTemplates)
      .leftJoin(programmes, eq(eventTemplates.programmeId, programmes.id))
      .leftJoin(users, eq(eventTemplates.createdById, users.id));

    // Faculty members can explore all reusable templates; role-based deletion is strictly guarded
    const rawTemplates = await templatesQuery.orderBy(desc(eventTemplates.createdAt));

    if (rawTemplates.length === 0) {
      return { success: true, data: [] };
    }

    const templateIds = rawTemplates.map((t) => t.id);

    // 2. Fetch all groups for these templates
    const rawGroups = await db
      .select({
        id: templateGroups.id,
        templateId: templateGroups.templateId,
        name: templateGroups.name,
        minChoices: templateGroups.minChoices,
        maxChoices: templateGroups.maxChoices,
        sortOrder: templateGroups.sortOrder,
      })
      .from(templateGroups)
      .where(inArray(templateGroups.templateId, templateIds))
      .orderBy(asc(templateGroups.sortOrder), asc(templateGroups.name));

    const groupIds = rawGroups.map((g) => g.id);

    // 3. Fetch all electives for these groups
    let rawElectives: (typeof templateElectives.$inferSelect)[] = [];
    if (groupIds.length > 0) {
      rawElectives = await db
        .select()
        .from(templateElectives)
        .where(inArray(templateElectives.groupId, groupIds))
        .orderBy(asc(templateElectives.courseCode), asc(templateElectives.name));
    }

    // Group electives by group ID
    const electivesByGroup = new Map<string, TemplateElectiveItem[]>();
    rawElectives.forEach((e) => {
      const list = electivesByGroup.get(e.groupId) || [];
      list.push({
        id: e.id,
        courseCode: e.courseCode,
        name: e.name,
        credits: e.credits,
        description: e.description,
        defaultMaxSeats: e.defaultMaxSeats,
      });
      electivesByGroup.set(e.groupId, list);
    });

    // Group template groups by template ID
    const groupsByTemplate = new Map<string, TemplateGroupItem[]>();
    rawGroups.forEach((g) => {
      const list = groupsByTemplate.get(g.templateId) || [];
      list.push({
        id: g.id,
        name: g.name,
        minChoices: g.minChoices,
        maxChoices: g.maxChoices,
        sortOrder: g.sortOrder,
        electives: electivesByGroup.get(g.id) || [],
      });
      groupsByTemplate.set(g.templateId, list);
    });

    // Assemble final response with role-based canDelete permissions
    const detailedList: DetailedTemplate[] = rawTemplates.map((t) => {
      const tGroups = groupsByTemplate.get(t.id) || [];
      const totalElectives = tGroups.reduce((acc, g) => acc + g.electives.length, 0);

      // Role permission determination:
      // - SYSTEM_ADMIN: Universal permission to delete any template
      // - COURSE_COORDINATOR: Can delete if template belongs to their programme OR created by them
      // - CLASS_TUTOR / STUDENT: No deletion permission
      let canDelete = false;
      let deleteRestrictionReason: string | undefined = undefined;

      if (session.role === "SYSTEM_ADMIN") {
        canDelete = true;
      } else if (session.role === "COURSE_COORDINATOR") {
        const isProgrammeMatch = Boolean(
          session.programmeId && session.programmeId === t.programmeId
        );
        const isCreator = Boolean(session.userId && session.userId === t.createdById);

        if (isProgrammeMatch || isCreator) {
          canDelete = true;
        } else {
          canDelete = false;
          deleteRestrictionReason = `Restricted: Course coordinators can only delete templates belonging to their assigned programme (${
            t.programmeCode || t.programmeName || "assigned"
          }) or templates created by themselves.`;
        }
      } else {
        canDelete = false;
        deleteRestrictionReason =
          "Restricted: Only system administrators and assigned course coordinators can delete templates.";
      }

      return {
        id: t.id,
        name: t.name,
        description: t.description,
        programmeId: t.programmeId,
        programmeName: t.programmeName,
        programmeCode: t.programmeCode,
        createdById: t.createdById,
        creatorName: t.creatorName,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        groupCount: tGroups.length,
        electiveCount: totalElectives,
        groups: tGroups,
        canDelete,
        deleteRestrictionReason,
      };
    });

    return { success: true, data: detailedList };
  } catch (error) {
    console.error("Error fetching templates with details:", error);
    return { success: false, error: "Failed to load event templates." };
  }
}

/**
 * Fetch available academic batches for a template's programme.
 */
export async function getTemplateBatchOptions(
  programmeId?: string
): Promise<{ success: boolean; data?: TemplateBatchOption[]; error?: string }> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
      return { success: false, error: "Unauthorized" };
    }

    const query = db
      .select({
        id: academicBatches.id,
        year: academicBatches.year,
        programmeId: academicBatches.programmeId,
        programmeName: programmes.name,
        programmeCode: programmes.code,
      })
      .from(academicBatches)
      .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
      .where(programmeId ? eq(academicBatches.programmeId, programmeId) : undefined)
      .orderBy(desc(academicBatches.year), asc(programmes.name));

    const batches = await query;
    const batchIds = batches.map((b) => b.id);

    // Count sections per batch
    const sectionCounts =
      batchIds.length > 0
        ? await db
            .select({
              batchId: sections.academicBatchId,
              count: sql<number>`count(*)::int`,
            })
            .from(sections)
            .where(inArray(sections.academicBatchId, batchIds))
            .groupBy(sections.academicBatchId)
        : [];

    const sectionCountMap = new Map(sectionCounts.map((sc) => [sc.batchId, sc.count]));

    const result: TemplateBatchOption[] = batches.map((b) => ({
      id: b.id,
      year: b.year,
      programmeId: b.programmeId,
      programmeName: b.programmeName,
      programmeCode: b.programmeCode,
      sectionCount: sectionCountMap.get(b.id) || 0,
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching template batch options:", error);
    return { success: false, error: "Failed to fetch batches." };
  }
}

/**
 * Creates a brand new registration event from a template, copying all
 * groups, electives, and creating section allocations automatically.
 */
export async function createEventFromTemplate(input: {
  templateId: string;
  name: string;
  academicBatchId: string;
  academicYear?: string;
  description?: string;
  openDate?: string | null;
  closeDate?: string | null;
  status?: string;
}): Promise<{ success: boolean; eventId?: string; eventName?: string; error?: string }> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
      return { success: false, error: "Unauthorized access to create event from template." };
    }

    const eventName = input.name.trim();
    if (!eventName) {
      return { success: false, error: "Event name is required." };
    }
    if (!input.academicBatchId) {
      return { success: false, error: "Please select an academic batch." };
    }

    // 1. Fetch template and its structure
    const [template] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, input.templateId))
      .limit(1);

    if (!template) {
      return { success: false, error: "Template not found." };
    }

    const tGroups = await db
      .select()
      .from(templateGroups)
      .where(eq(templateGroups.templateId, input.templateId))
      .orderBy(asc(templateGroups.sortOrder), asc(templateGroups.name));

    const tGroupIds = tGroups.map((g) => g.id);
    const tElectives =
      tGroupIds.length > 0
        ? await db
            .select()
            .from(templateElectives)
            .where(inArray(templateElectives.groupId, tGroupIds))
            .orderBy(asc(templateElectives.courseCode), asc(templateElectives.name))
        : [];

    // 2. Fetch department and sections for this academic batch
    const [batch] = await db
      .select({
        departmentId: programmes.departmentId,
      })
      .from(academicBatches)
      .innerJoin(programmes, eq(academicBatches.programmeId, programmes.id))
      .where(eq(academicBatches.id, input.academicBatchId))
      .limit(1);

    if (!batch?.departmentId) {
      return { success: false, error: "Target batch is not linked to a valid department." };
    }

    const batchSections = await db
      .select({
        id: sections.id,
      })
      .from(sections)
      .where(eq(sections.academicBatchId, input.academicBatchId));

    // 3. Execute in atomic transaction
    const newEvent = await db.transaction(async (tx) => {
      const openDate = input.openDate ? new Date(input.openDate) : null;
      const closeDate = input.closeDate ? new Date(input.closeDate) : null;

      // 3.1 Create registration event
      const [event] = await tx
        .insert(registrationEvents)
        .values({
          name: eventName,
          academicBatchId: input.academicBatchId,
          academicYear: input.academicYear?.trim() || null,
          description: input.description?.trim() || template.description || null,
          openDate,
          closeDate,
          status: input.status || "DRAFT",
          createdById: session.userId,
          allowEditing: true,
          autoClose: true,
          enableWaitlist: false,
        })
        .returning();

      // 3.2 Insert sections into event_sections
      for (const sec of batchSections) {
        await tx.insert(eventSections).values({
          eventId: event.id,
          sectionId: sec.id,
        });
      }

      // 3.3 Clone groups and electives
      for (const tGroup of tGroups) {
        const [newEventGroup] = await tx
          .insert(electiveGroups)
          .values({
            eventId: event.id,
            name: tGroup.name,
            minChoices: tGroup.minChoices,
            maxChoices: tGroup.maxChoices,
          })
          .returning();

        const groupElectives = tElectives.filter((e) => e.groupId === tGroup.id);
        for (const tElective of groupElectives) {
          const maxSeats = tElective.defaultMaxSeats || 40;

          const [newElective] = await tx
            .insert(electives)
            .values({
              groupId: newEventGroup.id,
              name: tElective.name,
              courseCode: tElective.courseCode || null,
              credits: tElective.credits || 3,
              maxSeats,
              availableSeats: maxSeats,
              description: tElective.description || null,
              isFull: false,
              isActive: true,
            })
            .returning();

          // 3.4 Seed elective_seat_allocations for all batch sections
          for (const sec of batchSections) {
            await tx.insert(electiveSeatAllocations).values({
              electiveId: newElective.id,
              sectionId: sec.id,
              departmentId: batch.departmentId,
              maxSeats,
              availableSeats: maxSeats,
              isFull: false,
            });
          }
        }
      }

      // 3.5 Log audit event
      await tx.insert(auditLogs).values({
        action: "CREATE_EVENT_FROM_TEMPLATE",
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        newValue: {
          eventId: event.id,
          eventName: event.name,
          templateId: template.id,
          templateName: template.name,
          groupsCopied: tGroups.length,
          electivesCopied: tElectives.length,
        },
      });

      return event;
    });

    safeRevalidatePath(
      "/faculty/events",
      "/faculty/templates",
      "/faculty/dashboard",
      "/faculty/window"
    );

    return {
      success: true,
      eventId: newEvent.id,
      eventName: newEvent.name,
    };
  } catch (error: any) {
    console.error("Error creating event from template:", error);
    return {
      success: false,
      error: error.message || "Failed to create event from template.",
    };
  }
}

/**
 * Creates a new reusable event template with elective baskets and courses.
 */
export async function createTemplate(input: {
  name: string;
  programmeId: string;
  description?: string;
  groups: Array<{
    name: string;
    minChoices: number;
    maxChoices: number;
    electives: Array<{
      name: string;
      courseCode?: string;
      credits: number;
      defaultMaxSeats: number;
      description?: string;
    }>;
  }>;
}): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
      return { success: false, error: "Unauthorized" };
    }

    const name = input.name.trim();
    if (!name) return { success: false, error: "Template name is required." };
    if (!input.programmeId) return { success: false, error: "Programme is required." };

    const newTemplate = await db.transaction(async (tx) => {
      const [template] = await tx
        .insert(eventTemplates)
        .values({
          name,
          programmeId: input.programmeId,
          description: input.description?.trim() || null,
          createdById: session.userId,
        })
        .returning();

      let groupOrder = 1;
      for (const grp of input.groups || []) {
        const [newGroup] = await tx
          .insert(templateGroups)
          .values({
            templateId: template.id,
            name: grp.name.trim(),
            minChoices: grp.minChoices || 1,
            maxChoices: grp.maxChoices || 1,
            sortOrder: groupOrder++,
          })
          .returning();

        for (const el of grp.electives || []) {
          await tx.insert(templateElectives).values({
            groupId: newGroup.id,
            name: el.name.trim(),
            courseCode: el.courseCode?.trim() || null,
            credits: el.credits || 3,
            defaultMaxSeats: el.defaultMaxSeats || 40,
            description: el.description?.trim() || null,
          });
        }
      }

      await tx.insert(auditLogs).values({
        action: "CREATE_EVENT_TEMPLATE",
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        newValue: { templateId: template.id, name: template.name },
      });

      return template;
    });

    safeRevalidatePath("/faculty/templates");
    return { success: true, templateId: newTemplate.id };
  } catch (error: any) {
    console.error("Error creating template:", error);
    return { success: false, error: error.message || "Failed to create template." };
  }
}

/**
 * Duplicates an existing template including its groups and courses.
 */
export async function duplicateTemplate(
  templateId: string,
  customName?: string
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    const session = await getSession();
    if (!session || (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR")) {
      return { success: false, error: "Unauthorized" };
    }

    const [source] = await db
      .select()
      .from(eventTemplates)
      .where(eq(eventTemplates.id, templateId))
      .limit(1);

    if (!source) return { success: false, error: "Template not found." };

    const sourceGroups = await db
      .select()
      .from(templateGroups)
      .where(eq(templateGroups.templateId, templateId))
      .orderBy(asc(templateGroups.sortOrder));

    const sourceGroupIds = sourceGroups.map((g) => g.id);
    const sourceElectives =
      sourceGroupIds.length > 0
        ? await db
            .select()
            .from(templateElectives)
            .where(inArray(templateElectives.groupId, sourceGroupIds))
        : [];

    const newTemplate = await db.transaction(async (tx) => {
      const copyName = customName?.trim() || `${source.name} (Copy)`;

      const [cloned] = await tx
        .insert(eventTemplates)
        .values({
          name: copyName,
          programmeId: source.programmeId,
          description: source.description,
          createdById: session.userId,
        })
        .returning();

      for (const grp of sourceGroups) {
        const [clonedGroup] = await tx
          .insert(templateGroups)
          .values({
            templateId: cloned.id,
            name: grp.name,
            minChoices: grp.minChoices,
            maxChoices: grp.maxChoices,
            sortOrder: grp.sortOrder,
          })
          .returning();

        const electivesForGroup = sourceElectives.filter((e) => e.groupId === grp.id);
        for (const el of electivesForGroup) {
          await tx.insert(templateElectives).values({
            groupId: clonedGroup.id,
            name: el.name,
            courseCode: el.courseCode,
            credits: el.credits,
            defaultMaxSeats: el.defaultMaxSeats,
            description: el.description,
          });
        }
      }

      await tx.insert(auditLogs).values({
        action: "DUPLICATE_EVENT_TEMPLATE",
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        newValue: { originalId: templateId, clonedId: cloned.id, name: cloned.name },
      });

      return cloned;
    });

    safeRevalidatePath("/faculty/templates");
    return { success: true, templateId: newTemplate.id };
  } catch (error: any) {
    console.error("Error duplicating template:", error);
    return { success: false, error: error.message || "Failed to duplicate template." };
  }
}

/**
 * Deletes an event template with strict role-based access control:
 * - SYSTEM_ADMIN: Universal deletion permission across all templates.
 * - COURSE_COORDINATOR: Can only delete templates belonging to their assigned programme
 *   or templates they created themselves.
 * - Other roles: Denied.
 */
export async function deleteTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Unauthorized: Please sign in to proceed." };
    }

    if (session.role !== "SYSTEM_ADMIN" && session.role !== "COURSE_COORDINATOR") {
      return {
        success: false,
        error: "Permission denied: Your role does not have authorization to delete templates.",
      };
    }

    const [template] = await db
      .select({
        id: eventTemplates.id,
        name: eventTemplates.name,
        programmeId: eventTemplates.programmeId,
        createdById: eventTemplates.createdById,
      })
      .from(eventTemplates)
      .where(eq(eventTemplates.id, templateId))
      .limit(1);

    if (!template) {
      return { success: false, error: "Template not found or already deleted." };
    }

    // Role-based permission enforcement for Course Coordinators
    if (session.role === "COURSE_COORDINATOR") {
      const isProgrammeMatch = Boolean(
        session.programmeId && session.programmeId === template.programmeId
      );
      const isCreator = Boolean(session.userId && session.userId === template.createdById);

      if (!isProgrammeMatch && !isCreator) {
        return {
          success: false,
          error:
            "Permission denied: Course coordinators can only delete templates belonging to their assigned programme or created by themselves.",
        };
      }
    }

    await db.transaction(async (tx) => {
      // 1. Explicitly clean up children (cascading safety)
      const groups = await tx
        .select({ id: templateGroups.id })
        .from(templateGroups)
        .where(eq(templateGroups.templateId, templateId));

      const groupIds = groups.map((g) => g.id);
      if (groupIds.length > 0) {
        await tx
          .delete(templateElectives)
          .where(inArray(templateElectives.groupId, groupIds));
      }
      await tx
        .delete(templateGroups)
        .where(eq(templateGroups.templateId, templateId));

      // 2. Delete the template
      await tx
        .delete(eventTemplates)
        .where(eq(eventTemplates.id, templateId));

      // 3. Record audit trail
      await tx.insert(auditLogs).values({
        action: "DELETE_EVENT_TEMPLATE",
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        oldValue: {
          id: template.id,
          name: template.name,
          programmeId: template.programmeId,
          createdById: template.createdById,
          deletedByRole: session.role,
        },
      });
    });

    safeRevalidatePath("/faculty/templates", "/faculty/events");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting template:", error);
    return { success: false, error: error.message || "Failed to delete template." };
  }
}
