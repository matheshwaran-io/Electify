import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, PoolConfig } from "pg";
import dns from "node:dns";
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
    // Scripts and test processes may exit once every client is idle instead of
    // waiting out the idle timeout. A running server is kept alive by its HTTP
    // listener, so this does not close connections in the app.
    allowExitOnIdle: true,
  };

  // Cloud PostgreSQL (Supabase, Neon, RDS) requires SSL and IPv6-compatible DNS resolution
  if (!isLocal) {
    poolConfig.ssl = { rejectUnauthorized: false };
    poolConfig.lookup = (hostname, options, cb) => {
      dns.lookup(hostname, { all: true }, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
          cb(null, addresses[0].address, addresses[0].family);
          return;
        }
        dns.lookup(hostname, options, cb);
      });
    };
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
      // Every statement is guarded by a catalog check first: ALTER TABLE ... IF NOT
      // EXISTS still takes an ACCESS EXCLUSIVE lock even when there is nothing to
      // do, which can block or deadlock live registrations on a cold start.
      await pool.query(`
        DO $$
        BEGIN
          -- Ensure users table has current_session_id
          IF to_regclass('public.users') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'current_session_id'
          ) THEN
            ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "current_session_id" text;
          END IF;

          -- Ensure registration_events has new control columns
          IF to_regclass('public.registration_events') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'registration_events' AND column_name = 'allow_editing'
          ) THEN
            ALTER TABLE "registration_events" ADD COLUMN IF NOT EXISTS "allow_editing" boolean DEFAULT true NOT NULL;
          END IF;
          IF to_regclass('public.registration_events') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'registration_events' AND column_name = 'auto_close'
          ) THEN
            ALTER TABLE "registration_events" ADD COLUMN IF NOT EXISTS "auto_close" boolean DEFAULT true NOT NULL;
          END IF;

          -- Ensure student_registrations has its status column
          -- (waitlist columns are intentionally not created: see drizzle/0004_remove_waitlist.sql)
          IF to_regclass('public.student_registrations') IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'student_registrations' AND column_name = 'status'
          ) THEN
            ALTER TABLE "student_registrations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'CONFIRMED' NOT NULL;
          END IF;
          IF to_regclass('public.student_registrations') IS NOT NULL AND to_regclass('public."studentRegistrations_status_idx"') IS NULL THEN
            CREATE INDEX IF NOT EXISTS "studentRegistrations_status_idx" ON "student_registrations" ("status");
          END IF;

          -- Ensure pin_reset_requests table exists for the tutor-authorized student password reset flow
          IF to_regclass('public.pin_reset_requests') IS NULL THEN
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
          END IF;

          -- Subject profiles for the student subject explorer (additive; see drizzle/0005_subject_profiles.sql)
          IF to_regclass('public.subject_profiles') IS NULL THEN
            CREATE TABLE IF NOT EXISTS "subject_profiles" (
              "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
              "slug" text NOT NULL UNIQUE,
              "title" text NOT NULL,
              "course_code" text,
              "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
              "programme_id" uuid REFERENCES "programmes"("id") ON DELETE SET NULL,
              "summary" text,
              "content" jsonb DEFAULT '{}'::jsonb NOT NULL,
              "status" text DEFAULT 'DRAFT' NOT NULL,
              "created_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
              "updated_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
              "created_at" timestamp DEFAULT now() NOT NULL,
              "updated_at" timestamp DEFAULT now() NOT NULL
            );
            CREATE INDEX IF NOT EXISTS "subjectProfiles_status_idx" ON "subject_profiles" ("status");
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

