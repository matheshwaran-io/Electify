# Contributing to Electify

Thank you for contributing to Electify! This document outlines guidelines and development standards for maintaining code quality, data reliability, and testing rigor.

---

## 1. Development Workflow

### Branching Strategy
- `main`: Production-ready branch. All changes must pass CI validation.
- `feat/*`: New features or enhancements.
- `fix/*`: Bug fixes.
- `chore/*` or `refactor/*`: Maintenance, reorganization, dependency updates, and documentation.

### Prerequisites
- Node.js: `>= 20.0.0`
- Package Manager: `npm` (peer dependencies handled via project `.npmrc`)
- PostgreSQL: `>= 15` (local or managed Supabase/Neon instance)

### Local Setup
```bash
# Clone the repository
git clone <repo-url>
cd Electify

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

---

## 2. Code Quality & Formatting Standards

### TypeScript
- Maintain strict type checking. Run `npx tsc --noEmit` before committing.
- Do not introduce avoidable `any` types or blanket `@ts-ignore` comments.
- Strongly type all API parameters, server action inputs/outputs, and database schemas.

### ESLint & Linting
- Run `npm run lint` before committing.
- The repository must maintain **0 errors and 0 warnings**.
- Keep React Hook dependencies exhaustive (`react-hooks/exhaustive-deps`).

### Database & Drizzle ORM
- Schema definitions reside in `src/lib/db/schema.ts`.
- When updating schema models:
  1. Generate migration: `npm run db:generate`
  2. Inspect the generated migration in `drizzle/` for safe rollback paths and data preservation.
  3. Never drop data-bearing columns without an explicit, approved migration and backup plan.
  4. Ensure all foreign keys, unique constraints, and check constraints have descriptive names.

---

## 3. Testing Standards

Electify enforces comprehensive automated testing using Node.js's native test runner (`tsx --test`).

### Running Tests
```bash
# Run all automated tests
npm test

# Run a specific test suite
npx tsx --env-file=.env.local --test tests/year-servers.test.ts
```

### Writing Tests
- Place tests in the `tests/` directory.
- Test suites must be self-cleaning: use `after()` or `afterEach()` hooks to clean up any temporary entities created during test runs.
- Do NOT run destructive migrations or test against production databases.
- Always test concurrency boundaries for registration and seat booking.

---

## 4. Pull Request Checklist

Before submitting a Pull Request:
- [ ] `npx tsc --noEmit` passes with 0 errors.
- [ ] `npm run lint` passes with 0 errors and 0 warnings.
- [ ] `npm test` passes all test suites cleanly.
- [ ] `npm run build` succeeds without build errors.
- [ ] No hardcoded secrets, API keys, or personal tokens are included.
- [ ] Documentation is updated if architecture or configuration changes are introduced.
