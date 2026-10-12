-- ════════════════════════════════════════════════════════════════════
-- Rollback for 0004_remove_waitlist
--
-- Restores the waitlist columns, the WAITLISTED enum value, and every
-- archived row exactly as it was before 0004. Seat counts were never changed
-- by 0004, so they need no repair.
--
-- Only needed if the previous (waitlist) code must be redeployed.
-- Run WITHOUT a wrapping transaction (Postgres cannot use a newly added enum
-- value in the transaction that added it):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/rollback/0004_remove_waitlist.down.sql
-- ════════════════════════════════════════════════════════════════════

ALTER TYPE registration_status ADD VALUE IF NOT EXISTS 'WAITLISTED' BEFORE 'CANCELLED';

ALTER TABLE registration_events ADD COLUMN IF NOT EXISTS enable_waitlist boolean DEFAULT false NOT NULL;
ALTER TABLE student_registrations ADD COLUMN IF NOT EXISTS is_waitlisted boolean DEFAULT false NOT NULL;
ALTER TABLE student_registrations ADD COLUMN IF NOT EXISTS waitlist_position integer;

-- Event flags
UPDATE registration_events e
SET enable_waitlist = (a.payload->>'enable_waitlist')::boolean
FROM legacy_waitlist_archive a
WHERE a.source_table = 'registration_events' AND a.source_id = e.id;

-- Choices: status and queue position as they were
UPDATE student_registrations sr
SET status = COALESCE(a.payload->>'status', 'WAITLISTED'),
    is_waitlisted = COALESCE((a.payload->>'is_waitlisted')::boolean, true),
    waitlist_position = (a.payload->>'waitlist_position')::integer,
    updated_at = COALESCE((a.payload->>'updated_at')::timestamp, now())
FROM legacy_waitlist_archive a
WHERE a.source_table = 'student_registrations' AND a.source_id = sr.id;

-- Parent registrations: status and receipt snapshot as they were
UPDATE registrations r
SET status = (a.payload->>'status')::registration_status,
    receipt_snapshot = a.payload->'receipt_snapshot',
    updated_at = COALESCE((a.payload->>'updated_at')::timestamp, now())
FROM legacy_waitlist_archive a
WHERE a.source_table = 'registrations' AND a.source_id = r.id;

-- The archive is kept; drop it manually once the rollback is verified:
-- DROP TABLE legacy_waitlist_archive;
