import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Runs drizzle/0006_academic_sessions.sql (and its rollback) against legacy
 * fixtures in a throwaway schema, so real tables are never touched.
 */
const UP = readFileSync(resolve("drizzle/0006_academic_sessions.sql"), "utf8");
const DOWN = readFileSync(resolve("drizzle/rollback/0006_academic_sessions.down.sql"), "utf8");

const schema = `mig06_${randomUUID().slice(0, 8)}`;
const id = () => randomUUID();
const ids = {
  progP: id(),
  progQ: id(),
  batch25: id(),
  batch26: id(),
  batchLegacy: id(),
  secF25: id(),
  secG25: id(),
  secF26: id(),
  secLegacy: id(),
  e1: id(),
  e2: id(),
  e3: id(),
  e4: id(),
  es1: id(),
  esWrong: id(),
  es2: id(),
  student1: id(),
  studentMismatch: id(),
  staff: id(),
  codeNoClass: id(),
  reg1: id(),
};

const LEGACY = `
  CREATE TABLE users (id uuid PRIMARY KEY, role text NOT NULL, section_id uuid, academic_batch_id uuid);
  CREATE TABLE programmes (id uuid PRIMARY KEY, duration_years integer DEFAULT 4);
  CREATE TABLE academic_batches (id uuid PRIMARY KEY, year text NOT NULL, programme_id uuid NOT NULL REFERENCES programmes(id));
  CREATE TABLE sections (id uuid PRIMARY KEY, label text NOT NULL, academic_batch_id uuid NOT NULL REFERENCES academic_batches(id));
  CREATE TABLE registration_events (id uuid PRIMARY KEY, name text NOT NULL, academic_year text, academic_batch_id uuid NOT NULL REFERENCES academic_batches(id), status text DEFAULT 'DRAFT' NOT NULL);
  CREATE TABLE event_sections (id uuid PRIMARY KEY, event_id uuid NOT NULL REFERENCES registration_events(id) ON DELETE CASCADE, section_id uuid NOT NULL REFERENCES sections(id), UNIQUE (event_id, section_id));
  CREATE TABLE invite_codes (id uuid PRIMARY KEY, code text NOT NULL, role text NOT NULL, section_id uuid, academic_batch_id uuid);
  CREATE TABLE registrations (id uuid PRIMARY KEY, student_id uuid NOT NULL, event_id uuid NOT NULL, status text NOT NULL, receipt_snapshot jsonb);
`;

function statements(sql: string) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("Migration 0006: academic sessions and cohort targeting", () => {
  let client: Client;
  const one = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await client.query(q, params)).rows[0] as T;
  const all = async <T = Record<string, unknown>>(q: string, params: unknown[] = []) => (await client.query(q, params)).rows as T[];
  /** Runs SQL in one transaction and always ends it, so a failure can't leave the connection stuck. */
  const runInTransaction = async (...sqls: string[]) => {
    await client.query("BEGIN");
    try {
      for (const q of sqls) await client.query(q);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  };

  before(async () => {
    const url = process.env.DATABASE_URL!;
    const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
    client = new Client({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(LEGACY);

    const q = (text: string, params: unknown[]) => client.query(text, params);
    await q(`INSERT INTO programmes VALUES ($1, 2), ($2, 4)`, [ids.progP, ids.progQ]);
    await q(`INSERT INTO academic_batches VALUES ($1, '2025', $3), ($2, '2026', $3), ($4, 'Legacy', $5)`, [ids.batch25, ids.batch26, ids.progP, ids.batchLegacy, ids.progQ]);
    await q(`INSERT INTO sections VALUES ($1, 'F', $4), ($2, 'G', $4), ($3, 'F', $5), ($6, 'A', $7)`, [ids.secF25, ids.secG25, ids.secF26, ids.batch25, ids.batch26, ids.secLegacy, ids.batchLegacy]);
    await q(
      `INSERT INTO registration_events (id, name, academic_year, academic_batch_id, status) VALUES
        ($1, 'MCA F 2025 cohort', '2026-2027', $5, 'OPEN'),
        ($2, 'MCA F 2026 cohort', '2026–2027', $6, 'OPEN'),
        ($3, 'Legacy label', 'Batch 2026', $7, 'CLOSED'),
        ($4, 'Two-year label', '2027-2029', $5, 'DRAFT')`,
      [ids.e1, ids.e2, ids.e3, ids.e4, ids.batch25, ids.batch26, ids.batchLegacy]
    );
    // es1 is correct; esWrong targets the 2026 cohort's F from the 2025 cohort's event
    await q(`INSERT INTO event_sections VALUES ($1, $4, $5), ($2, $4, $6), ($3, $7, $6)`, [ids.es1, ids.esWrong, ids.es2, ids.e1, ids.secF25, ids.secF26, ids.e2]);
    await q(
      `INSERT INTO users VALUES ($1, 'STUDENT', $4, $5), ($2, 'STUDENT', $6, $5), ($3, 'CLASS_TUTOR', $4, NULL)`,
      [ids.student1, ids.studentMismatch, ids.staff, ids.secF25, ids.batch25, ids.secF26]
    );
    await q(`INSERT INTO invite_codes VALUES ($1, 'OLD-CODE', 'STUDENT', NULL, NULL)`, [ids.codeNoClass]);
    await q(`INSERT INTO registrations VALUES ($1, $2, $3, 'CONFIRMED', '{"receiptNumber":"ELC-1"}')`, [ids.reg1, ids.student1, ids.e1]);
  });

  after(async () => {
    if (!client) return;
    try {
      await client.query("ROLLBACK").catch(() => undefined);
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await client.end();
    }
  });

  test("maps only what it can map confidently", async () => {
    await runInTransaction(UP);

    const sessions = await all<{ start_year: number; end_year: number; status: string }>(`SELECT start_year, end_year, status FROM academic_sessions`);
    assert.deepStrictEqual(sessions, [{ start_year: 2026, end_year: 2027, status: "ACTIVE" }], "only the consecutive YYYY-YYYY label becomes a session");

    const ev = await all<{ id: string; linked: boolean }>(`SELECT id, academic_session_id IS NOT NULL AS linked FROM registration_events`);
    const linked = Object.fromEntries(ev.map((e) => [e.id, e.linked]));
    assert.strictEqual(linked[ids.e1], true);
    assert.strictEqual(linked[ids.e2], true, "en dash label is recognised");
    assert.strictEqual(linked[ids.e3], false, "free-text label is left for reconciliation");
    assert.strictEqual(linked[ids.e4], false, "non-consecutive years are left for reconciliation");

    const batches = await all<{ id: string; admission_year: number | null; expected_end_year: number | null; dates_confirmed: boolean }>(
      `SELECT id, admission_year, expected_end_year, dates_confirmed FROM academic_batches`
    );
    const b = Object.fromEntries(batches.map((x) => [x.id, x]));
    assert.deepStrictEqual([b[ids.batch25].admission_year, b[ids.batch25].expected_end_year], [2025, 2027]);
    assert.deepStrictEqual([b[ids.batch26].admission_year, b[ids.batch26].expected_end_year], [2026, 2028]);
    assert.deepStrictEqual([b[ids.batchLegacy].admission_year, b[ids.batchLegacy].expected_end_year], [null, null], "no year guessed from a label");
    assert.ok(batches.every((x) => x.dates_confirmed === false), "derived dates wait for confirmation");

    const terms = await all<{ academic_batch_id: string; study_year: number | null; confirmed: boolean }>(
      `SELECT academic_batch_id, study_year, confirmed FROM cohort_session_terms ORDER BY study_year DESC`
    );
    assert.deepStrictEqual(
      terms.map((t) => [t.academic_batch_id, t.study_year, t.confirmed]),
      [
        [ids.batch25, 2, false],
        [ids.batch26, 1, false],
      ],
      "both MCA F cohorts join 2026–2027 as separate cohorts at different stages"
    );
  });

  test("event targeting is consistent and contradictions are archived, not lost", async () => {
    const rows = await all<{ id: string; academic_batch_id: string }>(`SELECT id, academic_batch_id FROM event_sections ORDER BY id`);
    assert.deepStrictEqual(rows.map((r) => r.id).sort(), [ids.es1, ids.es2].sort());
    const archived = await one<{ source_id: string; reason: string }>(`SELECT source_id, reason FROM academic_reconciliation_archive`);
    assert.deepStrictEqual(archived, { source_id: ids.esWrong, reason: "SECTION_OUTSIDE_EVENT_COHORT" });

    // The database itself now refuses targeting outside the event's cohort.
    await assert.rejects(
      client.query(`INSERT INTO event_sections (id, event_id, section_id, academic_batch_id) VALUES ($1, $2, $3, $4)`, [id(), ids.e1, ids.secF26, ids.batch26]),
      /event_sections_event_cohort_fk/
    );
    await assert.rejects(
      client.query(`INSERT INTO event_sections (id, event_id, section_id, academic_batch_id) VALUES ($1, $2, $3, $4)`, [id(), ids.e1, ids.secF26, ids.batch25]),
      /event_sections_section_cohort_fk/
    );
    // ...but a second class of the same cohort is allowed (explicit multi-class targeting)
    await client.query(`INSERT INTO event_sections (id, event_id, section_id, academic_batch_id) VALUES ($1, $2, $3, $4)`, [id(), ids.e1, ids.secG25, ids.batch25]);
  });

  test("inconsistent existing rows are flagged (NOT VALID), and records are untouched", async () => {
    const cons = await all<{ conname: string; convalidated: boolean }>(
      `SELECT conname, convalidated FROM pg_constraint WHERE connamespace = $1::regnamespace AND conname IN ('users_section_cohort_fk','invite_codes_student_section_check','invite_codes_section_cohort_fk') ORDER BY conname`,
      [schema]
    );
    assert.deepStrictEqual(
      cons.map((c) => [c.conname, c.convalidated]),
      [
        ["invite_codes_section_cohort_fk", true],
        ["invite_codes_student_section_check", false],
        ["users_section_cohort_fk", false],
      ]
    );
    // New inconsistent writes are refused even while the constraint is NOT VALID
    await assert.rejects(client.query(`UPDATE users SET section_id = $1 WHERE id = $2`, [ids.secF26, ids.student1]), /users_section_cohort_fk/);

    const reg = await one<{ status: string; receipt_snapshot: unknown }>(`SELECT status, receipt_snapshot FROM registrations WHERE id = $1`, [ids.reg1]);
    assert.deepStrictEqual(reg, { status: "CONFIRMED", receipt_snapshot: { receiptNumber: "ELC-1" } });
    const users = await one<{ n: number }>(`SELECT count(*)::int AS n FROM users`);
    assert.strictEqual(users.n, 3);
  });

  test("is idempotent", async () => {
    await runInTransaction(UP);
    assert.strictEqual((await one<{ n: number }>(`SELECT count(*)::int AS n FROM academic_sessions`)).n, 1);
    assert.strictEqual((await one<{ n: number }>(`SELECT count(*)::int AS n FROM cohort_session_terms`)).n, 2);
    assert.strictEqual((await one<{ n: number }>(`SELECT count(*)::int AS n FROM academic_reconciliation_archive`)).n, 1);
  });

  test("rollback restores the previous structure and the archived targeting", async () => {
    await runInTransaction(...statements(DOWN));

    const tables = await all<{ t: string | null }>(`SELECT to_regclass('academic_sessions')::text AS t UNION ALL SELECT to_regclass('cohort_session_terms')::text`);
    assert.deepStrictEqual(tables.map((t) => t.t), [null, null]);
    const cols = await all<{ c: string }>(
      `SELECT table_name || '.' || column_name AS c FROM information_schema.columns WHERE table_schema = $1 AND column_name IN ('academic_session_id','semester','admission_year','expected_end_year','dates_confirmed') OR (table_schema = $1 AND table_name = 'event_sections' AND column_name = 'academic_batch_id')`,
      [schema]
    );
    assert.deepStrictEqual(cols, []);
    const restored = await one<{ n: number }>(`SELECT count(*)::int AS n FROM event_sections WHERE id = $1`, [ids.esWrong]);
    assert.strictEqual(restored.n, 1, "the archived targeting row is back");
  });
});
