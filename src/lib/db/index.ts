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

          -- Ensure student_registrations has waitlist and status columns
          IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_registrations') THEN
            ALTER TABLE "student_registrations" ADD COLUMN IF NOT EXISTS "is_waitlisted" boolean DEFAULT false NOT NULL;
            ALTER TABLE "student_registrations" ADD COLUMN IF NOT EXISTS "waitlist_position" integer;
            ALTER TABLE "student_registrations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'CONFIRMED' NOT NULL;
            CREATE INDEX IF NOT EXISTS "studentRegistrations_status_idx" ON "student_registrations" ("status");
          END IF;

          -- Ensure pin_reset_requests table exists for tutor-authorized student PIN reset flow
          CREATE TABLE IF NOT EXISTS "pin_reset_requests" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            "student_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
            "section_id" uuid REFERENCES "sections"("id") ON DELETE CASCADE,
            "tutor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
            "status" text DEFAULT 'PENDING' NOT NULL,
            "reset_token" text UNIQUE,
            "token_expires_at" timestamp,
            "authorized_at" timestamp,
            "completed_at" timestamp,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          );
          CREATE INDEX IF NOT EXISTS "pinResetRequests_student_idx" ON "pin_reset_requests" ("student_id");
          CREATE INDEX IF NOT EXISTS "pinResetRequests_section_idx" ON "pin_reset_requests" ("section_id");
          CREATE INDEX IF NOT EXISTS "pinResetRequests_status_idx" ON "pin_reset_requests" ("status");
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

