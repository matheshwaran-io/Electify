"""Chapters 6 and 7."""
F = "figures/"
S = "assets/screens/"


def chapter6(R):
    R.heading("6. REGISTRATION PROCESSING AND DATA INTEGRITY", 1)
    R.para("This chapter explains how a registration is processed, how seats are accounted for, and how the system keeps its data consistent when many students act at once. The behaviour described here is implemented in `src/app/actions/register.ts`, `src/lib/seat-ops.ts`, `src/lib/registration-window.ts` and `src/lib/student-events.ts`.")
    R.heading("6.1 Eligibility of a Student for an Event", 2)
    for t in [
        "Before a student can see or act on an event, the system decides whether the event is meant for that student. The decision is made by a single query in `isStudentEligibleForEvent`, which succeeds only if all the conditions in Table 6.1 hold. The same query is used to build the student's list of events and, inside the registration transaction, to re-check eligibility on the same database snapshot as the write. An identifier supplied in a request — for example an event or subject belonging to another cohort — therefore cannot be used to register outside the student's own class.",
    ]:
        R.para(t)
    R.table("Table 6.1 | Conditions for a Student to Be Eligible for an Event", ["Condition", "How it is checked"], [
        ["The user is a student", "The account's role is STUDENT."],
        ["The student's class belongs to the student's cohort", "The section joined to the user must have the same cohort as the user record."],
        ["The event targets the student's class", "A row must exist in event_sections for the event and the student's section."],
        ["The event belongs to the student's cohort", "The event's cohort must equal the student's cohort."],
        ["The account is active and eligible", "Checked by the registration actions before the transaction starts."],
    ], widths=[2.6, 4.0], bold_first=True)
    R.heading("6.2 The Registration Window Rule", 2)
    for t in [
        "Whether students may submit, change or cancel is decided by `getRegistrationWindow`, a pure function of the event's status, opening time, closing time and automatic-closing flag, evaluated against the server's clock at the moment of the request. A paused event is closed; an event in a closed status is closed; otherwise the window opens at the opening time (or immediately if a member of staff has opened it manually) and closes after the closing time if automatic closing is enabled.",
        "The student pages use the same function to decide what to display, and the countdown shown to students is synchronised with the server's clock. These displays are conveniences only: every Server Action calls the function again with its own clock, so a request sent from a page that was left open after the deadline, or from a modified browser, is rejected. The tests confirm that registration opens exactly at the opening time and not a millisecond earlier.",
    ]:
        R.para(t)
    R.heading("6.3 The Registration Transaction", 2)
    for t in [
        "Figure 6.1 shows the steps of `registerElectives`. Inexpensive checks are made first, without taking any locks: the caller must be a student, maintenance mode must be off, the account must be active and eligible, the event must target the student's class and cohort, the window must be open, and the selections must contain at most one subject per group, each belonging to the event. If any check fails, the action returns a specific error code and nothing is written.",
        "The remaining work is done inside one database transaction. The student's registration row for the event is locked with `SELECT … FOR UPDATE`, and the request is rejected if the student has already confirmed a registration. Eligibility is checked again on the transaction's snapshot. The chosen subjects are then locked, always in ascending order of their identifiers; taking locks in a fixed order means that two transactions that need the same subjects cannot each hold one and wait for the other, which would cause a deadlock. For each choice a seat is taken, the choice is written to `student_registrations`, and a replay event recording the seat count before and after is inserted. Finally the receipt is created and an audit record is written. If any step fails — for example because a seat ran out — the whole transaction is rolled back, and no seat, choice, receipt or log entry from the attempt remains.",
    ]:
        R.para(t)
    R.figure(F + "fig_registration_txn.png", "Figure 6.1 | Steps of the Registration Transaction and the takeSeat Rule", width=6.3)
    R.para("From the student's point of view the process is short. The picker shows each basket with its subjects and remaining seats, and a progress indicator shows which baskets still need a choice (Figure 6.2). When every basket has a choice, the student reviews the selection in a confirmation dialog that lists the subjects and total credits (Figure 6.3). If a chosen subject fills while the dialog is open, the server returns the code SEAT_TAKEN with the identifier of the subject, and the picker highlights that subject while keeping the student's other choices.")
    R.figure(S + "13_electives_selected.png", "Figure 6.2 | Elective Picker with One Subject Selected in Each Basket", width=6.2)
    R.figure(S + "14_confirm_dialog.png", "Figure 6.3 | Confirmation Dialog Shown Before a Registration Is Submitted", width=6.2)
    R.heading("6.4 Seat Accounting and Class Quotas", 2)
    for t in [
        "Seats are taken and returned only through two functions in `seat-ops.ts`, `takeSeat` and `releaseSeat`, which must be called inside a transaction that already holds the lock on the subject row. `takeSeat` first checks that the subject has a seat. It then locks any class quota rows for the subject. If the student's class has a quota, the quota must also have a seat, and both the subject counter and the quota counter are decremented. If the student's class has no quota but other classes do, the student may only use seats that are not still reserved: the seats available on the subject minus the seats still available in all quotas must be positive. The decrement is written as an SQL expression on the locked row, and the subject is marked full when its count reaches zero.",
        "`releaseSeat` increments the subject counter and, if the student's class has a quota, the quota counter, using `LEAST(available + 1, maximum)` so that a counter can never rise above its capacity even if a release were attempted twice. Because both functions run under row locks, the remaining-seat count read by a transaction cannot change before the transaction commits, which rules out the lost-update anomaly described in Section 2.2.",
        "As a final safeguard, the database itself rejects any update that would make a seat counter negative, through check constraints on both `electives` and `elective_seat_allocations`. In correct operation these constraints are never triggered, but they ensure that a defect in application code could not silently overbook a subject.",
    ]:
        R.para(t)
    R.heading("6.5 Changing and Cancelling a Registration", 2)
    for t in [
        "While the window is open, a student can change a choice to another subject in the same basket, cancel a single choice, or cancel the whole registration; changes are allowed only if the event permits editing. Figure 6.4 summarises the two flows. A change locks the current choice and both subjects, takes a seat in the new subject first and releases the old seat only after that has succeeded. If the new subject is full, the transaction is rolled back and the student keeps the original seat; the student is never left without a seat because of a failed change.",
        "A cancellation releases the seat and marks the choice as CANCELLED rather than deleting it, so the history remains available. If no active choices remain, the parent registration also becomes CANCELLED, and the receipt snapshot marks the cancelled line. Because the action first checks that the choice is not already cancelled, repeating a cancellation request does not return the seat twice. Every change and cancellation writes replay and audit records in the same transaction.",
    ]:
        R.para(t)
    R.figure(F + "fig_change_cancel.png", "Figure 6.4 | Seat Handling When a Choice Is Changed or Cancelled", width=6.3)
    R.heading("6.6 Receipts", 2)
    for t in [
        "Every confirmed registration receives a receipt number of the form `ELC-<year>-<term>-<sequence>`, for example ELC-2026-EVEN-000048. The sequence is computed from the highest existing number while holding a PostgreSQL advisory lock, so two confirmations committed at the same moment cannot receive the same number; a unique constraint on the receipt number provides a further guarantee. The receipt is also stored as a JSON snapshot containing the student's details, the full class, cohort, Year Server and semester, and the confirmed subjects. Because it is a snapshot, the receipt continues to show what was confirmed even if the student's records or the subject names change later.",
        "Students see their registration record and receipt immediately after confirming (Figure 6.5) and can download it as a PDF, which is generated in the browser with jsPDF, or print it. During testing it was observed that the term part of the receipt number is derived from the event's name — it is ODD only if the name contains the word “odd” — rather than from the semester stored on the event. As a result, the Semester 3 event in the demonstration data produced an EVEN receipt number. This defect is recorded in Chapter 8.",
    ]:
        R.para(t)
    R.figure(S + "15_after_submit.png", "Figure 6.5 | Registration Record and Receipt Shown After a Successful Submission", width=6.2)
    R.heading("6.7 Database Constraints as a Safety Net", 2)
    R.para("Application checks are complemented by constraints in the database, so that the most important rules hold even if a future change to the code is incorrect. The principal constraints are listed in Table 6.2.", after=8)
    R.table("Table 6.2 | Principal Integrity Constraints", ["Constraint", "Table", "Rule enforced"], [
        ["electives_available_seats_nonnegative", "electives", "Remaining seats can never be negative."],
        ["allocations_available_seats_nonnegative", "elective_seat_allocations", "A class quota can never be overdrawn."],
        ["student_registrations_unique", "student_registrations", "One choice per student, event and group."],
        ["student_event_registration_unique", "registrations", "One registration record per student and event."],
        ["receipt_number (unique)", "registrations", "No two registrations share a receipt number."],
        ["event_sections_*_cohort_fk", "event_sections", "A targeted class must belong to the event's cohort."],
        ["users_section_cohort_fk", "users", "A student's class must belong to the student's cohort."],
        ["invite_codes_student_section_check / _cohort_fk", "invite_codes", "A student signup code must name one class inside its cohort."],
        ["academic_sessions_years_check", "academic_sessions", "An academic year spans exactly one year (end = start + 1)."],
        ["cohort_session_terms checks", "cohort_session_terms", "Study year 1–6 and semester 1–12 when set."],
    ], widths=[2.6, 1.7, 2.3], size=10)
    R.heading("6.8 Audit Trail and Registration Replay", 2)
    for t in [
        "Two complementary logs are kept. The audit log records administrative and security-relevant actions, such as sign-ins, account creation, signup-code use, password-reset approvals, event status changes and registrations, with the user, role and a structured description of the change (Figure 6.7). Authorisation codes themselves are never written to the log. The replay log records registration activity for each event — registrations, changes, cancellations and resets — together with the seat count before and after each step.",
        "The replay log supports the Registration Replay page (Figure 6.6), which lets staff step through the order in which students registered, distinguish student submissions from manual entries made by tutors, and export the activity. This makes it possible to answer questions such as who took the last seat in a subject and when, which is difficult to establish with form-based processes. A limitation observed during testing is that the IP address column of the audit log shows a fixed placeholder value, `client-ip`, because the sign-in code does not yet read the client's address from the request.",
    ]:
        R.para(t)
    R.figure(S + "36b_replay_event.png", "Figure 6.6 | Registration Replay for an Event", width=6.2)
    R.figure(S + "45_admin_audit.png", "Figure 6.7 | Audit Log Viewed by an Administrator", width=6.2)


def chapter7(R):
    R.heading("7. SYSTEM IMPLEMENTATION", 1)
    R.heading("7.1 Development Environment", 2)
    R.para("The system was developed and tested in the environment summarised in Table 7.1.", after=8)
    R.table("Table 7.1 | Development and Test Environment", ["Item", "Details"], [
        ["Operating system", "macOS 26.6 (Apple silicon)"],
        ["Runtime", "Node.js 24.16.0"],
        ["Database (tests and screenshots)", "PostgreSQL 18.4 on the local machine, in a database created for this report"],
        ["Database (development)", "A hosted Supabase PostgreSQL project used by the team as its development database"],
        ["Package manager and tools", "npm, tsx, drizzle-kit, ESLint, TypeScript compiler"],
        ["Browser automation", "Playwright 1.64 driving Google Chrome, used to capture the screenshots in this report [26]"],
        ["Version control", "Git; the results in this report refer to commit 8861a14"],
    ], widths=[2.2, 4.4], bold_first=True)
    R.heading("7.2 Project Structure", 2)
    R.para("The repository follows the conventions of the Next.js App Router. The principal directories are described in Table 7.2.", after=8)
    R.table("Table 7.2 | Project Directory Structure", ["Path", "Contents"], [
        ["src/app/login, src/app/join", "Sign-in page and the class signup (join) page."],
        ["src/app/dashboard", "Student pages: event overview, subject explorer, elective picker, registration record and receipt."],
        ["src/app/faculty/(authenticated)", "Staff pages: dashboards, Year Servers, class roster, live window, monitor, events, electives, reports, replay, audit, users and settings."],
        ["src/app/actions", "Server Actions grouped by area (Table 4.3)."],
        ["src/app/api", "Route handlers: health check and class switching."],
        ["src/lib", "Domain modules (authentication, workspace, eligibility, window rule, seat operations, password policy) and the database client and schema in src/lib/db."],
        ["src/components", "Reusable interface components: layout shell, subject explorer, tutor tools, form controls and data tables."],
        ["src/proxy.ts", "Edge function that verifies the session cookie and guards routes by role."],
        ["drizzle", "Generated and hand-written SQL migrations, with rollback scripts in drizzle/rollback."],
        ["scripts", "Maintenance scripts: applying SQL migrations, seeding subject profiles, data clean-up."],
        ["tests", "Automated tests and the fixture helper tests/helpers/world.ts."],
    ], widths=[2.3, 4.3], size=10.5)
    R.heading("7.3 Database Schema and Migrations", 2)
    for t in [
        "The schema is declared in TypeScript with Drizzle in `src/lib/db/schema.ts`, from which drizzle-kit can create or synchronise tables. Changes that alter existing data are written as reviewed SQL files and applied with a small script, `scripts/db/apply-sql.ts`, which runs each file inside a single transaction so that a failure leaves the database unchanged. Each data-changing migration has a matching rollback script. Table 7.3 lists the migrations.",
        "Migrations that rewrite data are written to be safe to run more than once, and they archive any row they change before changing it. For example, migration 0004, which retired an earlier waitlist feature, copies every affected row into an archive table as JSON, converts waitlisted choices — which never held a seat — into cancelled choices, and only then drops the waitlist columns. Migration 0006 introduced academic sessions and cohort targeting; where it could not map existing data with confidence, it left the data unchanged and recorded it for review by an administrator rather than guessing.",
    ]:
        R.para(t)
    R.table("Table 7.3 | Database Migrations", ["File", "Change", "Rollback"], [
        ["0000–0002 (generated)", "Initial schema and early additions generated by drizzle-kit.", "—"],
        ["0003_careful_cancellation.sql", "Adds a status to each per-group choice so cancelled choices are kept rather than deleted.", "—"],
        ["0004_remove_waitlist.sql", "Retires the waitlist: archives affected rows, converts waitlisted choices to cancelled, drops waitlist columns.", "Yes"],
        ["0005_subject_profiles.sql", "Adds subject profiles for the subject explorer.", "Yes"],
        ["0006_academic_sessions.sql", "Adds academic sessions (Year Servers), cohort terms, cohort dates, event targeting and composite foreign keys.", "Yes"],
    ], widths=[2.1, 3.7, 0.8], size=10.5)
    R.heading("7.4 Authentication Implementation", 2)
    for t in [
        "Sign-in, signup and password management are implemented in `src/app/actions/auth.ts`, using `src/lib/auth.ts` for tokens and sessions. Table 7.4 lists the principal parameters. Student accounts that were created before the move from six-digit PINs to passwords, or that were created by a tutor with a default password, can still prove their old credential once; they then receive a ten-minute ticket that only allows them to set a proper password. The ticket is signed with a key derived for that purpose alone and is bound to the current password hash, so it stops working as soon as the password changes and can never be used as a session token.",
        "In production, the application refuses to sign tokens if the `JWT_SECRET` environment variable is missing or still set to the development fallback value. The edge proxy, however, verifies tokens with the same fallback when the variable is absent; setting a strong secret is therefore a deployment requirement, as noted in Section 7.9.",
    ]:
        R.para(t)
    R.table("Table 7.4 | Authentication Parameters", ["Parameter", "Value"], [
        ["Password hashing", "bcrypt, cost factor 12"],
        ["Password policy", "At least 8 characters, a letter and a number; not the register number or a blocked common password; at most 72 bytes"],
        ["Session token", "JWT, HS256, valid for 2 hours, in an HTTP-only, SameSite=Lax cookie (Secure in production)"],
        ["Single active session", "Random session identifier per sign-in, compared with the user record on every request"],
        ["Sign-in rate limit", "5 failed attempts per identifier, then locked for 15 minutes"],
        ["Password upgrade ticket", "Separate signing key, 10-minute validity, bound to the current password hash"],
        ["Tutor-authorised reset code", "Format RST-XXXXXX from an unambiguous alphabet, valid for 24 hours, not written to logs"],
    ], widths=[2.2, 4.4], bold_first=True)
    R.heading("7.5 Student Interface", 2)
    for t in [
        "After signing in, a student is taken to the event for their class. If the event has not yet opened, the application sends the student to a countdown page (in the version tested this page failed with a server error, as reported in Chapter 8); once the window opens, the student sees the elective picker. The picker is a client component that keeps the student's selections in memory, shows the remaining seats for each subject, offers a details view and a side-by-side comparison of subjects, and enables the confirmation button only when every basket has a choice. When the picker receives a realtime notification that a subject's seats have changed, it updates the counts and disables subjects that have become full.",
        "The registration record page (Figure 6.5) shows the confirmed choices with buttons to change or cancel each one while the window is open, the closing time, and the receipt with a copy button for the receipt number. Errors are shown in plain language and identify what the student can do next, for example when the student is offline or when the window has closed.",
    ]:
        R.para(t)
    R.heading("7.6 Staff Interface", 2)
    for t in [
        "Staff pages share an application shell with a collapsible sidebar, a command palette for quick navigation, and the current Year Server and class at the top. The class tutor's dashboard (Figure 7.1) summarises the current event for the active class: the number of students registered, the number of subjects and baskets, the share of seats allocated, the latest registrations and the students who have not yet registered, with a button to copy their e-mail addresses for a reminder.",
        "The Live Window page (Figure 7.2) is where a tutor controls the registration window: it shows the time remaining, the progress of the event through its stages, the number of students registered and seats filled, a chart of the distribution of choices across subjects, and the settings for the opening and closing times and whether editing is allowed. The class page lists the students of the class with their submission status and provides the tools to add students, import a CSV file, issue signup codes and handle password resets.",
    ]:
        R.para(t)
    R.figure(S + "22_tutor_dashboard.png", "Figure 7.1 | Class Tutor Dashboard for the Active Class", width=6.2)
    R.figure(S + "24_tutor_window.png", "Figure 7.2 | Live Window Page Used by a Class Tutor to Control Registration", width=6.2)
    R.heading("7.7 Live Monitoring and Realtime Updates", 2)
    for t in [
        "The Live Registration Monitor (Figure 7.3) gives coordinators and tutors a view of an event while it is running: student turnout, submissions per minute, seat saturation, the number of full subjects, participation by class, seat saturation for each subject, and a stream of recent activity that can be filtered to confirmations, changes or cancellations. The page refreshes automatically at a selectable interval, and staff can pause, resume or close the window and export the activity stream as CSV from the same page.",
        "Live updates use Supabase Realtime [24]. The student picker and the subject explorer subscribe to changes on the subject table, and the tutor's class page subscribes to changes in registrations; a presence channel shows which students are currently online. These subscriptions improve responsiveness, but no rule depends on them: the subject explorer also polls every thirty seconds, the monitor polls on its own interval, and every action re-checks seats on the server. During the screenshot session, realtime was intentionally not configured in the isolated copy of the application, which is why the student pages in this report show a “Reconnecting” indicator. The monitor also displayed the message that the window was closed for new submissions while the Semester 3 event was in fact open to students; this inconsistency is recorded in Chapter 8.",
    ]:
        R.para(t)
    R.figure(S + "34_coord_monitor.png", "Figure 7.3 | Live Registration Monitor for the Semester 3 Event", width=6.2)
    R.heading("7.8 Reports and Exports", 2)
    for t in [
        "Coordinators have a programme-level Reports page (Figure 7.4) that lists, for the selected Year Server, each student with their class, allotted subjects and receipt number, with search, filters by class and event, and export to CSV and PDF. Tutors have a class report with the same information for their class, a summary of registration progress and an enrolment chart by subject. Every report carries the full class and Year Server identity, so exported files from different cohorts cannot be confused.",
    ]:
        R.para(t)
    R.figure(S + "35_coord_reports.png", "Figure 7.4 | Coordinator Reports Page with Allotments by Student", width=6.2)
    R.heading("7.9 Configuration and Deployment Considerations", 2)
    for t in [
        "The application is configured through environment variables, listed in Table 7.5. A health endpoint, `/api/health`, reports whether the database is reachable and whether the expected configuration is present; it can also create the first administrator account, which in production requires a separate setup secret. Administrators can switch on maintenance mode, which shows a maintenance page and makes registration actions refuse requests.",
        "The project includes deployment notes for hosting on a Node.js platform with a pooled PostgreSQL connection. At the time of writing the system has been run only in development environments; it has not been deployed for a live registration cycle, and the settings recommended in the deployment notes, such as connection pool sizes, have not been validated under load.",
    ]:
        R.para(t)
    R.table("Table 7.5 | Configuration Variables", ["Variable", "Purpose"], [
        ["DATABASE_URL", "Connection string used by the application (a pooled connection in production)."],
        ["DIRECT_URL", "Direct connection used by drizzle-kit for schema changes."],
        ["JWT_SECRET", "Secret for signing session tokens; must be a strong random value in production."],
        ["NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase project used for realtime updates (optional)."],
        ["SETUP_SECRET, INITIAL_ADMIN_PASSWORD", "Controlled creation of the first administrator account through the health endpoint."],
    ], widths=[2.8, 3.8], size=10.5)
