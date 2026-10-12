/**
 * Applies one hand-written SQL migration from drizzle/ inside a single transaction.
 *
 *   npx tsx --env-file=.env.local scripts/db/apply-sql.ts drizzle/0004_remove_waitlist.sql
 *
 * The project's database is managed with `drizzle-kit push` plus hand-written
 * SQL files (see drizzle/0003_*.sql), so these files are applied explicitly
 * rather than through `drizzle-kit migrate`. Take a backup first:
 *   pg_dump "$DATABASE_URL" -Fc -f backup.dump
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/db/apply-sql.ts <path-to-sql>");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const sql = readFileSync(resolve(file), "utf8");
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  const client = new Client({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } });
  client.on("notice", (n) => console.log(`NOTICE: ${n.message}`));

  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log(`Applied ${file}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`Failed, nothing was changed: ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
