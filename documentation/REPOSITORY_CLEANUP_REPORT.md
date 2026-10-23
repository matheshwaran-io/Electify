# Repository Cleanup Report

Date: 23 October 2026 · Base commit: `db3b7d0` (branch `main`)
Scope: read-only audit, then small, reversible changes. Nothing was staged,
committed, pushed, deployed or deleted from Git history.

## 1. Starting state (left exactly as found)

| Path | Git status | Action |
| --- | --- | --- |
| `artifacts/presentation/ELECTIFY_…_Project_Presentation.pptx` | modified | Preserved (owner's PowerPoint save). |
| `artifacts/presentation/~$ELECTIFY_…_Project_Presentation.pptx` | deleted | Preserved as-is. It is an Office lock file that was committed by mistake; committing the deletion is safe. |
| `ELECTIFY_…_Project_Presentation.pptx` (repository root) | untracked | Preserved. It differs from the copy in `artifacts/`; the owner should decide which is canonical. |

## 2. Changes made

| Change | Reason | Reversible by |
| --- | --- | --- |
| Deleted `documentation/final-report/__pycache__/*.cpython-314.pyc` (3 files, ~105 KB) from disk | Python bytecode cache, regenerated automatically; never source | `git checkout -- documentation/final-report/__pycache__` |
| `.gitignore`: added `__pycache__/`, `*.py[cod]`, `~$*` | Stops bytecode and Office lock files being committed again | Remove the lines |
| `.github/workflows/ci.yml`: added `npm run test:unit`; Node version now read from `.nvmrc` (24) instead of a fixed 20 | CI previously ran no tests; Node 20 reached end of life in April 2026 and `.nvmrc` already says 24 | Revert the file |
| Added `documentation/PROJECT_MAINTENANCE_MANUAL.md`, `ARCHITECTURE.md`, `DEVELOPMENT_SETUP.md`, `DEPLOYMENT.md`, `TESTING.md`, this report | Maintainer documentation | Delete the files |
| `README.md`: corrected claims, added safety notes and links to the new docs | Accuracy (see §4) | Revert the file |
| `CONTRIBUTING.md`: setup uses `db:push` instead of the non-working `db:migrate`; `npm test` example targets a local DB; links to new guides | Accuracy and safety | Revert the file |
| Superseded banners on `docs/architecture.md`, `docs/database.md`, `docs/deployment.md`, `docs/development/testing.md` | They recommend commands that are unsafe or outdated (e.g. `db:migrate`) | Remove the banner lines |

The deletions are **not staged**. Git shows them as ` D`; to keep them run
`git rm --cached` (or `git add`) on those paths when you commit.

## 3. Recommended, not done (needs the owner's decision)

### 3.1 Third-party and personal material in a public repository — high priority

| Path | Size (tracked) | Concern |
| --- | --- | --- |
| `documentation/final-report/work/reference.docx` | 1.4 MB | Another team's report ("A Multi-Agent Framework…") naming other students; used only as a formatting reference |
| `documentation/final-report/work/render/ref_render.docx`, `render/ref/` (71 page images), `render/ref_*.png` | ~8.8 MB | Renders of the same third-party report |
| `documentation/final-report/work/refmedia/` | 1.3 MB, 17 files | Media extracted from that report |
| `scripts/fix-mca-genai.ts` | — | 11 real-looking student names and `@srmist.edu.in` addresses |

Suggested (review first):

```bash
git rm -r --cached documentation/final-report/work/reference.docx \
  documentation/final-report/work/render/ref_render.docx \
  documentation/final-report/work/render/ref \
  documentation/final-report/work/refmedia
# then add those paths to .gitignore
```

Untracking only removes them from future commits. **They remain in Git
history** and in any clone or fork. Removing them from history needs a history
rewrite (`git filter-repo`) and a force-push, which is a separate, deliberate
decision.

### 3.2 Large generated report intermediates

`documentation/final-report/work/render/` (other than `ref`), `work/screens/`
and `work/screens_v2/` are about 60 MB of rendered pages and screenshots;
`documentation/final-report/previous/` holds 10 MB of earlier report versions.
They are reproducible outputs or archives. Consider moving them to a release
asset or out of the repository. Kept because the report build may reference them.

### 3.3 Superseded report generator

`documentation/final-report/generate_mca_report.py`, `append_chapters_*.py`,
`generate_diagrams.py`, `generate_all_diagrams.py`, `test_helpers.py` and
`assets/` belong to an older report pipeline (the current one is under
`work/`). Kept: their purpose overlaps with the current pipeline and they may
still be wanted for reference.

### 3.4 Tooling content

`.agents/skills/supabase*` (40 files) and `skills-lock.json` are third-party
AI-agent skill text, unused by the application. `.claude/launch.json` is a
local dev-server launcher. Both are harmless; keep them or untrack them as you prefer.

### 3.5 Database hygiene (hosted development database)

Observed read-only on 23 Oct 2026 — **no changes were made**:

- 3 registration events with `available_seats > max_seats`, and 2 subjects
  (PGI25D03J, PGI25G03T) with 19 confirmed picks for 18 seats. Repair with
  `scripts/db/repair-elective-seat-allocations.sql` after a backup and owner approval.
- 13 tables (`academic_reconciliation_archive`, `re_*`) that are not in
  `schema.ts`. Make sure `db:push` is never run against this database.
- Migration 0007 is applied there.

### 3.6 Code-level safety improvements (not done, behaviour changes)

- Add a host guard to `src/lib/db/reset.ts` (refuse non-local hosts without an explicit flag).
- Add `tablesFilter` to `drizzle.config.ts` so `db:push` ignores foreign tables.
- Change `npm test` so it does not default to `.env.local`, or refuses non-local hosts.
- Require `SETUP_SECRET` for `/api/health?setup=1` in every environment and
  stop returning raw database errors.
- Update the 4 stale integration tests (see [TESTING.md](TESTING.md#known-failures)).
- Add an npm script and rollback for migration 0007.

## 4. README corrections

| Before | After | Evidence |
| --- | --- | --- |
| "Tests: Passing" badge | CI workflow badge | 4 integration tests currently fail; CI runs lint, unit tests, type-check and build |
| Receipts "stored as snapshots at confirmation time" | Issued when the student finalizes (or the window closes) | `finalizeStudentRegistration`, migration 0007 |
| Realtime described as required | Optional | `realtimeConfigured` in `src/lib/supabase.ts` |
| "`npm test` requires active PostgreSQL" | Also warns that it uses `.env.local` and writes rows | `package.json` `test` script |

## 5. Secret scan

A custom scan of all tracked files and of the full Git history (all
reachable commits) looked for private keys, cloud tokens, JWTs, connection
strings with passwords and `.env` files. Results:

- No `.env`, `.pem` or key file has ever been committed.
- 22 matches in tracked files, all placeholders (`.env.example`,
  docs), CI dummy values, or test-only values for throwaway local databases
  (`tests/e2e/fixtures/constants.ts`, `playwright.config.ts`).
- Development passwords printed by `src/lib/db/seed.ts` and the `Admin@12345`
  bootstrap fallback are documented, development-only values. They were
  checked (bcrypt comparison, read-only) and do **not** match the accounts on
  the hosted development database.

This scan is pattern-based and cannot prove the absence of secrets. It did not
use an external scanning service.
