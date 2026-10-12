/**
 * Self-contained fixtures for registration tests: one faculty → department →
 * programme → batch → section, an event with groups and electives, and
 * students. Every row is tagged with a unique suffix and removed by cleanup().
 *
 * Tests run against DATABASE_URL (the project's convention, see package.json
 * "test"), so nothing here may touch rows it did not create.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  academicBatches,
  auditLogs,
  departments,
  electiveGroups,
  electiveSeatAllocations,
  electives,
  faculties,
  programmes,
  registrationEvents,
  registrations,
  replayEvents,
  sections,
  studentRegistrations,
  subjectProfiles,
  users,
} from "@/lib/db/schema";
import { setTestSession } from "@/lib/auth";

export type ElectiveSpec = { key: string; name: string; seats: number; courseCode?: string; description?: string };
export type GroupSpec = { key: string; name: string; electives: ElectiveSpec[]; maxChoices?: number };

export type World = {
  tag: string;
  facultyId: string;
  departmentId: string;
  programmeId: string;
  batchId: string;
  sectionId: string;
  adminId: string;
  eventId: string;
  groups: Record<string, string>;
  electives: Record<string, string>;
  students: string[];
  extraEventIds: string[];
  extraBatchIds: string[];
  profileIds: string[];
};

const HOUR = 3600_000;

export async function createWorld(opts: {
  groups: GroupSpec[];
  students?: number;
  openDate?: Date | null;
  closeDate?: Date | null;
  status?: string;
  allowEditing?: boolean;
}): Promise<World> {
  const tag = randomUUID().slice(0, 8);

  const [fac] = await db.insert(faculties).values({ name: `Test Faculty ${tag}`, code: `TF_${tag}` }).returning();
  const [dept] = await db.insert(departments).values({ name: `Test Dept ${tag}`, code: `TD_${tag}`, facultyId: fac.id }).returning();
  const [prog] = await db
    .insert(programmes)
    .values({ name: `Test Programme ${tag}`, code: `TP_${tag}`, degreeType: "PG", departmentId: dept.id })
    .returning();
  const [batch] = await db.insert(academicBatches).values({ year: `Y${tag}`, programmeId: prog.id }).returning();
  const [sec] = await db.insert(sections).values({ label: "A", academicBatchId: batch.id }).returning();

  const [admin] = await db
    .insert(users)
    .values({ name: `Admin ${tag}`, email: `admin_${tag}@test.local`, passwordHash: "x", role: "SYSTEM_ADMIN" })
    .returning();

  const [event] = await db
    .insert(registrationEvents)
    .values({
      name: `Test Event ${tag}`,
      academicBatchId: batch.id,
      createdById: admin.id,
      openDate: opts.openDate === undefined ? new Date(Date.now() - HOUR) : opts.openDate,
      closeDate: opts.closeDate === undefined ? new Date(Date.now() + 24 * HOUR) : opts.closeDate,
      status: opts.status ?? "PUBLISHED",
      allowEditing: opts.allowEditing ?? true,
    })
    .returning();

  const groups: Record<string, string> = {};
  const electiveIds: Record<string, string> = {};
  let order = 0;
  for (const g of opts.groups) {
    const [grp] = await db
      .insert(electiveGroups)
      .values({ eventId: event.id, name: g.name, minChoices: 1, maxChoices: g.maxChoices ?? 1, sortOrder: order++ })
      .returning();
    groups[g.key] = grp.id;
    for (const e of g.electives) {
      const [el] = await db
        .insert(electives)
        .values({
          groupId: grp.id,
          name: e.name,
          courseCode: e.courseCode ?? null,
          description: e.description ?? null,
          credits: 3,
          maxSeats: Math.max(e.seats, 1),
          availableSeats: e.seats,
          isFull: e.seats <= 0,
        })
        .returning();
      electiveIds[e.key] = el.id;
    }
  }

  const students: string[] = [];
  for (let i = 0; i < (opts.students ?? 2); i++) {
    const [s] = await db
      .insert(users)
      .values({
        name: `Student ${i + 1} ${tag}`,
        email: `s${i}_${tag}@srmist.edu.in`,
        passwordHash: "x",
        role: "STUDENT",
        registerNumber: `RA${tag.toUpperCase()}${i}`,
        programmeId: prog.id,
        departmentId: dept.id,
        academicBatchId: batch.id,
        sectionId: sec.id,
      })
      .returning();
    students.push(s.id);
  }

  return {
    tag,
    facultyId: fac.id,
    departmentId: dept.id,
    programmeId: prog.id,
    batchId: batch.id,
    sectionId: sec.id,
    adminId: admin.id,
    eventId: event.id,
    groups,
    electives: electiveIds,
    students,
    extraEventIds: [],
    extraBatchIds: [],
    profileIds: [],
  };
}

export function asStudent(world: World, index: number) {
  setTestSession({ userId: world.students[index], name: `Student ${index + 1}`, email: `s${index}@test.local`, role: "STUDENT" });
}

export function asRole(role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT", userId: string) {
  setTestSession({ userId, name: role, email: `${role.toLowerCase()}@test.local`, role });
}

export async function seats(electiveId: string) {
  const [row] = await db.select().from(electives).where(eq(electives.id, electiveId));
  return row.availableSeats;
}

export async function setEventWindow(eventId: string, fields: { openDate?: Date | null; closeDate?: Date | null; status?: string }) {
  await db.update(registrationEvents).set(fields).where(eq(registrationEvents.id, eventId));
}

export async function addSectionQuota(world: World, electiveKey: string, maxSeats: number, availableSeats = maxSeats) {
  await db.insert(electiveSeatAllocations).values({
    electiveId: world.electives[electiveKey],
    departmentId: world.departmentId,
    sectionId: world.sectionId,
    maxSeats,
    availableSeats,
    isFull: availableSeats <= 0,
  });
}

export async function cleanup(world: World | undefined) {
  setTestSession(undefined);
  if (!world) return;
  const eventIds = [world.eventId, ...world.extraEventIds];
  const groupRows = await db.select({ id: electiveGroups.id }).from(electiveGroups).where(inArray(electiveGroups.eventId, eventIds));
  const groupIds = groupRows.map((g) => g.id);
  const electiveRows = groupIds.length ? await db.select({ id: electives.id }).from(electives).where(inArray(electives.groupId, groupIds)) : [];
  const electiveIdList = electiveRows.map((e) => e.id);

  await db.delete(replayEvents).where(inArray(replayEvents.registrationEventId, eventIds));
  await db.delete(studentRegistrations).where(inArray(studentRegistrations.eventId, eventIds));
  await db.delete(registrations).where(inArray(registrations.eventId, eventIds));
  if (electiveIdList.length) await db.delete(electiveSeatAllocations).where(inArray(electiveSeatAllocations.electiveId, electiveIdList));
  if (groupIds.length) await db.delete(electives).where(inArray(electives.groupId, groupIds));
  await db.delete(electiveGroups).where(inArray(electiveGroups.eventId, eventIds));
  await db.delete(registrationEvents).where(inArray(registrationEvents.id, eventIds));
  if (world.profileIds.length) await db.delete(subjectProfiles).where(inArray(subjectProfiles.id, world.profileIds));

  const userIds = [world.adminId, ...world.students];
  await db.delete(auditLogs).where(inArray(auditLogs.userId, userIds));
  await db.delete(users).where(inArray(users.id, userIds));
  await db.delete(sections).where(eq(sections.id, world.sectionId));
  await db.delete(academicBatches).where(inArray(academicBatches.id, [world.batchId, ...world.extraBatchIds]));
  await db.delete(programmes).where(eq(programmes.id, world.programmeId));
  await db.delete(departments).where(eq(departments.id, world.departmentId));
  await db.delete(faculties).where(eq(faculties.id, world.facultyId));
}
