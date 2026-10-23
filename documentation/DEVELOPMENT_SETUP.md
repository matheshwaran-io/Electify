# Electify — Development Setup (macOS / Linux)

Windows users: follow [../WINDOWS_SETUP.md](../WINDOWS_SETUP.md).
Background and caveats: [PROJECT_MAINTENANCE_MANUAL.md](PROJECT_MAINTENANCE_MANUAL.md).

## 1. Prerequisites

| Tool | Version | Check |
| --- | --- | --- |
| Node.js | 24 recommended (`.nvmrc`); minimum 20.9; `npm test` needs 22+ (glob patterns in `node --test`) | `node -v` |
| npm | bundled with Node | `npm -v` |
| PostgreSQL | 14+ running locally | `psql --version`, `pg_isready` |
| Git | any recent | `git --version` |
| Google Chrome | only for `npm run test:e2e` (Playwright uses `channel: "chrome"`) | |

## 2. Clone and install

```bash
git clone https://github.com/matheshwaran-io/Electify.git
cd Electify
nvm use          # optional, picks Node 24 from .nvmrc
npm ci
```

## 3. Create a local database

```bash
createdb electify_dev
```

Use a **local** database for development. Do not point a development checkout
at a shared or hosted database unless you have a specific reason and a backup.

## 4. Environment files

Two files are read by different tools (both are git-ignored):

| File | Read by |
| --- | --- |
| `.env.local` | Next.js (`dev`, `build`, `start`), and the `--env-file=.env.local` scripts: `npm test`, `db:migrate:*`, `db:seed:subjects` |
| `.env` | drizzle-kit (`db:push`, `db:generate`, `db:migrate`), `db:seed`, `db:reset` (via `dotenv/config`) |

```bash
cp .env.example .env.local
cp .env.example .env
```

Edit **both** files. Minimum values for local work:

```env
DATABASE_URL="postgresql://<user>@localhost:5432/electify_dev"
DIRECT_URL="postgresql://<user>@localhost:5432/electify_dev"
JWT_SECRET="<output of the command below>"
# Leave the Supabase values empty to run without realtime:
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
```

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Check where you are pointing before any database command:

```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log(new URL(process.env.DATABASE_URL).hostname)"
node -e "require('dotenv').config({path:'.env'}); console.log(new URL(process.env.DIRECT_URL||process.env.DATABASE_URL).hostname)"
```

Both should print `localhost`.

## 5. Create the schema and seed data

```bash
npm run db:push        # creates all tables from src/lib/db/schema.ts (new, empty DB only)
npm run db:seed        # SRM hierarchy and development accounts (local only)
npm run db:seed:subjects   # optional: subject explorer content
```

`db:seed` prints the development accounts and passwords it created. They are
for your local database only.

Hand-written migrations `0003`–`0007` describe changes to **existing**
databases. A fresh `db:push` already includes their end state, so you do not
need to apply them to a new local database.

## 6. Run

```bash
npm run dev            # http://localhost:3000
```

Sign in as the seeded root administrator, choose a Year Server, and explore.
Health check: <http://localhost:3000/api/health>.

## 7. Checks before you commit

```bash
npm run lint
npm run typecheck
npm run test:unit
DATABASE_URL=postgresql://localhost:5432/electify_test DIRECT_URL=postgresql://localhost:5432/electify_test npm test
```

Create `electify_test` once with `createdb electify_test` followed by
`DATABASE_URL=postgresql://localhost:5432/electify_test npx drizzle-kit push`.
See [TESTING.md](TESTING.md) for the e2e suite.

## 8. Building next to a running dev server

```bash
NEXT_DIST_DIR=.next-build npm run build
```

`/.next-*/` is git-ignored.

## 9. Common problems

See the troubleshooting table in
[PROJECT_MAINTENANCE_MANUAL.md §13](PROJECT_MAINTENANCE_MANUAL.md#13-troubleshooting).
