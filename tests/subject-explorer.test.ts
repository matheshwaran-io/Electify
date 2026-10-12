import test, { describe, after } from "node:test";
import assert from "node:assert";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, registrations, studentRegistrations, subjectProfiles, users } from "@/lib/db/schema";
import { setTestSession } from "@/lib/auth";
import { registerElectives } from "@/app/actions/register";
import { getLiveFeedUpdates, getUnregisteredStudentsList } from "@/app/actions/monitor";
import { checkSubjectResourceLinks, listSubjectProfiles, setSubjectProfileStatus, upsertSubjectProfile } from "@/app/actions/subjects";
import { loadSubjectCatalog, loadSubjectDetail } from "@/lib/subjects/queries";
import { readSubjectContent } from "@/lib/subjects/content-schema";
import { cloudComputingProfile } from "@/lib/subjects/catalog/cloud-computing";
import { getRegistrationWindow } from "@/lib/registration-window";
import { addSectionQuota, asRole, asStudent, cleanup, createWorld, seats, setEventWindow, type World } from "./helpers/world";

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * Subject explorer, preview mode and the server-side registration window.
 * Uses its own fixtures (tests/helpers/world.ts) and removes them afterwards.
 */
describe("Subject explorer and preview mode", () => {
  const worlds: World[] = [];
  const make = async (...args: Parameters<typeof createWorld>) => {
    const w = await createWorld(...args);
    worlds.push(w);
    return w;
  };
  after(async () => {
    for (const w of worlds) await cleanup(w);
  });

  const upcoming = () => ({
    openDate: new Date(Date.now() + 2 * HOUR),
    closeDate: new Date(Date.now() + 26 * HOUR),
    groups: [
      {
        key: "A",
        name: "Professional Elective",
        electives: [
          { key: "A1", name: "Course A1", seats: 2, courseCode: "TSTA1" },
          { key: "A2", name: "Course A2", seats: 0 },
        ],
      },
      { key: "B", name: "Open Elective", electives: [{ key: "B1", name: "Course B1", seats: 5 }] },
    ],
    students: 3,
  });

  test("1. Students can browse the catalogue before registration opens", async () => {
    const w = await make(upcoming());
    const { ctx, subjects } = await loadSubjectCatalog(w.students[0]);
    assert.strictEqual(ctx.status, "OK");
    if (ctx.status !== "OK") return;
    assert.strictEqual(ctx.window.state, "UPCOMING");
    assert.strictEqual(ctx.window.isOpen, false);
    assert.strictEqual(ctx.window.opensAt?.getTime(), ctx.event.openDate?.getTime(), "countdown target is the stored opening time");
    assert.deepStrictEqual(subjects.map((s) => s.name).sort(), ["Course A1", "Course A2", "Course B1"]);

    const { subject } = await loadSubjectDetail(w.students[0], w.electives.A1);
    assert.ok(subject, "detail page loads before opening");
    assert.strictEqual(subject.courseCode, "TSTA1");
    assert.deepStrictEqual(
      subject.alternatives.map((a) => a.name),
      ["Course A2"],
      "alternatives come from the same basket only"
    );
  });

  test("2. Preview shows real capacity, including section quotas and full subjects", async () => {
    const w = await make(upcoming());
    await addSectionQuota(w, "B1", 3, 1);
    const { subjects } = await loadSubjectCatalog(w.students[0]);
    const by = Object.fromEntries(subjects.map((s) => [s.name, s.availability]));
    assert.strictEqual(by["Course A1"].available, 2);
    assert.strictEqual(by["Course A2"].available, 0);
    assert.strictEqual(by["Course A2"].state, "full");
    assert.strictEqual(by["Course B1"].available, 1, "section quota is the tighter limit");
    assert.strictEqual(by["Course B1"].sectionLimited, true);
  });

  test("3. Opening subject pages never reserves a seat", async () => {
    const w = await make(upcoming());
    for (let i = 0; i < 3; i++) {
      await loadSubjectCatalog(w.students[i]);
      await loadSubjectDetail(w.students[i], w.electives.A1);
    }
    assert.strictEqual(await seats(w.electives.A1), 2);
    const rows = await db.select().from(studentRegistrations).where(eq(studentRegistrations.eventId, w.eventId));
    assert.strictEqual(rows.length, 0);
  });

  test("4. Submitting before the window opens is rejected by the server", async () => {
    const w = await make(upcoming());
    asStudent(w, 0);
    const res = await registerElectives(w.eventId, [
      { groupId: w.groups.A, electiveId: w.electives.A1 },
      { groupId: w.groups.B, electiveId: w.electives.B1 },
    ]);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.code, "WINDOW_CLOSED");
    assert.strictEqual(await seats(w.electives.A1), 2, "no seat taken");
    const [reg] = await db.select().from(registrations).where(eq(registrations.eventId, w.eventId));
    assert.strictEqual(reg, undefined, "no registration row created");
  });

  test("5. Registration works once the opening time has passed", async () => {
    const w = await make(upcoming());
    await setEventWindow(w.eventId, { openDate: new Date(Date.now() - MIN) });
    asStudent(w, 0);
    const res = await registerElectives(w.eventId, [
      { groupId: w.groups.A, electiveId: w.electives.A1 },
      { groupId: w.groups.B, electiveId: w.electives.B1 },
    ]);
    assert.strictEqual(res.success, true, res.error);

    const { ctx, subjects } = await loadSubjectCatalog(w.students[1]);
    assert.strictEqual(ctx.status === "OK" && ctx.window.state, "OPEN");
    assert.strictEqual(subjects.find((s) => s.name === "Course A1")?.availability.available, 1, "catalogue reflects the confirmed seat");
  });

  test("6. Late and paused submissions are rejected; confirmed records are kept", async () => {
    const w = await make({ ...upcoming(), openDate: new Date(Date.now() - HOUR) });
    asStudent(w, 0);
    const ok = await registerElectives(w.eventId, [
      { groupId: w.groups.A, electiveId: w.electives.A1 },
      { groupId: w.groups.B, electiveId: w.electives.B1 },
    ]);
    assert.strictEqual(ok.success, true, ok.error);

    await setEventWindow(w.eventId, { status: "PAUSED" });
    asStudent(w, 1);
    const paused = await registerElectives(w.eventId, [
      { groupId: w.groups.A, electiveId: w.electives.A1 },
      { groupId: w.groups.B, electiveId: w.electives.B1 },
    ]);
    assert.strictEqual(paused.code, "WINDOW_CLOSED");

    await setEventWindow(w.eventId, { status: "PUBLISHED", closeDate: new Date(Date.now() - 1000) });
    const late = await registerElectives(w.eventId, [
      { groupId: w.groups.A, electiveId: w.electives.A1 },
      { groupId: w.groups.B, electiveId: w.electives.B1 },
    ]);
    assert.strictEqual(late.success, false);
    assert.strictEqual(late.code, "WINDOW_CLOSED");
    assert.strictEqual(await seats(w.electives.A1), 1, "only the on-time registration holds a seat");

    const [kept] = await db
      .select()
      .from(registrations)
      .where(and(eq(registrations.eventId, w.eventId), eq(registrations.studentId, w.students[0])));
    assert.strictEqual(kept.status, "CONFIRMED", "closing the window does not touch confirmed registrations");
    assert.ok(kept.receiptNumber);
  });

  test("7. Ineligible students, other batches' events and foreign electives are rejected", async () => {
    const w = await make({ ...upcoming(), openDate: new Date(Date.now() - HOUR) });
    const other = await make({ ...upcoming(), openDate: new Date(Date.now() - HOUR) });

    await db.update(users).set({ isEligible: false }).where(eq(users.id, w.students[0]));
    asStudent(w, 0);
    const ineligible = await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }]);
    assert.strictEqual(ineligible.code, "INELIGIBLE");

    asStudent(other, 0);
    const wrongEvent = await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: w.electives.A1 }]);
    assert.strictEqual(wrongEvent.code, "WRONG_EVENT");

    asStudent(w, 1);
    const foreign = await registerElectives(w.eventId, [{ groupId: other.groups.A, electiveId: other.electives.A1 }]);
    assert.strictEqual(foreign.code, "INVALID_SELECTION");
    const mismatched = await registerElectives(w.eventId, [{ groupId: w.groups.A, electiveId: other.electives.A1 }]);
    assert.strictEqual(mismatched.success, false);

    assert.strictEqual(await seats(w.electives.A1), 2);
    assert.strictEqual(await seats(other.electives.A1), 2);
  });

  test("8. The catalogue never exposes another batch's subjects or unknown ids", async () => {
    const w = await make(upcoming());
    const other = await make(upcoming());
    const foreign = await loadSubjectDetail(w.students[0], other.electives.A1);
    assert.strictEqual(foreign.subject, null);
    const unknown = await loadSubjectDetail(w.students[0], randomUUID());
    assert.strictEqual(unknown.subject, null);

    const { subjects } = await loadSubjectCatalog(w.students[0]);
    assert.ok(subjects.every((s) => Object.values(w.electives).includes(s.electiveId)));
    for (const s of subjects) {
      assert.ok(!("students" in s) && !("registrations" in s), "no per-student data in the catalogue");
    }
  });

  test("9. Only published profiles for the student's programme are shown", async () => {
    const w = await make(upcoming());
    const other = await make(upcoming());
    const name = `Course A1`;
    asRole("SYSTEM_ADMIN", w.adminId);

    const draft = await upsertSubjectProfile({
      slug: `test-draft-${w.tag}`,
      title: name,
      programmeId: w.programmeId,
      content: cloudComputingProfile.content,
      status: "DRAFT",
    });
    assert.strictEqual(draft.success, true, draft.success ? undefined : draft.error);
    if (draft.success) w.profileIds.push(draft.id);

    let detail = await loadSubjectDetail(w.students[0], w.electives.A1);
    assert.strictEqual(detail.subject?.content, null, "draft profiles are not shown");

    const foreign = await upsertSubjectProfile({
      slug: `test-foreign-${w.tag}`,
      title: name,
      programmeId: other.programmeId,
      content: cloudComputingProfile.content,
      status: "PUBLISHED",
    });
    assert.strictEqual(foreign.success, true);
    if (foreign.success) w.profileIds.push(foreign.id);
    detail = await loadSubjectDetail(w.students[0], w.electives.A1);
    assert.strictEqual(detail.subject?.content, null, "another programme's profile is not matched");

    if (draft.success) await setSubjectProfileStatus(draft.id, "PUBLISHED");
    detail = await loadSubjectDetail(w.students[0], w.electives.A1);
    assert.ok(detail.subject?.content, "published profile for this programme is shown");
    assert.strictEqual(detail.subject?.profile?.slug, `test-draft-${w.tag}`);
    assert.ok(detail.subject?.content?.resources.length);
    assert.strictEqual(detail.subject?.courseCode, "TSTA1", "official code still comes from the offering, not the profile");
  });

  test("10. Subject profile management is limited to admins and own-programme coordinators", async () => {
    const w = await make(upcoming());
    const other = await make(upcoming());
    const input = (slug: string, programmeId: string | null) => ({
      slug: `${slug}-${w.tag}`,
      title: `Role Test ${w.tag}`,
      programmeId,
      content: { tags: [], resources: [], examples: [] },
      status: "DRAFT" as const,
    });

    asStudent(w, 0);
    assert.strictEqual((await upsertSubjectProfile(input("student", w.programmeId))).success, false);
    assert.strictEqual((await listSubjectProfiles()).success, false);

    asRole("CLASS_TUTOR", w.adminId);
    assert.strictEqual((await upsertSubjectProfile(input("tutor", w.programmeId))).success, false);

    setTestSession({ userId: w.adminId, name: "Coord", email: "coord@test.local", role: "COURSE_COORDINATOR", programmeId: w.programmeId });
    assert.strictEqual((await upsertSubjectProfile(input("coord-other", other.programmeId))).success, false, "not another programme");
    assert.strictEqual((await upsertSubjectProfile(input("coord-global", null))).success, false, "not an unscoped profile");
    const own = await upsertSubjectProfile(input("coord-own", w.programmeId));
    assert.strictEqual(own.success, true, own.success ? undefined : own.error);
    if (own.success) w.profileIds.push(own.id);

    setTestSession({ userId: w.adminId, name: "Coord", email: "coord@test.local", role: "COURSE_COORDINATOR", programmeId: other.programmeId });
    if (own.success) {
      assert.strictEqual((await setSubjectProfileStatus(own.id, "PUBLISHED")).success, false, "other programme's coordinator cannot publish");
      assert.strictEqual((await checkSubjectResourceLinks(own.id)).success, false);
    }

    asRole("SYSTEM_ADMIN", w.adminId);
    const admin = await upsertSubjectProfile(input("admin-global", null));
    assert.strictEqual(admin.success, true);
    if (admin.success) w.profileIds.push(admin.id);

    const audit = await db.select().from(auditLogs).where(and(eq(auditLogs.userId, w.adminId), inArray(auditLogs.action, ["SUBJECT_PROFILE_CREATED"])));
    assert.strictEqual(audit.length, 2, "each successful change is audited");
    const stored = await db.select().from(subjectProfiles).where(inArray(subjectProfiles.id, w.profileIds));
    assert.strictEqual(stored.length, 2);
  });

  test("11. Monitor feed and unregistered list are staff-only", async () => {
    const w = await make(upcoming());
    asStudent(w, 0);
    assert.strictEqual((await getLiveFeedUpdates(w.eventId)).success, false);
    assert.strictEqual((await getUnregisteredStudentsList(w.eventId)).success, false);
  });
});

describe("Subject content validation", () => {
  test("Unsafe or malformed resource links are dropped, valid sections survive", () => {
    const content = readSubjectContent({
      tags: ["cloud"],
      resources: [
        { title: "Script", url: "javascript:alert(1)", provider: "X", description: "bad", kind: "reference" },
        { title: "Plain http", url: "http://example.com", provider: "X", description: "bad", kind: "reference" },
        { title: "Relative", url: "/docs", provider: "X", description: "bad", kind: "reference" },
        { title: "Good", url: "https://example.com/docs", provider: "X", description: "ok", kind: "documentation" },
      ],
      overview: "not an object",
      examples: [],
    });
    assert.deepStrictEqual(content.resources.map((r) => r.title), ["Good"]);
    assert.deepStrictEqual(content.tags, ["cloud"]);
    assert.strictEqual(content.overview, undefined, "a broken section is skipped, not fatal");
  });

  test("Garbage content renders as an empty guide instead of throwing", () => {
    for (const raw of [null, undefined, "x", 42, [], { resources: "nope" }]) {
      const c = readSubjectContent(raw);
      assert.deepStrictEqual(c.resources, []);
      assert.deepStrictEqual(c.tags, []);
    }
  });

  test("Bundled Cloud Computing guide makes no official claims", () => {
    const p = cloudComputingProfile;
    assert.strictEqual(p.courseCode, null, "no invented course code");
    const c = readSubjectContent(p.content);
    assert.strictEqual(c.resources.length, p.content.resources.length, "every bundled link passes validation");
    assert.strictEqual(c.prerequisites?.official, undefined, "no invented official prerequisites");
    const provenances = [c.overview, c.syllabus, c.outcomes, c.prerequisites, c.difficulty, c.careers]
      .map((s) => (s as { provenance?: { status: string } } | undefined)?.provenance?.status)
      .filter(Boolean);
    assert.ok(provenances.length >= 5);
    assert.ok(provenances.every((s) => s !== "OFFICIAL"), "nothing in the bundled guide is marked official");
    assert.ok(c.resources.every((r) => !r.lastCheckStatus), "links are not claimed as checked in source");
  });
});

describe("Registration window rule", () => {
  const now = new Date("2026-03-01T10:00:00.000Z");
  const at = (ms: number) => new Date(now.getTime() + ms);

  test("Opens exactly at openDate, not a millisecond earlier", () => {
    assert.strictEqual(getRegistrationWindow({ status: "PUBLISHED", openDate: at(1), closeDate: at(HOUR) }, now).state, "UPCOMING");
    assert.strictEqual(getRegistrationWindow({ status: "PUBLISHED", openDate: now, closeDate: at(HOUR) }, now).state, "OPEN");
  });

  test("Closes after closeDate when auto-close is on", () => {
    assert.strictEqual(getRegistrationWindow({ status: "PUBLISHED", openDate: at(-HOUR), closeDate: now }, now).state, "OPEN");
    assert.strictEqual(getRegistrationWindow({ status: "PUBLISHED", openDate: at(-HOUR), closeDate: at(-1) }, now).state, "CLOSED");
    assert.strictEqual(
      getRegistrationWindow({ status: "PUBLISHED", openDate: at(-HOUR), closeDate: at(-1), autoClose: false }, now).state,
      "OPEN",
      "manual close events stay open until faculty close them"
    );
  });

  test("Status overrides: paused, closed and manual open", () => {
    assert.strictEqual(getRegistrationWindow({ status: "PAUSED", openDate: at(-HOUR), closeDate: at(HOUR) }, now).state, "PAUSED");
    for (const s of ["CLOSED", "VERIFICATION", "FINALIZED", "ARCHIVED"]) {
      assert.strictEqual(getRegistrationWindow({ status: s, openDate: at(-HOUR), closeDate: at(HOUR) }, now).isOpen, false);
    }
    assert.strictEqual(getRegistrationWindow({ status: "OPEN", openDate: at(HOUR), closeDate: at(2 * HOUR) }, now).state, "OPEN");
    assert.strictEqual(getRegistrationWindow({ status: "PUBLISHED", openDate: null, closeDate: null }, now).state, "UNSCHEDULED");
  });

  test("Accepts ISO strings and ignores invalid dates", () => {
    const w = getRegistrationWindow({ status: "PUBLISHED", openDate: at(HOUR).toISOString(), closeDate: "not a date" }, now);
    assert.strictEqual(w.state, "UPCOMING");
    assert.strictEqual(w.closesAt, null);
  });
});
