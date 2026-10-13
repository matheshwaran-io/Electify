import { expect, test } from "@playwright/test";
import { EVENTS, STUDENTS, SUBJECTS } from "./fixtures/constants";
import { query, seatsOf, settle, signInStudent } from "./helpers";

/**
 * Regression: the elective picker copied seat counts into state once and never
 * took newer server data, and had no refresh at all when realtime is not
 * configured. It now re-renders from the server when the tab becomes visible
 * (and every 30s), and shows the new counts.
 */
test("picker shows updated seat counts after a background refresh, without a reload", async ({ page }) => {
  await signInStudent(page, STUDENTS.mcaF3.reg);
  await page.goto("/dashboard/electives");
  await settle(page);
  const before = await seatsOf(SUBJECTS.enterprise, EVENTS.mcaSem3);
  const card = page.locator("div").filter({ has: page.getByText(SUBJECTS.enterprise, { exact: true }) }).filter({ hasText: /seats? left/ }).last();
  await expect(card).toContainText(`${before.available} seats left`);

  // Another registration path changes the counter (simulated directly in the test database).
  await query(
    `update electives set available_seats = available_seats - 3 where name = $1 and group_id in
       (select g.id from elective_groups g join registration_events e on e.id = g.event_id where e.name = $2)`,
    [SUBJECTS.enterprise, EVENTS.mcaSem3]
  );
  try {
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(card).toContainText(`${before.available - 3} seats left`, { timeout: 15_000 });
    expect(page.url()).toContain("/dashboard/electives");
  } finally {
    await query(
      `update electives set available_seats = available_seats + 3 where name = $1 and group_id in
         (select g.id from elective_groups g join registration_events e on e.id = g.event_id where e.name = $2)`,
      [SUBJECTS.enterprise, EVENTS.mcaSem3]
    );
  }
});
