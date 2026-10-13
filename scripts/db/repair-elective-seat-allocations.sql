-- One-off repair for databases where migration 0002 was only partly applied
-- and elective_seat_allocations is missing (found on the hosted Supabase dev
-- database on 2026-10-13). Creates the table exactly as 0002 + 0005 define it.
-- Additive and idempotent; does nothing if the table already exists.
--   npx tsx --env-file=.env.local scripts/db/apply-sql.ts scripts/db/repair-elective-seat-allocations.sql
DO $$
BEGIN
  IF to_regclass('elective_seat_allocations') IS NOT NULL THEN
    RAISE NOTICE 'elective_seat_allocations already exists; nothing to do';
    RETURN;
  END IF;

  CREATE TABLE elective_seat_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    elective_id uuid NOT NULL CONSTRAINT elective_seat_allocations_elective_id_electives_id_fk REFERENCES electives(id) ON DELETE CASCADE,
    department_id uuid NOT NULL CONSTRAINT elective_seat_allocations_department_id_departments_id_fk REFERENCES departments(id) ON DELETE CASCADE,
    section_id uuid CONSTRAINT elective_seat_allocations_section_id_sections_id_fk REFERENCES sections(id) ON DELETE CASCADE,
    max_seats integer NOT NULL,
    available_seats integer NOT NULL,
    is_full boolean DEFAULT false NOT NULL,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL,
    CONSTRAINT elective_section_allocation_unique UNIQUE (elective_id, section_id),
    CONSTRAINT allocations_available_seats_nonnegative CHECK (available_seats >= 0)
  );
  CREATE INDEX allocations_elective_idx ON elective_seat_allocations (elective_id);
  CREATE INDEX allocations_dept_idx ON elective_seat_allocations (department_id);
  CREATE INDEX allocations_section_idx ON elective_seat_allocations (section_id);
END $$;
