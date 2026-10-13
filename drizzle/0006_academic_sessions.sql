-- ════════════════════════════════════════════════════════════════════
-- 0006_academic_sessions
--
-- Separates three academic concepts that were previously blurred:
--
--   A. Academic session   academic_sessions (e.g. 2026–2027): the year the
--                         institution is operating. New table.
--   B. Admission cohort   academic_batches (programme + admission year) and
--                         its sections (the class, e.g. MCA F). Gains
--                         explicit admission_year / expected_end_year.
--                         The legacy text column `year` is kept untouched.
--   C. Study stage        cohort_session_terms: which cohorts study in which
--                         session, and their study year / semester there.
--
-- Registration events gain academic_session_id and semester, and event
-- targeting (event_sections) becomes structurally consistent: a targeted
-- section must belong to the event's own cohort (composite foreign keys).
--
-- Data handling (nothing is dropped or renamed):
--   * admission_year is copied from `year` only when it is a 4-digit year.
--   * expected_end_year is derived from the programme's stored duration and
--     marked dates_confirmed = false until an administrator confirms it.
--   * Sessions are created only from event academic_year values of the exact
--     form YYYY-YYYY (consecutive years). Other events keep a NULL session
--     and are listed for reconciliation in the app.
--   * Cohort/session terms are created only for cohorts that have an event in
--     that session, with confirmed = false.
--   * event_sections rows that target a section of a different cohort than
--     their event are copied to academic_reconciliation_archive and removed.
--     (Students of such sections could never reach those events anyway.)
--   * Constraints that existing rows would violate are added NOT VALID, so
--     new writes are checked; they are validated when the data is clean.
--   * Existence checks are per table (conrelid), so the file also applies
--     correctly to a schema other than public (used by the migration test).
--
-- Idempotent. Apply with: npm run db:migrate:academic-sessions
-- Rollback: drizzle/rollback/0006_academic_sessions.down.sql
-- ════════════════════════════════════════════════════════════════════

-- 1. Academic sessions ------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_year integer NOT NULL,
  end_year integer NOT NULL,
  status text DEFAULT 'ACTIVE' NOT NULL,
  starts_on date,
  ends_on date,
  created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT academic_sessions_years_unique UNIQUE (start_year, end_year),
  CONSTRAINT academic_sessions_years_check CHECK (end_year = start_year + 1 AND start_year BETWEEN 2000 AND 2100),
  CONSTRAINT academic_sessions_status_check CHECK (status IN ('PLANNED', 'ACTIVE', 'ARCHIVED')),
  CONSTRAINT academic_sessions_dates_check CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on > starts_on)
);

-- 2. Admission cohort dates ------------------------------------------
ALTER TABLE academic_batches ADD COLUMN IF NOT EXISTS admission_year integer;
ALTER TABLE academic_batches ADD COLUMN IF NOT EXISTS expected_end_year integer;
ALTER TABLE academic_batches ADD COLUMN IF NOT EXISTS dates_confirmed boolean DEFAULT false NOT NULL;

UPDATE academic_batches
SET admission_year = year::integer
WHERE admission_year IS NULL AND btrim(year) ~ '^\d{4}$';

UPDATE academic_batches b
SET expected_end_year = b.admission_year + p.duration_years
FROM programmes p
WHERE p.id = b.programme_id
  AND b.expected_end_year IS NULL
  AND b.admission_year IS NOT NULL
  AND p.duration_years BETWEEN 1 AND 6;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'academic_batches_cohort_years_check' AND conrelid = 'academic_batches'::regclass) THEN
    ALTER TABLE academic_batches ADD CONSTRAINT academic_batches_cohort_years_check
      CHECK (expected_end_year IS NULL OR admission_year IS NULL OR (expected_end_year > admission_year AND expected_end_year - admission_year <= 6));
  END IF;
END $$;

-- 3. Cohort membership and stage per session -------------------------
CREATE TABLE IF NOT EXISTS cohort_session_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_batch_id uuid NOT NULL REFERENCES academic_batches(id) ON DELETE CASCADE,
  academic_session_id uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
  study_year integer,
  current_semester integer,
  confirmed boolean DEFAULT false NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT cohort_session_terms_unique UNIQUE (academic_batch_id, academic_session_id),
  CONSTRAINT cohort_session_terms_year_check CHECK (study_year IS NULL OR study_year BETWEEN 1 AND 6),
  CONSTRAINT cohort_session_terms_semester_check CHECK (current_semester IS NULL OR current_semester BETWEEN 1 AND 12)
);
CREATE INDEX IF NOT EXISTS cohortSessionTerms_session_idx ON cohort_session_terms (academic_session_id);

-- 4. Events belong to a session (and optionally a semester) -----------
ALTER TABLE registration_events ADD COLUMN IF NOT EXISTS academic_session_id uuid REFERENCES academic_sessions(id) ON DELETE RESTRICT;
ALTER TABLE registration_events ADD COLUMN IF NOT EXISTS semester integer;
CREATE INDEX IF NOT EXISTS registrationEvents_session_idx ON registration_events (academic_session_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registration_events_semester_check' AND conrelid = 'registration_events'::regclass) THEN
    ALTER TABLE registration_events ADD CONSTRAINT registration_events_semester_check CHECK (semester IS NULL OR semester BETWEEN 1 AND 12);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'registration_events_id_batch_unique' AND conrelid = 'registration_events'::regclass) THEN
    ALTER TABLE registration_events ADD CONSTRAINT registration_events_id_batch_unique UNIQUE (id, academic_batch_id);
  END IF;
END $$;

-- Sessions only from unambiguous "YYYY-YYYY" event labels
INSERT INTO academic_sessions (start_year, end_year, status)
SELECT DISTINCT m[1]::integer, m[2]::integer, 'ACTIVE'
FROM registration_events e
CROSS JOIN LATERAL regexp_match(btrim(coalesce(e.academic_year, '')), '^(\d{4})\s*[-–/]\s*(\d{4})$') AS m
WHERE m IS NOT NULL AND m[2]::integer = m[1]::integer + 1 AND m[1]::integer BETWEEN 2000 AND 2100
ON CONFLICT (start_year, end_year) DO NOTHING;

UPDATE registration_events e
SET academic_session_id = s.id
FROM academic_sessions s
WHERE e.academic_session_id IS NULL
  AND s.start_year = ((regexp_match(btrim(coalesce(e.academic_year, '')), '^(\d{4})\s*[-–/]\s*(\d{4})$'))[1])::integer
  AND s.end_year = ((regexp_match(btrim(coalesce(e.academic_year, '')), '^(\d{4})\s*[-–/]\s*(\d{4})$'))[2])::integer;

-- Cohorts with an event in a session are members of it (unconfirmed)
INSERT INTO cohort_session_terms (academic_batch_id, academic_session_id, study_year, current_semester, confirmed)
SELECT DISTINCT ON (e.academic_batch_id, e.academic_session_id)
  e.academic_batch_id,
  e.academic_session_id,
  CASE WHEN b.admission_year IS NOT NULL AND s.start_year - b.admission_year + 1 BETWEEN 1 AND 6
       THEN s.start_year - b.admission_year + 1 END,
  NULL,
  false
FROM registration_events e
JOIN academic_batches b ON b.id = e.academic_batch_id
JOIN academic_sessions s ON s.id = e.academic_session_id
WHERE e.academic_session_id IS NOT NULL
ORDER BY e.academic_batch_id, e.academic_session_id
ON CONFLICT (academic_batch_id, academic_session_id) DO NOTHING;

-- 5. Event targeting must stay inside the event's cohort ---------------
CREATE TABLE IF NOT EXISTS academic_reconciliation_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  reason text NOT NULL,
  payload jsonb NOT NULL,
  archived_at timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sections_id_batch_unique' AND conrelid = 'sections'::regclass) THEN
    ALTER TABLE sections ADD CONSTRAINT sections_id_batch_unique UNIQUE (id, academic_batch_id);
  END IF;
END $$;

ALTER TABLE event_sections ADD COLUMN IF NOT EXISTS academic_batch_id uuid;

UPDATE event_sections es
SET academic_batch_id = s.academic_batch_id
FROM sections s
WHERE s.id = es.section_id AND es.academic_batch_id IS NULL;

INSERT INTO academic_reconciliation_archive (source_table, source_id, reason, payload)
SELECT 'event_sections', es.id, 'SECTION_OUTSIDE_EVENT_COHORT', to_jsonb(es)
FROM event_sections es
JOIN registration_events e ON e.id = es.event_id
WHERE es.academic_batch_id IS DISTINCT FROM e.academic_batch_id
  AND NOT EXISTS (SELECT 1 FROM academic_reconciliation_archive a WHERE a.source_table = 'event_sections' AND a.source_id = es.id);

DELETE FROM event_sections es
USING registration_events e
WHERE e.id = es.event_id AND es.academic_batch_id IS DISTINCT FROM e.academic_batch_id;

ALTER TABLE event_sections ALTER COLUMN academic_batch_id SET NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_sections_section_cohort_fk' AND conrelid = 'event_sections'::regclass) THEN
    ALTER TABLE event_sections ADD CONSTRAINT event_sections_section_cohort_fk
      FOREIGN KEY (section_id, academic_batch_id) REFERENCES sections (id, academic_batch_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'event_sections_event_cohort_fk' AND conrelid = 'event_sections'::regclass) THEN
    ALTER TABLE event_sections ADD CONSTRAINT event_sections_event_cohort_fk
      FOREIGN KEY (event_id, academic_batch_id) REFERENCES registration_events (id, academic_batch_id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. A student's section must belong to their cohort; class codes name one class
DO $$
DECLARE bad integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_section_cohort_fk' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_section_cohort_fk
      FOREIGN KEY (section_id, academic_batch_id) REFERENCES sections (id, academic_batch_id) NOT VALID;
  END IF;
  SELECT count(*) INTO bad FROM users u JOIN sections s ON s.id = u.section_id
  WHERE u.academic_batch_id IS NOT NULL AND s.academic_batch_id <> u.academic_batch_id;
  IF bad = 0 THEN
    ALTER TABLE users VALIDATE CONSTRAINT users_section_cohort_fk;
  ELSE
    RAISE NOTICE 'users_section_cohort_fk left NOT VALID: % user(s) have a section outside their cohort', bad;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invite_codes_student_section_check' AND conrelid = 'invite_codes'::regclass) THEN
    ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_student_section_check
      CHECK (role <> 'STUDENT' OR section_id IS NOT NULL) NOT VALID;
  END IF;
  SELECT count(*) INTO bad FROM invite_codes WHERE role = 'STUDENT' AND section_id IS NULL;
  IF bad = 0 THEN
    ALTER TABLE invite_codes VALIDATE CONSTRAINT invite_codes_student_section_check;
  ELSE
    RAISE NOTICE 'invite_codes_student_section_check left NOT VALID: % student code(s) have no class', bad;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invite_codes_section_cohort_fk' AND conrelid = 'invite_codes'::regclass) THEN
    ALTER TABLE invite_codes ADD CONSTRAINT invite_codes_section_cohort_fk
      FOREIGN KEY (section_id, academic_batch_id) REFERENCES sections (id, academic_batch_id) NOT VALID;
  END IF;
  SELECT count(*) INTO bad FROM invite_codes c JOIN sections s ON s.id = c.section_id
  WHERE c.academic_batch_id IS NOT NULL AND s.academic_batch_id <> c.academic_batch_id;
  IF bad = 0 THEN
    ALTER TABLE invite_codes VALIDATE CONSTRAINT invite_codes_section_cohort_fk;
  ELSE
    RAISE NOTICE 'invite_codes_section_cohort_fk left NOT VALID: % code(s) name a class outside their cohort', bad;
  END IF;
END $$;
