"""Front matter and Chapters 1–3."""

TITLE_LINES = ["ELECTIFY: A COHORT-ISOLATED", "ELECTIVE REGISTRATION SYSTEM WITH", "TRANSACTIONAL SEAT ALLOCATION"]
TITLE = "ELECTIFY: A COHORT-ISOLATED ELECTIVE REGISTRATION SYSTEM WITH TRANSACTIONAL SEAT ALLOCATION"
TEAM = [
    ("MATHESHWARAN R", "RA2532241010311"),
    ("SUHAS C", "RA2532241010312"),
    ("NITHYASHREE K", "RA2532241010329"),
    ("DEVANANDA E", "RA2532241010332"),
]

ACKNOWLEDGEMENT = [
    "We thank the Almighty, and our parents and families, whose encouragement carried us through this project and the rest of the MCA programme.",
    "We are grateful to Dr. T. R. Paarivendhar, Chancellor, SRM Institute of Science and Technology, for the institution and the facilities within which this work was done.",
    "We thank Dr. A. Duraisamy, Dean, and Dr. S. Albert Antony Raj, Deputy Dean, Faculty of Science and Humanities, for supporting project work in the faculty.",
    "We thank Dr. P. J. Arul Leena Rose, Professor and Head, Department of Computer Applications, for her support during the project and its reviews.",
    "Our guide, Dr. V. Nisha, Assistant Professor, Department of Computer Applications, advised us throughout the project. We are grateful for her direction, her suggestions and her patience with our questions.",
    "Finally, we thank the faculty members of the department, whose comments at the reviews improved the work, and our classmates and friends, who supported us while the system was being built.",
]

ABSTRACT = [
    "Elective registration in a university department is a short, intense activity. Within a fixed window, every student of a class must choose a limited number of subjects from groups such as professional and open electives, and each subject has a fixed number of seats. When the process is run with paper forms, spreadsheets or general-purpose online forms, seat limits are applied by hand, several students can be promised the same last seat, and staff have little visibility of who has registered until the window has closed. A further difficulty arises when a department runs several admission batches at once: classes from different years can share a section name, and choices made by one cohort must never consume seats or appear in the records of another.",
    "This project presents Electify, a web-based elective registration system built with Next.js 16, React 19, TypeScript, the Drizzle ORM and PostgreSQL. The academic structure is modelled as faculties, departments, programmes, admission batches and classes, and each academic year is managed as a separate “Year Server” workspace in which staff see only the classes they are responsible for. Students join their class with a signup code issued by the class tutor, sign in with their register number and password, explore the subjects offered to their class, and submit their choices during the registration window. Every submission is processed in a single database transaction that locks the chosen subject rows, applies the subject capacity and any class quota, records the choice and issues a receipt. Changes and cancellations follow the same discipline, so a seat is either held by exactly one student or returned to the pool.",
    "Class tutors, course coordinators and administrators have role-specific tools for managing classes, events, subjects, seat quotas, live monitoring, reports, an audit log and a replay of registration activity. The implementation was checked at two levels. At the server level, 136 automated tests in 18 suites, run against a PostgreSQL database, cover cohort isolation, concurrent access to the last seat, changes and cancellations, onboarding, password policy, access control and data migrations. At the browser level, 36 end-to-end tests drive the application in Google Chrome with synthetic data: they reload every important page for each role, follow a student from sign-in to cancellation while checking the database, and examine layout at seven screen sizes and accessibility with an automated checker. All tests passed in the runs reported here. Defects found while building these tests were corrected and given regression tests; they are described in Chapter 8 together with the limits of the testing.",
]
KEYWORDS = "Elective registration, seat allocation, concurrency control, PostgreSQL transactions, role-based access control, Next.js, cohort isolation, web application."


def chapter1(R):
    R.heading("1. INTRODUCTION", 1)
    R.heading("1.1 Background", 2)
    for t in [
        "Most postgraduate and undergraduate programmes include elective courses. An elective allows a student to shape part of the programme around an area of interest, and it allows a department to offer specialised subjects without making them compulsory for everyone. In a typical semester a class is asked to choose one subject from a group of professional electives and one from a group of open electives, while each subject can accept only as many students as its teaching resources allow.",
        "Collecting these choices sounds simple, but the activity has several properties that make it difficult to run well. Registration happens inside a short window, and many students act in the first few minutes because popular subjects fill quickly. Seat limits must be respected exactly; if two students are told that they have the last seat in a subject, one of them has to be moved later, which is unfair to the student and creates extra work for staff. Students also need clear information about each subject before they choose, and staff need an accurate, current view of who has registered and who has not.",
        "A department rarely runs a single cohort at a time. In a two-year MCA programme, for example, the first-year and second-year batches are both active, and each may have classes with the same section letter. The registration for one cohort's third semester must not be visible to, or consume seats from, the other cohort. The same faculty member may also be the class tutor of classes in different batches, so the system must keep the classes apart while still allowing one account to manage both.",
        "Web technology now makes it practical for a department to run this process on its own system. Modern frameworks allow the user interface and the server logic to live in one code base, and relational databases such as PostgreSQL provide transactions and row-level locks that can enforce seat limits even when many requests arrive at the same moment [14], [15]. Electify was developed to apply these capabilities to the specific problem of elective registration in a department, with attention to correctness under concurrency, separation of cohorts and clear role boundaries for staff.",
    ]:
        R.para(t)
    R.heading("1.2 Problem Statement", 2)
    for t in [
        "When elective registration is handled through paper forms, shared spreadsheets or general online form tools, the seat limit of a subject is not enforced at the moment a student submits a choice. Allocation is decided afterwards by staff, often on a first-come basis reconstructed from timestamps, and disputes are resolved manually. Students cannot see how many seats remain, staff cannot see progress while the window is open, and a record of what was chosen and changed is difficult to reconstruct.",
        "A simple web form backed by a database does not solve the problem by itself. If the application reads the remaining seat count, checks it and then writes a new value in separate steps, two simultaneous requests can both read the same count and both succeed, producing an overbooked subject; this is the classic lost-update problem described in the database literature [7], [10]. In addition, a system that serves several batches must make sure that a student only sees the event meant for their own class, that staff can act only on the classes assigned to them, and that a value supplied by the browser (such as a cookie naming a class) can never widen a user's access.",
        "The problem addressed by this project can therefore be stated as follows: *to design and implement a departmental elective registration system that enforces subject capacity and class quotas exactly under concurrent use, keeps admission cohorts and academic years isolated from each other, gives each staff role only the access it needs, and provides students with clear subject information and a verifiable record of their registration.*",
    ]:
        R.para(t)
    R.heading("1.3 Objectives and Scope", 2)
    R.heading("1.3.1 Objectives", 3)
    R.para("The main objective of the project is to build a working elective registration system for a department and to verify its behaviour with automated tests. The specific objectives are:", indent=0, after=6)
    R.items([
        "To model the academic structure of faculties, departments, programmes, admission batches and classes, and to organise each academic year as a separate workspace.",
        "To let students join their own class securely using a tutor-issued signup code, and to sign in with their register number and a password that meets a defined policy.",
        "To allow staff to create registration events for specific classes, with elective groups, subjects, seat capacities and optional class quotas.",
        "To enforce the registration window on the server and to process every registration, change and cancellation as a single database transaction that cannot overbook a subject.",
        "To issue a receipt for each confirmed registration and to keep an audit log and a replay record of registration activity.",
        "To give class tutors, course coordinators and administrators role-specific dashboards, live monitoring and reports limited to the classes they manage.",
        "To provide students with a subject explorer that shows the subjects offered to their class, the remaining seats and supplementary guidance about each subject.",
        "To verify the system with automated tests that cover cohort isolation, concurrency, access control, onboarding and data migrations.",
    ], kind="number")
    R.heading("1.3.2 Scope of the Project", 3)
    for t in [
        "The project covers the full registration workflow of a department: setting up the academic structure and Year Servers, onboarding students into classes, preparing registration events, running the registration window, monitoring progress, and producing reports and receipts. It supports four roles — system administrator, course coordinator, class tutor and student — and keeps the data of different cohorts and academic years separate.",
        "Allocation in the current version follows the order in which confirmed requests are committed: a student who submits while seats remain receives a seat, and the database guarantees that the capacity is never exceeded. Preference-based allocation schemes, such as ranking several subjects and running an assignment algorithm after the window closes, are outside the scope of this version and are discussed as future work.",
        "The project does not integrate with the university's central student information or examination systems, and it does not send e-mail or SMS notifications. It has been developed and tested on development databases with fictional data; it has not been deployed for an actual registration cycle, and no claims are made about its performance under production load.",
    ]:
        R.para(t)


def chapter2(R):
    R.heading("2. LITERATURE SURVEY", 1)
    R.para("This chapter reviews the published work and technical standards that informed the design of Electify. The survey covers four areas: how courses and electives can be allocated to students, how databases keep shared data consistent under concurrent access, how access to a multi-user system is controlled, and how passwords and sessions should be handled. It closes with the gap that the project addresses.")
    R.heading("2.1 Course Allocation in Higher Education", 2)
    for t in [
        "Assigning students to courses with limited capacity is a well-studied allocation problem. Gale and Shapley's work on stable matching [1] introduced the idea of matching two sides of a market according to preferences, and it remains the starting point for many admission and assignment schemes. Course allocation differs from simple matching because each student usually needs several courses and each course accepts many students.",
        "Budish and Cantillon studied the course allocation mechanism used at Harvard Business School, in which students take turns choosing courses in a draft [2]. Their analysis showed that students behave strategically under such mechanisms and that a mechanism which looks fair on paper can produce unequal outcomes in practice. Budish later proposed the approximate competitive equilibrium from equal incomes mechanism, in which students receive equal budgets of artificial currency and courses are priced so that demand matches capacity [3]. These studies show that the choice of allocation rule has real consequences for fairness and efficiency.",
        "Many departments, however, use a simpler rule: students register during a window and seats are given in the order in which confirmed requests arrive. This rule is easy to explain and requires no ranking of preferences, but it is only fair if the system applies it exactly — every confirmed seat must correspond to a real seat, and the order must be decided by the system rather than reconstructed afterwards. Electify implements this rule and makes its enforcement a property of the database transaction, while leaving room for more elaborate mechanisms in future versions.",
    ]:
        R.para(t)
    R.heading("2.2 Transactions and Concurrency Control", 2)
    for t in [
        "Codd's relational model [4] and the entity-relationship approach proposed by Chen [5] provide the conceptual basis for storing structured academic data, such as programmes, batches, classes and registrations, as related tables with keys and constraints. Textbooks such as Silberschatz, Korth and Sudarshan [6] describe how these concepts are realised in relational database systems, including referential integrity and check constraints.",
        "When many users update the same data at the same time, the database must decide how their operations interleave. Eswaran, Gray, Lorie and Traiger formalised the notion of consistency and the role of locking in achieving serialisable execution [7], and Gray and Reuter's treatment of transaction processing [8] describes the locking, logging and recovery techniques used by commercial systems. Berenson and colleagues showed that the isolation levels defined in the SQL standard permit anomalies, such as lost updates and write skew, that developers often assume are impossible [9].",
        "Kleppmann discusses these anomalies from the point of view of application developers and recommends explicit locking, for example `SELECT … FOR UPDATE`, or atomic update statements when an application must read a value and then write a value that depends on it [10]. The PostgreSQL documentation describes the row-level locks, advisory locks and isolation levels that the database provides [14], [15]. Electify follows this guidance: every seat change locks the affected subject rows, the locks are always taken in the same order to avoid deadlocks, and check constraints reject any negative seat count as a final safeguard.",
    ]:
        R.para(t)
    R.heading("2.3 Access Control", 2)
    for t in [
        "Saltzer and Schroeder's principles for the protection of information [11] include least privilege, complete mediation (every access is checked) and fail-safe defaults. These principles remain the basis of modern access-control design. Role-based access control, introduced by Ferraiolo and Kuhn [12] and developed into a family of models by Sandhu and colleagues [13], grants permissions to roles rather than to individual users, which matches the way a department assigns responsibilities to administrators, coordinators and class tutors.",
        "Pure role-based control is not sufficient for a departmental system, because two class tutors share the same role but must manage different classes. The permission therefore depends on both the role and the user's relationship to the data, which is sometimes described as attribute-based or relationship-based control. The OWASP Top 10 lists broken access control as the most common serious weakness in web applications [16], and many of its examples involve exactly this situation: a user with a valid role who can reach another user's records by changing an identifier in a request. Electify addresses this by deriving each staff member's scope from trusted database records on every request and by checking the scope inside each server action.",
    ]:
        R.para(t)
    R.heading("2.4 Authentication and Session Management", 2)
    for t in [
        "Passwords should never be stored in recoverable form. Provos and Mazières designed bcrypt, an adaptive hashing function whose cost can be increased as hardware becomes faster [17]. The current NIST guideline on authenticators, SP 800-63B-4, asks verifiers to screen new passwords against lists of commonly used or compromised values, to limit failed attempts, and not to force periodic changes. It sets a minimum of 15 characters for a password that is the only authentication factor, and it rules out composition rules such as requiring particular character classes [18]. Section 4.6 compares Electify's password policy with these requirements. The OWASP Application Security Verification Standard provides a checklist of requirements for authentication and session management [19].",
        "JSON Web Tokens, defined in RFC 7519 [20], are a compact way to carry signed claims, such as a user identifier and role, between the server and the browser. A signed token proves that the server issued it, but it cannot by itself be revoked before it expires; a system that needs revocation must keep some server-side state as well. Section 4.6 describes how Electify pairs a short-lived token with a session identifier held in the database for this reason.",
    ]:
        R.para(t)
    R.heading("2.5 Web Application Frameworks", 2)
    for t in [
        "The project uses Next.js [21], a React-based framework [22] in which pages can be rendered on the server and in which server-side functions, called Server Actions, can be invoked directly from user-interface components. This keeps validation and database access on the server while avoiding a separate hand-written API layer. Database access uses the Drizzle ORM [23], which describes tables in TypeScript and produces typed SQL queries, and live updates use Supabase Realtime, which broadcasts database changes to subscribed browsers over WebSockets [24]. Server-side tests use the test runner built into Node.js [25]. Browser-level tests are written with Playwright [26], and accessibility is checked with axe-core [27], which tests rendered pages against rules derived from the Web Content Accessibility Guidelines (WCAG) 2.1 [28].",
    ]:
        R.para(t)
    R.heading("2.6 Research Gap", 2)
    for t in [
        "The sources reviewed above address the parts of the problem separately. The allocation literature [1]–[3] concentrates on the rules that decide who receives which course, and assumes that the chosen rule is carried out correctly. The database literature [7]–[10], [14], [15] explains how to keep shared data consistent but is not specific to course registration. The access-control literature [11]–[13], [16] gives general principles that must be translated into concrete checks for a particular organisation.",
        "For a department that wants to run elective registration on its own system, these ideas have to be combined in one place: the seat rule must be enforced inside a transaction, the data of each cohort and academic year must be kept apart, and staff permissions must follow the department's assignment of classes. Electify was built to bring these concerns together in a single, testable application, and this report documents how each of them is implemented and verified.",
    ]:
        R.para(t)
    R.heading("Summary of the Literature Survey", 3)
    R.para("The survey identifies first-come allocation as a simple and widely understood rule whose fairness depends on exact enforcement; explicit row locking and database constraints as the standard means of enforcing such a rule under concurrency; role- and relationship-based checks as the basis of access control; and adaptive password hashing, rate limiting and revocable sessions as current practice for authentication. These findings directly shaped the design described in the following chapters.")


def chapter3(R):
    R.heading("3. SYSTEM ANALYSIS", 1)
    R.heading("3.1 Existing System", 2)
    for t in [
        "Where a department has no dedicated system, elective choices are commonly collected in one of three ways: on paper forms returned to the class tutor, in a shared spreadsheet that students or tutors edit, or through a general-purpose online form whose responses are exported to a spreadsheet. In each case the form records a request, and the decision about whether a seat is available is taken later by a member of staff.",
        "These approaches have the advantage of needing no development effort, and they work adequately for small classes with generous seat limits. Their weaknesses appear when demand for a subject exceeds its capacity, when several classes share subjects, and when students change their minds during the window.",
    ]:
        R.para(t)
    R.heading("Limitations of the Existing System", 3)
    R.items([
        "Seat limits are not checked when a choice is made, so more students may select a subject than it can accept.",
        "Allocation is reconstructed afterwards from submission times or by hand, which is slow and difficult to justify to students.",
        "Students cannot see how many seats remain, so they cannot make an informed second choice.",
        "Staff have no live view of who has registered and who still needs a reminder.",
        "Changes and withdrawals are handled informally, and there is no reliable record of what was changed and when.",
        "When several batches are active, the responses of different cohorts can be mixed in the same sheet or form.",
        "Access to a shared sheet is all-or-nothing; a person who can edit it can alter anyone's entry.",
    ])
    R.heading("3.2 Proposed System", 2)
    for t in [
        "Electify replaces the form-and-spreadsheet process with a web application in which the seat rule is enforced at the moment of submission. Staff prepare a registration event for one or more classes of a cohort, define elective groups and subjects with their capacities, and set the opening and closing times. Students see only the event for their own class. When a student confirms a choice, the server locks the subject rows, checks the remaining seats and either confirms the registration and issues a receipt or reports that the seat has just been taken, all within one transaction.",
        "Each academic year is handled as a Year Server: a workspace that contains the cohorts studying in that year and the events created for them. Staff choose a Year Server when they sign in, and every page and action is limited to the classes they manage inside it. The system distinguishes four roles, summarised in Table 3.1.",
    ]:
        R.para(t)
    R.table("Table 3.1 | User Roles and Responsibilities", ["Role", "Main responsibilities"], [
        ["System Administrator", "Creates Year Servers, faculties, departments, programmes and staff accounts; issues staff invite codes; sets how many classes a tutor may manage; has access to every class, the audit log, the database tools and maintenance mode. The root administrator account cannot be deleted, deactivated or demoted."],
        ["Course Coordinator", "Manages the classes of their programme: registration events, elective groups, subjects, seat allocations and class quotas, event templates, live monitoring and programme-wide reports."],
        ["Class Tutor", "Claims and manages classes of any programme in their department, up to the administrator's limit: class roster, signup codes, password-reset approvals, registration window timers, live window, manual registration on behalf of a student, and class reports."],
        ["Student", "Joins a class with a signup code, explores subjects, registers, changes or cancels choices while the window is open, and downloads a receipt."],
    ], widths=[1.6, 5.0], bold_first=True)
    R.para("The proposed system follows the overall flow shown below. The detailed design of each part is presented in Chapters 4 to 6.", indent=0.5)
    R.items([
        "An administrator creates a Year Server and links the cohorts that study in it; staff accounts are created through invite codes.",
        "A class tutor issues a class signup code; students use it to create accounts that are attached to that class.",
        "A coordinator or tutor prepares a registration event for the class, with groups, subjects, seats and the registration window.",
        "Students explore the subjects and, once the window opens, submit their choices; each submission is confirmed or rejected atomically.",
        "Staff watch progress live, follow up with students who have not registered, and export reports when the window closes.",
    ], kind="number")
    R.heading("3.3 Functional and Non-Functional Requirements", 2)
    R.heading("3.3.1 Functional Requirements", 3)
    R.para("The functional requirements identified for the system are listed in Table 3.2. Each requirement is implemented in the current version of the application.", after=8)
    R.table("Table 3.2 | Functional Requirements", ["ID", "Requirement"], [
        ["FR1", "The system shall allow an administrator to create Year Servers and to link admission cohorts to them with their study year and semester."],
        ["FR2", "The system shall allow a class tutor to generate, list and revoke class signup codes with an expiry date and a maximum number of uses."],
        ["FR3", "The system shall let a student create an account only through a valid signup code, attaching the account to the class named by the code."],
        ["FR4", "The system shall authenticate students by register number and password, and staff by e-mail address and password."],
        ["FR5", "The system shall let staff create registration events for selected classes of one cohort, with elective groups, subjects, seat capacities and opening and closing times."],
        ["FR6", "The system shall allow coordinators to reserve seats of a subject for particular classes (class quotas)."],
        ["FR7", "The system shall show a student only the events and subjects offered to the student's own class."],
        ["FR8", "The system shall accept a registration only while the window is open, and only if a seat is available to the student."],
        ["FR9", "The system shall allow a student to change or cancel a choice while the window is open, subject to the event's settings."],
        ["FR10", "The system shall issue a receipt with a unique number for every confirmed registration."],
        ["FR11", "The system shall provide staff with live monitoring, a list of students who have not registered, and exportable reports."],
        ["FR12", "The system shall record significant actions in an audit log and registration activity in a replay log."],
        ["FR13", "The system shall support a tutor-authorised password reset for students."],
        ["FR14", "The system shall let a tutor claim classes from any programme of the tutor's department, up to a limit set by the administrator, and keep each class's roster separate."],
    ], widths=[0.7, 5.9], bold_first=True)
    R.heading("3.3.2 Non-Functional Requirements", 3)
    R.table("Table 3.3 | Non-Functional Requirements", ["Quality", "Requirement"], [
        ["Correctness", "The number of confirmed registrations for a subject or class quota must never exceed its capacity, even when requests arrive simultaneously."],
        ["Isolation", "Data belonging to one cohort or Year Server must not be visible to, or modifiable by, users who are not responsible for it."],
        ["Security", "Passwords must be hashed with an adaptive function; sign-in attempts must be rate limited; every server action must check the caller's role and scope."],
        ["Auditability", "Registrations, changes, cancellations and administrative actions must leave a durable record."],
        ["Usability", "Students must be able to complete registration with a small number of clear steps and see seat availability before confirming."],
        ["Reliability", "A failed submission must leave no partial data; the student's selections must be preserved so that the attempt can be repeated."],
        ["Maintainability", "Business rules such as the registration window and seat accounting must be defined once and reused by every page and action."],
    ], widths=[1.4, 5.2], bold_first=True)
    R.heading("3.4 Advantages of the Proposed System", 2)
    R.items([
        "**Exact seat enforcement** – capacity and class quotas are checked inside a locked transaction, so a subject cannot be overbooked.",
        "**Cohort and year isolation** – events, subjects, seats and reports are tied to a class and a Year Server, so batches do not interfere with each other.",
        "**Scoped staff access** – each staff member can act only on the classes their role and assignments allow.",
        "**Transparency for students** – remaining seats and subject information are visible before and during registration, and every confirmation produces a receipt.",
        "**Live visibility for staff** – tutors and coordinators can see progress and pending students while the window is open.",
        "**Traceability** – audit and replay logs record who did what and how seat counts changed.",
        "**Single source of rules** – the window rule and seat accounting are implemented once and shared by the user interface and the server.",
    ])
