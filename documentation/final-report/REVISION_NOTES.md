# Electify Report — Revision Notes (15 October 2026)

Revised file: `documentation/final-report/Electify_Mini_Project_Report.docx` (70 pages; PDF alongside).
Previous version kept as `previous/Electify_Mini_Project_Report.2026-10-13.docx`.
Sources: `documentation/final-report/work/` (`content_a.py`–`content_d.py`, `build_report.py`); rebuild with `python3 build_report.py`, then update the fields in Word.

No similarity checker was run. Nothing in this document is a similarity or originality score.

## 1. Repository and document audit

| Reviewed | What was checked |
| --- | --- |
| Report (all 11 chapters, front matter, tables, figures, references, appendices) | Every technical claim against the current code (commit `bfd9bd8`) |
| `src/` (actions, `lib/`, proxy, schema, pages) | Features added or changed since the 13 October report: explicit Year Server selection, multi-programme tutors and the class limit, root-administrator protection, production admin bootstrap rule, revoked-session handling, receipt term, monitor and window controls |
| `tests/` (18 server-side suites, 8 browser specs) | Test counts and names; re-run on 15 October |
| `drizzle/`, `drizzle/meta/_journal.json` | Migration claims; `drizzle-kit migrate` behaviour tested on throwaway databases |
| `docs/`, `README.md`, `WINDOWS_SETUP.md`, `docs/qa/` | Consistency with the report |
| Existing similarity report | **None provided** — passages could not be prioritised from checker output |

## 2. Issue report

**Factually out of date (corrected)**
- Abstract and Chapter 8: "105 tests in 14 suites"; now 136 server-side tests in 18 suites plus 36 browser tests.
- §5.2: "If there is exactly one [Year Server], it is selected automatically". Since commit `2ceabe6`, staff always choose. Figure 4.4 showed the same old rule and was redrawn.
- §6.6, §6.8, Chapter 8: receipt example `ELC-2026-EVEN-000048`, `client-ip` audit limitation, "Reconnecting" indicator, monitor "closed" message, countdown failure. All were fixed in the QA pass and are now described as corrected defects.
- Table 8.6 (old): seven defects marked "Open"; six were fixed. The rewritten table lists 14 defects with status.
- Screenshots of the Year Server chooser, Academic Years page, receipt, monitor and others showed the old interface; all 18 were recaptured.
- Not documented before: multi-programme tutor assignment within a department, the administrator's class limit, root-administrator protection, production refusal of the default admin password, revoked-session redirect, responsive-layout and accessibility testing.

**Weakly supported or inaccurate (corrected)**
- §4.6 said the password policy "follows the emphasis of NIST SP 800-63B". Against the current guideline (SP 800-63B-4) it does not fully: it uses an 8-character minimum and requires a letter and a number. The text now states this plainly and Chapter 9 lists alignment as future work.
- §7.3 implied the standard migration path works. `drizzle-kit migrate` fails on databases built with `db:push` and builds only part of the schema on an empty one (verified on throwaway databases); now stated.

**Repetition / possible similarity risk (revised)**
- The single-session explanation appeared in Chapters 2 and 4. Chapter 2 now gives only the general limitation of signed tokens and refers to §4.6.
- The abstract and §9.1 shared a long feature list (detected by comparing eight-word sequences across all chapters). §9.1 was rewritten around the order of a registration.
- The acknowledgement used stock phrasing common to many reports ("right opportunity", "profound gratitude"). It was rewritten in plain, specific wording; the names and designations are unchanged.
- No other paragraph pair shares more than two eight-word sequences. Chapter 2's definitions (relational model, RBAC, bcrypt, JWT) are paraphrased and cited, not quoted.

**Kept unchanged by design:** cover page, bonafide certificate wording, chapter structure, page setup and fonts, which follow the department's reference format.

## 3. Reference audit

All 28 references were checked against publisher, standards-body or bibliographic records on 15 October 2026. Every in-text citation `[1]`–`[28]` has an entry, and every entry is cited.

| Ref | Change |
| --- | --- |
| [6] Silberschatz et al. | Year 2019 → **2020** (copyright year of the 7th edition) |
| [8] Gray & Reuter | Year 1992 → **1993** (catalogued year; released late 1992) |
| [17] Provos & Mazières | Pages 81–91 → **81–92** |
| [18] NIST SP 800-63B (2017) | **Replaced** by SP 800-63B-4 (Temoshok et al., July 2025); the 2017 edition was withdrawn on 1 August 2025. Text updated to match the new requirements. |
| [19] OWASP ASVS 4.0.3 | **Updated** to ASVS 5.0.0 (May 2025) |
| [27] axe-core | **Added** (cited for accessibility testing) |
| [28] WCAG 2.1 | **Added** (cited for accessibility rules) |

Verified unchanged: [1] Gale & Shapley 1962; [2] Budish & Cantillon, *AER* 102(5) 2237–2271; [3] Budish, *JPE* 119(6) 1061–1103; [4] Codd 1970; [5] Chen 1976; [7] Eswaran et al., *CACM* 19(11) 624–633; [9] Berenson et al., SIGMOD 1995 pp. 1–10; [11] Saltzer & Schroeder 1975; [12] Ferraiolo & Kuhn 1992 pp. 554–563; [13] Sandhu et al., *Computer* 29(2) 38–47; [20] RFC 7519.

Online documentation entries [14]–[16], [21]–[26] carry access dates; their pages exist but change over time.

**Still needs your check:** the department may require a different citation style (the reference report used an unnumbered list). Ask your guide before submission.

## 4. Change summary

| Area | Change |
| --- | --- |
| Acknowledgement | Rewritten; same people and order |
| Abstract | New testing paragraph (server-side, browser, layout, accessibility) |
| Ch. 2 | §2.4 rewritten for SP 800-63B-4; §2.5 cites Playwright, axe-core, WCAG |
| Ch. 3 | Table 3.1 roles updated; FR14 added (multi-programme tutors) |
| Ch. 4 | §4.6 revoked-session handling and an honest NIST comparison; §4.7 root administrator; Figure 4.4 redrawn |
| Ch. 5 | §5.2 explicit Year Server choice; §5.3 tutors across programmes and class limit; §5.4 window controls follow the shared rule |
| Ch. 6 | Receipt term from the semester; audit address recorded |
| Ch. 7 | Environment, project structure, migration caveat, picker refresh, optional realtime, production admin bootstrap |
| Ch. 8 | Rewritten from the 15 October evidence: 18 suites, browser tests (§8.5), responsive and accessibility results (§8.6), 14 defects (§8.7), updated limitations |
| Ch. 9 | Conclusion rewritten; future work adds password-policy alignment and defect D7 |
| Ch. 10 | Five reference corrections, two additions |
| Ch. 11 | Browser test list (Table 11.2); demonstration data note; tables renumbered |
| Figures | 18 screenshots recaptured on 15 October with fictional data; Figure 4.4 redrawn |

**Evidence behind the numbers** (in `work/evidence/`):
- `test-run.txt`: 136/136 server-side tests, commit `bfd9bd8`, 15 Oct 2026 15:10 IST.
- `e2e-results.json`: 36/36 browser tests.
- `mobile-audit-report.json`: 154 measurements, 0 overflow.
- `a11y-report.json`: 0 violations.
- `seat-consistency.txt`: seat counts compared with stored choices.
- The 13 October evidence is in `evidence/v1/`.

**New finding during this revision:** with the browser's reduced-motion setting on, the sign-in and join pages log a hydration error. The decorative seat graphic renders differently on the server and in the browser. It is recorded as open defect D7 in the report and in `docs/qa/mobile-first-regression-report.md`. No application code was changed in this revision.

## 5. Verification checklist for you and your guide

- [ ] **Title.** "Electify: A Cohort-Isolated Elective Registration System with Transactional Seat Allocation" was chosen by us, not taken from an approved proposal. Confirm it matches the title registered with the department.
- [ ] **Names and designations.** Guide, Head of Department, Dean, Deputy Dean, Chancellor (taken from the reference report) and the four team members' names and register numbers.
- [ ] **Month and year** on the cover ("October – 2026").
- [ ] **Signatures.** All signature spaces are blank and the report claims no approval.
- [ ] **Citation style.** IEEE numbered style is used; confirm it is accepted.
- [ ] **Declaration.** The reference report had no candidate declaration page; add one if your department requires it.
- [ ] **AI-use disclosure.** SRMIST's current rules for project reports were not available here. Ask your guide whether use of AI tools in writing or coding must be declared, and add a statement if so.
- [ ] **Screenshots.** They show fictional demonstration data and an emulated desktop browser; confirm this is acceptable.
- [ ] **Accuracy sign-off.** The team should read Chapters 5–8 against the running system before submission.

## 6. How to check similarity

1. Submit `Electify_Mini_Project_Report.docx` (or the PDF, if the portal requires it) through the checker your university provides. Ask your guide or the library which one SRMIST uses (Turnitin is a common example); this was not verified here. Use only the institution's account; public "free checkers" may store your text and can later cause matches against your own report.
2. Ask the guide which exclusions apply. Commonly the cover, certificate, acknowledgement, references and code appendices are excluded or filtered, as are quotes and small matches (for example under 10 words).
3. Read the report by source, not just the percentage:
   - Matches to your own earlier drafts or the department's reference template are expected. The guide can exclude them.
   - Matches on technical terms, framework names, standard phrases ("row-level locking") and reference-list entries are normal.
   - A long continuous match to one external source needs attention. Rewrite it from your own understanding of Electify, or quote and cite it.
4. If a passage is flagged, revise the source file in `work/content_*.py` and rebuild, so the DOCX and its sources stay in step.
5. The 80 % originality and under 10 % similarity targets are yours to verify with the official checker; this revision does not guarantee any score.
