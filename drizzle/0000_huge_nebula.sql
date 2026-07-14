CREATE TABLE "academic_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" text NOT NULL,
	"programme_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "academic_batches_year_programme_unique" UNIQUE("year","programme_id")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"user_id" uuid,
	"user_email" text,
	"user_role" text,
	"ip_address" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"faculty_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "elective_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_choices" integer DEFAULT 1 NOT NULL,
	"max_choices" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "electives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"course_code" text,
	"name" text NOT NULL,
	"credits" integer DEFAULT 3 NOT NULL,
	"description" text,
	"max_seats" integer NOT NULL,
	"available_seats" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_full" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	CONSTRAINT "event_sections_unique" UNIQUE("event_id","section_id")
);
--> statement-breakpoint
CREATE TABLE "event_students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "event_students_unique" UNIQUE("event_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "event_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"programme_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faculties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "faculties_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invite_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"role" text NOT NULL,
	"faculty_id" uuid,
	"department_id" uuid,
	"programme_id" uuid,
	"academic_batch_id" uuid,
	"section_id" uuid,
	"created_by_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"used_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invite_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"ip" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lockout_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempts_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "programmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"degree_type" text,
	"department_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "programmes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "registration_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"academic_year" text,
	"academic_batch_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"open_date" timestamp,
	"close_date" timestamp,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"academic_batch_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sections_label_batch_unique" UNIQUE("label","academic_batch_id")
);
--> statement-breakpoint
CREATE TABLE "student_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"elective_id" uuid NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_registrations_unique" UNIQUE("student_id","event_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY DEFAULT 'system' NOT NULL,
	"maintenance_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_electives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"course_code" text,
	"name" text NOT NULL,
	"credits" integer DEFAULT 3 NOT NULL,
	"description" text,
	"default_max_seats" integer DEFAULT 40 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_choices" integer DEFAULT 1 NOT NULL,
	"max_choices" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"employee_id" text,
	"register_number" text,
	"phone" text,
	"faculty_id" uuid,
	"department_id" uuid,
	"programme_id" uuid,
	"academic_batch_id" uuid,
	"section_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_eligible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_employee_id_unique" UNIQUE("employee_id"),
	CONSTRAINT "users_register_number_unique" UNIQUE("register_number")
);
--> statement-breakpoint
ALTER TABLE "academic_batches" ADD CONSTRAINT "academic_batches_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elective_groups" ADD CONSTRAINT "elective_groups_event_id_registration_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."registration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "electives" ADD CONSTRAINT "electives_group_id_elective_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."elective_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sections" ADD CONSTRAINT "event_sections_event_id_registration_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."registration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_sections" ADD CONSTRAINT "event_sections_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_students" ADD CONSTRAINT "event_students_event_id_registration_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."registration_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_students" ADD CONSTRAINT "event_students_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_templates" ADD CONSTRAINT "event_templates_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_academic_batch_id_academic_batches_id_fk" FOREIGN KEY ("academic_batch_id") REFERENCES "public"."academic_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_codes" ADD CONSTRAINT "invite_codes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programmes" ADD CONSTRAINT "programmes_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_academic_batch_id_academic_batches_id_fk" FOREIGN KEY ("academic_batch_id") REFERENCES "public"."academic_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_academic_batch_id_academic_batches_id_fk" FOREIGN KEY ("academic_batch_id") REFERENCES "public"."academic_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD CONSTRAINT "student_registrations_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD CONSTRAINT "student_registrations_event_id_registration_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."registration_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD CONSTRAINT "student_registrations_group_id_elective_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."elective_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD CONSTRAINT "student_registrations_elective_id_electives_id_fk" FOREIGN KEY ("elective_id") REFERENCES "public"."electives"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_electives" ADD CONSTRAINT "template_electives_group_id_template_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."template_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_groups" ADD CONSTRAINT "template_groups_template_id_event_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."event_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_academic_batch_id_academic_batches_id_fk" FOREIGN KEY ("academic_batch_id") REFERENCES "public"."academic_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;