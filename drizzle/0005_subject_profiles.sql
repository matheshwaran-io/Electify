-- ════════════════════════════════════════════════════════════════════
-- 0005_subject_profiles
--
-- Additive only.
--   1. subject_profiles: student-facing subject information for the subject
--      explorer (description, syllabus, outcomes, prerequisites, difficulty,
--      careers, resources), with per-section provenance in `content`.
--      The same table is also created by the login-time self-heal in
--      src/lib/db/index.ts, so this file is safe to run either way.
--   2. Non-negative seat checks on electives and section allocations, as a
--      database-level backstop against overbooking. Added NOT VALID (enforced
--      for every new write) and then validated; if old rows violate them the
--      validation is skipped with a notice instead of failing the migration.
--
-- Idempotent. Rollback: drizzle/rollback/0005_subject_profiles.down.sql
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subject_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  course_code text,
  aliases jsonb DEFAULT '[]'::jsonb NOT NULL,
  programme_id uuid REFERENCES programmes(id) ON DELETE SET NULL,
  summary text,
  content jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'DRAFT' NOT NULL,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "subjectProfiles_status_idx" ON subject_profiles (status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'electives_available_seats_nonnegative') THEN
    ALTER TABLE electives ADD CONSTRAINT electives_available_seats_nonnegative CHECK (available_seats >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'allocations_available_seats_nonnegative') THEN
    ALTER TABLE elective_seat_allocations ADD CONSTRAINT allocations_available_seats_nonnegative CHECK (available_seats >= 0) NOT VALID;
  END IF;

  BEGIN
    ALTER TABLE electives VALIDATE CONSTRAINT electives_available_seats_nonnegative;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'electives has rows with negative available_seats; constraint left NOT VALID (still enforced on new writes).';
  END;
  BEGIN
    ALTER TABLE elective_seat_allocations VALIDATE CONSTRAINT allocations_available_seats_nonnegative;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'elective_seat_allocations has rows with negative available_seats; constraint left NOT VALID (still enforced on new writes).';
  END;
END $$;
