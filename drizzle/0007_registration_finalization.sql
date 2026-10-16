-- ════════════════════════════════════════════════════════════════════
-- 0007_registration_finalization
--
-- Adds is_finalized flag to registrations so that official receipt numbers,
-- printable receipts, and downloadable PDFs are only generated when a student
-- finishes and locks their registration (or when the window closes).
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE "registrations" ADD COLUMN IF NOT EXISTS "is_finalized" boolean DEFAULT false NOT NULL;
UPDATE "registrations" SET "is_finalized" = true WHERE "receipt_number" IS NOT NULL;
