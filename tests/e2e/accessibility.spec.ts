import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, STAFF, STUDENTS } from "./fixtures/constants";
import { chooseYearServer, query, settle, signInStaff, signInStudent } from "./helpers";

/**
 * Automated accessibility checks (axe-core, WCAG 2.0/2.1 A and AA rules) on the
 * important pages, at desktop and phone widths. Serious and critical
 * violations fail the test; all findings are written to test-results.
 */
test.describe.configure({ timeout: 300_000 });

type Row = { page: string; width: number; id: string; impact: string | null | undefined; help: string; nodes: number; sample: string };
const rows: Row[] = [];

async function check(page: Page, label: string, url: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.waitForTimeout(500);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      // Next.js development overlay is not part of the application.
      .exclude("nextjs-portal")
      .analyze();
    for (const v of result.violations) {
      rows.push({ page: label, width, id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target.join(" ") ?? "" });
    }
    const blocking = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect.soft(blocking.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(" ")}`), `${label} @${width}`).toEqual([]);
  }
}

test.afterAll(() => {
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(`test-results/a11y-${process.env.QA_PHASE ?? "after"}.json`, JSON.stringify(rows, null, 2));
});

test("public pages", async ({ page }) => {
  await check(page, "login", "/login");
  await check(page, "join", "/join");
});

test("student pages", async ({ page }) => {
  await signInStudent(page, STUDENTS.mcaF2.reg);
  const [subject] = await query<{ id: string }>(
    `select e.id from electives e join elective_groups g on g.id = e.group_id join registration_events ev on ev.id = g.event_id where ev.name = $1 order by e.name limit 1`,
    [EVENTS.mcaSem3]
  );
  await check(page, "student-electives", "/dashboard/electives");
  await check(page, "student-subjects", "/dashboard/subjects");
  await check(page, "student-subject-detail", `/dashboard/subjects/${subject.id}`);
  await page.context().clearCookies();
  await signInStudent(page, STUDENTS.mcaN1.reg);
  await check(page, "student-countdown", "/countdown");
});

test("staff pages", async ({ page }) => {
  await signInStaff(page, STAFF.tutor.email);
  await check(page, "staff-session-select", "/faculty/session-select");
  await chooseYearServer(page, 2026);
  for (const [label, url] of [
    ["tutor-dashboard", "/faculty/dashboard"],
    ["tutor-section", "/faculty/section"],
    ["tutor-window", "/faculty/window"],
    ["tutor-monitor", "/faculty/monitor"],
    ["tutor-reports", "/faculty/tutor-reports"],
  ] as const) await check(page, label, url);
  await page.context().clearCookies();
  await signInStaff(page, STAFF.admin.email);
  await chooseYearServer(page, 2026);
  for (const [label, url] of [
    ["admin-users", "/faculty/users"],
    ["admin-audit", "/faculty/audit"],
    ["admin-year-servers", "/faculty/academic-sessions"],
  ] as const) await check(page, label, url);
});
