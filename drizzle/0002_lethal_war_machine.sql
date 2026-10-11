ALTER TYPE "public"."registration_status" ADD VALUE 'WAITLISTED' BEFORE 'CANCELLED';--> statement-breakpoint
CREATE TABLE "elective_seat_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"elective_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"section_id" uuid,
	"max_seats" integer NOT NULL,
	"available_seats" integer NOT NULL,
	"is_full" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "elective_section_allocation_unique" UNIQUE("elective_id","section_id")
);
--> statement-breakpoint
ALTER TABLE "registration_events" ADD COLUMN "allow_editing" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_events" ADD COLUMN "auto_close" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "registration_events" ADD COLUMN "enable_waitlist" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD COLUMN "is_waitlisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "student_registrations" ADD COLUMN "waitlist_position" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_session_id" text;--> statement-breakpoint
ALTER TABLE "elective_seat_allocations" ADD CONSTRAINT "elective_seat_allocations_elective_id_electives_id_fk" FOREIGN KEY ("elective_id") REFERENCES "public"."electives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elective_seat_allocations" ADD CONSTRAINT "elective_seat_allocations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elective_seat_allocations" ADD CONSTRAINT "elective_seat_allocations_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_elective_idx" ON "elective_seat_allocations" USING btree ("elective_id");--> statement-breakpoint
CREATE INDEX "allocations_dept_idx" ON "elective_seat_allocations" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "allocations_section_idx" ON "elective_seat_allocations" USING btree ("section_id");