import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { EVENTS, STAFF, STUDENTS } from "./fixtures/constants";
import { chooseYearServer, query, settle, signInStaff, signInStudent } from "./helpers";

/**
 * Responsive audit: important pages at representative viewports. Fails on
 * horizontal overflow of the page or of the app shell's scrolling <main>, and
 * checks that the navigation pattern for the width is present. Screenshots of
 * selected widths are written to test-results/qa-screens/<QA_PHASE>/ (default "after");
 * a curated set is kept in docs/qa/artifacts.
 */
test.describe.configure({ timeout: 600_000 });

export const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
] as const;
const SHOT_AT = new Set(["320x568", "390x844", "768x1024", "1440x900"]);
const PHASE = process.env.QA_PHASE ?? "after";
const OUT = path.join("test-results/qa-screens", PHASE);
const RESULTS = path.join("test-results", `mobile-audit-${PHASE}.json`);

type Finding = { page: string; viewport: string; docOverflow: number; mainOverflow: number; culprits: string[]; nav: string };
const findings: Finding[] = [];

async function measure(page: Page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const docOverflow = Math.max(0, document.documentElement.scrollWidth - vw);
    const main = document.querySelector("main#main") as HTMLElement | null;
    const mainOverflow = main ? Math.max(0, main.scrollWidth - main.clientWidth) : 0;
    const scrollable = (el: Element | null): boolean => {
      for (let e = el?.parentElement; e && e !== document.body; e = e.parentElement) {
        if (e === main) return false;
        const ox = getComputedStyle(e).overflowX;
        if ((ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") && e.scrollWidth > e.clientWidth - 1) return true;
      }
      return false;
    };
    const limit = main ? main.getBoundingClientRect().right : vw;
    const culprits =
      docOverflow > 0 || mainOverflow > 0
        ? [...document.querySelectorAll("body *")]
            .filter((el) => {
              const r = el.getBoundingClientRect();
              if (r.width === 0 || r.right <= limit + 1) return false;
              const pos = getComputedStyle(el).position;
              return pos !== "fixed" && !scrollable(el);
            })
            .slice(0, 6)
            .map((el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String((el as HTMLElement).className).split(" ").slice(0, 4).join(".")} →${Math.round(el.getBoundingClientRect().right - limit)}px`)
        : [];
    // offsetParent is always null for position:fixed elements, so measure the box instead.
    const visible = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
    };
    const nav = visible('nav[aria-label="Primary"]') ? "bottom-bar" : visible('button[aria-label="Open navigation"]') ? "drawer" : visible("aside") ? "sidebar" : "none";
    return { docOverflow, mainOverflow, culprits, nav };
  });
}

async function audit(page: Page, label: string, url: string, opts: { shell?: boolean } = {}) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await settle(page);
    await page.waitForTimeout(400);
    const m = await measure(page);
    findings.push({ page: label, viewport: vp.name, ...m });
    if (SHOT_AT.has(vp.name)) {
      // Hide the Next.js development-mode indicator; it is not part of the app.
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      fs.mkdirSync(path.join(OUT, vp.name), { recursive: true });
      await page.screenshot({ path: path.join(OUT, vp.name, `${label}.png`), fullPage: !opts.shell });
    }
    expect.soft(m.docOverflow, `${label} @${vp.name} page overflow ${m.culprits.join(", ")}`).toBe(0);
    expect.soft(m.mainOverflow, `${label} @${vp.name} main overflow ${m.culprits.join(", ")}`).toBe(0);
    if (opts.shell) {
      const expected = vp.width < 768 ? "bottom-bar" : vp.width < 1024 ? "drawer" : "sidebar";
      expect.soft(m.nav, `${label} @${vp.name} navigation`).toBe(expected);
    }
  }
}

test.afterAll(() => {
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(RESULTS, JSON.stringify(findings, null, 2));
});

test("public pages", async ({ page }) => {
  await audit(page, "login", "/login");
  await audit(page, "join", "/join");
});

test("student pages", async ({ page }) => {
  await signInStudent(page, STUDENTS.mcaF3.reg);
  const [subject] = await query<{ id: string }>(
    `select e.id from electives e join elective_groups g on g.id = e.group_id join registration_events ev on ev.id = g.event_id where ev.name = $1 order by e.name limit 1`,
    [EVENTS.mcaSem3]
  );
  await audit(page, "student-electives", "/dashboard/electives");
  await audit(page, "student-subjects", "/dashboard/subjects");
  await audit(page, "student-subject-detail", `/dashboard/subjects/${subject.id}`);
});

test("student countdown", async ({ page }) => {
  await signInStudent(page, STUDENTS.mcaN1.reg);
  await audit(page, "student-countdown", "/countdown");
  // Regression: the timer digits were clipped at phone widths (an ancestor hides the overflow).
  for (const vp of VIEWPORTS.slice(0, 4)) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/countdown");
    const box = await page.getByRole("timer").boundingBox();
    expect(box, `timer visible @${vp.name}`).not.toBeNull();
    expect.soft(box!.x, `timer left edge @${vp.name}`).toBeGreaterThanOrEqual(0);
    expect.soft(box!.x + box!.width, `timer right edge @${vp.name}`).toBeLessThanOrEqual(vp.width);
  }
});

test("tutor pages", async ({ page }) => {
  await signInStaff(page, STAFF.tutor.email);
  await chooseYearServer(page, 2026);
  for (const [label, url] of [
    ["tutor-dashboard", "/faculty/dashboard"],
    ["tutor-section", "/faculty/section"],
    ["tutor-window", "/faculty/window"],
    ["tutor-electives", "/faculty/tutor-electives"],
    ["tutor-reports", "/faculty/tutor-reports"],
    ["tutor-monitor", "/faculty/monitor"],
  ] as const) await audit(page, label, url, { shell: true });
  await audit(page, "staff-session-select", "/faculty/session-select?choose=1");
});

test("coordinator and admin pages", async ({ page }) => {
  await signInStaff(page, STAFF.coordinator.email);
  await chooseYearServer(page, 2026);
  for (const [label, url] of [
    ["coord-electives", "/faculty/electives"],
    ["coord-events", "/faculty/events"],
    ["coord-reports", "/faculty/reports"],
    ["coord-students", "/faculty/students"],
  ] as const) await audit(page, label, url, { shell: true });

  await page.context().clearCookies();
  await signInStaff(page, STAFF.admin.email);
  await chooseYearServer(page, 2026);
  for (const [label, url] of [
    ["admin-year-servers", "/faculty/academic-sessions"],
    ["admin-users", "/faculty/users"],
    ["admin-audit", "/faculty/audit"],
    ["admin-invites", "/faculty/invites"],
    ["admin-departments", "/faculty/departments"],
  ] as const) await audit(page, label, url, { shell: true });
});
