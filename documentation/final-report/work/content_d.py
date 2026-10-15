"""Chapters 8–11."""
import re
from docx.enum.text import WD_ALIGN_PARAGRAPH

F = "figures/"
S = "assets/screens/"
REPO = "/Users/maddy/Current Project/Electify/"
EVID = "evidence/"

SUITES = [
    ("tests/academic-sessions.test.ts", "Academic sessions and cohort-isolated registration"),
    ("tests/academic-sessions-migration.test.ts", "Migration 0006: academic sessions and cohort targeting"),
    ("tests/class-student-onboarding.test.ts", "Class-Based Student Self-Onboarding and Password Security"),
    ("tests/event-delete-and-reset.test.ts", "Event Management: Delete Event & Reset Registrations"),
    ("tests/live-monitor.test.ts", "Live Event Registration Monitor & Surveillance Module"),
    ("tests/multi-programme-tutor.test.ts", "Multi-Programme Class Tutor Assignments & Isolation"),
    ("tests/password-policy.test.ts", "Student password policy"),
    ("tests/qa-regressions.test.ts", "Receipt term (QA: receipts for odd semesters were numbered EVEN)"),
    ("tests/qa-regressions.test.ts", "Staff window phase follows the student window rule (QA: no Pause for an open published event)"),
    ("tests/registration-modifications.test.ts", "Registration changes, cancellations and capacity (no waitlist)"),
    ("tests/remove-waitlist-migration.test.ts", "Migration 0004: remove waitlist"),
    ("tests/role-based-invite-codes.test.ts", "Role-Based Unique Invite Codes"),
    ("tests/subject-explorer.test.ts", "Subject explorer and preview mode"),
    ("tests/subject-explorer.test.ts", "Subject content validation"),
    ("tests/subject-explorer.test.ts", "Registration window rule"),
    ("tests/template-role-deletion.test.ts", "Role-Based Event Template Deletion & Access Controls"),
    ("tests/year-server-selection-flow.test.ts", "Year Server Selection Flow & Complete Workspace Isolation"),
    ("tests/year-servers.test.ts", "Year Servers System — Simplified Annual Workspaces"),
]

E2E_GROUPS = [
    ("route-reload.spec.ts", "Route inventory: direct navigation and reload for every important page and role; protected routes without a session"),
    ("student-workflow.spec.ts", "Complete student journey with database assertions after each step"),
    ("staff-isolation.spec.ts", "Year Server and class restoration, forged class cookie, configuration change, cohort isolation, URL tampering"),
    ("session.spec.ts", "Sign-out and Back, tampered cookie, superseded and deactivated sessions, double submission, audit address"),
    ("freshness.spec.ts", "Picker seat counts follow new server data without a reload"),
    ("mobile-layout.spec.ts", "22 pages at 7 screen sizes: overflow, navigation pattern, countdown fit"),
    ("accessibility.spec.ts", "axe-core WCAG 2.0/2.1 A and AA rules on 15 pages at desktop and phone width"),
    ("navigation-a11y.spec.ts", "Keyboard and focus behaviour of the phone and tablet navigation"),
]


def parse_run():
    """Suite -> list of (passed, name) from the recorded spec-reporter output."""
    out, cur = {}, None
    for line in open(EVID + "test-run.txt", encoding="utf-8"):
        line = line.rstrip("\n")
        m = re.match(r"^▶ (.*)$", line)
        if m:
            cur = m.group(1); out[cur] = []; continue
        m = re.match(r"^  ([✔✖]) (.*?) \([\d.]+ms\)$", line)
        if m and cur:
            out[cur].append((m.group(1) == "✔", m.group(2)))
    meta = open(EVID + "test-run-meta.txt").read().split("\n")
    summary = {k: v for k, v in re.findall(r"^ℹ (\w+) (\S+)$", open(EVID + "test-run.txt", encoding="utf-8").read(), re.M)}
    return out, meta, summary


def excerpt(path, ranges):
    lines = open(REPO + path, encoding="utf-8").read().split("\n")
    parts = []
    for a, b in ranges:
        parts.append("\n".join(lines[a - 1:b]))
    return "\n    // …\n".join(parts)


def parse_e2e():
    """(file, title, status) for every test in the recorded Playwright JSON report."""
    import json
    data = json.load(open(EVID + "e2e-results.json", encoding="utf-8"))
    out = []

    def walk(suite, file, prefix):
        file = suite.get("file") or file
        for spec in suite.get("specs", []):
            for t in spec.get("tests", []):
                status = t["results"][-1]["status"] if t.get("results") else "not run"
                out.append((file.split("/")[-1], " › ".join(prefix + [spec["title"]]), status))
        for child in suite.get("suites", []):
            walk(child, file, prefix + ([child["title"]] if child.get("title") and not child["title"].endswith(".ts") else []))

    for s in data["suites"]:
        walk(s, s.get("file", ""), [])
    stats = data.get("stats", {})
    return out, stats


def chapter8(R):
    runs, meta, summary = parse_run()
    e2e, e2e_stats = parse_e2e()
    total = int(summary["tests"]); passed = int(summary["pass"]); failed = int(summary["fail"])
    e2e_total = len(e2e); e2e_passed = sum(1 for _, _, st in e2e if st == "passed")
    c = WD_ALIGN_PARAGRAPH.CENTER
    R.heading("8. TESTING AND RESULTS", 1)
    R.heading("8.1 Testing Methodology", 2)
    for t in [
        "Electify was tested at three levels. Server-side tests call the application's Server Actions and domain functions directly and then inspect the database. Browser tests drive the running application in Google Chrome as a student or member of staff would, and check both what the page shows and what the database contains afterwards. Static checks with the TypeScript compiler and ESLint run over the whole code base. In addition, the interface was walked through with fictional demonstration data, which is how the screenshots in this report were captured.",
        "Both automated levels use a real PostgreSQL database rather than mocks, because the properties that matter most — row locking, constraints and transactions — exist only in a real database. Server-side tests build their own fixtures through `tests/helpers/world.ts`, tag every row with a unique suffix, use academic years far in the future (for example 2095–2097) so that they cannot collide with other data, and remove their rows afterwards; the migration tests run each SQL migration and its rollback inside a temporary schema. The browser tests start from a database that is dropped, recreated from the schema and filled with synthetic fixtures before every run, and a guard refuses to run them against anything other than that local database.",
        "Concurrency is tested by starting several Server Action calls at once from the test process. Each call takes its own connection from the pool, so the transactions really do overlap inside PostgreSQL and compete for the same row locks. This exercises the locking logic, but it is not a load test: the number of simultaneous requests is small and no performance measurements are claimed.",
    ]:
        R.para(t)
    R.heading("8.2 Test Environment", 2)
    R.para("The runs reported in this chapter used the environment in Table 8.1. All databases were local and separate from the team's shared development database.", after=8)
    R.table("Table 8.1 | Test Environment for the Reported Runs", ["Item", "Details"], [
        ["Date of runs", f"{meta[0]} (server-side); browser suite on the same day"],
        ["Code version", f"Git commit {meta[2]}"],
        ["Runtime", f"Node.js {meta[1].lstrip('v')}; server-side tests with tsx and the node:test runner, run one file at a time"],
        ["Browser tests", "Playwright 1.64 with the locally installed Google Chrome; isolated development server on port 3210"],
        ["Databases", "PostgreSQL 18.4 on localhost: electify_report (server-side) and electify_e2e (browser, recreated each run)"],
        ["Commands", "npm test with DATABASE_URL pointing to the local database; npm run test:e2e"],
        ["Exit status", f"server-side {meta[3].replace('exit=', 'exit code ')}; browser suite exit code 0"],
    ], widths=[1.8, 4.8], bold_first=True)
    R.heading("8.3 Server-Side Test Suites", 2)
    R.para(f"Table 8.2 lists the eighteen server-side suites and their results. All {total} tests passed and {failed} failed; none were skipped. The complete list of test names is in Appendix 11.3.", after=8)
    rows = []
    for i, (file, suite) in enumerate(SUITES, start=1):
        tests = runs.get(suite, [])
        rows.append([str(i), suite, file.replace("tests/", ""), str(len(tests)), str(sum(1 for p, _ in tests if p)), str(sum(1 for p, _ in tests if not p))])
    rows.append(["", "Total", "", str(total), str(passed), str(failed)])
    R.table("Table 8.2 | Server-Side Test Suites and Results", ["No.", "Suite", "File", "Tests", "Passed", "Failed"], rows,
            widths=[0.4, 2.9, 2.0, 0.55, 0.6, 0.55], size=9, align_cols={0: c, 3: c, 4: c, 5: c})

    def res(suite, prefix):
        for p, name in runs[suite]:
            if name.startswith(prefix):
                return "Passed" if p else "Failed"
        raise KeyError(prefix)
    O = "Class-Based Student Self-Onboarding and Password Security"
    M = "Registration changes, cancellations and capacity (no waitlist)"
    A = "Academic sessions and cohort-isolated registration"
    X = "Subject explorer and preview mode"
    W = "Registration window rule"
    Y = "Year Servers System — Simplified Annual Workspaces"
    P = "Multi-Programme Class Tutor Assignments & Isolation"
    T = "Role-Based Event Template Deletion & Access Controls"
    L = "Live Event Registration Monitor & Surveillance Module"
    E = "Event Management: Delete Event & Reset Registrations"
    R.heading("8.4 Functional, Concurrency and Access-Control Test Cases", 2)
    R.para("Tables 8.3 to 8.5 show representative cases from these suites. The names are those used in the code, the expected behaviour summarises what each test asserts, and the result is the one recorded in the reported run.", after=8)
    R.table("Table 8.3 | Representative Functional Test Cases", ["ID", "Test case", "Expected behaviour", "Result"], [
        ["TC01", "Student signup with a class code", "Account created with a hashed password; class and cohort taken from the code, not from the form.", res(O, "5.")],
        ["TC02", "Duplicate register number or e-mail", "A second signup with the same register number or e-mail is rejected.", res(O, "6.")],
        ["TC03", "Student sign-in", "Students sign in with register number and password only.", res(O, "7.")],
        ["TC04", "Tutor-authorised password reset", "Request, tutor authorisation and new password complete in sequence.", res(O, "10.")],
        ["TC05", "Browse subjects before opening", "Catalogue visible before the window opens; opening a subject reserves nothing.", res(X, "1.")],
        ["TC06", "Submit before opening time", "The server rejects a submission made before the window opens.", res(X, "4.")],
        ["TC07", "Window opening boundary", "The window opens exactly at the opening time, not a millisecond earlier.", res(W, "Opens exactly")],
        ["TC08", "Register for a full subject", "Rejected with SEAT_TAKEN; no records are created.", res(M, "3.")],
        ["TC09", "Change to a subject with seats", "The seat moves to the new subject in one step.", res(M, "1.")],
        ["TC10", "Change to a full subject", "Change rejected; the student keeps the current seat.", res(M, "2.")],
        ["TC11", "Cancel one choice", "Seat released; the choice is kept with status CANCELLED.", res(M, "4.")],
        ["TC12", "Change after the deadline", "Modification rejected and nothing changes.", res(M, "6.")],
        ["TC13", "Receipt identity", "Receipts and reports carry the full class, cohort and Year Server.", res(A, "10.")],
        ["TC14", "Tutor with classes in two programmes", "One tutor manages MCA F and MSc IT F with separate rosters.", res(P, "1.")],
    ], widths=[0.55, 1.8, 3.45, 0.8], size=9.5, align_cols={0: c, 3: c})
    R.table("Table 8.4 | Concurrency and Integrity Test Cases", ["ID", "Test", "Expected behaviour", "Result"], [
        ["CI01", "Concurrent registrations for the last seat", "Exactly one succeeds; the others receive SEAT_TAKEN; seats end at 0; one confirmed row.", res(M, "8.")],
        ["CI02", "Concurrent changes into the last seat", "Exactly one change succeeds; the others keep their original seats.", res(M, "9.")],
        ["CI03", "Concurrent registration across a cohort event", "Capacity is never exceeded; one confirmed choice holds the seat.", res(A, "9.")],
        ["CI04", "Repeated cancellation", "A retried cancellation does not release the seat twice.", res(M, "10.")],
        ["CI05", "Failed multi-group registration", "If one basket fails, the whole registration rolls back.", res(M, "11.")],
        ["CI06", "Simultaneous confirmations", "No two confirmations share a receipt number.", res(M, "13.")],
        ["CI07", "Signup code activation limit", "Enrolment is refused once the code's limit is reached.", res(O, "9.")],
        ["CI08", "Independent seat counters", "The same subject offered to two cohorts keeps separate counts.", res(A, "8.")],
    ], widths=[0.55, 2.0, 3.25, 0.8], size=9.5, align_cols={0: c, 3: c})
    R.table("Table 8.5 | Access Control and Isolation Test Cases", ["ID", "Test", "Result"], [
        ["AC01", "A student cannot see or register for another cohort's event.", res(A, "6.")],
        ["AC02", "Crafted requests cannot bypass class targeting or mix offerings.", res(A, "7.")],
        ["AC03", "A signup code never moves an existing student to another cohort.", res(A, "12.")],
        ["AC04", "Staff cannot reach classes, sessions, events, students or reports outside their scope.", res(A, "13.")],
        ["AC05", "A tutor cannot claim classes outside their department.", res(P, "4.")],
        ["AC06", "The administrator's limit on classes per tutor is enforced by the server.", res(P, "5.")],
        ["AC07", "A tutor cannot open an unassigned class of the same department.", res(P, "9.")],
        ["AC08", "A tutor cannot see, authorise or reject resets for another section.", res(O, "14.")],
        ["AC09", "Repeated wrong passwords trigger a temporary lockout.", res(O, "8.")],
        ["AC10", "Students and tutors cannot delete event templates.", res(T, "2.")],
        ["AC11", "Unauthorised users cannot read live monitoring data.", res(L, "1.")],
        ["AC13", "Unauthorised users cannot reset or delete registration events.", res(E, "1.")],
        ["AC12", "Non-administrators cannot delete a Year Server.", res(Y, "8.")],
    ], widths=[0.6, 5.2, 0.8], size=9.5, align_cols={0: c, 2: c})

    R.heading("8.5 Browser End-to-End Tests", 2)
    for t in [
        "The browser tests use Playwright [26] and live in `tests/e2e`. Before each run a global set-up step drops the local test database, recreates it from the schema and seeds synthetic fixtures: an administrator, a coordinator, a tutor who teaches MCA F of the 2025 and 2026 cohorts and MSc IT F, a second tutor, students in each class, an open Semester 3 event for MCA, an open event for MSc IT offering a subject with the same name, and an event that opens in the future. All accounts use the reserved domain example.test.",
        "A shared helper records every browser console error, uncaught exception and server error during a test, and any of them fails the test. Waits are tied to visible content or to the network becoming idle rather than to fixed delays, and database queries confirm the outcome of each workflow. Table 8.6 summarises the eight test files.",
    ]:
        R.para(t)
    per_file = {}
    for f, _, st in e2e:
        per_file.setdefault(f, []).append(st)
    rows = [[f, desc, str(len(per_file.get(f, []))), str(sum(1 for s in per_file.get(f, []) if s == "passed"))] for f, desc in E2E_GROUPS]
    rows.append(["Total", "", str(e2e_total), str(e2e_passed)])
    R.table("Table 8.6 | Browser End-to-End Test Files and Results", ["File", "What it checks", "Tests", "Passed"], rows,
            widths=[1.7, 3.6, 0.6, 0.7], size=9.5, align_cols={2: c, 3: c})
    for t in [
        "The route test opens each page of the inventory by its address, waits for its main content, reloads it and checks the content again for students, tutors, coordinators and administrators; it also confirms that eight protected addresses answer an unauthenticated request with a redirect to the sign-in page rather than any content. The student workflow signs in, reloads, browses subjects, keeps its picks across a reload, registers, reloads the receipt, presses Back, changes one subject and cancels another, and after each step compares the page with the seat counters and choices stored in the database. The staff tests check that the selected Year Server and class survive reloads, that a forged class cookie is ignored, and that pausing a window persists across a reload and is seen by a student.",
    ]:
        R.para(t)

    R.heading("8.6 Responsive Layout and Accessibility", 2)
    for t in [
        "Phones are the most likely device for many students, so layout was checked at seven representative sizes from 320 × 568 to 1440 × 900 pixels. For each of 22 pages and each size, the test measures any horizontal overflow of the page and of the staff shell's scrolling area, names the elements that cause it, and checks the navigation pattern expected at that width: a bottom bar on phones, a drawer on tablets and a sidebar on wider screens. These sizes are representative browser dimensions, not a guarantee for every device.",
        "The first audit found eleven overflow failures on five pages and two problems that the measurement could not see: countdown digits clipped by their container on phones, and page headers whose actions squeezed the title into a single-word column on tablets. Table 8.7 lists them with their corrections. After the corrections, none of the 154 measurements showed overflow.",
    ]:
        R.para(t)
    R.table("Table 8.7 | Responsive Layout Problems Found and Corrected", ["Page", "Widths", "Problem found", "Correction"], [
        ["Subject list and detail", "320–390", "Header row 23–93 px wider than the screen", "Logo mark only on phones; narrower links; icon-only sign-out"],
        ["Live monitor", "320–390", "Event selector 13–83 px too wide", "Full-width selector on phones"],
        ["Year Servers", "320", "Cards 4 px too wide", "Title row wraps; smaller padding"],
        ["Join page", "320", "Decorative mark 2 px too wide", "Negative margin only on wider screens"],
        ["Countdown", "320–430", "Timer digits clipped", "Digits scale with screen width"],
        ["Pages with several actions", "640–1023", "Title squeezed into a narrow column", "Shared page header stacks below 1024 px"],
    ], widths=[1.4, 0.8, 2.1, 2.3], size=9.5)
    R.para("Accessibility was checked with axe-core [27] against the WCAG 2.0 and 2.1 level A and AA rules [28] on 15 pages, each at desktop and phone width. The first run reported the three problems in Table 8.8; after the corrections it reported no violations of any severity. Keyboard and focus behaviour of the compact navigation was tested separately: the phone menu and the tablet drawer open from the keyboard, close with Escape and return focus to their button, and the bottom-bar targets are at least 44 pixels tall. Automated checks cannot judge everything; use with a screen reader was not tested.", after=8)
    R.table("Table 8.8 | Accessibility Problems Found and Corrected", ["Rule (impact)", "Where", "Correction"], [
        ["select-name (critical)", "Two drop-down lists on the live monitor had no accessible name", "Labels added"],
        ["color-contrast (serious)", "A pulsing badge faded its own text; faded counts on the Year Servers tabs", "Pulse removed from the text; counts use the muted text colour"],
        ["definition-list, dlitem (serious)", "Countdown summary wrapped its terms in extra elements", "Icons moved inside the terms, same appearance"],
    ], widths=[1.8, 2.8, 2.0], size=9.5)

    R.heading("8.7 Defects Found and Corrected", 2)
    for t in [
        "Building the tests above, and walking through the interface, revealed the defects in Table 8.9. Each defect except D7 was reproduced, traced to a cause, corrected with the smallest change that addressed the cause, and, where the environment allowed, covered by a test that was confirmed to pass afterwards. D7 was found and traced to its cause while the screenshots for this report were being captured; it is not yet corrected and is listed in Chapter 9. D8 was a security defect: a member of staff or a student whose session had been replaced by a sign-in elsewhere, or whose account had been deactivated, could still load protected pages, because the code that should have rejected the session failed while trying to delete cookies and fell back to a weaker check.",
    ]:
        R.para(t)
    R.table("Table 8.9 | Defects Found and Corrected", ["ID", "Defect", "Cause", "Regression check", "Status"], [
        ["D1", "Countdown page failed on every load and reload", "A Server Component called a function exported from a client-only module", "Route reload test", "Fixed"],
        ["D2", "Subject not-found page failed the same way", "Same cause", "Code review", "Fixed"],
        ["D3", "Odd-semester receipts numbered EVEN", "Term taken from the event name", "Unit and workflow tests", "Fixed"],
        ["D4", "Monitor said “closed” for an open event; offered “Reopen” for an event not yet open", "Stored status used instead of the window rule", "Staff workflow test", "Fixed"],
        ["D5", "Audit log address always “client-ip”", "Hard-coded placeholder", "Session test", "Fixed"],
        ["D6", "Unhandled error from the picker's realtime subscription (development)", "Cleanup could run before the lazily loaded client was ready", "Code review; realtime not enabled in tests", "Fixed, not exercised"],
        ["D7", "Hydration warning on the sign-in and join pages when the browser asks for reduced motion", "The decorative seat graphic renders a different style on the server and in the browser", "None yet; the browser tests run without the reduced-motion preference", "Open"],
        ["D8", "Replaced or deactivated sessions could still load pages (security)", "Cookie deletion throws during page rendering; the error fell through to a weaker check", "Session tests", "Fixed"],
        ["D9", "Picker kept showing old seat counts", "Counts copied into state once; no refresh without realtime", "Freshness test (fails without the fix)", "Fixed"],
        ["D10", "No Pause control for a published event that was open", "Controls required the stored status OPEN", "Staff workflow and unit tests", "Fixed"],
        ["D11", "Tutor class limit and maintenance mode not saved on a new database", "Update of a settings row that did not exist", "Server test", "Fixed"],
        ["D12", "Administrators never saw the unlock control on the class page", "Comparison with a role name that does not exist", "Code review", "Fixed"],
        ["D13", "Endless connection errors and “Reconnecting” when realtime is not configured", "Client connected to a placeholder host", "Route reload test", "Fixed"],
        ["D14", "Server-side suite failed intermittently", "Test files ran in parallel against one database and raced on Year Servers", "Repeated full runs", "Fixed"],
    ], widths=[0.45, 1.85, 1.95, 1.45, 0.9], size=8.5, align_cols={0: c, 4: c})
    R.para("After the walkthrough used for the screenshots, the seat counters were compared with the stored choices directly in the database. For every subject, the number of seats taken (capacity minus available seats) equalled the number of confirmed choices, as Table 8.10 shows.", after=8)
    sc = []
    for line in open(EVID + "seat-consistency.txt", encoding="utf-8").read().split("\n")[1:]:
        parts = line.split("|")
        if len(parts) == 4 and parts[1].isdigit():
            name, mx, av, cf = parts
            sc.append([name, mx, av, str(int(mx) - int(av)), cf, "Yes" if int(mx) - int(av) == int(cf) else "No"])
    R.table("Table 8.10 | Seat Consistency Check After the Walkthrough", ["Subject", "Capacity", "Available", "Taken", "Confirmed choices", "Consistent"], sc,
            widths=[2.4, 0.8, 0.85, 0.7, 1.05, 0.85], size=10, align_cols={1: c, 2: c, 3: c, 4: c, 5: c})

    R.heading("8.8 Limitations of the Testing Approach", 2)
    R.para("The results show that the implemented rules behave as intended in the cases tested. They do not establish everything that would be needed before a live registration cycle. Table 8.11 lists what was not tested.", after=8)
    R.table("Table 8.11 | Testing Not Executed", ["Type of testing", "Status", "Remarks"], [
        ["Load and performance under realistic numbers of students", "Not executed", "No throughput or response-time measurements are claimed."],
        ["Realtime updates with a configured Supabase project", "Not executed", "Realtime was disabled in the isolated environments; correctness does not depend on it."],
        ["Other browsers and real devices", "Not executed", "Google Chrome only, with emulated screen sizes."],
        ["Screen-reader use", "Not executed", "Automated accessibility checks and keyboard tests only."],
        ["Student signup and password reset through the browser", "Not executed", "Covered by server-side tests only."],
        ["Running the setup on Windows", "Not executed", "Setup guide prepared and checked on macOS only."],
        ["Independent security assessment and user acceptance testing", "Not executed", "Access-control tests exist; no external assessment or pilot with real users."],
        ["Receipt PDF content", "Not executed", "The download was not opened and inspected."],
    ], widths=[2.4, 1.0, 3.2], size=9.5)


def chapter9(R):
    R.heading("9. CONCLUSION AND FUTURE ENHANCEMENTS", 1)
    R.heading("9.1 Conclusion", 2)
    for t in [
        "This project set out to build an elective registration system for a department that enforces seat limits exactly, keeps cohorts and academic years separate, and gives each role only the access it needs. Electify meets these aims in its current form. Registration, changes and cancellations are processed in single transactions that lock the affected subject rows in a fixed order, apply subject capacities and class quotas, and either complete fully or leave no trace. Composite foreign keys and scoped queries keep each cohort's events, seats and reports apart, and staff permissions are derived on every request from the department's own assignment of classes rather than from anything the browser sends.",
        "The surrounding features follow the order in which a department actually runs a registration. Administrators open a Year Server and link its cohorts; tutors, who may look after classes in more than one programme, bring students in with signup codes and handle forgotten passwords; coordinators prepare subjects and reserve seats for particular classes; students read about the subjects before choosing; and while the window is open, staff can follow progress live and afterwards export reports, consult the audit log or replay how the seats were taken.",
        "Testing at two levels proved its worth. The server-side tests verify the rules that depend on real row locks and constraints, such as the outcome when several students compete for the last seat. The browser tests, which reload every important page and follow complete workflows, found defects that the server-side tests could not see — among them a page that failed on every load and a security fault that let replaced sessions keep loading pages. Those defects were corrected and now have regression tests, and the remaining gaps in the testing are stated plainly in Chapter 8.",
    ]:
        R.para(t)
    R.heading("9.2 Future Enhancements", 2)
    R.items([
        "**Password policy** – align the policy with NIST SP 800-63B-4 [18]: at least 15 characters for passwords used alone, no character-class rules, and a larger blocklist; or add a second factor.",
        "**Load and acceptance testing** – measure behaviour with realistic numbers of simultaneous students and run a pilot registration with one class before wider use.",
        "**Preference-based allocation** – let students rank several subjects and run an allocation mechanism after the window closes, drawing on the course allocation literature [2], [3], as an alternative to first-come allocation.",
        "**Multiple choices per basket** – extend the registration logic to baskets that require more than one subject.",
        "**Verification workflow** – implement the VERIFICATION and FINALIZED stages so that staff can review and formally close an event.",
        "**Notifications** – remind students who have not registered and send receipt confirmations by e-mail.",
        "**Integration** – import student lists and subject data from the university's central systems instead of entering them manually.",
        "**Reduced-motion rendering** – make the decorative graphic on the sign-in and join pages render identically on the server and in the browser (defect D7), and run the browser tests with the reduced-motion preference as well.",
        "**Wider verification** – test realtime updates with a configured project, other browsers, real phones, screen readers and the Windows setup.",
    ], kind="number")


REFERENCES = [
    "D. Gale and L. S. Shapley, “College admissions and the stability of marriage,” *The American Mathematical Monthly*, vol. 69, no. 1, pp. 9–15, 1962.",
    "E. Budish and E. Cantillon, “The multi-unit assignment problem: Theory and evidence from course allocation at Harvard,” *American Economic Review*, vol. 102, no. 5, pp. 2237–2271, 2012.",
    "E. Budish, “The combinatorial assignment problem: Approximate competitive equilibrium from equal incomes,” *Journal of Political Economy*, vol. 119, no. 6, pp. 1061–1103, 2011.",
    "E. F. Codd, “A relational model of data for large shared data banks,” *Communications of the ACM*, vol. 13, no. 6, pp. 377–387, 1970.",
    "P. P.-S. Chen, “The entity-relationship model—Toward a unified view of data,” *ACM Transactions on Database Systems*, vol. 1, no. 1, pp. 9–36, 1976.",
    "A. Silberschatz, H. F. Korth, and S. Sudarshan, *Database System Concepts*, 7th ed. New York, NY, USA: McGraw-Hill Education, 2020.",
    "K. P. Eswaran, J. N. Gray, R. A. Lorie, and I. L. Traiger, “The notions of consistency and predicate locks in a database system,” *Communications of the ACM*, vol. 19, no. 11, pp. 624–633, 1976.",
    "J. Gray and A. Reuter, *Transaction Processing: Concepts and Techniques*. San Mateo, CA, USA: Morgan Kaufmann, 1993.",
    "H. Berenson, P. Bernstein, J. Gray, J. Melton, E. O’Neil, and P. O’Neil, “A critique of ANSI SQL isolation levels,” in *Proc. ACM SIGMOD Int. Conf. on Management of Data*, San Jose, CA, USA, 1995, pp. 1–10.",
    "M. Kleppmann, *Designing Data-Intensive Applications*. Sebastopol, CA, USA: O’Reilly Media, 2017.",
    "J. H. Saltzer and M. D. Schroeder, “The protection of information in computer systems,” *Proceedings of the IEEE*, vol. 63, no. 9, pp. 1278–1308, 1975.",
    "D. F. Ferraiolo and D. R. Kuhn, “Role-based access controls,” in *Proc. 15th National Computer Security Conference*, Baltimore, MD, USA, 1992, pp. 554–563.",
    "R. S. Sandhu, E. J. Coyne, H. L. Feinstein, and C. E. Youman, “Role-based access control models,” *IEEE Computer*, vol. 29, no. 2, pp. 38–47, 1996.",
    "The PostgreSQL Global Development Group, “Explicit locking,” *PostgreSQL Documentation*, ch. 13.3. [Online]. Available: https://www.postgresql.org/docs/current/explicit-locking.html (accessed Oct. 13, 2026).",
    "The PostgreSQL Global Development Group, “Transaction isolation,” *PostgreSQL Documentation*, ch. 13.2. [Online]. Available: https://www.postgresql.org/docs/current/transaction-iso.html (accessed Oct. 13, 2026).",
    "OWASP Foundation, “OWASP Top 10:2021.” [Online]. Available: https://owasp.org/Top10/ (accessed Oct. 13, 2026).",
    "N. Provos and D. Mazières, “A future-adaptable password scheme,” in *Proc. USENIX Annual Technical Conference, FREENIX Track*, Monterey, CA, USA, 1999, pp. 81–92.",
    "D. Temoshok et al., “Digital identity guidelines: Authentication and authenticator management,” National Institute of Standards and Technology, Gaithersburg, MD, USA, NIST Special Publication 800-63B-4, Jul. 2025, doi: 10.6028/NIST.SP.800-63B-4.",
    "OWASP Foundation, “Application Security Verification Standard 5.0.0,” May 2025. [Online]. Available: https://owasp.org/www-project-application-security-verification-standard/ (accessed Oct. 15, 2026).",
    "M. Jones, J. Bradley, and N. Sakimura, “JSON Web Token (JWT),” Internet Engineering Task Force, RFC 7519, May 2015.",
    "Vercel, “Next.js documentation.” [Online]. Available: https://nextjs.org/docs (accessed Oct. 13, 2026).",
    "Meta Open Source, “React documentation.” [Online]. Available: https://react.dev (accessed Oct. 13, 2026).",
    "Drizzle Team, “Drizzle ORM documentation.” [Online]. Available: https://orm.drizzle.team/docs/overview (accessed Oct. 13, 2026).",
    "Supabase, “Realtime,” *Supabase Documentation*. [Online]. Available: https://supabase.com/docs/guides/realtime (accessed Oct. 13, 2026).",
    "OpenJS Foundation, “Test runner,” *Node.js Documentation*. [Online]. Available: https://nodejs.org/api/test.html (accessed Oct. 13, 2026).",
    "Microsoft, “Playwright documentation.” [Online]. Available: https://playwright.dev/docs/intro (accessed Oct. 13, 2026).",
    "Deque Systems, “axe-core: Accessibility engine for automated web UI testing.” [Online]. Available: https://github.com/dequelabs/axe-core (accessed Oct. 15, 2026).",
    "World Wide Web Consortium, “Web Content Accessibility Guidelines (WCAG) 2.1,” W3C Recommendation, 2018. [Online]. Available: https://www.w3.org/TR/WCAG21/ (accessed Oct. 15, 2026).",
]


def chapter10(R):
    R.heading("10. REFERENCES", 1)
    from docx.shared import Inches, Pt
    for i, ref in enumerate(REFERENCES, start=1):
        p = R.doc.add_paragraph(style="Normal")
        p.paragraph_format.left_indent = Inches(0.45)
        p.paragraph_format.first_line_indent = Inches(-0.45)
        p.paragraph_format.space_after = Pt(6)
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        R.rich(p, f"[{i}]\t" + ref)
        p.paragraph_format.tab_stops.add_tab_stop(Inches(0.45))


def chapter11(R):
    runs, meta, summary = parse_run()
    R.heading("11. APPENDICES", 1)
    R.heading("11.1 Selected Source Code", 2)
    R.para("This appendix reproduces the parts of the source code that implement the central rules discussed in Chapter 6. The excerpts are copied unchanged from the repository at the commit used for testing; lines omitted for brevity are marked with “// …”.")
    R.heading("11.1.1 src/lib/seat-ops.ts — taking and releasing seats", 3)
    R.code(excerpt("src/lib/seat-ops.ts", [(30, 87)]))
    R.heading("11.1.2 src/lib/registration-window.ts — the window rule", 3)
    R.code(excerpt("src/lib/registration-window.ts", [(51, 78)]))
    R.heading("11.1.3 src/app/actions/register.ts — locking inside the registration transaction", 3)
    R.code(excerpt("src/app/actions/register.ts", [(172, 189), (219, 248), (299, 317)]))
    R.heading("11.2 Additional Screenshots", 2)
    R.para("The following screenshots show further staff pages captured during the walkthrough with fictional data.")
    R.figure(S + "23_tutor_section.png", "Figure 11.1 | Class Page with the Student Roster and Class Tools", width=6.2)
    R.figure(S + "27_tutor_electives.png", "Figure 11.2 | Subjects and Groups Page with Seat Counts per Subject", width=6.2)
    R.heading("11.3 Automated Test Results", 2)
    R.para(f"Table 11.1 lists every server-side test in the reported run ({meta[0]}, commit {meta[2]}), grouped by suite, with its recorded result. Table 11.2 lists the browser tests from the run on the same day.", after=8)
    rows, n = [], 0
    for file, suite in SUITES:
        for p, name in runs.get(suite, []):
            n += 1
            rows.append([str(n), suite, name, "Passed" if p else "Failed"])
    c = WD_ALIGN_PARAGRAPH.CENTER
    R.table("Table 11.1 | Complete List of Server-Side Tests and Results", ["No.", "Suite", "Test", "Result"], rows,
            widths=[0.45, 1.95, 3.5, 0.7], size=8.5, align_cols={0: c, 3: c})
    e2e, _ = parse_e2e()
    rows = [[str(i), f, title, "Passed" if st == "passed" else st.title()] for i, (f, title, st) in enumerate(e2e, start=1)]
    R.table("Table 11.2 | Complete List of Browser End-to-End Tests and Results", ["No.", "File", "Test", "Result"], rows,
            widths=[0.45, 1.75, 3.7, 0.7], size=8.5, align_cols={0: c, 3: c})
    R.heading("11.4 Demonstration Data Used for Screenshots", 2)
    for t in [
        "All screenshots in this report were taken on 15 October 2026 from an isolated development server running the code described in this report, separate from the team's own server and connected to a local database created for the purpose. The data was created specifically for the walkthrough and is entirely fictional: no real student, staff member, register number, e-mail address or password appears in any screenshot. E-mail addresses use the reserved domain example.test, and register numbers begin with DEMO. The institutional names (faculty, department and programme) were used only to make the screens recognisable. Registrations in the demonstration data were created through the application's own registration action, so seat counts, receipts and logs are those produced by the application. The development-mode indicator that Next.js overlays on pages was hidden in the captures; it is not part of the application's interface. Live updates were not configured for the captures, so that the copy would not connect to the team's hosted project. The demonstration data is summarised in Table 11.3.",
    ]:
        R.para(t)
    R.table("Table 11.3 | Fictional Demonstration Data", ["Item", "Contents"], [
        ["Staff accounts", "Demo Administrator, Demo Coordinator (MCA), Demo Tutor (tutor of MCA F 2025–2027 and MCA F 2026–2028)"],
        ["Year Servers", "2025 (active), 2026 (active), 2027 (planned)"],
        ["Cohorts and classes", "MCA 2025–2027: classes F and G; MCA 2026–2028: class F; BCA 2026–2029: class A"],
        ["Students", "36 in MCA F 2025, 30 in MCA G 2025, 12 in MCA F 2026; names of the form “Demo Student F01”"],
        ["Events", "Semester 3 Elective Registration (MCA 2025, classes F and G, open); Semester 1 Value-Added Course Registration (MCA F 2026, opening in the future)"],
        ["Subjects", "Professional Elective I: Cloud Computing, Data Science and Analytics, Cyber Security (8-seat quotas for F and G), Full Stack Web Development; Open Elective I: Digital Marketing, Entrepreneurship Development, Organisational Behaviour"],
        ["Activity", "47 registrations created through the registration action, including one change and one cancellation, plus one registration completed through the student interface"],
    ], widths=[1.6, 5.0], size=10, bold_first=True)
    R.heading("11.5 Glossary", 2)
    R.table("Table 11.4 | Glossary of Terms", ["Term", "Meaning in this report"], [
        ["Cohort (academic batch)", "Students of one programme admitted in the same year, for example MCA 2025–2027."],
        ["Class (section)", "A section of a cohort, for example MCA F of the 2025–2027 cohort."],
        ["Year Server", "The workspace for one academic year (an academic session), containing the cohorts studying in that year."],
        ["Registration event", "One registration exercise for one cohort, with its baskets, subjects and window."],
        ["Basket (elective group)", "A group of subjects from which a student chooses, such as Professional Elective I."],
        ["Class quota", "Seats of a subject reserved for students of a particular class."],
        ["Server Action", "A server-side function in Next.js that is called directly from the user interface."],
        ["Row lock", "A database lock on a row (SELECT … FOR UPDATE) that makes other transactions wait until it is released."],
        ["Advisory lock", "An application-defined PostgreSQL lock, used here to serialise receipt numbering."],
        ["Receipt snapshot", "A JSON copy of the confirmed registration stored at the time of confirmation."],
    ], widths=[1.8, 4.8], size=10.5, bold_first=True)
