-- ════════════════════════════════════════════════════════════════════
-- 0004_remove_waitlist
--
-- Retires the waitlist feature without losing history.
--
--   1. Archives every row this migration changes or whose columns it drops
--      into legacy_waitlist_archive (full row as JSON).
--   2. Legacy waitlisted choices never held a seat, so they become CANCELLED
--      choices. No seat counts change.
--   3. Receipt snapshots that listed a waitlisted choice mark it
--      "[Cancelled]" (the original snapshot is in the archive).
--   4. Parent registrations that were WAITLISTED become CONFIRMED when they
--      still hold at least one confirmed choice, otherwise CANCELLED. This is
--      the same outcome as the existing "cancel one elective" flow.
--   5. Drops student_registrations.is_waitlisted / waitlist_position and
--      registration_events.enable_waitlist, and removes WAITLISTED from the
--      registration_status enum.
--
-- Not touched: replay_events and audit_logs (historical log rows, including
-- STUDENT_WAITLISTED / WAITLIST_PROMOTED entries), confirmed registrations,
-- receipts without waitlisted entries, seat counts.
--
-- Idempotent: every step checks current state, so it is safe to re-run.
-- Uses unqualified names so it applies to the schema on the search_path.
-- Run it in one transaction:  npm run db:migrate:remove-waitlist
-- Rollback: drizzle/rollback/0004_remove_waitlist.down.sql
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS legacy_waitlist_archive (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table text NOT NULL,
  source_id uuid NOT NULL,
  payload jsonb NOT NULL,
  archived_at timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS legacy_waitlist_archive_source_idx ON legacy_waitlist_archive (source_table, source_id);

DO $$
DECLARE
  sr_has_flag boolean;
  sr_has_status boolean;
  ev_has_flag boolean;
  waitlisted_pred text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'student_registrations' AND column_name = 'is_waitlisted')
    INTO sr_has_flag;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'student_registrations' AND column_name = 'status')
    INTO sr_has_status;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'registration_events' AND column_name = 'enable_waitlist')
    INTO ev_has_flag;

  -- Which choices count as waitlisted, for whatever columns this database has.
  waitlisted_pred := CASE
    WHEN sr_has_flag AND sr_has_status THEN '(sr.is_waitlisted = true OR sr.status = ''WAITLISTED'')'
    WHEN sr_has_flag THEN 'sr.is_waitlisted = true'
    WHEN sr_has_status THEN 'sr.status = ''WAITLISTED'''
    ELSE 'false'
  END;

  -- 1a. Archive waitlisted choices
  EXECUTE format(
    'INSERT INTO legacy_waitlist_archive (source_table, source_id, payload)
     SELECT ''student_registrations'', sr.id, to_jsonb(sr) FROM student_registrations sr
     WHERE %s AND NOT EXISTS (
       SELECT 1 FROM legacy_waitlist_archive a WHERE a.source_table = ''student_registrations'' AND a.source_id = sr.id)',
    waitlisted_pred);

  -- 1b. Archive parent registrations that were waitlisted or whose receipt lists a waitlisted choice
  INSERT INTO legacy_waitlist_archive (source_table, source_id, payload)
  SELECT 'registrations', r.id, to_jsonb(r) FROM registrations r
  WHERE (r.status::text = 'WAITLISTED'
         OR r.receipt_snapshot->>'isWaitlisted' = 'true'
         OR (jsonb_typeof(r.receipt_snapshot->'electives') = 'array' AND EXISTS (
               SELECT 1 FROM jsonb_array_elements(r.receipt_snapshot->'electives') e
               WHERE e->>'isWaitlisted' = 'true' OR e->>'status' = 'WAITLISTED')))
    AND NOT EXISTS (SELECT 1 FROM legacy_waitlist_archive a WHERE a.source_table = 'registrations' AND a.source_id = r.id);

  -- 1c. Archive which events had the waitlist switched on
  IF ev_has_flag THEN
    EXECUTE
      'INSERT INTO legacy_waitlist_archive (source_table, source_id, payload)
       SELECT ''registration_events'', e.id, jsonb_build_object(''enable_waitlist'', e.enable_waitlist, ''name'', e.name)
       FROM registration_events e
       WHERE e.enable_waitlist = true AND NOT EXISTS (
         SELECT 1 FROM legacy_waitlist_archive a WHERE a.source_table = ''registration_events'' AND a.source_id = e.id)';
  END IF;

  -- 2. Waitlisted choices held no seat: mark them cancelled (seat counts unchanged)
  IF sr_has_status THEN
    EXECUTE format('UPDATE student_registrations sr SET status = ''CANCELLED'', updated_at = now() WHERE %s', waitlisted_pred);
  END IF;

  -- 3. Receipt snapshots: waitlisted entries become cancelled entries
  UPDATE registrations r
  SET receipt_snapshot = (r.receipt_snapshot - 'isWaitlisted') || jsonb_build_object('electives', (
        SELECT COALESCE(jsonb_agg(
          CASE WHEN e->>'isWaitlisted' = 'true' OR e->>'status' = 'WAITLISTED' THEN
            (e - 'isWaitlisted' - 'waitlistPosition') || jsonb_build_object(
              'status', 'CANCELLED',
              'electiveName', btrim(regexp_replace(COALESCE(e->>'electiveName', 'Elective'), '\s*\[Waitlisted #?[0-9]*\]', '', 'g')) || ' [Cancelled]')
          ELSE e - 'isWaitlisted' - 'waitlistPosition'
          END ORDER BY t.ord), '[]'::jsonb)
        FROM jsonb_array_elements(r.receipt_snapshot->'electives') WITH ORDINALITY AS t(e, ord))),
      updated_at = now()
  WHERE jsonb_typeof(r.receipt_snapshot->'electives') = 'array'
    AND (r.receipt_snapshot->>'isWaitlisted' = 'true'
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(r.receipt_snapshot->'electives') e
                    WHERE e->>'isWaitlisted' = 'true' OR e->>'status' = 'WAITLISTED'));

  -- 4. Parent status: confirmed if any confirmed choice remains, otherwise cancelled
  IF sr_has_status THEN
    UPDATE registrations r
    SET status = (CASE WHEN EXISTS (
                    SELECT 1 FROM student_registrations sr
                    WHERE sr.student_id = r.student_id AND sr.event_id = r.event_id AND sr.status = 'CONFIRMED')
                  THEN 'CONFIRMED' ELSE 'CANCELLED' END)::text::registration_status,
        updated_at = now()
    WHERE r.status::text = 'WAITLISTED';
  ELSE
    UPDATE registrations r SET status = 'CANCELLED', updated_at = now() WHERE r.status::text = 'WAITLISTED';
  END IF;

  -- 5a. Drop the waitlist columns
  ALTER TABLE student_registrations DROP COLUMN IF EXISTS is_waitlisted;
  ALTER TABLE student_registrations DROP COLUMN IF EXISTS waitlist_position;
  ALTER TABLE registration_events DROP COLUMN IF EXISTS enable_waitlist;

  -- 5b. Remove WAITLISTED from the enum (no row uses it after step 4)
  IF EXISTS (
    SELECT 1 FROM pg_enum en
    JOIN pg_type ty ON ty.oid = en.enumtypid
    JOIN pg_namespace ns ON ns.oid = ty.typnamespace
    WHERE ty.typname = 'registration_status' AND ns.nspname = current_schema() AND en.enumlabel = 'WAITLISTED'
  ) THEN
    ALTER TYPE registration_status RENAME TO registration_status_pre_0004;
    CREATE TYPE registration_status AS ENUM ('NOT_REGISTERED', 'CONFIRMED', 'CANCELLED', 'RESET_BY_COORDINATOR');
    ALTER TABLE registrations ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE registrations ALTER COLUMN status TYPE registration_status USING status::text::registration_status;
    ALTER TABLE registrations ALTER COLUMN status SET DEFAULT 'NOT_REGISTERED';
    DROP TYPE registration_status_pre_0004;
  END IF;
END $$;
