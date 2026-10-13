import { expect, test } from "@playwright/test";
import { EVENTS, STUDENTS, SUBJECTS } from "./fixtures/constants";
import { collectProblems, expectNoProblems, query, reloadAndSettle, seatsOf, settle, signInStudent } from "./helpers";

/**
 * The full student journey on one synthetic student, with a reload after each
 * meaningful step and database assertions for seats, choices and receipts.
 * Uses STUDENTS.mcaF1 only (no other test registers that student).
 */
test.describe.configure({ mode: "serial", timeout: 180_000 });

const student = STUDENTS.mcaF1;

async function studentRows() {
  return query<{ status: string; receipt_number: string | null }>(
    `select r.status, r.receipt_number from registrations r join users u on u.id = r.student_id
       join registration_events e on e.id = r.event_id where u.register_number = $1 and e.name = $2`,
    [student.reg, EVENTS.mcaSem3]
  );
}
async function choices() {
  return query<{ subject: string; status: string }>(
    `select el.name as subject, s.status from student_registrations s join users u on u.id = s.student_id
       join electives el on el.id = s.elective_id where u.register_number = $1 order by el.name`,
    [student.reg]
  );
}

test("student registers, reloads, changes and cancels with consistent seats", async ({ page }) => {
  const problems = collectProblems(page);
  const before = { cloud: await seatsOf(SUBJECTS.cloud, EVENTS.mcaSem3), marketing: await seatsOf(SUBJECTS.marketing, EVENTS.mcaSem3), data: await seatsOf(SUBJECTS.data, EVENTS.mcaSem3) };

  await test.step("sign in and reload keeps the session and identity", async () => {
    await signInStudent(page, student.reg);
    await expect(page).toHaveURL(/\/dashboard\/electives/);
    await expect(page.getByText(student.reg)).toBeVisible();
    await reloadAndSettle(page);
    await expect(page).toHaveURL(/\/dashboard\/electives/);
    await expect(page.getByText(student.reg)).toBeVisible();
    await expect(page.getByText("MCA F · 2025–2027").first()).toBeVisible();
  });

  await test.step("subject explorer and detail show live capacity without reserving", async () => {
    await page.goto("/dashboard/subjects");
    await expect(page.getByRole("heading", { name: "Explore subjects" })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(SUBJECTS.cloud) }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/subjects\/[0-9a-f-]{36}/);
    await expect(page.getByText(`${before.cloud.available} seats available`).first()).toBeVisible();
    await reloadAndSettle(page);
    await expect(page.getByRole("heading", { name: SUBJECTS.cloud })).toBeVisible();
    expect((await seatsOf(SUBJECTS.cloud, EVENTS.mcaSem3)).available).toBe(before.cloud.available);
  });

  await test.step("picks survive a reload before confirming", async () => {
    await page.goto("/dashboard/electives");
    await page.getByText(SUBJECTS.cloud, { exact: true }).first().click();
    await page.getByText(SUBJECTS.marketing, { exact: true }).first().click();
    await expect(page.getByText("Ready to confirm")).toBeVisible();
    await reloadAndSettle(page);
    await expect(page.getByText("Ready to confirm")).toBeVisible();
    expect(await studentRows()).toEqual([]);
  });

  let receipt = "";
  await test.step("confirm registration, receipt shown only after the server confirms", async () => {
    await page.getByRole("button", { name: /review and confirm/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(SUBJECTS.cloud)).toBeVisible();
    await dialog.getByRole("button", { name: /confirm registration/i }).click();
    await page.waitForURL(/\/dashboard\/(my-registration|success)/);
    await settle(page);
    const rows = await studentRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("CONFIRMED");
    receipt = rows[0].receipt_number!;
    // Semester 3 is an odd semester (regression: the term used to come from the event name).
    expect(receipt).toMatch(/^ELC-\d{4}-ODD-\d{6}$/);
    await expect(page.getByText(receipt).first()).toBeVisible();
    expect((await seatsOf(SUBJECTS.cloud, EVENTS.mcaSem3)).available).toBe(before.cloud.available - 1);
    expect((await seatsOf(SUBJECTS.marketing, EVENTS.mcaSem3)).available).toBe(before.marketing.available - 1);
  });

  await test.step("reload, back navigation and revisiting the picker never resubmit", async () => {
    await reloadAndSettle(page);
    await expect(page.getByText(receipt).first()).toBeVisible();
    await page.goBack();
    await settle(page);
    await page.goto("/dashboard/electives");
    await expect(page).toHaveURL(/\/dashboard\/my-registration/);
    expect(await studentRows()).toHaveLength(1);
    const seats = await seatsOf(SUBJECTS.cloud, EVENTS.mcaSem3);
    expect(seats.available).toBe(before.cloud.available - 1);
    expect(seats.max - seats.available).toBe(seats.confirmed);
  });

  await test.step("change Cloud Computing to Data Science moves exactly one seat", async () => {
    await page.goto("/dashboard/my-registration");
    await page.getByRole("button", { name: "Change" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: new RegExp(SUBJECTS.data) }).click();
    await dialog.getByRole("button", { name: /confirm change/i }).click();
    await expect(dialog).toBeHidden();
    await settle(page);
    expect((await seatsOf(SUBJECTS.cloud, EVENTS.mcaSem3)).available).toBe(before.cloud.available);
    expect((await seatsOf(SUBJECTS.data, EVENTS.mcaSem3)).available).toBe(before.data.available - 1);
    await reloadAndSettle(page);
    await expect(page.getByRole("region", { name: "Selected Electives" }).getByText(SUBJECTS.data)).toBeVisible();
  });

  await test.step("cancel the open elective releases its seat and survives reload", async () => {
    await page.getByRole("button", { name: /^Cancel$/ }).nth(1).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Cancel Elective" }).click();
    await expect(dialog).toBeHidden();
    await settle(page);
    const m = await seatsOf(SUBJECTS.marketing, EVENTS.mcaSem3);
    expect(m.available).toBe(before.marketing.available);
    expect(m.max - m.available).toBe(m.confirmed);
    expect(await choices()).toEqual([
      { subject: SUBJECTS.data, status: "CONFIRMED" },
      { subject: SUBJECTS.marketing, status: "CANCELLED" },
    ]);
    await reloadAndSettle(page);
    await expect(page.getByText("Seat Released")).toBeVisible();
    const rows = await studentRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].receipt_number).toBe(receipt);
  });

  expectNoProblems(problems, "during the student workflow");
});
