import test, { describe, before, after } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Runs drizzle/0004_remove_waitlist.sql (and its rollback) against legacy
 * fixtures in a throwaway schema, so the real tables are never touched.
 * The migration uses unqualified names, so search_path decides where it runs.
 */
const UP = readFileSync(resolve("drizzle/0004_remove_waitlist.sql"), "utf8");
const DOWN = readFileSync(resolve("drizzle/rollback/0004_remove_waitlist.down.sql"), "utf8");

const schema = `mig_test_${randomUUID().slice(0, 8)}`;
const id = () => randomUUID();
const ids = {
  eventOn: id(),
  eventOff: id(),
  elX: id(),
  elY: id(),
  g1: id(),
  g2: id(),
  studentA: id(),
  studentB: id(),
  studentC: id(),
  choiceAConfirmed: id(),
  choiceAWaitlisted: id(),
  choiceBWaitlisted: id(),
  choiceCConfirmed: id(),
  choiceCCancelled: id(),
  regA: id(),
  regB: id(),
  regC: id(),
};

const snapshotA = {
  receiptNumber: "ELC-2025-ODD-000001",
  isWaitlisted: true,
  electives: [
    { groupName: "PE", electiveName: "Elective X", status: "CONFIRMED" },
    { groupName: "OE", electiveName: "Elective Y [Waitlisted #1]", status: "WAITLISTED", isWaitlisted: true, waitlistPosition: 1 },
  ],
};
const snapshotB = {
  receiptNumber: "ELC-2025-ODD-000002",
  isWaitlisted: true,
  electives: [{ groupName: "OE", electiveName: "Elective Y [Waitlisted #2]", isWaitlisted: true, waitlistPosition: 2 }],
};
const snapshotC = {
  receiptNumber: "ELC-2025-ODD-000003",
  electives: [{ groupName: "PE", electiveName: "Elective X", status: "CONFIRMED" }],
};

const LEGACY_SCHEMA = `
  CREATE TYPE registration_status AS ENUM ('NOT_REGISTERED', 'CONFIRMED', 'WAITLISTED', 'CANCELLED', 'RESET_BY_COORDINATOR');
  CREATE TABLE registration_events (id uuid PRIMARY KEY, name text NOT NULL, enable_waitlist boolean DEFAULT false NOT NULL);
  CREATE TABLE electives (id uuid PRIMARY KEY, name text NOT NULL, available_seats integer NOT NULL);
  CREATE TABLE student_registrations (
    id uuid PRIMARY KEY, student_id uuid NOT NULL, event_id uuid NOT NULL, group_id uuid NOT NULL, elective_id uuid NOT NULL,
    status text DEFAULT 'CONFIRMED' NOT NULL, is_waitlisted boolean DEFAULT false NOT NULL, waitlist_position integer,
    updated_at timestamp DEFAULT now() NOT NULL
  );
  CREATE TABLE registrations (
    id uuid PRIMARY KEY, student_id uuid NOT NULL, event_id uuid NOT NULL,
    status registration_status DEFAULT 'NOT_REGISTERED' NOT NULL, receipt_number text UNIQUE, receipt_snapshot jsonb,
    updated_at timestamp DEFAULT now() NOT NULL
  );
  CREATE TABLE replay_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL);
  CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL);
`;

/** Splits the rollback into single statements so each runs in its own transaction, like psql without -1. */
function statements(sql: string) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("Migration 0004: remove waitlist", () => {
  let client: Client;

  before(async () => {
    const url = process.env.DATABASE_URL!;
    const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
    client = new Client({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query(LEGACY_SCHEMA);

    const q = (sql: string, params: unknown[]) => client.query(sql, params);
    await q(`INSERT INTO registration_events VALUES ($1, 'Waitlist on', true), ($2, 'Waitlist off', false)`, [ids.eventOn, ids.eventOff]);
    await q(`INSERT INTO electives VALUES ($1, 'Elective X', 0), ($2, 'Elective Y', 0)`, [ids.elX, ids.elY]);
    const sr = `INSERT INTO student_registrations (id, student_id, event_id, group_id, elective_id, status, is_waitlisted, waitlist_position, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '2025-01-01 10:00:00')`;
    await q(sr, [ids.choiceAConfirmed, ids.studentA, ids.eventOn, ids.g1, ids.elX, "CONFIRMED", false, null]);
    await q(sr, [ids.choiceAWaitlisted, ids.studentA, ids.eventOn, ids.g2, ids.elY, "WAITLISTED", true, 1]);
    // Older rows only set the flag and left status CONFIRMED
    await q(sr, [ids.choiceBWaitlisted, ids.studentB, ids.eventOn, ids.g2, ids.elY, "CONFIRMED", true, 2]);
    await q(sr, [ids.choiceCConfirmed, ids.studentC, ids.eventOn, ids.g1, ids.elX, "CONFIRMED", false, null]);
    await q(sr, [ids.choiceCCancelled, ids.studentC, ids.eventOn, ids.g2, ids.elY, "CANCELLED", false, null]);
    const reg = `INSERT INTO registrations (id, student_id, event_id, status, receipt_number, receipt_snapshot, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, '2025-01-01 10:00:00')`;
    await q(reg, [ids.regA, ids.studentA, ids.eventOn, "WAITLISTED", snapshotA.receiptNumber, snapshotA]);
    await q(reg, [ids.regB, ids.studentB, ids.eventOn, "WAITLISTED", snapshotB.receiptNumber, snapshotB]);
    await q(reg, [ids.regC, ids.studentC, ids.eventOn, "CONFIRMED", snapshotC.receiptNumber, snapshotC]);
    await client.query(`INSERT INTO replay_events (event_type) VALUES ('STUDENT_WAITLISTED'), ('WAITLIST_PROMOTED'), ('STUDENT_REGISTERED')`);
    await client.query(`INSERT INTO audit_logs (action) VALUES ('WAITLIST_PROMOTED')`);
  });

  after(async () => {
    if (!client) return;
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows[0] as T;
  const columns = async () =>
    (
      await client.query(
        `SELECT table_name || '.' || column_name AS c FROM information_schema.columns WHERE table_schema = $1 ORDER BY 1`,
        [schema]
      )
    ).rows.map((r) => r.c as string);
  const enumLabels = async () =>
    (
      await client.query(
        `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE t.typname = 'registration_status' AND n.nspname = $1 ORDER BY e.enumsortorder`,
        [schema]
      )
    ).rows.map((r) => r.enumlabel as string);

  test("applies, archives history and converts legacy waitlist rows", async () => {
    await client.query("BEGIN");
    await client.query(UP);
    await client.query("COMMIT");

    const cols = await columns();
    for (const c of ["student_registrations.is_waitlisted", "student_registrations.waitlist_position", "registration_events.enable_waitlist"]) {
      assert.ok(!cols.includes(c), `${c} dropped`);
    }
    assert.deepStrictEqual(await enumLabels(), ["NOT_REGISTERED", "CONFIRMED", "CANCELLED", "RESET_BY_COORDINATOR"]);

    const archive = (await client.query(`SELECT source_table, count(*)::int AS n FROM legacy_waitlist_archive GROUP BY 1 ORDER BY 1`)).rows;
    assert.deepStrictEqual(archive, [
      { source_table: "registration_events", n: 1 },
      { source_table: "registrations", n: 2 },
      { source_table: "student_registrations", n: 2 },
    ]);
    const archivedA = await one<{ payload: { status: string; is_waitlisted: boolean; waitlist_position: number } }>(
      `SELECT payload FROM legacy_waitlist_archive WHERE source_id = $1`,
      [ids.choiceAWaitlisted]
    );
    assert.strictEqual(archivedA.payload.is_waitlisted, true);
    assert.strictEqual(archivedA.payload.waitlist_position, 1);

    const status = async (table: string, rowId: string) => (await one<{ status: string }>(`SELECT status::text FROM ${table} WHERE id = $1`, [rowId])).status;
    assert.strictEqual(await status("student_registrations", ids.choiceAWaitlisted), "CANCELLED");
    assert.strictEqual(await status("student_registrations", ids.choiceBWaitlisted), "CANCELLED", "flag-only rows are converted too");
    assert.strictEqual(await status("student_registrations", ids.choiceAConfirmed), "CONFIRMED");
    assert.strictEqual(await status("registrations", ids.regA), "CONFIRMED", "keeps the confirmed choice");
    assert.strictEqual(await status("registrations", ids.regB), "CANCELLED", "nothing confirmed left");

    const snapA = (await one<{ receipt_snapshot: typeof snapshotA }>(`SELECT receipt_snapshot FROM registrations WHERE id = $1`, [ids.regA]))
      .receipt_snapshot;
    assert.strictEqual("isWaitlisted" in snapA, false);
    assert.deepStrictEqual(snapA.electives[0], snapshotA.electives[0]);
    assert.deepStrictEqual(snapA.electives[1], { groupName: "OE", electiveName: "Elective Y [Cancelled]", status: "CANCELLED" });
    assert.strictEqual(snapA.receiptNumber, snapshotA.receiptNumber, "receipt number kept");

    const c = await one<{ status: string; receipt_snapshot: unknown; updated_at: Date }>(
      `SELECT status::text, receipt_snapshot, updated_at FROM registrations WHERE id = $1`,
      [ids.regC]
    );
    assert.strictEqual(c.status, "CONFIRMED");
    assert.deepStrictEqual(c.receipt_snapshot, snapshotC, "unrelated receipts untouched");
    assert.strictEqual(c.updated_at.getFullYear(), 2025, "unrelated registrations not rewritten");
    assert.strictEqual(await status("student_registrations", ids.choiceCCancelled), "CANCELLED");

    const seatsRow = await one<{ x: number; y: number }>(
      `SELECT (SELECT available_seats FROM electives WHERE id = $1) AS x, (SELECT available_seats FROM electives WHERE id = $2) AS y`,
      [ids.elX, ids.elY]
    );
    assert.deepStrictEqual(seatsRow, { x: 0, y: 0 }, "seat counts unchanged");
    assert.strictEqual((await one<{ n: number }>(`SELECT count(*)::int AS n FROM replay_events`)).n, 3, "replay history kept");
    assert.strictEqual((await one<{ n: number }>(`SELECT count(*)::int AS n FROM audit_logs`)).n, 1, "audit history kept");
  });

  test("is idempotent", async () => {
    await client.query("BEGIN");
    await client.query(UP);
    await client.query("COMMIT");
    assert.strictEqual((await one<{ n: number }>(`SELECT count(*)::int AS n FROM legacy_waitlist_archive`)).n, 5, "nothing archived twice");
  });

  test("rollback restores the pre-migration state from the archive", async () => {
    for (const stmt of statements(DOWN)) await client.query(stmt);

    assert.deepStrictEqual(await enumLabels(), ["NOT_REGISTERED", "CONFIRMED", "WAITLISTED", "CANCELLED", "RESET_BY_COORDINATOR"]);
    const a = await one<{ status: string; is_waitlisted: boolean; waitlist_position: number }>(
      `SELECT status, is_waitlisted, waitlist_position FROM student_registrations WHERE id = $1`,
      [ids.choiceAWaitlisted]
    );
    assert.deepStrictEqual(a, { status: "WAITLISTED", is_waitlisted: true, waitlist_position: 1 });
    const b = await one<{ status: string; is_waitlisted: boolean }>(`SELECT status, is_waitlisted FROM student_registrations WHERE id = $1`, [
      ids.choiceBWaitlisted,
    ]);
    assert.deepStrictEqual(b, { status: "CONFIRMED", is_waitlisted: true });

    const regA = await one<{ status: string; receipt_snapshot: unknown }>(`SELECT status::text, receipt_snapshot FROM registrations WHERE id = $1`, [ids.regA]);
    assert.strictEqual(regA.status, "WAITLISTED");
    assert.deepStrictEqual(regA.receipt_snapshot, snapshotA);
    assert.strictEqual((await one<{ enable_waitlist: boolean }>(`SELECT enable_waitlist FROM registration_events WHERE id = $1`, [ids.eventOn])).enable_waitlist, true);
    assert.strictEqual((await one<{ enable_waitlist: boolean }>(`SELECT enable_waitlist FROM registration_events WHERE id = $1`, [ids.eventOff])).enable_waitlist, false);
  });
});
