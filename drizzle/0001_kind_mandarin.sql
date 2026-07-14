CREATE TYPE "public"."registration_status" AS ENUM('NOT_REGISTERED', 'CONFIRMED', 'CANCELLED', 'RESET_BY_COORDINATOR');--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"status" "registration_status" DEFAULT 'NOT_REGISTERED' NOT NULL,
	"receipt_number" text,
	"receipt_snapshot" jsonb,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "registrations_receipt_number_unique" UNIQUE("receipt_number"),
	CONSTRAINT "student_event_registration_unique" UNIQUE("student_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "replay_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_event_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"student_id" uuid,
	"student_name" text,
	"event_type" text NOT NULL,
	"subject_id" uuid,
	"subject_name" text,
	"old_subject" text,
	"new_subject" text,
	"seat_before" integer,
	"seat_after" integer,
	"performed_by" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tutor_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	CONSTRAINT "tutor_sections_unique" UNIQUE("tutor_id","section_id")
);
--> statement-breakpoint
ALTER TABLE "programmes" ADD COLUMN "duration_years" integer DEFAULT 4;--> statement-breakpoint
ALTER TABLE "programmes" ADD COLUMN "semesters" integer DEFAULT 8;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD COLUMN "is_locked" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_registration_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."registration_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_events" ADD CONSTRAINT "replay_events_registration_event_id_registration_events_id_fk" FOREIGN KEY ("registration_event_id") REFERENCES "public"."registration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_events" ADD CONSTRAINT "replay_events_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_events" ADD CONSTRAINT "replay_events_subject_id_electives_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."electives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "replay_events" ADD CONSTRAINT "replay_events_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sections" ADD CONSTRAINT "tutor_sections_tutor_id_users_id_fk" FOREIGN KEY ("tutor_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_sections" ADD CONSTRAINT "tutor_sections_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registrations_student_idx" ON "registrations" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "registrations_event_idx" ON "registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "replayEvents_event_idx" ON "replay_events" USING btree ("registration_event_id");--> statement-breakpoint
CREATE INDEX "replayEvents_timestamp_idx" ON "replay_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "tutorSections_tutor_idx" ON "tutor_sections" USING btree ("tutor_id");--> statement-breakpoint
CREATE INDEX "tutorSections_section_idx" ON "tutor_sections" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "departments_faculty_idx" ON "departments" USING btree ("faculty_id");--> statement-breakpoint
CREATE INDEX "electiveGroups_event_idx" ON "elective_groups" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "electives_group_idx" ON "electives" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "eventSections_event_idx" ON "event_sections" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "eventSections_section_idx" ON "event_sections" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "eventStudents_event_idx" ON "event_students" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "eventStudents_student_idx" ON "event_students" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "eventTemplates_prog_idx" ON "event_templates" USING btree ("programme_id");--> statement-breakpoint
CREATE INDEX "eventTemplates_created_idx" ON "event_templates" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "inviteCodes_faculty_idx" ON "invite_codes" USING btree ("faculty_id");--> statement-breakpoint
CREATE INDEX "inviteCodes_dept_idx" ON "invite_codes" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "inviteCodes_prog_idx" ON "invite_codes" USING btree ("programme_id");--> statement-breakpoint
CREATE INDEX "inviteCodes_batch_idx" ON "invite_codes" USING btree ("academic_batch_id");--> statement-breakpoint
CREATE INDEX "inviteCodes_section_idx" ON "invite_codes" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "inviteCodes_created_idx" ON "invite_codes" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "programmes_dept_idx" ON "programmes" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "registrationEvents_batch_idx" ON "registration_events" USING btree ("academic_batch_id");--> statement-breakpoint
CREATE INDEX "registrationEvents_created_idx" ON "registration_events" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "registrationEvents_status_idx" ON "registration_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "studentRegistrations_student_idx" ON "student_registrations" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "studentRegistrations_event_idx" ON "student_registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "studentRegistrations_group_idx" ON "student_registrations" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "studentRegistrations_elective_idx" ON "student_registrations" USING btree ("elective_id");--> statement-breakpoint
CREATE INDEX "templateElectives_group_idx" ON "template_electives" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "templateGroups_template_idx" ON "template_groups" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_faculty_idx" ON "users" USING btree ("faculty_id");--> statement-breakpoint
CREATE INDEX "users_dept_idx" ON "users" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "users_prog_idx" ON "users" USING btree ("programme_id");--> statement-breakpoint
CREATE INDEX "users_batch_idx" ON "users" USING btree ("academic_batch_id");--> statement-breakpoint
CREATE INDEX "users_section_idx" ON "users" USING btree ("section_id");