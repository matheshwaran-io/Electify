# Electify Database Reference & Migration Guide

## 1. Relational Schema Architecture

Electify uses **PostgreSQL** with schema definitions maintained using **Drizzle ORM** (`src/lib/db/schema.ts`).

### Core Tables Summary

| Table | Purpose | Key Constraints |
| ----- | ------- | --------------- |
| `academic_sessions` | Defines Year Servers (e.g. 2025, 2026) | `session_code` UNIQUE, `is_active` |
| `faculties` | University Colleges / Faculties (e.g., CET, FSH) | `code` UNIQUE |
| `departments` | Departments linked to faculties | Foreign key -> `faculties.id` |
| `programmes` | Academic Degrees (e.g., MCA, B.Tech) | Foreign key -> `departments.id` |
| `academic_batches` | Cohorts linked to programmes and year sessions | Foreign keys -> `programmes.id`, `academic_sessions.id` |
| `sections` | Student sections within a batch | Foreign key -> `academic_batches.id`, `(batch_id, name)` UNIQUE |
| `users` | Accounts for Students, Tutors, Coordinators, Admins | `email` UNIQUE, `register_number` UNIQUE |
| `tutor_sections` | Multi-section mapping for Class Tutors | Composite PK `(tutor_id, section_id)` |
| `invite_codes` | Onboarding tokens for Staff roles | `code` UNIQUE, expiration, max uses |
| `registration_events` | Registration time windows and status | Foreign key -> `academic_batches.id` |
| `elective_groups` | Groups within an event (e.g., PE, OE) | Foreign key -> `registration_events.id` |
| `electives` | Specific course offerings and capacities | Foreign key -> `elective_groups.id`, `available_seats >= 0` CHECK |
| `subject_profiles` | Canonical master catalog of courses | `subject_code` UNIQUE |
| `registrations` | Student registration header & receipt | Foreign key -> `users.id`, `registration_events.id`, UNIQUE `(user_id, event_id)` |
| `student_registrations` | Line items linking student to chosen electives | Foreign key -> `registrations.id`, `electives.id` |
| `replay_events` | Granular audit trail of seat allocations | Timestamped log for playback |
| `audit_logs` | Administrative mutation trail | Timestamped actor and action log |
| `login_attempts` | Brute force detection and lockout tracking | Keyed by identifier and IP |
| `system_settings` | System-wide toggles (maintenance mode, etc.) | Key-value settings table |

---

## 2. Migration Workflow

Migrations are generated and tracked in the `drizzle/` directory using Drizzle Kit.

### Migration Commands
```bash
# Generate a new SQL migration from schema diffs
npm run db:generate

# Apply pending migrations to the database
npm run db:migrate

# Apply specific targeted migration scripts
npm run db:migrate:remove-waitlist
npm run db:migrate:subject-profiles
npm run db:migrate:academic-sessions
```

### Safety Principles
1. **Never drop data-bearing columns** without an explicit transition phase (e.g., deprecate -> copy -> drop).
2. **Always test migrations against staging or isolated local PostgreSQL** before applying to production.
3. **Use transactions inside migration SQL files** so failed migrations roll back automatically without leaving dirty schema states.
4. Keep rollback SQL scripts in version control whenever destructive alterations are made.

---

## 3. Concurrency & Integrity Invariants

- **Check Constraints**: `available_seats >= 0` prevents any race condition from decrementing seats below zero.
- **Atomic Operations**: Elective updates utilize SQL expressions like:
  ```sql
  UPDATE electives
  SET available_seats = available_seats - 1,
      is_full = (available_seats - 1 <= 0)
  WHERE id = $1 AND available_seats > 0;
  ```
  If zero rows are updated, the transaction detects that the elective is full and rolls back.
