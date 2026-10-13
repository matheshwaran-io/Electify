/**
 * Seeds the synthetic end-to-end fixtures into the throwaway `electify_e2e`
 * database. Run by tests/e2e/global-setup.ts after the database has been
 * recreated from the schema; refuses to touch any other database.
 *
 *   DATABASE_URL=postgresql://localhost:5432/electify_e2e npx tsx tests/e2e/fixtures/seed.ts
 */
import * as bcrypt from "bcryptjs";
import { db, pool } from "@/lib/db";
import {
  academicBatches, academicSessions, cohortSessionTerms, departments, electiveGroups, electiveSeatAllocations,
  electives, eventSections, faculties, inviteCodes, programmes, registrationEvents, sections, systemSettings,
  tutorSections, users,
} from "@/lib/db/schema";
import { E2E_DB_NAME, E2E_PASSWORD, EVENTS, SIGNUP_CODE_MSC, STAFF, STUDENTS, SUBJECTS } from "./constants";

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\/[^/]*(localhost|127\.0\.0\.1)[^/]*\//.test(url) || !url.split("?")[0].endsWith(`/${E2E_DB_NAME}`)) {
  throw new Error(`Refusing to seed: DATABASE_URL must be the local ${E2E_DB_NAME} database.`);
}

const HOUR = 3600_000;

async function main() {
  const hash = await bcrypt.hash(E2E_PASSWORD, 10);
  await db.insert(systemSettings).values({ id: "system", maintenanceMode: false, maxTutorSections: 10 }).onConflictDoNothing();

  const [admin] = await db.insert(users).values({ name: STAFF.admin.name, email: STAFF.admin.email, passwordHash: hash, role: "SYSTEM_ADMIN", employeeId: "E2E-ADM" }).returning();
  const [fac] = await db.insert(faculties).values({ name: "E2E Faculty of Science and Humanities", code: "E2E-FSH" }).returning();
  const [dept] = await db.insert(departments).values({ name: "E2E Department of Computer Applications", code: "E2E-DCA", facultyId: fac.id }).returning();
  const [mca] = await db.insert(programmes).values({ name: "MCA", code: "E2E-MCA", degreeType: "PG", durationYears: 2, semesters: 4, departmentId: dept.id }).returning();
  const [msc] = await db.insert(programmes).values({ name: "MSc IT", code: "E2E-MSCIT", degreeType: "PG", durationYears: 2, semesters: 4, departmentId: dept.id }).returning();

  const [s25] = await db.insert(academicSessions).values({ startYear: 2025, endYear: 2026, status: "ACTIVE", createdById: admin.id }).returning();
  const [s26] = await db.insert(academicSessions).values({ startYear: 2026, endYear: 2027, status: "ACTIVE", createdById: admin.id }).returning();

  const batch = async (programmeId: string, year: number) =>
    (await db.insert(academicBatches).values({ year: String(year), admissionYear: year, expectedEndYear: year + 2, datesConfirmed: true, programmeId }).returning())[0];
  const mca25 = await batch(mca.id, 2025);
  const mca26 = await batch(mca.id, 2026);
  const msc26 = await batch(msc.id, 2026);
  const section = async (label: string, batchId: string) => (await db.insert(sections).values({ label, academicBatchId: batchId }).returning())[0];
  const cls = {
    mca25F: { sec: await section("F", mca25.id), batch: mca25 },
    mca25G: { sec: await section("G", mca25.id), batch: mca25 },
    mca26F: { sec: await section("F", mca26.id), batch: mca26 },
    msc26F: { sec: await section("F", msc26.id), batch: msc26 },
  };
  await db.insert(cohortSessionTerms).values([
    { academicBatchId: mca25.id, academicSessionId: s25.id, studyYear: 1, currentSemester: 1, confirmed: true },
    { academicBatchId: mca25.id, academicSessionId: s26.id, studyYear: 2, currentSemester: 3, confirmed: true },
    { academicBatchId: mca26.id, academicSessionId: s26.id, studyYear: 1, currentSemester: 1, confirmed: true },
    { academicBatchId: msc26.id, academicSessionId: s26.id, studyYear: 1, currentSemester: 1, confirmed: true },
  ]);

  const staff = (who: keyof typeof STAFF, role: string, employeeId: string, programmeId?: string, sectionId?: string) =>
    db.insert(users).values({ name: STAFF[who].name, email: STAFF[who].email, passwordHash: hash, role, employeeId, facultyId: fac.id, departmentId: dept.id, programmeId, sectionId }).returning();
  const [coord] = await staff("coordinator", "COURSE_COORDINATOR", "E2E-CC", mca.id);
  const [tutor] = await staff("tutor", "CLASS_TUTOR", "E2E-CT1", mca.id, cls.mca25F.sec.id);
  const [tutorG] = await staff("tutorG", "CLASS_TUTOR", "E2E-CT2", mca.id, cls.mca25G.sec.id);
  await db.insert(tutorSections).values([
    { tutorId: tutor.id, sectionId: cls.mca25F.sec.id },
    { tutorId: tutor.id, sectionId: cls.mca26F.sec.id },
    { tutorId: tutor.id, sectionId: cls.msc26F.sec.id },
    { tutorId: tutorG.id, sectionId: cls.mca25G.sec.id },
  ]);

  for (const s of Object.values(STUDENTS)) {
    const c = cls[s.cls];
    await db.insert(users).values({
      name: s.name, email: `${s.reg.toLowerCase()}@example.test`, passwordHash: hash, role: "STUDENT", registerNumber: s.reg,
      facultyId: fac.id, departmentId: dept.id, programmeId: c.batch.programmeId, academicBatchId: c.batch.id, sectionId: c.sec.id,
    });
  }

  const event = async (name: string, b: typeof mca25, sessionId: string, semester: number, targets: (typeof cls)[keyof typeof cls][], openOffsetH: number, createdById: string) => {
    const [ev] = await db.insert(registrationEvents).values({
      name, academicBatchId: b.id, academicSessionId: sessionId, semester, createdById,
      openDate: new Date(Date.now() + openOffsetH * HOUR), closeDate: new Date(Date.now() + (openOffsetH + 72) * HOUR),
      status: "PUBLISHED", allowEditing: true,
    }).returning();
    await db.insert(eventSections).values(targets.map((t) => ({ eventId: ev.id, sectionId: t.sec.id, academicBatchId: b.id })));
    return ev;
  };
  const group = async (eventId: string, name: string, sortOrder: number) => (await db.insert(electiveGroups).values({ eventId, name, sortOrder }).returning())[0];
  const subject = async (groupId: string, name: string, seats: number) =>
    (await db.insert(electives).values({ groupId, name, maxSeats: seats, availableSeats: seats, credits: 3, description: `${name} (synthetic test subject).` }).returning())[0];

  const ev1 = await event(EVENTS.mcaSem3, mca25, s26.id, 3, [cls.mca25F, cls.mca25G], -2, coord.id);
  const pe = await group(ev1.id, SUBJECTS.pe, 0);
  const oe = await group(ev1.id, SUBJECTS.oe, 1);
  await subject(pe.id, SUBJECTS.cloud, 10);
  await subject(pe.id, SUBJECTS.data, 10);
  const sec = await subject(pe.id, SUBJECTS.security, 4);
  await subject(oe.id, SUBJECTS.marketing, 10);
  await subject(oe.id, SUBJECTS.enterprise, 10);
  await db.insert(electiveSeatAllocations).values([
    { electiveId: sec.id, departmentId: dept.id, sectionId: cls.mca25F.sec.id, maxSeats: 2, availableSeats: 2 },
    { electiveId: sec.id, departmentId: dept.id, sectionId: cls.mca25G.sec.id, maxSeats: 2, availableSeats: 2 },
  ]);

  const ev2 = await event(EVENTS.mscSem1, msc26, s26.id, 1, [cls.msc26F], -2, tutor.id);
  const mscPe = await group(ev2.id, SUBJECTS.pe, 0);
  await subject(mscPe.id, SUBJECTS.cloud, 6);
  await subject(mscPe.id, "Web Technologies", 6);

  const ev3 = await event(EVENTS.mcaFuture, mca26, s26.id, 1, [cls.mca26F], 48, tutor.id);
  const vac = await group(ev3.id, "Value-Added Course", 0);
  await subject(vac.id, "Python for Data Analysis", 20);

  await db.insert(inviteCodes).values({
    code: SIGNUP_CODE_MSC, role: "STUDENT", facultyId: fac.id, departmentId: dept.id, programmeId: msc.id,
    academicBatchId: msc26.id, sectionId: cls.msc26F.sec.id, createdById: tutor.id,
    expiresAt: new Date(Date.now() + 7 * 24 * HOUR), maxUses: 30, usedCount: 2,
  });
  console.log("e2e fixtures seeded");
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
