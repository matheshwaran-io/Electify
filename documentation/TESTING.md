# Electify — Testing

## Suites at a glance

| Suite | Command | Database | What it covers |
| --- | --- | --- | --- |
| Lint | `npm run lint` | none | ESLint on `src/` (`npx eslint scripts tests` for the rest) |
| Types | `npm run typecheck` | none | `tsc --noEmit` |
| Unit | `npm run test:unit` | none | `tests/password-policy.test.ts`, `tests/qa-regressions.test.ts` (window rule, time parsing, password policy) |
| Integration | `npm test` | **PostgreSQL, writes rows** | All `tests/**/*.test.ts`: registration, seats, Year Servers, invites, monitor, migrations, isolation |
| End-to-end | `npm run test:e2e` | local PostgreSQL, recreates `electify_e2e` | Playwright in Chrome: student journey, staff isolation, reload safety, accessibility (axe), mobile layout |
| Build | `npm run build` | none | Production compile |

CI (`.github/workflows/ci.yml`) runs lint, unit, type-check and build on pushes
and pull requests to `main`. Integration and e2e suites run only locally.

## Integration tests — choose the database explicitly

The `test` script is
`tsx --env-file=.env.local --test --test-concurrency=1 "tests/**/*.test.ts"`, so
by default it uses the `DATABASE_URL` in **`.env.local`**. Fixtures in
`tests/helpers/world.ts` create uniquely tagged rows and delete them afterwards,
but they still write to that database, and the migration tests run DDL inside
transactions. Run them against a dedicated local database:

```bash
createdb electify_test
DATABASE_URL=postgresql://localhost:5432/electify_test npx drizzle-kit push
DATABASE_URL=postgresql://localhost:5432/electify_test \
DIRECT_URL=postgresql://localhost:5432/electify_test \
npm test
```

Variables set on the command line take precedence over `--env-file`.
`npm test` needs Node 22+ (it passes a glob to `node --test`).

## End-to-end tests

`playwright.config.ts` starts its own `next dev` on port **3210** with
`NEXT_DIST_DIR=.next-e2e`, a fixed test-only `JWT_SECRET`, realtime disabled,
and `DATABASE_URL` = `E2E_DATABASE_URL` (default
`postgresql://localhost:5432/electify_e2e`). `tests/e2e/global-setup.ts`
drops and recreates that database and seeds the synthetic fixtures in
`tests/e2e/fixtures/` (all names are invented; e-mails use `example.test`).

```bash
npm run test:e2e
# custom local server/port:
E2E_DATABASE_URL=postgresql://postgres@localhost:5432/electify_e2e E2E_PORT=3211 npm run test:e2e
```

Requirements: local PostgreSQL with `createdb`/`dropdb` on the PATH (set
`PGPASSWORD` if needed) and Google Chrome installed. Results:
`test-results/e2e-results.json`; traces and screenshots are kept for failures
only. The setup drops the database, so it refuses to run unless the URL's host
is `localhost`/`127.0.0.1` and the database name is exactly `electify_e2e`.

## Latest observed results (23 October 2026, `main` @ `e7b3151` + working tree)

| Suite | Result |
| --- | --- |
| Lint | 0 errors, 1 warning (`src/lib/workspace.ts:201` unused `scope`) |
| Type-check | pass |
| Unit | 15 / 15 pass |
| Integration (local DB) | 141 / 145 pass, 4 fail (below) |
| E2E | 23 passed, 13 failed (59.6 min). All failures are stale test code, see below. |
| Build | pass (isolated `NEXT_DIST_DIR`) |

### Known failures

All four failures come from tests that still describe earlier behaviour. The
application behaviour they now contradict was changed on purpose in later
commits. They should be updated by someone who confirms the intended rules.

| Test | Expectation in test | Current behaviour | Changed in |
| --- | --- | --- | --- |
| `tests/academic-sessions.test.ts` › 2. The selected academic session filters the workspace | `listSessionsForScope` returns only the sessions a tutor teaches in | Returns all sessions to every staff role; classes remain scoped | `e7b3151` |
| `tests/academic-sessions.test.ts` › 10. Receipts and reports carry the full cohort and session identity | Receipt number exists right after `registerElectives` | Receipt is issued by `finalizeStudentRegistration` (or when the window closes) | "Pdf" commit (`254de48`) |
| `tests/subject-explorer.test.ts` › 6. Late and paused submissions are rejected; confirmed records are kept | Same receipt-at-registration assumption | Same as above | `254de48` |
| `tests/academic-sessions.test.ts` › 13. Staff cannot reach classes… outside their scope | Event status stays `PUBLISHED` after a rejected cross-scope pause | The unauthorized pause **is rejected**; the status becomes `OPEN` because `syncExpiredRegistrationEvents` auto-opens PUBLISHED events whose `open_date` has passed | auto-open in `src/lib/auto-close.ts` |

None of these indicate an authorization gap: in test 13 the forbidden action
is refused; only the follow-up status assertion is stale.

### Known e2e failures

| Cause | Tests affected | Fix needed in tests |
| --- | --- | --- |
| `chooseYearServer()` in `tests/e2e/helpers.ts` clicks a button named `/^Year 2026,/`. Commit `402c74d` renamed the Year Server buttons to `"2026–2027, <status>…"`, so the click waits until the test times out. | 12 staff tests: `accessibility` › staff pages; `mobile-layout` › tutor pages, coordinator and admin pages; `navigation-a11y` › phone, tablet; `route-reload` › tutor, coordinator, administrator pages; `session` › tampered cookie; `staff-isolation` › workspace reloads, pause window, foreign replay | Match the new name (e.g. `^2026–\d{4},`). Until then, every check after the Year Server screen in these tests is untested. |
| `student-workflow.spec.ts` expects `receipt_number` right after confirming | 1 test | Finalize the registration first (receipts are issued at finalization since `254de48`). |

## Writing tests

- Pure rules (no DB) → add to a unit test file and to the `test:unit` script so CI runs it.
- Anything that touches the DB → use `tests/helpers/world.ts` so every row is
  tagged and cleaned up; never touch rows the test did not create.
- UI journeys → Playwright under `tests/e2e/`, using the synthetic fixtures and
  `helpers.ts` (`collectProblems`/`expectNoProblems` fail on console errors and 5xx).
