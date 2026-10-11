import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
  isDbReadyPromise: Promise<void> | undefined;
};

function getPool(): Pool {
  if (globalForDb.pool) {
    return globalForDb.pool;
  }

  const connectionString = process.env.DATABASE_URL;
  const isLocal =
    !connectionString ||
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

  const poolConfig: PoolConfig = {
    connectionString,
    max: process.env.NODE_ENV === "production" ? 10 : 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  };

  // Cloud PostgreSQL (Supabase, Neon, RDS) requires SSL
  if (!isLocal) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  const pool = new Pool(poolConfig);

  pool.on("error", (err) => {
    console.error("Unexpected error on idle PostgreSQL client:", err);
  });

  globalForDb.pool = pool;
  return pool;
}

export const pool = getPool();
export const db = drizzle(pool, { schema });
export default db;

/**
 * Idempotent schema auto-heal for production environments:
 * Ensures newly introduced columns exist even if migrations were not run manually.
 */
export async function ensureDatabaseReady(): Promise<void> {
  if (globalForDb.isDbReadyPromise) {
    return globalForDb.isDbReadyPromise;
  }

  globalForDb.isDbReadyPromise = (async () => {
    try {
      await pool.query(`
        DO $$
        BEGIN
          -- Ensure users table has current_session_id
          IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_session_id" text;
          END IF;

          -- Ensure registration_events has new control columns
          IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'registration_events') THEN
            ALTER TABLE "registration_events" ADD COLUMN IF NOT EXISTS "allow_editing" boolean DEFAULT true NOT NULL;
            ALTER TABLE "registration_events" ADD COLUMN IF NOT EXISTS "auto_close" boolean DEFAULT true NOT NULL;
            ALTER TABLE "registration_events" ADD COLUMN IF NOT EXISTS "enable_waitlist" boolean DEFAULT false NOT NULL;
          END IF;

          -- Ensure student_registrations has waitlist columns
          IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_registrations') THEN
            ALTER TABLE "student_registrations" ADD COLUMN IF NOT EXISTS "is_waitlisted" boolean DEFAULT false NOT NULL;
            ALTER TABLE "student_registrations" ADD COLUMN IF NOT EXISTS "waitlist_position" integer;
          END IF;
        END $$;
      `);
    } catch (err) {
      console.warn("[DB Auto-Heal] Non-fatal migration check warning:", err);
    }
  })();

  return globalForDb.isDbReadyPromise;
}

// Re-export schema for convenience
export * from "./schema";

