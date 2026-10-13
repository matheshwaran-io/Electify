import { expect, type Page, type Response } from "@playwright/test";
import { Client } from "pg";
import { E2E_DATABASE_URL, E2E_PASSWORD } from "./fixtures/constants";

// ───────────────────────────────────────────────────────── error collection
export type Problems = { console: string[]; page: string[]; server: string[] };

/**
 * Collects browser console errors, uncaught page errors and 5xx responses.
 * Network failures caused by the deliberately unconfigured realtime service are
 * not application errors and are ignored.
 */
export function collectProblems(page: Page): Problems {
  const p: Problems = { console: [], page: [], server: [] };
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/favicon|Download the React DevTools/i.test(text)) return;
    p.console.push(text.slice(0, 400));
  });
  page.on("pageerror", (e) => p.page.push(String(e?.message ?? e).slice(0, 400)));
  page.on("response", (r: Response) => {
    if (r.status() >= 500) p.server.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  return p;
}

export function expectNoProblems(p: Problems, label = "") {
  expect.soft(p.page, `uncaught page errors ${label}`).toEqual([]);
  expect.soft(p.server, `server errors ${label}`).toEqual([]);
  expect.soft(p.console, `console errors ${label}`).toEqual([]);
  p.console.length = 0;
  p.page.length = 0;
  p.server.length = 0;
}

// ───────────────────────────────────────────────────────── navigation
export async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
}

export async function reloadAndSettle(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await settle(page);
}

// ───────────────────────────────────────────────────────── sign-in
export async function signInStudent(page: Page, registerNumber: string) {
  await page.goto("/login");
  await page.getByPlaceholder("e.g. RA2532241010001").fill(registerNumber);
  await page.getByPlaceholder("Your password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /^sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await settle(page);
}

export async function signInStaff(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("tab", { name: /staff/i }).click();
  await page.getByPlaceholder("name@srmist.edu.in").fill(email);
  await page.getByPlaceholder("Your password").fill(E2E_PASSWORD);
  await page.getByRole("button", { name: /^sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  await settle(page);
}

/** Picks a Year Server on the chooser if it is shown. */
export async function chooseYearServer(page: Page, year: number) {
  if (!page.url().includes("/faculty/session-select")) return;
  await page.getByRole("button", { name: new RegExp(`^Year ${year},`) }).click();
  await page.waitForURL((u) => !u.pathname.includes("session-select"), { timeout: 30_000 });
  await settle(page);
}

// ───────────────────────────────────────────────────────── database (read-only assertions)
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: E2E_DATABASE_URL });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

export async function seatsOf(subject: string, eventName: string) {
  const [row] = await query<{ max: number; available: number; confirmed: string }>(
    `select e.max_seats as max, e.available_seats as available,
            (select count(*) from student_registrations s where s.elective_id = e.id and s.status = 'CONFIRMED') as confirmed
       from electives e join elective_groups g on g.id = e.group_id join registration_events ev on ev.id = g.event_id
      where e.name = $1 and ev.name = $2`,
    [subject, eventName]
  );
  return { max: row.max, available: row.available, confirmed: Number(row.confirmed) };
}

// ───────────────────────────────────────────────────────── layout
/** Horizontal overflow of the document, in CSS pixels (0 means none). */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
}
