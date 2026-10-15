# Electify on Windows — Setup Guide

A step-by-step guide for running Electify on **Windows 10 or Windows 11**, written for someone who has never set the project up before.

- Commands are for **Windows PowerShell 5.1**, which ships with Windows, unless marked otherwise. Run one command per line. PowerShell 5.1 does not support `&&`, so commands are never chained with it.
- No administrator rights are needed, except where an installer asks for them.
- Docker and WSL are **not** required.

> **What has been verified.** The commands in this guide come from the repository's `package.json` and configuration. On 15 October 2026 they were run on **macOS** (Node.js 24.16, npm 11.13): lint, type check, unit tests (12/12), integration tests against a local PostgreSQL (136/136), production build and the full end-to-end suite (36/36). The lockfile was checked for the Windows builds of the native packages (Next.js SWC, Tailwind, lightningcss, sharp, esbuild). They have **not been run on a Windows PC**; §G and §G.4 describe how to confirm them there.

---

## A. Prerequisites

| Tool | Version | Needed for | Download |
| --- | --- | --- | --- |
| Windows | 10 or 11, 64-bit | — | — |
| Git for Windows | any recent | getting the code | <https://git-scm.com/download/win> |
| Node.js (includes npm) | **20.9 or newer**, **24 LTS recommended** (`.nvmrc` says 24). `npm test` needs 22+. | everything | <https://nodejs.org/en/download> (choose the **LTS** Windows Installer `.msi`) |
| Visual Studio Code | any | editing | <https://code.visualstudio.com/> |
| A PostgreSQL database | 14 or newer | the app's data | Local: <https://www.postgresql.org/download/windows/> · or a hosted Supabase project |
| Google Chrome | any | end-to-end tests only (Playwright uses the installed Chrome) | <https://www.google.com/chrome/> |

The project uses **npm** (it has a `package-lock.json`). Do not use Yarn or pnpm.

### Check the installations

Open PowerShell (Start → type *PowerShell*) and run each line. A version number means the tool is installed.

```powershell
git --version
node --version
npm --version
```

`node --version` should print `v20.9.0` or higher (ideally `v24.x`). If PowerShell says *"is not recognized"*, see §H.1.

If you will use a **local** PostgreSQL, also check its tools (installed with PostgreSQL, see §E.1):

```powershell
psql --version
```

---

## B. Download the project

Use a short folder outside OneDrive, for example `C:\dev`. OneDrive syncing `node_modules` is slow and can lock files.

```powershell
New-Item -ItemType Directory -Force C:\dev | Out-Null
Set-Location C:\dev
git clone https://github.com/matheshwaran-io/Electify.git
Set-Location C:\dev\Electify
```

The repository may be private. If Git asks you to sign in, use a GitHub account that has access.

**If the folder path contains spaces**, put it in quotes:

```powershell
Set-Location "C:\Users\Your Name\Projects\Electify"
```

**Confirm you are in the project root.** Both lines must print `True`:

```powershell
Test-Path package.json
Test-Path src\app
```

**Open in VS Code:** run `code .` in that folder, or use *File → Open Folder…*. Open a terminal inside VS Code with *Terminal → New Terminal* (`` Ctrl+` ``); it starts in the project root.

---

## C. Install dependencies

```powershell
npm ci
```

`npm ci` installs exactly what `package-lock.json` records. It is the reproducible choice. The repository's `.npmrc` sets `legacy-peer-deps=true`, which npm applies automatically.

**Success looks like** `added NNN packages in …s` with no `npm ERR!` lines. `npm warn deprecated …` lines are normal.

Use `npm install` only when you intend to add or change a dependency, because it may update `package-lock.json`.

### If installation fails

Try these in order. **Do not delete `package-lock.json`.**

| Message | Meaning | Fix |
| --- | --- | --- |
| `npm.ps1 cannot be loaded because running scripts is disabled` | PowerShell's execution policy blocks npm's PowerShell launcher | Use `npm.cmd ci` (and `npm.cmd run …` afterwards). That needs no policy change. Optionally, for your user only: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| `npm ERR! code ENOENT … package.json` | Wrong folder | `Set-Location C:\dev\Electify`, then `Test-Path package.json` |
| `npm ci can only install packages when your package.json and package-lock.json are in sync` | `package.json` was edited without updating the lockfile | Run `npm install` once, then tell the team. Do not delete the lockfile. |
| `EBADENGINE` / Next.js says Node is too old | Node older than 20.9 | Install Node.js 24 LTS and open a new terminal |
| `ETIMEDOUT`, `ECONNRESET`, `self-signed certificate in certificate chain` | Network, proxy or firewall | Retry on another network, or set the proxy: `npm config set proxy http://host:port` and `npm config set https-proxy http://host:port`. Do not disable SSL checks. |
| `EPERM` / `EBUSY: resource busy or locked` | A file in `node_modules` is locked by an editor, antivirus, OneDrive or a running dev server | Stop `npm run dev` (Ctrl+C), close other terminals, then run `npm ci` again |
| errors mentioning `sharp` or `@img/sharp-win32` | Image library binaries (installed with Next.js) | Check `node -p "process.arch"` prints `x64` or `arm64` (64-bit Node), then run `npm ci` again |

Only if a retry still fails, remove the dependency folder and reinstall from the lockfile:

```powershell
Remove-Item -Recurse -Force node_modules
npm ci
```

---

## D. Configure environment variables

Electify reads its settings from **two** git-ignored files in the project root. Both are created from `.env.example`:

| File | Read by |
| --- | --- |
| `.env.local` | Next.js (`npm run dev`, `build`, `start`); `npm test`; `npm run db:migrate:*`; `npm run db:seed:subjects` |
| `.env` | drizzle-kit (`npm run db:push`, `db:generate`, `db:migrate`); `npm run db:seed`; `npm run db:reset` |

Create both, then open them:

```powershell
Copy-Item .env.example .env.local
Copy-Item .env.example .env
code .env.local
```

Put the **same values** in both files. Windows can hide file extensions, so check the real names:

```powershell
Get-ChildItem -Force -Name .env*
```

You must see `.env`, `.env.example` and `.env.local`. If you see `.env.local.txt`, rename it: `Rename-Item .env.local.txt .env.local`.

### Variables

| Variable | Required? | Exposure | What it is / where to get it |
| --- | --- | --- | --- |
| `DATABASE_URL` | **Yes** | server only | PostgreSQL connection string used by the app. Local: `postgresql://postgres:<password>@localhost:5432/electify`. Supabase: *Connect → Transaction pooler* (port 6543). |
| `DIRECT_URL` | Yes for schema commands | server only | Connection used by drizzle-kit. Local: same as `DATABASE_URL`. Supabase: *Connect → Session pooler* (port 5432) or direct connection. Falls back to `DATABASE_URL`. |
| `JWT_SECRET` | **Yes** | server only | Signs session cookies. At least 32 random characters. Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `SETUP_SECRET` | Production only | server only | Authorises the one-time admin bootstrap at `/api/health?setup=true` in production |
| `INITIAL_ADMIN_PASSWORD` | Production only | server only | Password for that bootstrapped root admin. Production refuses to bootstrap without it. |
| `NEXT_PUBLIC_APP_URL` | Optional | public | Canonical site URL used for metadata. Locally: `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | public | Supabase project URL, enables live seat updates. Without it the app works, but pages don't update live. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | public | Supabase public key for realtime. Supabase → *Project Settings → API Keys* |

The test-only variables `E2E_DATABASE_URL`, `E2E_PORT` and `PGPASSWORD` are described in §G.3. Variables starting with `NEXT_PUBLIC_` are sent to the browser; never put a secret in one.

**Rules:**
- Never commit `.env` or `.env.local`; Git already ignores them.
- Never paste their contents into chat, issues or screenshots.
- After changing a `NEXT_PUBLIC_` value, restart `npm run dev`.

---

## E. Configure the database

Choose **one** option.

### E.1 Local PostgreSQL (recommended for development)

1. Install PostgreSQL from <https://www.postgresql.org/download/windows/> (EDB installer). Remember the password you set for the `postgres` user. Keep the default port `5432`.
2. Add PostgreSQL's tools to your PATH for the current user (adjust `16` to your version):

   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Program Files\PostgreSQL\16\bin", "User")
   ```

   Close and reopen the terminal, then check with `psql --version`.
3. Create an empty database (it asks for the `postgres` password):

   ```powershell
   createdb -U postgres electify
   ```

4. In **both** `.env.local` and `.env`, set:

   ```
   DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/electify"
   DIRECT_URL="postgresql://postgres:<your-password>@localhost:5432/electify"
   ```

5. Create the tables from the schema, then load the starter data:

   ```powershell
   npm run db:push
   npm run db:seed
   ```

   `db:push` builds the current schema (`src/lib/db/schema.ts`) in the empty database; the end-to-end tests use the same method. `db:seed` creates the SRM faculty/department/programme hierarchy, the root administrator and core staff accounts, and default settings. It prints the accounts and **development** passwords it created (for example `electify@srmist.edu.in / Admin@12345`). These passwords are public knowledge, so use them only on a local database.

### E.2 Hosted database (Supabase or the team's shared database)

- Get `DATABASE_URL` (pooled, port 6543) and `DIRECT_URL` from the project owner or Supabase → *Connect*. Remote connections use SSL automatically.
- **A shared database already has its schema. Do not run `db:push`, `db:seed`, `db:reset`, `db:clean` or `fix:passwords` against it.**
- Schema changes to an existing database go through the reviewed, hand-written SQL migrations, after taking a backup. Each runs in one transaction and changes nothing if it fails. Run only the ones the project owner tells you are pending:

  ```powershell
  npm run db:migrate:remove-waitlist
  npm run db:migrate:subject-profiles
  npm run db:migrate:academic-sessions
  ```

- **Do not use `npm run db:migrate`** (drizzle-kit's migrator) for these databases, even though `docs/database.md` lists it. Its migration list only covers the first three generated files (`drizzle/0000`–`0002`). On a database built with `db:push` it stops with an error, and on an empty database it creates only part of the schema. Both were checked on a throwaway local database.

### Commands that change or delete data

| Command | Effect |
| --- | --- |
| `npm run db:reset` | **Drops the entire `public` schema (all data)** in the database in `.env` |
| `npm run db:clean` | Deletes mock/demo data |
| `npm run fix:passwords` | **Resets every student's password to their register number** |
| `npm run db:push` | Changes the schema to match the code; may drop columns |
| `npm test` | Writes test records to the database in `.env.local` |

Before running any of these, check which database your `.env` / `.env.local` points to. Never run them against production or real student data.

---

## F. Start Electify

1. Open PowerShell or the VS Code terminal in the project root (`Test-Path package.json` prints `True`).
2. Install dependencies (first time, or after `package-lock.json` changes): `npm ci`
3. Make sure `.env.local` and `.env` exist and the database is ready (§D, §E).
4. Start the development server:

   ```powershell
   npm run dev
   ```

5. Wait for output like:

   ```
   ▲ Next.js 16.x (Turbopack)
   - Local:        http://localhost:3000
   ✓ Ready in 2.1s
   ```

6. Open **<http://localhost:3000>**. You are sent to the sign-in page (`/login`). The first visit to each page compiles it and can take a few seconds.
7. **Stop** the server: press **Ctrl+C** in that terminal (answer `Y` if asked *Terminate batch job?*).
8. **Restart**: run `npm run dev` again. Restart after changing `.env.local` or `next.config.ts`.

If port 3000 is busy, Next.js offers or picks another port and prints it, or you can choose one: `npm run dev -- -p 3001`.

### Production build, run locally

Stop `npm run dev` first; both use the `.next` folder.

```powershell
npm run build
npm run start
```

`npm run build` must end with a route table and no errors. `npm run start` serves the built app at <http://localhost:3000>.

---

## G. Testing and verification

### G.1 Checks that need no database

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Expected: lint and type check finish without errors, the unit tests report `fail 0`, and the build prints a route table.

### G.2 Integration tests (`npm test`)

`npm test` runs every `tests/*.test.ts` against the database in **`.env.local`** and writes test records. Point `.env.local` at a **local** database first (§E.1). Requires Node.js 22+ (the test runner expands the quoted file pattern itself, so it behaves the same in PowerShell, cmd and bash).

```powershell
npm test
```

### G.3 End-to-end tests (`npm run test:e2e`)

Playwright drops and recreates a throwaway **local** database named `electify_e2e`, seeds synthetic accounts, starts its own server on port **3210** and uses your installed **Google Chrome**. It refuses to run against any non-local database.

Requirements: local PostgreSQL running, its `bin` folder on PATH (§E.1), and Google Chrome installed. The test runner does not read `.env` files, so set these in the terminal first (same window):

```powershell
$env:PGPASSWORD = "<your local postgres password>"
$env:E2E_DATABASE_URL = "postgresql://postgres@localhost:5432/electify_e2e"
npm run test:e2e
```

To run a single file: `npx playwright test tests/e2e/session.spec.ts`.

### G.4 Manual checklist (use local or seeded data only, never real student data)

| Area | Steps | Expected |
| --- | --- | --- |
| Sign-in | `/login` with a seeded staff account | Staff are asked to choose an academic Year Server, then see the staff dashboard |
| Root admin | Sign in as `electify@srmist.edu.in` (seed password on a local DB) | Admin pages work (users, invites, settings, audit) |
| Staff onboarding | Admin creates an invite code; open it in a private window and sign up | New staff account with the invited role |
| Student onboarding | Tutor issues a class signup code; student uses `/join` | Student account attached to that class |
| Registration window | Create an event for a class; open the window | Students see it; before opening, they see a countdown |
| Elective selection | As a student, choose subjects and confirm | One confirmation; seat counts drop; a double click does not create a duplicate |
| Locking / closing | Close the window or pass the deadline | Students can no longer change choices |
| Reports | Staff reports page; download PDF | Export opens |
| Mobile | Browser dev tools (F12) → device toolbar | Layout fits without horizontal scrolling |

---

## H. Troubleshooting

### H.1 `node` / `npm` not recognized

```powershell
Get-Command node, npm
$env:Path -split ";" | Select-String nodejs
```

No output means Node.js isn't installed or the terminal was opened before installing. Install the LTS `.msi`, **close all terminals and VS Code**, and open a new one.

### H.2 Port already in use

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object OwningProcess
Get-Process -Id <OwningProcess>
```

If it's an old `node` dev server, stop it in its own terminal with Ctrl+C, or `Stop-Process -Id <OwningProcess>`. Or run on another port: `npm run dev -- -p 3001`. The end-to-end server uses port 3210.

### H.3 Missing environment variables

Symptoms: `DATABASE_URL is not set`, `DIRECT_URL or DATABASE_URL must be set`, or a JWT secret warning.

```powershell
Get-ChildItem -Force -Name .env*
Select-String -Path .env.local -Pattern "^DATABASE_URL=", "^JWT_SECRET="
```

The second command shows whether the lines exist; avoid sharing its output because it contains values. Both `.env.local` and `.env` must exist (§D). Restart `npm run dev` after edits.

### H.4 Dependency installation failures

See the table in §C. Read the **first** `npm ERR!` line; later lines are usually consequences.

### H.5 Import casing errors (`Module not found` only on some machines)

Windows ignores letter case in file names but Linux (CI, Vercel) does not, so `@/components/Button` and `button.tsx` work on Windows yet fail there. Make every import match the file name exactly; check with `Get-ChildItem src -Recurse -Filter "*button*"`. (All current imports were checked and match.)

### H.6 TypeScript errors

```powershell
npm run typecheck
```

Fix the first error at the file and line shown. Restart the TypeScript server in VS Code (*Ctrl+Shift+P → TypeScript: Restart TS Server*) if the editor and the command disagree.

### H.7 PowerShell syntax errors

| You typed | Problem | Use instead |
| --- | --- | --- |
| `cp a b && npm run dev` | `&&` is not valid in PowerShell 5.1 | two lines, or `;` |
| `export JWT_SECRET=…` | bash syntax | `$env:JWT_SECRET = "…"` (current window only) |
| `rm -rf node_modules` | bash syntax | `Remove-Item -Recurse -Force node_modules` |
| `cat .env` | prints secrets | don't; open the file in VS Code instead |

### H.8 Database connection failures

```powershell
Test-NetConnection localhost -Port 5432
psql "postgresql://postgres@localhost:5432/electify" -c "select 1"
```

| Message | Fix |
| --- | --- |
| `ECONNREFUSED 127.0.0.1:5432` / `TcpTestSucceeded : False` | PostgreSQL isn't running: *Services* → start **postgresql-x64-NN** |
| `password authentication failed` | Wrong password in the URL. Percent-encode special characters (`@` as `%40`, `#` as `%23`) |
| `database "electify" does not exist` | `createdb -U postgres electify` |
| `getaddrinfo ENOTFOUND db.<ref>.supabase.co` | The direct Supabase host is IPv6-only on many networks; use the pooler connection string |
| Timeouts to Supabase | Project paused, or the network blocks ports 5432/6543 |

### H.9 Failed migrations

- `drizzle-kit` errors such as `url: ''` mean `.env` (not `.env.local`) is missing or has no `DIRECT_URL`/`DATABASE_URL`.
- `npm run db:migrate:*` scripts run inside one transaction and print *"Failed, nothing was changed"* on error. Read the SQL error, fix the cause, and rerun.
- Never "fix" a migration by running `db:reset` on a database that holds real data.

### H.10 File permission problems (`EPERM`, `EBUSY`, `EACCES`)

Usually a locked file. Stop dev servers (Ctrl+C), close extra terminals and editors that have the folder open, pause OneDrive, or move the project to `C:\dev`. Avoid running terminals "as Administrator"; files created that way can be locked for normal use.

### H.11 Native dependency or compilation errors

The project needs no C/C++ compiler. bcrypt is the pure-JavaScript `bcryptjs`, and `pg` runs without its native addon. The only native package is `sharp` (installed with Next.js), and it downloads prebuilt Windows binaries. If an error mentions `node-gyp` or Visual Studio Build Tools, check you are on 64-bit Node.js LTS and run `npm ci` again; you should not need to install build tools.

### H.12 The application doesn't start

1. Read the first error in the `npm run dev` terminal.
2. `npm run typecheck`: a type error can stop compilation.
3. Check §H.3 (environment) and §H.8 (database).
4. Delete only the build cache, then start again (this is safe; it is regenerated):

   ```powershell
   Remove-Item -Recurse -Force .next
   npm run dev
   ```

---

## I. Daily development workflow

```powershell
Set-Location C:\dev\Electify
git pull
npm ci
npm run dev
```

Run `npm ci` only when `package-lock.json` changed. Before committing:

```powershell
npm run lint
npm run typecheck
npm run test:unit
git status
git add <the files you changed>
git commit -m "describe the change"
```

`git status` should never list `.env` or `.env.local`; they are ignored. Line endings are handled by `.gitattributes` (LF in the repository), so no Git `core.autocrlf` setting is needed.
