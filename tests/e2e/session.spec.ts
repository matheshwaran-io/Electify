import { expect, test } from "@playwright/test";
import { EVENTS, STAFF, STUDENTS, SUBJECTS } from "./fixtures/constants";
import { chooseYearServer, query, reloadAndSettle, settle, signInStaff, signInStudent } from "./helpers";

/** Session restoration, sign-out and duplicate-submission behaviour. */
test.describe.configure({ timeout: 120_000 });

test("signing out and pressing Back never shows the protected page again", async ({ page }) => {
  await signInStudent(page, STUDENTS.mcaG1.reg);
  await page.goto("/dashboard/subjects");
  await expect(page.getByRole("heading", { name: "Explore subjects" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL(/\/login/);
  await page.goBack();
  await settle(page);
  // Either the browser's cached copy is refused, or the server redirects: no student data visible.
  await expect(page.locator("body")).not.toContainText(STUDENTS.mcaG1.reg);
  await expect(page).toHaveURL(/\/login/);
  await reloadAndSettle(page);
  await expect(page).toHaveURL(/\/login/);
});

test("a tampered session cookie is treated as signed out", async ({ page }) => {
  await signInStaff(page, STAFF.tutorG.email);
  await chooseYearServer(page, 2026);
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "electify_session")!;
  await page.context().addCookies([{ ...session, value: session.value.slice(0, -4) + "AAAA" }]);
  await page.goto("/faculty/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("body")).not.toContainText("Welcome back");
});

test("signing in elsewhere ends the earlier session on reload", async ({ page, browser }) => {
  await signInStudent(page, STUDENTS.mscF2.reg);
  const other = await (await browser.newContext()).newPage();
  await signInStudent(other, STUDENTS.mscF2.reg);
  // Regression: page renders used to accept the superseded session because the
  // cookie delete threw inside the check and fell through to a weaker fallback.
  await reloadAndSettle(page);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("status").filter({ hasText: "Your session ended" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(STUDENTS.mscF2.name);
  // The newer sign-in keeps working.
  await reloadAndSettle(other);
  await expect(other).toHaveURL(/\/dashboard/);
  await other.close();
});

test("a deactivated account loses access on the next page load", async ({ page }) => {
  await signInStudent(page, STUDENTS.mcaF4.reg);
  await expect(page).toHaveURL(/\/dashboard/);
  await query(`update users set is_active = false where register_number = $1`, [STUDENTS.mcaF4.reg]);
  try {
    await page.goto("/dashboard/subjects");
    await settle(page);
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("body")).not.toContainText("Explore subjects");
  } finally {
    await query(`update users set is_active = true where register_number = $1`, [STUDENTS.mcaF4.reg]);
  }
});

test("double-clicking confirm creates exactly one registration", async ({ page }) => {
  await signInStudent(page, STUDENTS.mcaF2.reg);
  await page.goto("/dashboard/electives");
  await page.getByText(SUBJECTS.data, { exact: true }).first().click();
  await page.getByText(SUBJECTS.enterprise, { exact: true }).first().click();
  await page.getByRole("button", { name: /review and confirm/i }).click();
  const confirm = page.getByRole("dialog").getByRole("button", { name: /confirm registration/i });
  await confirm.dblclick();
  await page.waitForURL(/\/dashboard\/(my-registration|success)/);
  await settle(page);
  const rows = await query<{ n: string }>(
    `select count(*) as n from registrations r join users u on u.id = r.student_id join registration_events e on e.id = r.event_id where u.register_number = $1 and e.name = $2`,
    [STUDENTS.mcaF2.reg, EVENTS.mcaSem3]
  );
  expect(Number(rows[0].n)).toBe(1);
  const picks = await query<{ n: string }>(
    `select count(*) as n from student_registrations s join users u on u.id = s.student_id where u.register_number = $1 and s.status = 'CONFIRMED'`,
    [STUDENTS.mcaF2.reg]
  );
  expect(Number(picks[0].n)).toBe(2);
  await expect(page.getByText(/already completed|went wrong|error/i)).toHaveCount(0);
});

test("sign-ins record the request address, not a placeholder, in the audit log", async ({ page }) => {
  await signInStudent(page, STUDENTS.mscF1.reg);
  // Regression: every login was recorded with the literal "client-ip".
  const rows = await query<{ ip: string | null }>(`select ip_address as ip from audit_logs where action = 'USER_LOGIN'`);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.filter((r) => r.ip === "client-ip")).toEqual([]);
});
