"""Chapters 4 and 5."""
from docx.enum.text import WD_ALIGN_PARAGRAPH

F = "figures/"
S = "assets/screens/"


def chapter4(R):
    R.heading("4. SYSTEM ARCHITECTURE AND DESIGN", 1)
    R.heading("4.1 Overall Architecture", 2)
    R.para("Electify is a full-stack web application organised in four tiers, shown in Figure 4.1. Students and staff use the application through a browser. Every request first passes through a small edge function, `src/proxy.ts`, which verifies the signed session cookie and sends users who are not signed in, or who request a page for another role, to the appropriate place. The application tier is a Next.js 16 App Router application: pages are React Server Components that read data on the server, and all changes are made through Server Actions, which are server-side functions called from the user interface [21].")
    R.figure(F + "fig_architecture.png", "Figure 4.1 | System Architecture of Electify", width=6.2)
    for t in [
        "The business rules are kept in a small set of domain modules under `src/lib`. The most important are `auth.ts` (session tokens and the single-session check), `workspace.ts` (the classes a staff member may manage), `student-events.ts` (which events a student may see), `registration-window.ts` (whether a window is open), `seat-ops.ts` (taking and releasing seats) and `password-policy.ts`. Pages and actions call these modules rather than repeating the rules, so the user interface and the server always agree.",
        "The data tier is a PostgreSQL database accessed through the Drizzle ORM and a node-postgres connection pool. Integrity rules that must never be broken, such as non-negative seat counts and the requirement that a class belongs to its cohort, are written as database constraints in addition to being checked in code. Supabase Realtime is used as an optional side channel: when subject or registration rows change, subscribed browsers are notified and refresh their seat counts. Pages also refresh on their own, so the application remains correct when the realtime channel is unavailable.",
    ]:
        R.para(t)
    R.heading("4.2 Technology Stack", 2)
    R.para("The technologies used in the project are listed in Table 4.1. Versions are those declared in the project's `package.json` at the time of writing.", after=8)
    R.table("Table 4.1 | Technology Stack", ["Layer", "Technology (version)", "Purpose in Electify"], [
        ["Language", "TypeScript 5", "Static typing for the whole code base, shared by client and server."],
        ["Framework", "Next.js 16.2 (App Router, Turbopack)", "Server-rendered pages, Server Actions, route handlers and the edge proxy."],
        ["User interface", "React 19.2, Tailwind CSS 4, Base UI, Lucide icons, Framer Motion", "Components, layout, styling, accessible primitives and motion."],
        ["Forms and validation", "React Hook Form 7, Zod 4", "Form state on the client; input validation on the server."],
        ["Database", "PostgreSQL", "Relational storage, transactions, row locks and constraints."],
        ["Data access", "Drizzle ORM 0.45, drizzle-kit 0.31, node-postgres 8", "Typed schema and queries; schema synchronisation."],
        ["Authentication", "jose 6 (JWT), bcryptjs 3", "Signed session tokens; password hashing."],
        ["Live updates", "Supabase JS client 2 (Realtime)", "Change notifications and presence for dashboards."],
        ["Documents", "jsPDF 4, jspdf-autotable 5", "Receipt and report PDFs generated in the browser."],
        ["Charts and notifications", "Recharts 3, Sonner 2", "Dashboard charts and toast messages."],
        ["Testing", "Node.js test runner via tsx 4", "Automated tests against a PostgreSQL database."],
    ], widths=[1.3, 2.3, 3.0], bold_first=True)
    R.heading("4.3 Data Flow Diagram", 2)
    for t in [
        "Figure 4.2 presents the level-1 data flow diagram. The four external actors interact with five processes. Students authenticate and onboard through process 1.0 and register through process 3.0, which reads the offerings prepared by coordinators and tutors in process 2.0. Process 3.0 writes registrations and, in the same transaction, the replay and audit records. Process 4.0 reads these stores to produce live monitoring, reports and the registration replay. Administrators maintain Year Servers, cohorts and accounts through process 5.0, and the class and cohort data it maintains are used by process 3.0 to decide eligibility.",
        "The diagram shows an important design decision: no process accepts a student's class or cohort from the browser. The class always comes from stored data — the signup code at onboarding and the user record afterwards.",
    ]:
        R.para(t)
    R.figure(F + "fig_dfd.png", "Figure 4.2 | Level-1 Data Flow Diagram", width=6.4)
    R.heading("4.4 Database Design", 2)
    for t in [
        "The database schema is defined in `src/lib/db/schema.ts`. Figure 4.3 shows the principal tables and their relationships, and Table 4.2 summarises their purpose. The academic hierarchy runs from faculties to departments, programmes, admission batches (cohorts) and sections (classes). A cohort is identified by its programme and admission year and does not change as students progress; the study year and semester of a cohort in a given academic year are stored separately in `cohort_session_terms`, linked to `academic_sessions`, which represent Year Servers.",
        "A registration event belongs to exactly one cohort and one academic session. The classes it is open to are listed in `event_sections`, which repeats the cohort identifier so that composite foreign keys can guarantee that every targeted class belongs to the event's own cohort. The same technique is used on `users` and `invite_codes`, so a student or a signup code can never point to a class of a different cohort. Elective groups belong to an event, subjects (`electives`) belong to a group, and optional class quotas are stored in `elective_seat_allocations`.",
        "Each student's registration for an event is represented by one row in `registrations`, which holds the overall status, the receipt number and a JSON snapshot of the receipt, and by one row per elective group in `student_registrations`. A unique constraint on student, event and group ensures that a student can hold at most one choice per group.",
    ]:
        R.para(t)
    R.figure(F + "fig_er.png", "Figure 4.3 | Entity-Relationship Diagram of the Principal Tables", width=6.4)
    R.table("Table 4.2 | Principal Database Tables", ["Table", "Purpose"], [
        ["faculties, departments, programmes", "Academic hierarchy of the institution."],
        ["academic_batches", "Admission cohorts: programme, admission year and expected end year."],
        ["sections", "Classes within a cohort (for example MCA F of the 2025 cohort)."],
        ["academic_sessions", "Year Servers (academic years) with status PLANNED, ACTIVE or ARCHIVED."],
        ["cohort_session_terms", "Which cohorts study in a Year Server, with their study year and semester."],
        ["users", "All accounts and roles; students are linked to their cohort and class."],
        ["tutor_sections", "Assignment of staff members to the classes they tutor."],
        ["invite_codes", "Staff invite codes and class signup codes with expiry and usage limits."],
        ["registration_events, event_sections", "Registration events and the classes each event is open to."],
        ["elective_groups, electives", "Elective baskets and subjects with capacity and remaining seats."],
        ["elective_seat_allocations", "Seats of a subject reserved for a particular class."],
        ["registrations, student_registrations", "Each student's registration, receipt and per-group choices."],
        ["replay_events, audit_logs", "Registration activity with seat counts; administrative audit trail."],
        ["login_attempts, pin_reset_requests", "Sign-in rate limiting; tutor-authorised password resets."],
        ["subject_profiles, event_templates", "Student-facing subject guidance; reusable event blueprints."],
    ], widths=[2.4, 4.2], bold_first=True)
    R.heading("4.5 Module Design", 2)
    for t in [
        "The server-side logic is divided into Server Action modules under `src/app/actions`, each serving one area of the application. Every exported action begins by establishing who the caller is and what they may access, and only then reads or writes data. Table 4.3 lists the modules.",
    ]:
        R.para(t)
    R.table("Table 4.3 | Server Action Modules", ["Module", "Responsibility"], [
        ["auth.ts", "Staff and student sign-in, staff registration with invite codes, class-code validation and student signup, password upgrade and password reset."],
        ["register.ts", "Student registration, change, cancellation and registration details (receipt)."],
        ["tutor.ts", "Class roster, signup codes, registration window and timers, manual registration, password-reset approvals, class reports."],
        ["coordinator.ts", "Events, elective groups, subjects, class quotas, student status and programme reports."],
        ["admin.ts", "Faculties, departments, users, invite codes, audit log and maintenance mode."],
        ["year-servers.ts, academic-sessions.ts", "Year Servers, cohort terms, event targeting and review of historical data."],
        ["monitor.ts, replay.ts", "Live monitoring data, pending-student lists, window status changes, replay and activity export."],
        ["templates.ts, subjects.ts", "Event templates and subject profiles shown in the subject explorer."],
        ["dashboard.ts, database.ts, workspace.ts, user.ts", "Role dashboards, scoped maintenance operations, Year Server selection and profile updates."],
    ], widths=[2.2, 4.4], bold_first=True)
    R.heading("4.6 Authentication and Session Design", 2)
    for t in [
        "Students sign in with their register number and password, and staff with their e-mail address and password. Passwords are hashed with bcrypt using a cost factor of 12 [17]. After a successful sign-in the server issues a JSON Web Token signed with HS256 [20] and valid for two hours, and stores it in an HTTP-only cookie with the SameSite=Lax attribute; the cookie is marked Secure in production. The token carries the user's identifier, role and a random session identifier.",
        "Each user record holds the identifier of the user's current session. On every request the server compares the identifier in the token with the stored value and also checks that the account is still active. A new sign-in replaces the stored value, so an older session on another device stops working immediately, and deactivating an account ends its sessions. This combination provides the convenience of a signed token with the ability to revoke it.",
        "Failed sign-in attempts are counted per identifier; after five failures the identifier is locked for fifteen minutes. The password policy, defined once in `password-policy.ts` and used by both the forms and the server, requires at least eight characters with a letter and a number, rejects the student's register number and a list of commonly used or previously issued default passwords, and refuses passwords longer than the 72 bytes that bcrypt can process, rather than silently truncating them. This follows the emphasis of NIST SP 800-63B on length and blocklists over arbitrary composition rules [18].",
    ]:
        R.para(t)
    R.heading("4.7 Role-Based Authorisation and Staff Workspace", 2)
    for t in [
        "Authorisation is enforced at three levels. The edge proxy keeps students out of staff pages and staff out of student pages. Each page and Server Action then checks the caller's role. Finally, for staff, every action resolves a workspace: the Year Server being worked in and the set of classes the user may manage in it. Figure 4.4 shows how the workspace is resolved and the checks that actions apply.",
        "The scope is always computed from trusted data. The role is read from the user's database record rather than from the token, so a change of role takes effect at once. An administrator's scope is every class; a course coordinator's scope is every class of the programme recorded on their account plus any classes they tutor; a class tutor's scope is the set of classes assigned to them in `tutor_sections`. The selected Year Server is remembered in a cookie for convenience, but the cookie is treated purely as navigation state: it is validated on every request, and naming a class or Year Server outside the user's scope has no effect. Table 4.4 summarises the resulting permissions.",
    ]:
        R.para(t)
    R.figure(F + "fig_workspace.png", "Figure 4.4 | Staff Authorisation and Workspace Resolution", width=6.4)
    R.table("Table 4.4 | Summary of Role Permissions", ["Capability", "Admin", "Coordinator", "Tutor", "Student"], [
        ["Create Year Servers, faculties, departments, staff accounts", "Yes", "No", "No", "No"],
        ["Create and edit registration events", "All classes", "Own programme", "Own classes", "No"],
        ["Define groups, subjects and seats", "All classes", "Own programme", "Own classes", "No"],
        ["Set class quotas for a subject", "Yes", "Own programme", "No", "No"],
        ["Issue class signup codes; approve password resets", "All classes", "Own programme", "Own classes", "No"],
        ["Live monitor, reports, replay", "All classes", "Own programme", "Own classes", "No"],
        ["Audit log and maintenance mode", "Yes", "No", "No", "No"],
        ["Bulk tools (reset seats, clear registrations)", "All classes", "Own programme", "No", "No"],
        ["Register, change or cancel electives", "No", "No", "Manual entry for own class", "Own registration"],
    ], widths=[2.8, 0.9, 1.1, 1.1, 0.9], size=10, align_cols={1: WD_ALIGN_PARAGRAPH.CENTER, 2: WD_ALIGN_PARAGRAPH.CENTER, 3: WD_ALIGN_PARAGRAPH.CENTER, 4: WD_ALIGN_PARAGRAPH.CENTER})
    R.heading("4.8 User Interface Design", 2)
    for t in [
        "The interface was designed around the tasks each role performs most often. The student side has a deliberately small number of pages: sign-in, joining a class, the subject explorer, the elective picker and the registration record. The staff side uses a sidebar layout with the current Year Server and class always visible at the top, and with navigation grouped into session control, academic registry and administration. Figure 4.5 shows the sign-in page, which offers separate student and staff forms.",
        "Several principles guided the design. Seat availability is shown in the same terms everywhere — “available”, “few seats left” or “full” — using a shared function so that the subject explorer, the picker and the server agree. Destructive or irreversible actions require confirmation. Errors returned by the server carry a machine-readable code, so the interface can, for example, highlight the subject that has just filled instead of showing a generic message. Pages are responsive and work on mobile screens, which matters because many students register from their phones.",
    ]:
        R.para(t)
    R.figure(S + "01_login.png", "Figure 4.5 | Sign-in Page with Student and Staff Forms", width=6.2)
    R.heading("4.9 System Design Summary", 2)
    for t in [
        "The design separates concerns along clear lines. The edge proxy handles coarse routing, Server Actions handle requests, domain modules hold the rules, and the database holds the data together with the constraints that protect it. Correctness under concurrency is achieved through transactions and row locks rather than through checks in the browser, and isolation between cohorts and years is achieved through both scoped queries and composite foreign keys. Live updates improve the experience but are not relied upon for correctness.",
    ]:
        R.para(t)


def chapter5(R):
    R.heading("5. ACADEMIC AND ELECTIVE MANAGEMENT", 1)
    R.para("This chapter describes how the academic structure, classes, registration events and subjects are set up and managed before and during a registration window.")
    R.heading("5.1 Academic Hierarchy", 2)
    for t in [
        "The institution is modelled as faculties, departments and programmes. Each programme records its degree type, duration in years and number of semesters. An administrator manages this hierarchy from the Departments page, where faculties can be expanded to show their departments, programmes and classes.",
        "Students are organised into admission batches, referred to in this report as cohorts. A cohort is a programme together with an admission year and an expected end year, for example the MCA cohort of 2025–2027. Each cohort has one or more sections, which are the classes students belong to, such as MCA F. Because two cohorts can each have a section F, the application always labels a class with its full identity, for example “MCA F · 2025–2027”, using a single labelling function in `src/lib/academic.ts`.",
    ]:
        R.para(t)
    R.heading("5.2 Year Servers, Cohorts and Study Stages", 2)
    for t in [
        "Each academic year is managed as a Year Server, stored as an academic session with a start year, an end year one year later, and a status of PLANNED, ACTIVE or ARCHIVED. A cohort studies in several consecutive Year Servers, and its study year and current semester in each one are stored in `cohort_session_terms`. When an administrator creates a Year Server, cohorts whose admission year matches are linked to it automatically as first-year cohorts; other cohorts can be added with their stage. Creation of new Year Servers is limited to two years ahead of the current year, so that planning stays realistic.",
        "When staff sign in, the system lists only the Year Servers that contain classes within their scope. If there is exactly one, it is selected automatically; if there are several, a chooser is shown (Figure 5.1). Archived Year Servers cannot be entered. The current Year Server and class remain visible in the sidebar, and if the selection is changed in another browser tab, the open page notices and refreshes, so staff never act on data from a different year by mistake. Administrators manage Year Servers from the page shown in Figure 5.2, which shows the number of programmes, classes, students and events in each.",
    ]:
        R.para(t)
    R.figure(S + "40_admin_session_select.png", "Figure 5.1 | Year Server Chooser Shown After Staff Sign-in", width=6.2)
    R.figure(S + "43_admin_year_servers.png", "Figure 5.2 | Year Server Management Page for Administrators", width=6.2)
    R.heading("5.3 Class Tutors and Student Onboarding", 2)
    for t in [
        "Staff accounts are linked to the classes they tutor through the `tutor_sections` table, and one tutor can be assigned to classes in different cohorts and Year Servers. A class tutor brings students into the system by generating a class signup code, for example `EF-MCA-F-7K2Q`. Each code names exactly one class, has an expiry date and a maximum number of uses (at most one hundred), and can be revoked at any time.",
        "Figure 5.3 shows the onboarding flow. When a student enters a code on the Join page, the server checks it and, if it is valid, shows the class, programme, department and tutor it belongs to (Figure 5.4). The student then supplies an e-mail address, register number, name and password. The account is created in a single transaction that first claims one use of the code with a conditional update — succeeding only while the code is active, unexpired and below its limit — and then inserts the user with the class and cohort taken from the code. This guarantees that two students signing up at the same moment cannot exceed the limit, and that a student can never choose their own class. If an account with the same register number or e-mail address already exists, the signup is refused, so a code cannot be used to move an existing student to another class.",
        "Students who forget their password request a reset with their register number. The request appears in the class tutor's queue; the tutor verifies the student and authorises the reset, which produces a one-time code valid for twenty-four hours. The student enters this code with a new password. Responses to reset requests are the same whether or not the register number exists, to avoid revealing which accounts are registered, and repeated wrong codes lock the reset form in the same way as failed sign-ins.",
    ]:
        R.para(t)
    R.figure(F + "fig_onboarding.png", "Figure 5.3 | Student Onboarding with a Class Signup Code", width=6.0)
    R.figure(S + "04_join_validated.png", "Figure 5.4 | Join Page After a Valid Class Signup Code Is Entered", width=6.2)
    R.heading("5.4 Registration Events and Their Lifecycle", 2)
    for t in [
        "A registration event represents one registration exercise for one cohort in one Year Server, such as the Semester 3 elective registration for the 2025 MCA cohort. It records the semester, the opening and closing times, whether students may change their choices after confirming, and whether the window should close automatically at the closing time. By default an event is created for a single class; it can be opened to several classes of the same cohort, but never to classes of another cohort.",
        "The status of an event and the registration window derived from it are shown in Figure 5.5 and Table 5.1. A coordinator moves an event from DRAFT to PUBLISHED. A published event is visible to its students; whether they may register is then decided by the window rule in `registration-window.ts`: the window is upcoming before the opening time, open from the opening time until the closing time, and closed afterwards if automatic closing is enabled. Staff can also open, pause, resume or close a window manually from the live window or the monitor. The statuses VERIFICATION and FINALIZED are recognised by the rule as closed states, but no action in the current version sets them.",
    ]:
        R.para(t)
    R.figure(F + "fig_lifecycle.png", "Figure 5.5 | Registration Event Status and Window Lifecycle", width=6.4)
    R.table("Table 5.1 | Event Statuses and Window States", ["Status / state", "Meaning", "Set by"], [
        ["DRAFT", "Being prepared; not visible to students.", "Created by staff"],
        ["PUBLISHED", "Visible to students; window state follows the opening and closing times.", "Coordinator"],
        ["UPCOMING (derived)", "Published, before the opening time; students can browse subjects but not submit.", "Window rule"],
        ["OPEN", "Students may submit, change and cancel; set manually or reached at the opening time.", "Tutor / monitor or window rule"],
        ["PAUSED", "Temporarily closed for submissions; confirmed registrations are kept.", "Tutor / monitor"],
        ["CLOSED", "No further changes; reached manually or after the closing time with automatic closing.", "Staff or window rule"],
        ["ARCHIVED", "Retained for records; not active.", "Coordinator"],
        ["VERIFICATION, FINALIZED", "Recognised as closed by the window rule; not set by any current action.", "—"],
    ], widths=[1.6, 3.6, 1.4], bold_first=True)
    R.heading("5.5 Elective Groups, Subjects and Seat Capacity", 2)
    for t in [
        "Within an event, subjects are arranged in elective groups, also called baskets, such as Professional Elective I and Open Elective I. Each group defines how many subjects a student must choose; the current registration logic accepts one choice per group. Each subject has a name, an optional course code, credits, a description, a maximum number of seats and a count of seats still available. Subjects are created per event, so the same subject offered to two cohorts in two events has two independent seat counters.",
        "A coordinator can reserve part of a subject's capacity for particular classes by defining class quotas. For example, a subject with sixteen seats may reserve eight seats for class F and eight for class G. A student of a class with a quota draws from that quota; a student of a class without a quota may only use seats that are not reserved for other classes. Figure 5.6 shows the coordinator's Electives and Seats page, which lists each basket with its subjects, seats taken, and class allotments.",
        "Events can also be created from event templates. A template stores a set of baskets and subjects that can be reused, for example when the same elective structure is offered to a new cohort. Templates are scoped to a programme; a template can be deleted only by an administrator, by a coordinator of that programme, or by the coordinator who created it.",
    ]:
        R.para(t)
    R.figure(S + "33_coord_electives.png", "Figure 5.6 | Coordinator View of Elective Baskets, Subjects and Seat Allotments", width=6.2)
    R.heading("5.6 Subject Explorer", 2)
    for t in [
        "Students often choose electives with little information beyond a subject name. The subject explorer addresses this by listing every subject offered to the student's class, with its basket, credits, remaining seats and a short description (Figure 5.7). The page is available as soon as the event is published, so students can read about the subjects before the window opens. Seat counts refresh every thirty seconds and, when realtime updates are available, immediately after a change. Opening a subject page never reserves a seat.",
        "Selecting a subject opens a detail page (Figure 5.8). Official facts — name, credits, basket, programme, department and seats — always come from the event data. Supplementary guidance, such as an overview, example topics, learning outcomes, prerequisites, an estimate of difficulty, career relevance and external learning resources, comes from a subject profile. Each section of a profile carries a label indicating whether it is official or proposed guidance, and the page states that the faculty-approved syllabus takes precedence. In the current version one bundled profile, for Cloud Computing, is included; its content is explicitly marked as not verified by faculty.",
    ]:
        R.para(t)
    R.figure(S + "11_subjects.png", "Figure 5.7 | Subject Explorer Listing the Subjects Offered to a Class", width=6.0)
    R.figure(S + "17_subject_detail.png", "Figure 5.8 | Subject Detail Page with Official Details and Labelled Guidance", width=6.2)
    R.heading("5.7 Summary", 2)
    R.para("Setting up a registration in Electify therefore involves a small number of well-defined steps: the administrator prepares the Year Server and links the cohorts, tutors bring students into their classes with signup codes, and coordinators or tutors prepare the event, baskets, subjects and quotas. Because every object is attached to a class, a cohort and a Year Server, the data of different batches stays separate throughout the process. The next chapter describes what happens when students register.")
