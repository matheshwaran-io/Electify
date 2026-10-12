ALTER TABLE "student_registrations" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'CONFIRMED' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "studentRegistrations_status_idx" ON "student_registrations" USING btree ("status");
