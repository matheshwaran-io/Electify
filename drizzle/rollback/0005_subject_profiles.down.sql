-- Rollback for 0005_subject_profiles. Removes the seat checks and the subject
-- profiles table (subject content is lost; export it first if it matters).
ALTER TABLE electives DROP CONSTRAINT IF EXISTS electives_available_seats_nonnegative;
ALTER TABLE elective_seat_allocations DROP CONSTRAINT IF EXISTS allocations_available_seats_nonnegative;
DROP TABLE IF EXISTS subject_profiles;
