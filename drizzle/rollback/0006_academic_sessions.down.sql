-- ════════════════════════════════════════════════════════════════════
-- Rollback for 0006_academic_sessions
--
-- Removes the academic-session structures and restores event_sections rows
-- that 0006 archived. Registrations, receipts, events, students and seat
-- counts are not touched by 0006 and need no repair.
--
-- WARNING: academic sessions, cohort dates and cohort/session terms entered
-- after 0006 are deleted. Export them first if they are needed:
--   \copy academic_sessions TO 'academic_sessions.csv' CSV HEADER
--   \copy cohort_session_terms TO 'cohort_session_terms.csv' CSV HEADER
--
-- Deploy the previous application version before (or together with) this
-- rollback; the new code expects these columns.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 -f drizzle/rollback/0006_academic_sessions.down.sql
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS invite_codes_section_cohort_fk;
ALTER TABLE invite_codes DROP CONSTRAINT IF EXISTS invite_codes_student_section_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_section_cohort_fk;

ALTER TABLE event_sections DROP CONSTRAINT IF EXISTS event_sections_event_cohort_fk;
ALTER TABLE event_sections DROP CONSTRAINT IF EXISTS event_sections_section_cohort_fk;

ALTER TABLE event_sections DROP COLUMN IF EXISTS academic_batch_id;

-- Restore archived targeting rows (they referenced valid events and sections)
INSERT INTO event_sections (id, event_id, section_id)
SELECT (a.payload->>'id')::uuid, (a.payload->>'event_id')::uuid, (a.payload->>'section_id')::uuid
FROM academic_reconciliation_archive a
WHERE a.source_table = 'event_sections'
  AND EXISTS (SELECT 1 FROM registration_events e WHERE e.id = (a.payload->>'event_id')::uuid)
  AND EXISTS (SELECT 1 FROM sections s WHERE s.id = (a.payload->>'section_id')::uuid)
ON CONFLICT DO NOTHING;

ALTER TABLE sections DROP CONSTRAINT IF EXISTS sections_id_batch_unique;

ALTER TABLE registration_events DROP CONSTRAINT IF EXISTS registration_events_id_batch_unique;
ALTER TABLE registration_events DROP CONSTRAINT IF EXISTS registration_events_semester_check;
DROP INDEX IF EXISTS registrationEvents_session_idx;
ALTER TABLE registration_events DROP COLUMN IF EXISTS semester;
ALTER TABLE registration_events DROP COLUMN IF EXISTS academic_session_id;

DROP TABLE IF EXISTS cohort_session_terms;

ALTER TABLE academic_batches DROP CONSTRAINT IF EXISTS academic_batches_cohort_years_check;
ALTER TABLE academic_batches DROP COLUMN IF EXISTS dates_confirmed;
ALTER TABLE academic_batches DROP COLUMN IF EXISTS expected_end_year;
ALTER TABLE academic_batches DROP COLUMN IF EXISTS admission_year;

DROP TABLE IF EXISTS academic_sessions;

-- The archive is kept for reference; drop it manually once the rollback is verified:
-- DROP TABLE academic_reconciliation_archive;
