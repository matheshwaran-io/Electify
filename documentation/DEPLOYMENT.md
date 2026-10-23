# Electify — Deployment

This guide describes how the code expects to be deployed. It has **not** been
exercised as part of this documentation pass: no deployment was made and no
cloud resource was created. Verify each step on a staging environment first.

## 1. Target

- Any Node 20.9+ host that can run `npm run build` and `npm start` (Next.js 16).
- The code contains Vercel-aware behaviour (`VERCEL_PROJECT_PRODUCTION_URL`),
  but there is no `vercel.json`; Vercel's Next.js defaults apply.
- A PostgreSQL database reachable from the host. A hosted Supabase project is
  supported; SSL is turned on automatically for non-local hosts.

## 2. Required configuration

Set these in the host's environment settings (never in a committed file):

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Pooled connection (e.g. Supabase pooler, port 6543, `?pgbouncer=true`). |
| `DIRECT_URL` | Direct connection for schema tools. |
| `JWT_SECRET` | 32+ random characters. Production refuses to start signing without it. |
| `SETUP_SECRET` | Only needed while bootstrapping the first admin; remove afterwards. |
| `INITIAL_ADMIN_PASSWORD` | Only needed while bootstrapping; change the password after first sign-in. |
| `NEXT_PUBLIC_APP_URL` | Canonical URL (optional). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Optional realtime. Leave empty to disable. |

Keep the server time zone at **UTC** (the Vercel default). Event times are
stored without a zone and compared on the server.

## 3. Database preparation

**New, empty database**

```bash
DIRECT_URL=<direct url> DATABASE_URL=<direct url> npx drizzle-kit push
```

**Existing database** — do *not* use `db:push` blindly (it has no table filter
and will propose dropping tables that are not in `schema.ts`) and do *not* use
`db:migrate` (the journal only knows 0000–0002). Instead:

1. Back up: `pg_dump "$DIRECT_URL" -Fc -f pre-deploy.dump`.
2. Find which hand-written migrations are missing (compare columns/tables with
   `drizzle/0003`–`0007`).
3. Apply each missing file in order:
   `npx tsx --env-file=<file with the target URL> scripts/db/apply-sql.ts drizzle/000N_*.sql`.
4. Rollbacks exist for 0004–0006 in `drizzle/rollback/`; 0003 and 0007 have none.

Release-specific requirement: the current code reads
`registrations.is_finalized`. A database without migration **0007** will fail
on registration pages.

## 4. Build and start

```bash
npm ci
npm run build
npm start          # listens on $PORT or 3000
```

On Vercel, the build and start commands are detected automatically.

## 5. First administrator

If the root admin (`electify@srmist.edu.in`) does not exist yet:

```bash
curl -s -H "x-setup-secret: $SETUP_SECRET" "https://<host>/api/health?setup=1"
```

Use the header rather than `?secret=` so the secret is not written to access
logs. Then sign in, change the password, and remove `SETUP_SECRET` and
`INITIAL_ADMIN_PASSWORD` from the environment.

Never run `npm run db:seed` against a production database: it creates accounts
with publicly documented development passwords.

## 6. Post-deploy checks

- `GET /api/health` returns `"status": "ok"` and `connected: true`.
- Sign in as admin → choose a Year Server → dashboard loads.
- A test student in a test class can see an upcoming event countdown.
- `/dev/*` pages return 404 in production.

## 7. Rollback

- Application: redeploy the previous build (Vercel "Promote" or your host's equivalent).
- Database: use the matching `drizzle/rollback/*.down.sql` where one exists, or
  restore the `pg_dump` taken in step 3.

## 8. CI

`.github/workflows/ci.yml` runs on pushes and pull requests to `main`:
install → lint → unit tests → type-check → build (with dummy environment
values). It does not deploy and does not run database tests.
