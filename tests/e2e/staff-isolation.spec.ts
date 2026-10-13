import { expect, test, type Page } from "@playwright/test";
import { EVENTS, SIGNUP_CODE_MSC, STAFF, STUDENTS, SUBJECTS } from "./fixtures/constants";
import { chooseYearServer, collectProblems, expectNoProblems, query, reloadAndSettle, settle, signInStaff, signInStudent } from "./helpers";

/**
 * Staff workspace behaviour across reloads and academic isolation between
 * classes, cohorts and Year Servers. The multi-class tutor teaches MCA F
 * 2025–2027, MCA F 2026–2028 and MSc IT F 2026–2028; a second tutor teaches
 * only MCA G 2025–2027.
 */
test.describe.configure({ timeout: 180_000 });

async function sectionId(programme: string, admissionYear: number, label: string) {
  const [row] = await query<{ id: string }>(
    `select s.id from sections s join academic_batches b on b.id = s.academic_batch_id join programmes p on p.id = b.programme_id
      where p.name = $1 and b.admission_year = $2 and s.label = $3`,
    [programme, admissionYear, label]
  );
  return row.id;
}

async function activeClassLabel(page: Page) {
  const trigger = page.getByRole("button", { name: /^Active class:/ }).first();
  return (await trigger.getAttribute("aria-label")) ?? "";
}

async function switchClass(page: Page, label: RegExp) {
  await page.getByRole("button", { name: /^Active class:/ }).first().click();
  await page.getByRole("option", { name: label }).click();
  await expect.poll(() => activeClassLabel(page)).toMatch(label);
  await settle(page);
}

test("tutor workspace: Year Server and class survive reloads and switching", async ({ page }) => {
  const problems = collectProblems(page);
  await signInStaff(page, STAFF.tutor.email);
  await expect(page).toHaveURL(/\/faculty\/session-select/);
  await chooseYearServer(page, 2026);

  await test.step("selected Year Server and class are restored after reload", async () => {
    await page.goto("/faculty/dashboard");
    expect(await activeClassLabel(page)).toMatch(/MCA F · 2025–2027/);
    await reloadAndSettle(page);
    await expect(page).toHaveURL(/\/faculty\/dashboard/);
    expect(await activeClassLabel(page)).toMatch(/MCA F · 2025–2027/);
    await expect(page.locator("body")).toContainText("2026–2027");
    await expect(page.locator("main")).toContainText(EVENTS.mcaSem3);
  });

  await test.step("switching to MSc IT F shows only that class, before and after reload", async () => {
    await switchClass(page, /MSc IT F · 2026–2028/);
    await page.goto("/faculty/section");
    await expect(page.locator("main")).toContainText(STUDENTS.mscF1.name);
    await expect(page.locator("main")).not.toContainText(STUDENTS.mcaF2.name);
    await reloadAndSettle(page);
    expect(await activeClassLabel(page)).toMatch(/MSc IT F · 2026–2028/);
    await expect(page.locator("main")).toContainText(STUDENTS.mscF1.name);
    await expect(page.locator("main")).not.toContainText(STUDENTS.mcaF2.name);
  });

  await test.step("signup code of the active class is listed after reload", async () => {
    await page.getByRole("button", { name: /class signup code/i }).click();
    await expect(page.getByRole("dialog")).toContainText(SIGNUP_CODE_MSC);
    await page.keyboard.press("Escape");
  });

  await test.step("a forged class cookie for an unassigned class is ignored", async () => {
    const foreign = await sectionId("MCA", 2025, "G");
    await page.context().addCookies([{ name: "electify_active_section", value: foreign, url: page.url() }]);
    await reloadAndSettle(page);
    expect(await activeClassLabel(page)).not.toMatch(/MCA G/);
    await expect(page.locator("main")).not.toContainText(STUDENTS.mcaG1.name);
  });

  await test.step("switching to the 2025 Year Server narrows classes and survives reload", async () => {
    await page.goto("/faculty/session-select?choose=1");
    await chooseYearServer(page, 2025);
    await page.goto("/faculty/dashboard");
    await reloadAndSettle(page);
    await expect(page.locator("body")).toContainText("2025–2026");
    expect(await activeClassLabel(page)).toMatch(/MCA F · 2025–2027/);
    await page.getByRole("button", { name: /^Active class:/ }).first().click();
    await expect(page.getByRole("option")).toHaveCount(1);
    await page.keyboard.press("Escape");
  });

  expectNoProblems(problems, "during the tutor workflow");
});

test("tutor configuration change (pause window) persists after reload and reaches students", async ({ page, browser }) => {
  await signInStaff(page, STAFF.tutor.email);
  await chooseYearServer(page, 2026);
  await page.goto("/faculty/dashboard");
  await switchClass(page, /MSc IT F · 2026–2028/);
  await page.goto("/faculty/window");
  await expect(page.locator("main")).toContainText(EVENTS.mscSem1);

  // Regression: the monitor said "closed" for a published event whose window is open.
  const [ev] = await query<{ id: string }>(`select id from registration_events where name = $1`, [EVENTS.mscSem1]);
  await page.goto(`/faculty/monitor?eventId=${ev.id}`);
  await expect(page.locator("main")).toContainText("actively accepting");
  await expect(page.getByRole("button", { name: /Pause Window/i })).toBeVisible();
  await page.goto("/faculty/window");

  // The event is PUBLISHED with its opening time passed, i.e. open to students:
  // the controls must offer Pause (regression: they used to require status OPEN).
  await page.getByRole("button", { name: "Pause window" }).click();
  await expect.poll(async () => (await query<{ status: string }>(`select status from registration_events where name = $1`, [EVENTS.mscSem1]))[0].status).toBe("PAUSED");
  await reloadAndSettle(page);
  await expect(page.locator("main")).toContainText(/paused/i);

  const studentPage = await (await browser.newContext()).newPage();
  await signInStudent(studentPage, STUDENTS.mscF2.reg);
  await expect(studentPage.locator("body")).toContainText(/paused/i);

  await page.getByRole("button", { name: "Resume window" }).click();
  await expect.poll(async () => (await query<{ status: string }>(`select status from registration_events where name = $1`, [EVENTS.mscSem1]))[0].status).toBe("OPEN");
  await studentPage.close();
});

test("students only see their own class's event and seat counters stay separate", async ({ page }) => {
  await signInStudent(page, STUDENTS.mscF1.reg);
  await expect(page.locator("body")).toContainText(EVENTS.mscSem1);
  await expect(page.locator("body")).not.toContainText(EVENTS.mcaSem3);
  await page.getByText(SUBJECTS.cloud, { exact: true }).first().click();
  await page.getByRole("button", { name: /review and confirm/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: /confirm registration/i }).click();
  await page.waitForURL(/\/dashboard\/(my-registration|success)/);
  await settle(page);

  const counters = await query<{ event: string; available: number; max: number }>(
    `select ev.name as event, e.available_seats as available, e.max_seats as max from electives e
       join elective_groups g on g.id = e.group_id join registration_events ev on ev.id = g.event_id where e.name = $1 order by ev.name`,
    [SUBJECTS.cloud]
  );
  const msc = counters.find((c) => c.event === EVENTS.mscSem1)!;
  const mca = counters.find((c) => c.event === EVENTS.mcaSem3)!;
  expect(msc.max - msc.available).toBe(1);
  // The MCA offering of "Cloud Computing" is a different counter; the MSc registration never touched it.
  const mcaConfirmed = await query<{ n: string }>(
    `select count(*) as n from student_registrations s join electives e on e.id = s.elective_id join elective_groups g on g.id = e.group_id
       join registration_events ev on ev.id = g.event_id where ev.name = $1 and e.name = $2 and s.status = 'CONFIRMED'`,
    [EVENTS.mcaSem3, SUBJECTS.cloud]
  );
  expect(mca.max - mca.available).toBe(Number(mcaConfirmed[0].n));

  await test.step("crafted URL to another cohort's event does not open it", async () => {
    const [mcaEvent] = await query<{ id: string }>(`select id from registration_events where name = $1`, [EVENTS.mcaSem3]);
    await page.goto(`/dashboard/electives?event=${mcaEvent.id}`);
    await settle(page);
    await expect(page.locator("body")).not.toContainText(EVENTS.mcaSem3);
    await page.goto(`/dashboard/subjects?event=${mcaEvent.id}`);
    await settle(page);
    await expect(page.locator("body")).not.toContainText(EVENTS.mcaSem3);
  });
});

test("a tutor cannot open another class's replay by URL", async ({ page }) => {
  await signInStaff(page, STAFF.tutorG.email);
  await chooseYearServer(page, 2026);
  const [mscEvent] = await query<{ id: string }>(`select id from registration_events where name = $1`, [EVENTS.mscSem1]);
  await page.goto(`/faculty/replay/${mscEvent.id}`);
  await settle(page);
  await expect(page.locator("main")).not.toContainText(STUDENTS.mscF1.name);
  await expect(page.locator("main")).not.toContainText(EVENTS.mscSem1);
});
