import { expect, test, type Page } from "@playwright/test";
import { EVENTS, STAFF, STUDENTS } from "./fixtures/constants";
import { chooseYearServer, collectProblems, expectNoProblems, query, reloadAndSettle, settle, signInStaff, signInStudent } from "./helpers";

/**
 * Route inventory with reload checks. Each page is opened by direct URL,
 * checked for its meaningful content, reloaded, and checked again; console
 * errors, uncaught exceptions and 5xx responses fail the test.
 */

type RouteCheck = { path: string; expect: RegExp; finalPath?: RegExp };

async function sweep(page: Page, routes: RouteCheck[]) {
  const problems = collectProblems(page);
  for (const r of routes) {
    await test.step(`${r.path}`, async () => {
      await page.goto(r.path, { waitUntil: "domcontentloaded" });
      await settle(page);
      if (r.finalPath) await expect(page).toHaveURL(r.finalPath);
      await expect(page.locator("body")).toContainText(r.expect);
      expectNoProblems(problems, `on load ${r.path}`);
      await reloadAndSettle(page);
      if (r.finalPath) await expect(page).toHaveURL(r.finalPath);
      await expect(page.locator("body")).toContainText(r.expect);
      expectNoProblems(problems, `after reload ${r.path}`);
    });
  }
}

test.describe("Unauthenticated access", () => {
  const protectedRoutes = ["/dashboard", "/dashboard/subjects", "/dashboard/electives", "/dashboard/my-registration", "/faculty/dashboard", "/faculty/reports", "/faculty/users", "/faculty/section"];
  for (const path of protectedRoutes) {
    test(`${path} redirects to sign-in without exposing content`, async ({ page, request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([302, 303, 307, 308]).toContain(res.status());
      expect(res.headers()["location"]).toMatch(/\/login/);
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    });
  }

  test("public pages load and survive reload", async ({ page }) => {
    await sweep(page, [
      { path: "/login", expect: /Sign in/ },
      { path: "/join", expect: /Join your class/ },
    ]);
  });
});

test.describe("Student routes", () => {
  test("open-event student: every page loads and reloads cleanly", async ({ page }) => {
    await signInStudent(page, STUDENTS.mcaF4.reg);
    const [subject] = await query<{ id: string }>(
      `select e.id from electives e join elective_groups g on g.id = e.group_id join registration_events ev on ev.id = g.event_id where ev.name = $1 order by e.name limit 1`,
      [EVENTS.mcaSem3]
    );
    await sweep(page, [
      { path: "/dashboard", expect: /Choose your electives|Semester 3/ },
      { path: "/dashboard/subjects", expect: /Explore subjects/ },
      { path: `/dashboard/subjects/${subject.id}`, expect: /Official details/ },
      { path: "/dashboard/electives", expect: /Choose your electives/ },
      // Not registered yet: the registration record redirects to the picker.
      { path: "/dashboard/my-registration", expect: /Choose your electives/, finalPath: /\/dashboard\/electives/ },
    ]);
  });

  test("upcoming-event student: countdown page loads and reloads cleanly", async ({ page }) => {
    await signInStudent(page, STUDENTS.mcaN1.reg);
    await sweep(page, [
      // Regression: /countdown crashed on load and reload (client function called on the server).
      { path: "/dashboard", expect: new RegExp(EVENTS.mcaFuture), finalPath: /\/countdown|\/dashboard/ },
      { path: "/countdown", expect: new RegExp(`${EVENTS.mcaFuture}[\\s\\S]*hours[\\s\\S]*minutes`) },
      { path: "/dashboard/subjects", expect: /Explore subjects/ },
    ]);
  });
});

test.describe("Staff routes", () => {
  test.describe.configure({ timeout: 300_000 });
  test("class tutor pages", async ({ page }) => {
    await signInStaff(page, STAFF.tutor.email);
    await chooseYearServer(page, 2026);
    await sweep(page, [
      { path: "/faculty/dashboard", expect: /Welcome back/ },
      { path: "/faculty/section", expect: /MCA F|MSc IT F/ },
      { path: "/faculty/window", expect: /Live window|registration window|Registration/ },
      { path: "/faculty/tutor-electives", expect: /Subjects & groups|Subjects/ },
      { path: "/faculty/tutor-reports", expect: /Section report|report/i },
      { path: "/faculty/monitor", expect: /Live Registration Monitor/ },
      { path: "/faculty/replay", expect: /Registration Replay/ },
      { path: "/faculty/assign-sections", expect: /class|Class/ },
      { path: "/faculty/approvals", expect: /E2E Student|registration|Registration/ },
      { path: "/faculty/settings", expect: /Settings/ },
    ]);
  });

  test("course coordinator pages", async ({ page }) => {
    await signInStaff(page, STAFF.coordinator.email);
    await chooseYearServer(page, 2026);
    await sweep(page, [
      { path: "/faculty/portal-select", expect: /Course Controller|Faculty/ },
      { path: "/faculty/dashboard", expect: /Welcome back/ },
      { path: "/faculty/electives", expect: /Electives & seats/ },
      { path: "/faculty/events", expect: /Registration events/ },
      { path: "/faculty/templates", expect: /Event Templates/ },
      { path: "/faculty/students", expect: /Students|students/ },
      { path: "/faculty/reports", expect: /Reports/ },
      { path: "/faculty/monitor", expect: /Live Registration Monitor/ },
      { path: "/faculty/academic-sessions", expect: /Academic Years/ },
    ]);
  });

  test("administrator pages", async ({ page }) => {
    await signInStaff(page, STAFF.admin.email);
    await chooseYearServer(page, 2026);
    await sweep(page, [
      { path: "/faculty/dashboard", expect: /Welcome back/ },
      { path: "/faculty/academic-sessions", expect: /Academic Years/ },
      { path: "/faculty/academic-sessions/2026", expect: /2026/ },
      { path: "/faculty/academic-sessions/review", expect: /review|Review/ },
      { path: "/faculty/year-servers", expect: /Academic Years|Year Servers/ },
      { path: "/faculty/users", expect: /Users/ },
      { path: "/faculty/departments", expect: /Departments/ },
      { path: "/faculty/invites", expect: /Invite codes/ },
      { path: "/faculty/audit", expect: /Audit log/ },
      { path: "/faculty/database", expect: /Database|database/ },
      // Tutor/coordinator-only page: administrators are sent to their dashboard.
      { path: "/faculty/approvals", expect: /Welcome back/, finalPath: /\/faculty\/dashboard/ },
      { path: "/faculty/settings", expect: /Settings/ },
    ]);
  });
});
