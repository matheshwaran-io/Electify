# Electify — Reload, Regression and Mobile-First QA Report

Date: 14 October 2026 · Branch: `chore/repo-cleanup-and-production-readiness` (base commit `c4089e0`, changes uncommitted at time of writing)

This report records what was actually tested, what was found, what was changed and what remains. Every result below comes from a run on the development machine; nothing was measured against production.

## 1. Environment and safety

| Item | Value |
| --- | --- |
| Stack (verified) | Next.js 16.2.10 (App Router, Turbopack), React 19.2, TypeScript 5, Drizzle ORM 0.45.2, PostgreSQL, jose/bcryptjs auth, optional Supabase Realtime |
| Unit/integration tests | Node `node:test` via `tsx` (existing) |
| Browser tests | Playwright 1.64 (`@playwright/test`, added) using the locally installed Google Chrome; axe-core via `@axe-core/playwright` (added) |
| Databases used | `electify_report` (local, recreated from the schema for the node tests) and `electify_e2e` (local, dropped, recreated and seeded with synthetic fixtures before every Playwright run). |
| Databases **not** used | The hosted Supabase development database in `.env.local` and anything production. Every test command set `DATABASE_URL` explicitly to a local database; the e2e global setup refuses any database other than local `electify_e2e`. |
| Isolation from the developer's server | The e2e server runs on port 3210 with its own output directory (`NEXT_DIST_DIR=.next-e2e`); the verification build used `.next-build`. The running dev server on port 3000 was not touched. |
| Test data | Synthetic only: accounts `e2e.*@example.test`, register numbers `E2E…`, a test-only password stored in `tests/e2e/fixtures/constants.ts`. No real student records, credentials or signup codes. Realtime is deliberately not configured for the e2e server. |

## 2. Baseline (before any change)

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Passed |
| `eslint src` | Passed (0 problems) |
| Node tests (130 tests, 16 suites, local DB) | **129 passed, 1 failed** — "Server enforces configurable max tutor sections limit" (defect R10 below) |
| Production build | Not run at baseline (the only `.next` directory belonged to the running dev server); run after the changes, see §8 |
| Browser tests | None existed |

## 3. Route inventory

Discovered from `src/app/**/page.tsx`. "Reload" means the page was opened by direct URL, checked for its meaningful content, reloaded and checked again, with console errors, uncaught exceptions and 5xx responses failing the test (`tests/e2e/route-reload.spec.ts`).

| Route | Role | Auth | Data needed | Direct nav + reload verified |
| --- | --- | --- | --- | --- |
| `/login`, `/join` | public | no | — | Yes |
| `/dashboard`, `/dashboard/electives` | student | yes | open event for the class | Yes |
| `/dashboard/subjects`, `/dashboard/subjects/[electiveId]` | student | yes | published event | Yes |
| `/dashboard/my-registration` | student | yes | redirects to the picker until registered | Yes (both states, the registered state in the workflow test) |
| `/countdown` | student | yes | event opening in the future | Yes |
| `/dashboard/success` | student | yes | — | Not opened directly (submission lands on `/dashboard/my-registration`) |
| `/faculty/session-select` | staff | yes | — | Yes |
| `/faculty/portal-select` | coordinator | yes | — | Yes |
| `/faculty/dashboard`, `/section`, `/window`, `/tutor-electives`, `/tutor-reports`, `/monitor`, `/replay`, `/assign-sections`, `/approvals`, `/settings` | tutor | yes | Year Server + class | Yes |
| `/faculty/electives`, `/events`, `/templates`, `/students`, `/reports`, `/academic-sessions` | coordinator | yes | Year Server | Yes |
| `/faculty/academic-sessions/[year]`, `/academic-sessions/review`, `/year-servers`, `/users`, `/departments`, `/invites`, `/audit`, `/database`, `/settings` | admin | yes | Year Server | Yes (`/approvals` correctly redirects admins to their dashboard) |
| `/faculty/replay/[eventId]` | staff | yes | event in scope | Yes (authorised and unauthorised) |
| Protected routes without a session | — | — | — | 8 routes: server answers 307 to `/login`, no content exposed |
| `/maintenance`, `/presentation`, `/dev/*` | — | — | — | **Not executed** (maintenance mode not toggled; dev pages are previews) |

## 4. Defects found and fixed

Each item was reproduced first, then fixed, then covered by a test that was run after the fix. "Observed failing" means the regression test (or the sweep that found it) failed before the fix.

| ID | Defect (as reproduced) | Root cause | Fix | Regression test |
| --- | --- | --- | --- | --- |
| R1 | `/countdown` showed "This page couldn't load" on load **and on every reload**; the subject not-found page had the same fault. | Server Components called `buttonVariants()`, which is exported from a `"use client"` module; calling a client-module export on the server throws. | Moved the variant definitions to `src/components/ui/button-variants.ts` (no directive); `button.tsx` re-exports them; both server pages import the plain module. | `route-reload.spec.ts` › upcoming-event student (observed failing) |
| R2 | **Security:** after signing in on another device, or after an account was deactivated, the old browser kept rendering protected pages on reload. Server Actions rejected it; pages did not. | In `getSession()`, the stale-session branch deleted cookies, which throws during a Server Component render; the exception landed in the `catch`, whose fallback only re-checked `isActive` and then returned the session. | `getSession()` now decides "revoked" first, deletes cookies best-effort, and during a render redirects to `/login?expired=1`; the proxy clears the cookies on that request (avoiding a redirect loop on the still-valid signature) and the sign-in page shows a "session ended" notice. | `session.spec.ts` › signing in elsewhere (observed failing), › deactivated account |
| R3 | Every student page logged repeated WebSocket errors and showed a permanent "Reconnecting" status when Supabase is not configured. | The client fell back to `placeholder.supabase.co` and subscribers always opened channels. | `src/lib/supabase.ts` exports `realtimeConfigured`; all subscribers skip channels when it is false. Status falls back to "Seats refresh every 30s". | `route-reload.spec.ts` fails on any console error (observed failing) |
| R4 | Unhandled rejection "cannot add `postgres_changes` callbacks … after `subscribe()`" in the picker (seen in development). | The picker imports the client lazily; under React strict mode / fast navigation the cleanup ran before the import resolved, so the next mount reused the already-subscribed `table-db-changes` channel. | Cleanup flag checked before subscribing; per-mount channel name. | Code review only — the path needs realtime, which is disabled in the isolated environment (see §9) |
| R5 | Seat counts in the picker went stale: new server data (e.g. after `router.refresh()`) never reached the cards, and without realtime there was no refresh at all. | `useState(electives)` copied the props once. | Take new props when they change; refresh from the server every 30 s and when the tab becomes visible (same policy as the subject explorer). | `freshness.spec.ts` (verified to fail with the fix removed) |
| R6 | Live window offered no **Pause** button for a published event whose opening time had passed — students could register, staff could not pause. | Controls required `status === "OPEN"`; `windowPhase` duplicated the window rule and ignored auto-close and the VERIFICATION/FINALIZED/ARCHIVED states. | `windowPhase` now delegates to `getRegistrationWindow`; the configuration card uses it. | `staff-isolation.spec.ts` › pause window (observed failing), `tests/qa-regressions.test.ts` |
| R7 | Monitor said "Window is closed for new student submissions" for an open published event, and offered "Reopen Window" (which opens immediately) for events not yet open. | Same stored-status shortcut. | Monitor uses the shared rule; upcoming events say so and the button reads "Open now". | `staff-isolation.spec.ts` (monitor message + Pause button) |
| R8 | Receipts for an odd semester (Semester 3) were numbered `ELC-YYYY-EVEN-…`. | Term was taken from the word "odd" in the event name. | `receiptTerm()` in `src/lib/academic.ts` uses the event's semester; the name check remains only for events without a semester. | `tests/qa-regressions.test.ts`; `student-workflow.spec.ts` asserts `ODD` |
| R9 | Audit log IP column always "client-ip". | Hard-coded placeholder. | Address taken from `x-forwarded-for` / `x-real-ip` (recorded for information only, never used for decisions); `null` when unavailable. | `session.spec.ts` › audit address |
| R10 | Changing the tutor class limit (and switching maintenance mode) did nothing on a database without a `system_settings` row, while reporting success. | Plain `UPDATE … WHERE id = 'system'`. | Upsert in `updateMaxTutorSectionsLimit` and `toggleMaintenanceMode`. | Existing `multi-programme-tutor` test 5 (failed at baseline, passes now) |
| R11 | Administrators never saw the "unlock" control on the class page. | Role compared with `"SUPER_ADMIN"`, which does not exist (`SYSTEM_ADMIN`). | Corrected the role name. | Code review only |
| R12 | Node test suite intermittently failed (`year-servers` test 2 or `year-server-selection-flow` test 3). | Test files ran in parallel against one database and raced on globally unique Year Servers (one test prunes all empty ones). | `npm test` runs files serially (`--test-concurrency=1`); the pg pool sets `allowExitOnIdle`, so each test process exits immediately (serial run went from ~340 s to ~9 s). | 136/136 across repeated runs |

## 5. Mobile-first audit

Viewports: 320×568, 375×667, 390×844, 430×932, 768×1024, 1366×768, 1440×900 (representative browser sizes, not a device-compatibility guarantee). 22 pages × 7 viewports = 154 measurements of horizontal overflow (document and the shell's scrolling `<main>`), plus the navigation pattern expected for the width (`tests/e2e/mobile-layout.spec.ts`).

**Before:** 11 overflow failures on 5 pages, plus visually confirmed problems the metric did not catch (clipped countdown, squeezed tablet header):

| Page | Viewports | Problem (measured) | Fix |
| --- | --- | --- | --- |
| Student subjects / subject detail | 320, 375, 390 | Header row overflowed by 93 / 38 / 23 px | Logo mark only below `sm`, tighter link padding, icon-only sign-out (40 px target) on phones |
| Live monitor | 320, 375, 390 | Event selector overflowed `<main>` by 83 / 28 / 13 px | Full-width selector on phones (40 px tall), truncation, `sm:max-w` |
| Year Servers | 320 | Cards overflowed by 4 px | Title row wraps; tighter padding on phones |
| Join | 320 | Decorative mark overflowed by 2 px | Negative margin only from `sm` |
| Countdown | 320–430 | Timer digits clipped (ancestor hides overflow, so not measurable as overflow) | Digits scale with width; added a "timer inside the viewport" assertion |
| Class page (and every page header with several actions) | 640–1023 | Title squeezed into a one-word-wide column | Shared `PageHeader` stays stacked below `lg`; actions wrap |

**After:** all 154 measurements have zero overflow; navigation is the bottom bar below 768 px, the drawer from 768 to 1023 px and the sidebar from 1024 px. Before/after images: `docs/qa/artifacts/fixes/`; further after-only examples: `docs/qa/artifacts/after/`. The "before" images show the Next.js development indicator (round "N"), which is not part of the app; it is hidden in later captures.

Navigation (already present, verified rather than rebuilt): phone bottom bar + "More" sheet, tablet drawer. `navigation-a11y.spec.ts` checks keyboard opening, Escape closing with focus returned to the trigger, closing after navigation, the Year Server and class identity visible on phones, and bottom-bar targets ≥ 44 px.

## 6. Accessibility

Automated: axe-core (WCAG 2.0/2.1 A and AA rules) on 15 pages at 1440 and 390 px (`accessibility.spec.ts`).

| Before | After |
| --- | --- |
| `select-name` (critical): monitor refresh-interval select; event selector | Labelled (`aria-label`) |
| `color-contrast` (serious): "LIVE TELEMETRY" badge pulsing its text below contrast; Year Server tab counts faded with `opacity-70` | Pulse removed from the text (the dot still signals "live"; also respects reduced motion); counts use the muted text colour |
| `definition-list` / `dlitem` (serious): countdown summary wrapped `dt`/`dd` in extra elements | Icons moved inside `dt`, same layout |
| — | Monitor sound toggle (icon-only) now has `aria-label` and `aria-pressed` |

After the fixes axe reports **no violations of any impact** on the pages checked. Manual: keyboard and focus behaviour of the compact navigation (above); dialogs used for confirmation already guard against double submission (`ConfirmDialog` pending state, picker submit guard) — double-clicking "Confirm registration" creates one registration (`session.spec.ts`). Reduced motion is already honoured (`MotionConfig reducedMotion="user"` and CSS media queries). Automated checks cannot judge everything; screen-reader use with real assistive technology was **not executed**.

## 7. Performance observations

Production build (`next start`), 390×844 with touch emulation, local machine, **no network throttling** — these numbers describe this machine only.

| Page | Requests | JS transferred | CLS | LCP |
| --- | --- | --- | --- | --- |
| `/login` | 28 | 372 KB | 0 | n/a* |
| `/dashboard/electives` | 41 | 394 KB | 0 | 144 ms |
| `/dashboard/subjects` | 33 | 393 KB | 0 | 380 ms |
| `/faculty/dashboard` | 33 | 401 KB | 0 | 88 ms |
| `/faculty/section` | 33 | 416 KB | 0.0004 | 384 ms |
| `/faculty/monitor` | 32 | 401 KB | 0 | 400 ms |
| `/faculty/window` | 31 | 404 KB | 0 | 380 ms |

\*No LCP entry was reported for `/login` in this run.

No duplicate requests or repeated server-action calls on load were seen (the single POST on `/faculty/section` is the password-reset queue). The login bundle contains framer-motion and zod, both used on that page; chart, PDF and Supabase code are not loaded there. No bundle optimisation was applied: replacing the animation library would be a redesign the evidence does not justify. The only performance-related change is that pages no longer retry a realtime connection that cannot succeed (R3). No before/after timings are claimed.

## 8. Final results

| Check | Result |
| --- | --- |
| `tsc --noEmit` | **Passed** |
| `eslint src` | **Passed** (0 problems). Linting `tests/` shows 15 warnings, all unused imports in pre-existing test files |
| Node unit/integration tests (`npm test`, local DB) | **136 / 136 passed** (18 suites, ~9 s), repeated serially; includes 6 new unit regression tests |
| Playwright end-to-end (`npm run test:e2e`) | **All passed** — 36 tests: route reload sweep (14), student workflow (1), staff workspace and isolation (4), sessions (6), freshness (1), mobile layout (5), accessibility (3), navigation (2) |
| Accessibility (axe) | **Passed** — 0 violations on 15 pages × 2 widths |
| Responsive (7 viewports) | **Passed** — 0 overflow in 154 measurements |
| Production build (`NEXT_DIST_DIR=.next-build next build`) | **Passed**; `/login` still statically rendered |

Workflows verified in the browser with database assertions: sign-in and reload; subject browsing and detail; picks surviving reload; registration with the receipt shown only after the server confirmed; reload and Back after submission (no resubmission); change and cancellation with exact seat restoration; tutor Year Server selection, class switching and reload; forged class cookie ignored; Year Server switch narrowing classes; staff configuration change (pause/resume) persisting across reload and reaching students; cohort isolation (same subject name, separate counters; crafted event URLs; another tutor's replay); sign-out + Back; tampered cookie; superseded and deactivated sessions; double submission.

## 9. Not executed or blocked

| Area | Status | Reason |
| --- | --- | --- |
| Realtime (Supabase) behaviour, including the R4 race fix | Not executed | Realtime is intentionally not configured for the isolated server; enabling it would connect to the hosted project. Verified by code review only. |
| Student signup through `/join` to account creation, password-reset UI flow | Not executed in the browser | Covered by existing node tests (`class-student-onboarding`); browser flow not automated in this pass |
| Event creation / templates / CSV import / bulk database tools through the UI | Not executed | Destructive or multi-step admin flows; server-side rules are covered by node tests |
| Receipt PDF download content | Not executed | |
| Load and concurrency at realistic scale, throttled-network performance | Not executed | No load testing environment |
| Real devices, Safari/Firefox, screen readers | Not executed | Chrome only, emulated viewports |
| `/maintenance`, `/presentation`, `/dev/*` | Not executed | |

## 10. Remaining issues (prioritised)

**Functional / security**
1. `getSession()` still fails *open* if the database cannot be reached at all (both checks throw): the signed token is accepted. Changing this is an authentication-architecture decision (it would sign everyone out during a database outage) and was left as is.
2. The proxy (`src/proxy.ts`) and `lib/auth.ts` fall back to a built-in JWT secret when `JWT_SECRET` is missing; signing refuses this in production, but verification in the proxy does not. Set `JWT_SECRET` in every deployed environment.
3. "Reopen" after an automatic deadline has passed sets the status to OPEN, but the window rule still closes the window after `close_date`; staff must move the closing time instead. The button label does not explain this.
4. The R4 realtime race fix and presence channels that share the topic `online-users` (tutor class and report pages) should be re-tested with realtime configured.
5. `src/lib/workspace.ts`'s header comment still says a single Year Server is selected automatically; since commit `c4089e0` staff always choose explicitly after sign-in (intended behaviour, covered by tests). Comment only.

6a. **Hydration mismatch with reduced motion (open).** Found on 15 October 2026 while capturing report screenshots: when the browser requests reduced motion, the decorative `SeatMark` graphic on `/login` and `/join` renders a different `style` on the server than on the client, and React logs a hydration error. The e2e suite runs without that preference, so it does not catch this. Fix: render the same markup on both sides (decide the reduced-motion variant after mount), then add a Playwright project with `reducedMotion: "reduce"`.

**Cosmetic / usability**
6. Data-heavy tables (audit log, invite codes, events) remain horizontally scrollable tables on phones rather than card layouts; they are usable but dense.
7. The monitor header still prints the stored status (e.g. `STATUS: PUBLISHED`) next to the now-correct explanation.
8. `tsconfig.json` gained `include` entries for the isolated output directories (added by Next.js automatically; harmless, the directories are git-ignored).

## 11. Files changed (summary)

Application: `src/lib/auth.ts`, `src/proxy.ts`, `src/app/login/page.tsx`, `src/components/auth/session-ended-notice.tsx` (R2); `src/components/ui/button-variants.ts`, `button.tsx`, countdown and not-found pages (R1); `src/lib/supabase.ts` and its subscribers (R3); `src/app/dashboard/registration-form.tsx` (R4, R5); `src/components/window/types.ts`, `configuration-card.tsx`, monitor client (R6, R7); `src/lib/academic.ts`, `src/app/actions/register.ts` (R8); `src/app/actions/auth.ts` (R9); `src/app/actions/tutor.ts`, `admin.ts` (R10); section client (R11); `src/lib/db/index.ts`, `package.json` test script (R12); responsive and accessibility fixes in `student-chrome.tsx`, `sign-out-button.tsx`, `subject-page-guard.tsx`, `brand-panel.tsx`, `countdown-timer.tsx`, `countdown/page.tsx`, `year-servers-client.tsx`, `monitor-client.tsx`, `ui/layout.tsx`.

Infrastructure: `playwright.config.ts`, `tests/e2e/**` (fixtures, global setup, helpers, 8 spec files), `tests/qa-regressions.test.ts`, `next.config.ts` (optional `NEXT_DIST_DIR`), `.gitignore`, dev dependencies `@playwright/test` and `@axe-core/playwright`.

Run locally:

```bash
npm run test:e2e
```

`npm test` reads `DATABASE_URL` from `.env.local`; point it at a local database when running it, as was done for this report.
