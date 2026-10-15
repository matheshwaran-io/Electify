# Electify Testing Guide & Verification Workflows

This document outlines the testing architecture, commands, and strategies used to ensure correctness, reliability, and concurrency safety.

---

## 1. Test Levels

Electify uses a three-tier testing strategy:

1. **Unit Tests (`tests/*.test.ts`)**: Fast, pure business rule tests that run without a database (e.g. password complexity policy, receipt semester terms, window phase calculations).
2. **Integration & Concurrency Tests (`tests/*.test.ts`)**: Database-backed test suites that spin up self-contained fixtures via `tests/helpers/world.ts`, simulate concurrent multi-user submissions, and test row-locking transactions against PostgreSQL.
3. **End-to-End Tests (`tests/e2e/*.spec.ts`)**: Browser automation via Playwright verifying student and faculty workflows, navigation, and accessibility (a11y).

---

## 2. Test Commands

### Running Unit Tests (No Database Required)
```bash
npm run test:unit
```
Runs pure unit tests (`tests/password-policy.test.ts`, `tests/qa-regressions.test.ts`). Completes in under 100ms.

### Running Full Integration Suite (Requires Live PostgreSQL)
```bash
npm test
```
Executes all integration test suites sequentially using Node.js test runner (`tsx --test --test-concurrency=1`). Requires a working `DATABASE_URL` in `.env.local`.

### Running End-to-End Tests (Playwright)
```bash
npm run test:e2e
```
Launches headless browser tests covering student login, course selection, and role-restricted routes.

---

## 3. Type Checking & Linting

Always verify type correctness and code style before committing changes:

```bash
# Typecheck entire codebase
npx tsc --noEmit

# Lint application source
npm run lint

# Lint scripts and test suites
npx eslint scripts tests --format compact
```

---

## 4. Test Isolation with `World` Fixtures

Integration tests create isolated test fixtures using `tests/helpers/world.ts`:
* Every test generates a random UUID suffix (e.g. `_world_abc123`).
* Fixtures are created in a dedicated hierarchy and cleaned up in `after()` blocks.
* Real university data is never modified by test runs.
