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
    ("tests/password-policy.test.ts", "Student password policy"),
    ("tests/registration-modifications.test.ts", "Registration changes, cancellations and capacity (no waitlist)"),
    ("tests/remove-waitlist-migration.test.ts", "Migration 0004: remove waitlist"),
    ("tests/role-based-invite-codes.test.ts", "Role-Based Unique Invite Codes"),
    ("tests/subject-explorer.test.ts", "Subject explorer and preview mode"),
    ("tests/subject-explorer.test.ts", "Subject content validation"),
    ("tests/subject-explorer.test.ts", "Registration window rule"),
    ("tests/template-role-deletion.test.ts", "Role-Based Event Template Deletion & Access Controls"),
    ("tests/year-servers.test.ts", "Year Servers System — Simplified Annual Workspaces"),
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


def chapter8(R):
    runs, meta, summary = parse_run()
    total = int(summary["tests"]); passed = int(summary["pass"]); failed = int(summary["fail"])
    R.heading("8. TESTING AND RESULTS", 1)
    R.heading("8.1 Testing Methodology", 2)
    for t in [
        "Testing combined three activities. The main body of evidence is a suite of automated tests that call the application's Server Actions and domain functions directly and check the resulting database state. These were supplemented by static checks with the TypeScript compiler and ESLint, and by a manual walkthrough of the user interface, carried out with a browser automation script on fictional data, during which the screenshots in this report were captured.",
        "The automated tests are written with the test runner built into Node.js [25] and executed through tsx. They run against a real PostgreSQL database rather than mocks, because the properties that matter most — row locking, constraints and transactions — can only be observed in a real database. Each test builds its own fixtures through `tests/helpers/world.ts`, tags every row it creates with a unique suffix, uses academic years far in the future (for example 2095–2097) so that it cannot collide with real data, and removes its rows afterwards. The migration tests go further and run the SQL migration and its rollback inside a temporary schema, so that the real tables are never touched.",
        "Concurrency is tested by starting several Server Action calls at the same time from the test process and waiting for all of them. Each call uses its own connection from the pool, so the transactions genuinely overlap in the database and compete for the same row locks. This verifies the locking logic but is not a load test; the number of concurrent requests is small, and no performance measurements were taken.",
    ]:
        R.para(t)
    R.heading("8.2 Test Environment", 2)
    R.para("The test run reported in this chapter was carried out in the environment shown in Table 8.1. For this report a new, empty PostgreSQL database was created on the local machine and the current schema was applied to it, so that the run did not depend on, or modify, the team's shared development database.", after=8)
    R.table("Table 8.1 | Test Environment for the Reported Run", ["Item", "Details"], [
        ["Date and time of run", meta[0]],
        ["Code version", f"Git commit {meta[2]}"],
        ["Runtime", f"Node.js {meta[1].lstrip('v')}, tests executed with tsx and the node:test runner"],
        ["Database", "PostgreSQL 18.4 on localhost, database electify_report created for this run; schema applied with drizzle-kit push"],
        ["Command", "tsx --env-file=.env.local --test 'tests/**/*.test.ts' with DATABASE_URL pointing to the local database"],
        ["Exit status", meta[3].replace("exit=", "exit code ")],
    ], widths=[1.9, 4.7], bold_first=True)
    R.heading("8.3 Test Suites and Overall Results", 2)
    R.para(f"Table 8.2 lists the fourteen test suites, the area each covers and the outcome of each in the reported run. All {total} tests passed; {failed} failed, and none were skipped or cancelled.", after=8)
    rows = []
    for i, (file, suite) in enumerate(SUITES, start=1):
        tests = runs.get(suite, [])
        rows.append([str(i), suite, file.replace("tests/", ""), str(len(tests)), str(sum(1 for p, _ in tests if p)), str(sum(1 for p, _ in tests if not p))])
    rows.append(["", "Total", "", str(total), str(passed), str(failed)])
    c = WD_ALIGN_PARAGRAPH.CENTER
    R.table("Table 8.2 | Automated Test Suites and Results", ["No.", "Suite", "File", "Tests", "Passed", "Failed"], rows,
            widths=[0.4, 2.9, 2.0, 0.55, 0.6, 0.55], size=9.5, align_cols={0: c, 3: c, 4: c, 5: c})
    R.para("The complete list of test names and their results is given in Appendix 11.3. The following sections describe the most important groups of tests.")
    R.heading("8.4 Functional Test Cases", 2)
    R.para("Table 8.3 lists representative functional test cases. The test names are those used in the code; the expected behaviour summarises what each test asserts, and the result is the outcome recorded in the reported run.", after=8)
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
    fn = [
        ["TC01", "Student signup with a class code", "Account created with a hashed password; class and cohort taken from the code, not from the form.", res(O, "5.")],
        ["TC02", "Duplicate register number or e-mail", "Second signup with the same register number or e-mail is rejected.", res(O, "6.")],
        ["TC03", "Student sign-in", "Students sign in with register number and password only.", res(O, "7.")],
        ["TC04", "Tutor-authorised password reset", "Request, tutor authorisation and new password complete in sequence.", res(O, "10.")],
        ["TC05", "Browse subjects before opening", "Catalogue visible before the window opens; opening a subject reserves nothing.", res(X, "1.")],
        ["TC06", "Submit before opening time", "Server rejects a submission made before the window opens.", res(X, "4.")],
        ["TC07", "Window opening boundary", "Window opens exactly at the opening time, not a millisecond earlier.", res(W, "Opens exactly")],
        ["TC08", "Register for a full subject", "Rejected with SEAT_TAKEN; no records are created.", res(M, "3.")],
        ["TC09", "Change to a subject with seats", "Seat moves to the new subject in one step.", res(M, "1.")],
        ["TC10", "Change to a full subject", "Change rejected; the student keeps the current seat.", res(M, "2.")],
        ["TC11", "Cancel one choice", "Seat released; the choice is kept with status CANCELLED.", res(M, "4.")],
        ["TC12", "Change after the deadline", "Modification rejected and nothing changes.", res(M, "6.")],
        ["TC13", "Receipt identity", "Receipt and reports carry the full class, cohort and Year Server.", res(A, "10.")],
        ["TC14", "Create a Year Server", "Administrator creates a Year Server as PLANNED or ACTIVE.", res(Y, "2.")],
    ]
    R.table("Table 8.3 | Representative Functional Test Cases", ["ID", "Test case", "Expected behaviour", "Result"], fn,
            widths=[0.55, 1.8, 3.45, 0.8], size=10, align_cols={0: c, 3: c})
    R.heading("8.5 Concurrency and Data Integrity Tests", 2)
    R.para("The tests in Table 8.4 target the guarantees described in Chapter 6. In each concurrency test several requests compete for the last seat or the last activation of a code, and the test checks both the replies and the final state of the database.", after=8)
    ci = [
        ["CI01", "Concurrent registrations for the last seat", "Exactly one succeeds; the others receive SEAT_TAKEN; seats end at 0; one confirmed row.", res(M, "8.")],
        ["CI02", "Concurrent changes into the last seat", "Exactly one change succeeds; the others keep their original seats.", res(M, "9.")],
        ["CI03", "Concurrent registration across a cohort event", "Capacity is never exceeded; exactly one confirmed choice holds the seat.", res(A, "9.")],
        ["CI04", "Repeated cancellation", "A retried cancellation does not release the seat twice.", res(M, "10.")],
        ["CI05", "Failed multi-group registration", "If one basket fails, the whole registration rolls back.", res(M, "11.")],
        ["CI06", "Simultaneous confirmations", "No two confirmations share a receipt number.", res(M, "13.")],
        ["CI07", "Signup code activation limit", "Enrolment is refused once the code's limit is reached.", res(O, "9.")],
        ["CI08", "Independent seat counters", "The same subject offered to two cohorts keeps separate counts.", res(A, "8.")],
        ["CI09", "Records stay consistent", "Receipts, replay events and audit rows agree after registrations and changes.", res(M, "12.")],
    ]
    R.table("Table 8.4 | Concurrency and Integrity Tests", ["ID", "Test", "Expected behaviour", "Result"], ci,
            widths=[0.55, 2.0, 3.25, 0.8], size=10, align_cols={0: c, 3: c})
    R.heading("8.6 Access Control and Isolation Tests", 2)
    R.para("Access-control tests act as different users and attempt operations that should be refused, including requests crafted to bypass the user interface. The principal cases are listed in Table 8.5.", after=8)
    T = "Role-Based Event Template Deletion & Access Controls"
    L = "Live Event Registration Monitor & Surveillance Module"
    E = "Event Management: Delete Event & Reset Registrations"
    ac = [
        ["AC01", "A student cannot see or register for another cohort's event.", res(A, "6.")],
        ["AC02", "Crafted requests cannot bypass class targeting or mix offerings.", res(A, "7.")],
        ["AC03", "A signup code never moves an existing student to another cohort.", res(A, "12.")],
        ["AC04", "Staff cannot reach classes, sessions, events, students or reports outside their scope.", res(A, "13.")],
        ["AC05", "Event creation is limited to classes managed in the selected session.", res(A, "14.")],
        ["AC06", "Ineligible students, other batches' events and foreign subjects are rejected.", res(X, "7.")],
        ["AC07", "A tutor cannot see, authorise or reject resets for another section.", res(O, "14.")],
        ["AC08", "Guessing reset codes locks the reset form.", res(O, "15.")],
        ["AC09", "Repeated wrong passwords trigger a temporary lockout.", res(O, "8.")],
        ["AC10", "Students and tutors cannot delete event templates.", res(T, "2.")],
        ["AC11", "Unauthorised users cannot access live monitoring data.", res(L, "1.")],
        ["AC12", "Unauthorised users cannot reset or delete events.", res(E, "1.")],
        ["AC13", "Non-administrators cannot delete a Year Server.", res(Y, "8.")],
    ]
    R.table("Table 8.5 | Access Control and Isolation Tests", ["ID", "Test", "Result"], ac,
            widths=[0.6, 5.2, 0.8], size=10, align_cols={0: c, 2: c})
    R.heading("8.7 Static Checks and Interface Walkthrough", 2)
    for t in [
        "The TypeScript compiler (`tsc --noEmit`) and ESLint were run on the same commit; both completed with exit code 0 and reported no errors. A walkthrough of the interface was then performed against an isolated copy of the application connected to the local database, using fictional demonstration data (Appendix 11.4). The walkthrough signed in as each role, completed a registration through the student interface, and opened every main staff page. A student registration made through the interface was confirmed and produced receipt number ELC-2026-EVEN-000048.",
        "The walkthrough was not a formal test with pass criteria for every page, but it did reveal the issues listed in Table 8.7. None of them was fixed as part of this report, because the report was prepared without changing application code; they are recorded here so that they can be addressed.",
    ]:
        R.para(t)
    R.para("After the walkthrough, the seat counters were compared with the stored choices directly in the database. For every subject, the number of seats taken (capacity minus available seats) equalled the number of confirmed choices, as shown in Table 8.6.", after=8)
    sc = []
    for line in open(EVID + "seat-consistency.txt", encoding="utf-8").read().split("\n")[1:]:
        parts = line.split("|")
        if len(parts) == 4 and parts[1].isdigit():
            name, mx, av, cf = parts
            sc.append([name, mx, av, str(int(mx) - int(av)), cf, "Yes" if int(mx) - int(av) == int(cf) else "No"])
    R.table("Table 8.6 | Seat Consistency Check After the Walkthrough", ["Subject", "Capacity", "Available", "Taken", "Confirmed choices", "Consistent"], sc,
            widths=[2.4, 0.8, 0.85, 0.7, 1.05, 0.85], size=10, align_cols={1: c, 2: c, 3: c, 4: c, 5: c})
    R.table("Table 8.7 | Defects and Observations from the Walkthrough", ["ID", "Observation", "Cause identified", "Status"], [
        ["D1", "The countdown page (/countdown) failed with “This page couldn’t load” for a student whose event had not yet opened.", "The server component calls buttonVariants(), which is exported from a client module (server log).", "Open"],
        ["D2", "The server log recorded the same error from the subject not-found page.", "Same cause, in dashboard/subjects/[electiveId]/not-found.tsx.", "Open"],
        ["D3", "Receipt for a Semester 3 (odd) event was numbered ELC-2026-EVEN-…", "Term derived from the word “odd” in the event name instead of the event's semester.", "Open"],
        ["D4", "Monitor showed “Window is closed for new student submissions” for a published event whose window was open.", "Monitor message appears to rely on the stored status rather than the shared window rule.", "Open"],
        ["D5", "Audit log IP address column shows “client-ip”.", "Sign-in code uses a fixed placeholder instead of the request address.", "Open"],
        ["D6", "Browser console reported an unhandled rejection from the realtime subscription in the student picker.", "Callbacks added to a realtime channel after subscribe(); seen in development mode.", "Open"],
        ["D7", "Browser console reported a hydration attribute mismatch on some pages.", "Development-mode warning; cause not investigated.", "Open"],
    ], widths=[0.45, 2.6, 2.75, 0.8], size=9.5, align_cols={0: c, 3: c})
    R.para("The “Reconnecting” indicator visible in some screenshots is not a defect of the application: realtime updates were deliberately left unconfigured in the isolated copy used for the walkthrough, so that it would not connect to the team's hosted project.")
    R.heading("8.8 Limitations of the Testing Approach", 2)
    R.para("The evidence presented in this chapter shows that the implemented rules behave as intended in the cases tested. It does not establish everything that would be needed before a live registration cycle. Table 8.8 lists the kinds of testing that were not executed for this report.", after=8)
    R.table("Table 8.8 | Testing Not Executed", ["Type of testing", "Status", "Remarks"], [
        ["Load and performance testing", "Not executed", "No measurements of response time or throughput were taken; behaviour with hundreds of simultaneous students is unverified."],
        ["Realtime updates with Supabase", "Not executed in this run", "Realtime was disabled in the walkthrough environment; correctness does not depend on it."],
        ["Cross-browser and mobile-device testing", "Not executed", "The walkthrough used Google Chrome on a desktop viewport only."],
        ["Accessibility audit", "Not executed", "No screen-reader or WCAG conformance review was performed."],
        ["Security penetration testing", "Not executed", "Access-control tests exist, but no independent security assessment was carried out."],
        ["User acceptance testing", "Not executed", "The system has not been used by real students and staff for a registration cycle."],
        ["Receipt PDF content check", "Not executed", "The PDF download was not opened and inspected during the walkthrough."],
    ], widths=[2.0, 1.3, 3.3], size=10)
    R.para("Within these limits, the results support the main claims of the design: seats are never overbooked in the concurrency scenarios tested, cohorts and Year Servers remain isolated, and staff cannot act outside their scope through the actions tested.")


def chapter9(R):
    R.heading("9. CONCLUSION AND FUTURE ENHANCEMENTS", 1)
    R.heading("9.1 Conclusion", 2)
    for t in [
        "This project set out to build an elective registration system for a department that enforces seat limits exactly, keeps cohorts and academic years separate, and gives each role only the access it needs. Electify meets these aims in its current form. Registration, changes and cancellations are processed in single transactions that lock the affected subject rows in a fixed order, apply subject capacities and class quotas, and either complete fully or leave no trace. Composite foreign keys and scoped queries keep each cohort's events, seats and reports apart, and staff permissions are derived on every request from the department's own assignment of classes rather than from anything the browser sends.",
        "Around this core, the system provides the tools a department needs to run a registration: Year Server workspaces, class signup codes, tutor-authorised password resets, event and subject management with class quotas, a subject explorer for students, receipts, live monitoring, reports, an audit log and a replay of registration activity. The 105 automated tests that were run, all of which passed, give evidence for the most important properties, including correct behaviour when several students compete for the last seat.",
        "The work also showed the value of testing against a real database and of a walkthrough of the interface. Several of the most important rules could only be verified with real row locks, and the walkthrough revealed defects — a failing countdown page, an incorrect term in receipt numbers and an inconsistent monitor message — that the automated tests did not cover. These are documented in Chapter 8 and are the first items for further work.",
    ]:
        R.para(t)
    R.heading("9.2 Future Enhancements", 2)
    R.items([
        "**Fix the recorded defects** – correct the countdown and not-found pages, derive the receipt term from the event's semester, use the shared window rule in the monitor, record the real client address in the audit log, and tidy the realtime subscription in the picker.",
        "**Load and acceptance testing** – measure behaviour with realistic numbers of simultaneous students and run a pilot registration with a class before wider use.",
        "**Preference-based allocation** – allow students to rank several subjects and run an allocation mechanism after the window closes, drawing on the course allocation literature [2], [3], as an alternative to first-come allocation.",
        "**Multiple choices per basket** – extend the registration logic to baskets that require more than one subject.",
        "**Verification workflow** – implement the VERIFICATION and FINALIZED stages so that staff can review and formally close an event.",
        "**Notifications** – send reminders to students who have not registered and confirmations of receipts by e-mail.",
        "**Integration** – import student lists and subject data from the university's central systems instead of entering them manually.",
        "**Accessibility and mobile review** – carry out an accessibility audit and test on a range of phones and browsers.",
    ], kind="number")


REFERENCES = [
    "D. Gale and L. S. Shapley, “College admissions and the stability of marriage,” *The American Mathematical Monthly*, vol. 69, no. 1, pp. 9–15, 1962.",
    "E. Budish and E. Cantillon, “The multi-unit assignment problem: Theory and evidence from course allocation at Harvard,” *American Economic Review*, vol. 102, no. 5, pp. 2237–2271, 2012.",
    "E. Budish, “The combinatorial assignment problem: Approximate competitive equilibrium from equal incomes,” *Journal of Political Economy*, vol. 119, no. 6, pp. 1061–1103, 2011.",
    "E. F. Codd, “A relational model of data for large shared data banks,” *Communications of the ACM*, vol. 13, no. 6, pp. 377–387, 1970.",
    "P. P.-S. Chen, “The entity-relationship model—Toward a unified view of data,” *ACM Transactions on Database Systems*, vol. 1, no. 1, pp. 9–36, 1976.",
    "A. Silberschatz, H. F. Korth, and S. Sudarshan, *Database System Concepts*, 7th ed. New York, NY, USA: McGraw-Hill Education, 2019.",
    "K. P. Eswaran, J. N. Gray, R. A. Lorie, and I. L. Traiger, “The notions of consistency and predicate locks in a database system,” *Communications of the ACM*, vol. 19, no. 11, pp. 624–633, 1976.",
    "J. Gray and A. Reuter, *Transaction Processing: Concepts and Techniques*. San Mateo, CA, USA: Morgan Kaufmann, 1992.",
    "H. Berenson, P. Bernstein, J. Gray, J. Melton, E. O’Neil, and P. O’Neil, “A critique of ANSI SQL isolation levels,” in *Proc. ACM SIGMOD Int. Conf. on Management of Data*, San Jose, CA, USA, 1995, pp. 1–10.",
    "M. Kleppmann, *Designing Data-Intensive Applications*. Sebastopol, CA, USA: O’Reilly Media, 2017.",
    "J. H. Saltzer and M. D. Schroeder, “The protection of information in computer systems,” *Proceedings of the IEEE*, vol. 63, no. 9, pp. 1278–1308, 1975.",
    "D. F. Ferraiolo and D. R. Kuhn, “Role-based access controls,” in *Proc. 15th National Computer Security Conference*, Baltimore, MD, USA, 1992, pp. 554–563.",
    "R. S. Sandhu, E. J. Coyne, H. L. Feinstein, and C. E. Youman, “Role-based access control models,” *IEEE Computer*, vol. 29, no. 2, pp. 38–47, 1996.",
    "The PostgreSQL Global Development Group, “Explicit locking,” *PostgreSQL Documentation*, ch. 13.3. [Online]. Available: https://www.postgresql.org/docs/current/explicit-locking.html (accessed Oct. 13, 2026).",
    "The PostgreSQL Global Development Group, “Transaction isolation,” *PostgreSQL Documentation*, ch. 13.2. [Online]. Available: https://www.postgresql.org/docs/current/transaction-iso.html (accessed Oct. 13, 2026).",
    "OWASP Foundation, “OWASP Top 10:2021.” [Online]. Available: https://owasp.org/Top10/ (accessed Oct. 13, 2026).",
    "N. Provos and D. Mazières, “A future-adaptable password scheme,” in *Proc. USENIX Annual Technical Conference, FREENIX Track*, Monterey, CA, USA, 1999, pp. 81–91.",
    "P. A. Grassi et al., “Digital identity guidelines: Authentication and lifecycle management,” National Institute of Standards and Technology, Gaithersburg, MD, USA, NIST Special Publication 800-63B, 2017.",
    "OWASP Foundation, “Application Security Verification Standard 4.0.3,” 2021. [Online]. Available: https://owasp.org/www-project-application-security-verification-standard/ (accessed Oct. 13, 2026).",
    "M. Jones, J. Bradley, and N. Sakimura, “JSON Web Token (JWT),” Internet Engineering Task Force, RFC 7519, May 2015.",
    "Vercel, “Next.js documentation.” [Online]. Available: https://nextjs.org/docs (accessed Oct. 13, 2026).",
    "Meta Open Source, “React documentation.” [Online]. Available: https://react.dev (accessed Oct. 13, 2026).",
    "Drizzle Team, “Drizzle ORM documentation.” [Online]. Available: https://orm.drizzle.team/docs/overview (accessed Oct. 13, 2026).",
    "Supabase, “Realtime,” *Supabase Documentation*. [Online]. Available: https://supabase.com/docs/guides/realtime (accessed Oct. 13, 2026).",
    "OpenJS Foundation, “Test runner,” *Node.js Documentation*. [Online]. Available: https://nodejs.org/api/test.html (accessed Oct. 13, 2026).",
    "Microsoft, “Playwright documentation.” [Online]. Available: https://playwright.dev/docs/intro (accessed Oct. 13, 2026).",
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
    R.para(f"Table 11.1 lists every automated test in the reported run ({meta[0]}, commit {meta[2]}), grouped by suite, with its recorded result.", after=8)
    rows, n = [], 0
    for file, suite in SUITES:
        for p, name in runs.get(suite, []):
            n += 1
            rows.append([str(n), suite, name, "Passed" if p else "Failed"])
    c = WD_ALIGN_PARAGRAPH.CENTER
    R.table("Table 11.1 | Complete List of Automated Tests and Results", ["No.", "Suite", "Test", "Result"], rows,
            widths=[0.45, 1.95, 3.5, 0.7], size=8.5, align_cols={0: c, 3: c})
    R.heading("11.4 Demonstration Data Used for Screenshots", 2)
    for t in [
        "All screenshots in this report were taken from an isolated copy of the application running on the development machine and connected to the local database created for this report. The data was created specifically for the walkthrough and is entirely fictional: no real student, staff member, register number, e-mail address or password appears in any screenshot. E-mail addresses use the reserved domain example.test, and register numbers begin with DEMO. The institutional names (faculty, department and programme) were used only to make the screens recognisable. Registrations in the demonstration data were created through the application's own registration action, so seat counts, receipts and logs are those produced by the application. The development-mode indicator that Next.js overlays on pages was hidden in the captures; it is not part of the application's interface. The demonstration data is summarised in Table 11.2.",
    ]:
        R.para(t)
    R.table("Table 11.2 | Fictional Demonstration Data", ["Item", "Contents"], [
        ["Staff accounts", "Demo Administrator, Demo Coordinator (MCA), Demo Tutor (tutor of MCA F 2025–2027 and MCA F 2026–2028)"],
        ["Year Servers", "2025 (active), 2026 (active), 2027 (planned)"],
        ["Cohorts and classes", "MCA 2025–2027: classes F and G; MCA 2026–2028: class F; BCA 2026–2029: class A"],
        ["Students", "36 in MCA F 2025, 30 in MCA G 2025, 12 in MCA F 2026; names of the form “Demo Student F01”"],
        ["Events", "Semester 3 Elective Registration (MCA 2025, classes F and G, open); Semester 1 Value-Added Course Registration (MCA F 2026, opening in the future)"],
        ["Subjects", "Professional Elective I: Cloud Computing, Data Science and Analytics, Cyber Security (8-seat quotas for F and G), Full Stack Web Development; Open Elective I: Digital Marketing, Entrepreneurship Development, Organisational Behaviour"],
        ["Activity", "47 registrations created through the registration action, including one change and one cancellation, plus one registration completed through the student interface"],
    ], widths=[1.6, 5.0], size=10, bold_first=True)
    R.heading("11.5 Glossary", 2)
    R.table("Table 11.3 | Glossary of Terms", ["Term", "Meaning in this report"], [
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
