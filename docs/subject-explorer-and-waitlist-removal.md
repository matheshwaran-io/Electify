# Subject Explorer, preview mode and waitlist removal

This note covers what changed, how it works, and how to operate it.

## 1. What students get

| Route | What it shows |
| --- | --- |
| `/dashboard/subjects` | Every active elective in the student's current registration event, with search (name, code, description, tags, syllabus topics), filters (category; programme and department only when there is more than one), an "only subjects with seats" switch, and live seat counts. |
| `/dashboard/subjects/[electiveId]` | Official offering facts, the registration window banner, seat availability, alternatives in the same basket, and the supplementary subject guide when one is published. |
| `/countdown` | Unchanged countdown, plus an "Explore subjects while you wait" button. |
| `/dashboard`, `/dashboard/electives`, `/dashboard/my-registration` | A "Subjects" link in the header. The picker's details dialog links to the full guide. Picks survive the round trip because the picker already stores them in `sessionStorage`. |

Students can browse before registration opens. Opening any of these pages never writes to the database and never reserves a seat.

A student only ever sees subjects from the latest event for **their own batch**, in a status students can see (`STUDENT_VISIBLE_EVENT_STATUSES` in `src/lib/registration-window.ts`). If an id from another batch or an unknown id is requested, the page returns the not-found page. Nothing about other students is returned.

## 2. Registration window (single source of truth)

`src/lib/registration-window.ts` holds `getRegistrationWindow(event, now)`. It is used by:

- the register, change and cancel server actions, which call it with the server clock at request time;
- `/countdown`, `/dashboard` and `/dashboard/electives`, which previously each had their own copy of the rule and did not handle `PAUSED`;
- the subject explorer banner.

The rules:

| Condition | State |
| --- | --- |
| Status is `PAUSED` | `PAUSED` |
| Status is `CLOSED`, `VERIFICATION`, `FINALIZED` or `ARCHIVED` | `CLOSED` |
| Started (`now >= openDate`, or status is `OPEN` or `ACTIVE`) | `OPEN`, unless closed by the next rule |
| Not started, `openDate` set | `UPCOMING` |
| Not started, no `openDate` | `UNSCHEDULED` |
| `now > closeDate` and `autoClose` | `CLOSED` |

The client countdown is for display only. When it reaches zero, the banner calls `router.refresh()` and the server decides again. Disabled buttons are a courtesy; `registerElectives` rejects anything outside the window with `code: "WINDOW_CLOSED"`.

### Timezone strategy

- `open_date` and `close_date` are Postgres `timestamp` (without time zone). node-postgres reads and writes them in the **server process's** time zone, and comparisons happen on JS `Date` instants.
- Keep the server's TZ fixed and the same everywhere that writes these columns (Vercel functions run in UTC). If you run scripts locally against production, run them with `TZ=UTC`.
- Everything shown to people is formatted in `APP_TIME_ZONE` (`Asia/Kolkata`, `src/lib/format.ts`).
- Countdowns are offset by the server time sent with the page (`useServerClock`), so a wrong device clock cannot open registration early or hide it.

## 3. Seats

- Seat numbers come from `electives.available_seats` and, when the student's section has a quota, `elective_seat_allocations.available_seats`. The figure shown is the smaller of the two (`studentSeatAvailability` in `src/lib/seats.ts`).
- `LiveSeatRefresh` listens to Supabase Realtime `UPDATE`s on the electives being shown, filtered to their ids, and refreshes the server data. While the tab is visible it also polls every 30 seconds as a fallback. Counts are re-read from the database; the client never computes them.
- Cached or displayed counts never authorise anything. On submit, `registerElectives` locks the elective rows (`SELECT … FOR UPDATE`, in id order) and the section quota, checks capacity, and decrements both inside one transaction. If the last seat went to someone else, the whole submission rolls back with `code: "SEAT_TAKEN"` and the message "The last seat in X was just taken. Please choose another elective."
- Migration 0005 adds `CHECK (available_seats >= 0)` to both tables as a database-level backstop.
- Changing an elective takes the new seat before releasing the old one. If the new one is full, nothing changes. Cancelling releases the seat and the section quota.

## 4. Subject guides (supplementary content)

### Data model

The `subject_profiles` table is defined in `src/lib/db/schema.ts` and created by `drizzle/0005_subject_profiles.sql` and the login-time self-heal.

| Column | Meaning |
| --- | --- |
| `slug` | Stable key, e.g. `cloud-computing` |
| `title`, `aliases` | Names an offering can be matched by |
| `course_code` | Set only when the university has confirmed it |
| `programme_id` | Restricts the guide to one programme; `null` = any programme |
| `summary` | One-paragraph description |
| `content` | JSON validated by `subjectContentSchema` (`src/lib/subjects/content-schema.ts`) |
| `status` | `DRAFT`, `PUBLISHED` or `ARCHIVED`; students only see `PUBLISHED` |
| `created_by_id`, `updated_by_id`, timestamps | Who changed it and when |

A guide is attached to an offering by course code first, then by normalised name or alias, within the offering's programme. There is no foreign key from `electives`, so un-migrated databases keep working.

Every content section carries `provenance { status: OFFICIAL | PROPOSED | UNVERIFIED, source, verifiedAt, verifiedBy }`, and the page shows a badge and source line for each. Difficulty is labelled "(estimate)" unless it is `OFFICIAL`. The official facts panel (code, credits, category, programme, department, seats) always comes from the registration event, never from the guide.

`readSubjectContent` reads each section independently. A malformed section is skipped rather than breaking the page, and resource URLs must be absolute `https://` URLs (anything else is dropped). Links render with `target="_blank" rel="noopener noreferrer external"`.

### Who can edit

The actions live in `src/app/actions/subjects.ts`:

- `SYSTEM_ADMIN`: any guide.
- `COURSE_COORDINATOR`: only guides scoped to their own programme. They cannot create unscoped guides or edit, publish or check another programme's.
- Students and tutors are rejected.

Every change is written to `audit_logs`.

There is no admin screen yet. Today's workflow is:

1. Add or edit a file in `src/lib/subjects/catalog/` (see `cloud-computing.ts`) and add it to `PROFILES` in `scripts/seed-subject-profiles.ts`.
2. Run `npm run db:seed:subjects -- --draft` to upsert it by slug as a draft, then review it.
3. Run `npm run db:seed:subjects` to publish, or call `setSubjectProfileStatus`.
4. Optionally run `npm run db:seed:subjects -- --check-links`. This probes each resource URL once (HEAD, then GET, 8 s timeout) and stores `lastCheckedAt` and `lastCheckStatus`. The page shows "Link checked <date>" only when such a result exists, and "Link not yet checked" otherwise. Pages never fetch external sites.

### The bundled Cloud Computing guide

`src/lib/subjects/catalog/cloud-computing.ts` is editorial guidance written for this project. It is **not** a university syllabus.

- `course_code` is `null`.
- Every section is `PROPOSED` or `UNVERIFIED`.
- The syllabus is labelled "Example topics only".
- There are no official prerequisites, credits, semester or faculty names.
- Careers are framed as guidance with no placement or salary claims.

The four resources (NIST SP 800-145, Microsoft Learn Azure Fundamentals, AWS Skill Builder, Google Cloud training) all returned HTTP 2xx when checked on 13 Oct 2026. Have faculty review it and replace sections with approved content, marking them `OFFICIAL` with `verifiedAt` and `verifiedBy`, before relying on it.

Semester is not stored for electives anywhere in the schema, so it is shown as "Not recorded for electives" and is not a filter.

## 5. Waitlist removal

The waitlist was removed from the schema, actions, UI, receipts, monitor, reports, replay, templates and tests. Full seats now fail with a clear message instead of queueing the student.

### Migration `drizzle/0004_remove_waitlist.sql`

The migration is idempotent and uses unqualified names, so it applies to the schema on `search_path`. In order, it:

1. Copies every row it changes or whose columns it drops into `legacy_waitlist_archive` as full-row JSON.
2. Marks waitlisted choices `CANCELLED`. They never held a seat, so seat counts are not touched.
3. Rewrites receipt snapshot entries that were waitlisted as "<name> [Cancelled]" and removes the waitlist keys.
4. Sets `WAITLISTED` parent registrations to `CONFIRMED` if a confirmed choice remains, otherwise `CANCELLED`.
5. Drops `student_registrations.is_waitlisted`, `student_registrations.waitlist_position` and `registration_events.enable_waitlist`, and rebuilds the `registration_status` enum without `WAITLISTED`.

`replay_events` and `audit_logs` are not modified. Historical `STUDENT_WAITLISTED` and `WAITLIST_PROMOTED` entries remain as history.

### How to run

```bash
pg_dump "$DATABASE_URL" -Fc -f scratch/db-backups/before-0004.dump
npm run db:migrate:subject-profiles
npm run db:migrate:remove-waitlist
```

Run 0004 **before** any `drizzle-kit push` against a database that still has the waitlist columns. `push` would drop them without archiving.

### Rollback

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/rollback/0004_remove_waitlist.down.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/rollback/0005_subject_profiles.down.sql
```

Run the 0004 rollback without `-1`, because Postgres cannot use a newly added enum value in the same transaction. It restores the columns, the enum value and every archived row exactly as before. Rolling back 0005 deletes `subject_profiles` and its content, so export it first if needed.

`tests/remove-waitlist-migration.test.ts` runs 0004, a second 0004 run (idempotency) and the rollback against legacy fixtures in a throwaway schema.

### Retained references

The following still mention the waitlist on purpose:

- `drizzle/0002_*` and `drizzle/meta/0002_snapshot.json`: history of applied migrations.
- The 0004 migration, its rollback and its test.
- Historical replay and audit rows in the database.

## 6. Self-heal locking fix

`ensureDatabaseReady()` (called at login) used `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. That takes an `ACCESS EXCLUSIVE` lock on `users` and `registration_events` even when the column already exists. It deadlocked a concurrent registration in the test suite, and a cold start during a registration surge could do the same in production. Each statement is now guarded by a catalog check, so an up-to-date database takes no DDL locks; this was verified with `pg_locks`.

## 7. Dev preview

`/dev/subjects` (development only; returns 404 in production) renders the explorer with sample offerings and the real Cloud Computing guide:

- `?state=upcoming|open|paused|closed|unscheduled`
- `?view=detail[&subject=e1|e2|e3]`
- `?view=empty`

## 8. Tests

`npm test` runs against `DATABASE_URL` with self-cleaning fixtures (`tests/helpers/world.ts`).

| File | What it covers |
| --- | --- |
| `tests/subject-explorer.test.ts` | Browsing before opening; real capacity including section quotas; no seat reserved by browsing; rejected before opening; accepted after opening; late and paused submissions rejected while confirmed records are kept; ineligible students, wrong batch and foreign electives rejected; catalogue scoping; published-only and programme-scoped guides; editor role separation; staff-only monitor feeds; content validation; window boundaries |
| `tests/registration-modifications.test.ts` | Change, cancel, cancel all, full-elective rejection, concurrency on the last seat and on changes, rollback on failure, unique receipt numbers, waitlist-free receipts |
| `tests/remove-waitlist-migration.test.ts` | Migration, idempotency and rollback on legacy data |
