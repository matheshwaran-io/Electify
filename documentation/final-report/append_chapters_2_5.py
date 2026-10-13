import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os

def append_chapters_2_to_5(doc):
    COLOR_PRIMARY = RGBColor(15, 23, 42)
    COLOR_SECONDARY = RGBColor(37, 99, 235)
    COLOR_BODY = RGBColor(30, 41, 59)
    COLOR_MUTED = RGBColor(100, 116, 139)

    def set_cell_background(cell, fill_hex):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        tcPr.append(shd)

    def set_cell_margins(cell, top=100, bottom=100, left=130, right=130):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
        tcPr.append(tcMar)

    def format_run(run, font_name="Times New Roman", size_pt=12, bold=False, italic=False, color=COLOR_BODY):
        run.font.name = font_name
        run.font.size = Pt(size_pt)
        run.bold = bold
        run.italic = italic
        run.font.color.rgb = color

    def add_para(text="", align=WD_ALIGN_PARAGRAPH.JUSTIFY, space_before=0, space_after=6, line_spacing=1.5):
        p = doc.add_paragraph()
        p.alignment = align
        p.paragraph_format.space_before = Pt(space_before)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = line_spacing
        if text:
            run = p.add_run(text)
            format_run(run)
        return p

    def add_chapter_title(num, title):
        doc.add_page_break()
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(18)
        p.paragraph_format.space_after = Pt(4)
        run_num = p.add_run(f"CHAPTER {num}\n")
        format_run(run_num, size_pt=14, bold=True, color=COLOR_SECONDARY)
        run_title = p.add_run(title.upper())
        format_run(run_title, size_pt=18, bold=True, color=COLOR_PRIMARY)
        p_div = doc.add_paragraph()
        p_div.paragraph_format.space_before = Pt(2)
        p_div.paragraph_format.space_after = Pt(14)
        r_line = p_div.add_run("―" * 48)
        format_run(r_line, size_pt=10, bold=True, color=COLOR_MUTED)

    def add_heading_1(title):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(14)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(title)
        format_run(run, size_pt=13.5, bold=True, color=COLOR_PRIMARY)
        return p

    def add_heading_2(title):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.keep_with_next = True
        run = p.add_run(title)
        format_run(run, size_pt=12, bold=True, color=COLOR_PRIMARY)
        return p

    def add_figure(img_path, caption, width=Inches(6.0)):
        if os.path.exists(img_path):
            p_img = doc.add_paragraph()
            p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_img.paragraph_format.space_before = Pt(10)
            p_img.paragraph_format.space_after = Pt(4)
            p_img.add_run().add_picture(img_path, width=width)
            p_cap = doc.add_paragraph()
            p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cap.paragraph_format.space_before = Pt(2)
            p_cap.paragraph_format.space_after = Pt(12)
            run = p_cap.add_run(caption)
            format_run(run, size_pt=10, bold=True, color=COLOR_PRIMARY)

    def create_styled_table(headers, data, col_widths=None):
        table = doc.add_table(rows=len(data) + 1, cols=len(headers))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        hdr_cells = table.rows[0].cells
        for i, h_text in enumerate(headers):
            hdr_cells[i].text = h_text
            set_cell_background(hdr_cells[i], "1E3A8A")
            set_cell_margins(hdr_cells[i], top=100, bottom=100, left=120, right=120)
            p = hdr_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            for r in p.runs:
                format_run(r, size_pt=9.5, bold=True, color=RGBColor(255, 255, 255))
        for row_idx, row_data in enumerate(data):
            row_cells = table.rows[row_idx + 1].cells
            bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
            for col_idx, cell_value in enumerate(row_data):
                row_cells[col_idx].text = str(cell_value)
                set_cell_background(row_cells[col_idx], bg_color)
                set_cell_margins(row_cells[col_idx], top=80, bottom=80, left=110, right=110)
                p = row_cells[col_idx].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.15
                for r in p.runs:
                    format_run(r, size_pt=8.8, color=COLOR_BODY)
        if col_widths:
            for row in table.rows:
                for idx, width in enumerate(col_widths):
                    row.cells[idx].width = Inches(width)
        p_spacer = doc.add_paragraph()
        p_spacer.paragraph_format.space_before = Pt(2)
        p_spacer.paragraph_format.space_after = Pt(8)
        return table

    # =========================================================================
    # CHAPTER 2: LITERATURE REVIEW AND RELATED SYSTEMS
    # =========================================================================
    add_chapter_title(2, "Literature Review and Related Systems")

    add_heading_1("2.1 Evolution of University Course Registration Systems")
    add_para(
        "The administration of university course registration has evolved through three distinct technological eras over the past "
        "four decades. In the earliest paradigm (1980s–1990s), academic institutions relied upon physical paper slips, in-person token queues, "
        "and manual roster collation. This paper-bound process was severely constrained by human latency, logistical delays, and frequent "
        "clerical transcription errors. As collegiate enrollments expanded, universities transitioned toward mainframe batch processing systems. "
        "Students submitted optical mark recognition (OMR) sheets or telephonic Interactive Voice Response (IVR) requests, which were queued "
        "and processed in nightly sequential batches. While batch systems eliminated physical queuing, they introduced complete opacity: students "
        "were unable to verify seat availability in real time and frequently discovered weeks later that their selections had been rejected due to "
        "oversubscription."
    )
    add_para(
        "With the proliferation of the World Wide Web in the late 1990s and early 2000s, universities adopted online web portals integrated "
        "into comprehensive Enterprise Resource Planning (ERP) suites, such as Ellucian Banner, Oracle PeopleSoft Campus Solutions, and SAP "
        "Higher Education. These systems introduced real-time web forms; however, their underlying software architectures were monolithic, tightly "
        "coupled to legacy relational database backends, and engineered primarily for administrative record-keeping rather than burst concurrent "
        "traffic. Consequently, contemporary universities continue to experience acute operational failures during course registration periods."
    )

    add_heading_1("2.2 Comparative Analysis of Academic ERP Solutions")
    add_para(
        "A rigorous inspection of prevailing commercial and open-source academic registration systems reveals significant architectural "
        "trade-offs in handling high-concurrency seat allocation, data auditing, and student user experience. Table 2.1 presents a comparative "
        "evaluation of legacy approaches against Electify."
    )

    comp_headers = ["System / Platform", "Architecture Paradigm", "Concurrency Control", "Seat Allocation Integrity", "Audit & Replay Capability", "User Experience (UX)"]
    comp_data = [
        ["Ellucian Banner", "Monolithic J2EE / Oracle DB", "Optimistic Locking / Row wait", "Vulnerable to timeout deadlocks under burst traffic", "Administrative system logs only; no student-facing replay", "Complex multi-tab forms; high cognitive load"],
        ["Oracle PeopleSoft", "Multi-tier Tuxedo / PeopleTools", "Application-level queuing", "Requires batch reconciliation; ghost seats occur", "Database trigger history; difficult temporal playback", "Legacy enterprise table UI; not mobile responsive"],
        ["Generic Open-Source SIS (Kuali, Moodle)", "PHP / MySQL LAMP Stack", "Naive auto-increment with no atomic locking", "Frequent overbooking anomalies; zero-waitlist unsupported", "Basic CRUD change logs; lacks cryptographic receipts", "Fragmented navigation; static non-reactive views"],
        ["Electify (Proposed System)", "Serverless Next.js 16 + Drizzle + PostgreSQL", "Pessimistic Row-Level Locking (SELECT FOR UPDATE)", "Strict zero-waitlist policy; non-negative atomic seat bounds", "Event-sourced replay ledger + cryptographic PDF receipts", "Clean, accessible, reactive UI with live seat telemetry"]
    ]
    create_styled_table(comp_headers, comp_data, col_widths=[1.2, 1.2, 1.3, 1.3, 1.2, 1.0])

    add_heading_1("2.3 Database Concurrency Control in High-Contention Allocation")
    add_para(
        "In relational database management systems (RDBMS), concurrency control during high-contention resource allocation represents a "
        "classic computer science challenge. In academic elective registration, thousands of concurrent transactions contend for a finite, "
        "diminishing resource—available course seats. Two primary concurrency control mechanisms dominate database literature:"
    )
    add_para(
        "1. Optimistic Concurrency Control (OCC): Under OCC, transactions read data records without acquiring exclusive locks, assuming that "
        "conflicts are rare. At commit time, the transaction verifies whether another transaction has modified the target record (e.g., via version "
        "timestamps or checksums). If a collision is detected, the transaction aborts and retries. While OCC performs admirably in low-contention "
        "e-commerce scenarios, it degrades catastrophically in high-contention elective registration: when hundreds of students compete for the last "
        "5 seats of an advanced Cloud Computing elective, upwards of 95% of concurrent transactions collide, triggering repeated aborts, retry storms, "
        "and complete thread exhaustion in connection pools."
    )
    add_para(
        "2. Pessimistic Concurrency Control (PCC): Under PCC, transactions acquire immediate row-level exclusive locks on targeted course records "
        "(e.g., via PostgreSQL's SELECT FOR UPDATE statement) before evaluating seat constraints. By serializing access at the row level, only one "
        "transaction at a time evaluates and decrements available_seats. When combined with atomic SQL expressions (UPDATE electives SET available_seats "
        "= available_seats - 1 WHERE id = $1 AND available_seats > 0), pessimistic locking guarantees zero overbooking with deterministic rollback "
        "behavior. Electify adopts this pessimistic locking paradigm, entirely eliminating race conditions."
    )

    add_heading_1("2.4 Modern Web Architectures and Edge-Proxy Routing")
    add_para(
        "Recent advancements in full-stack web engineering have transformed how web applications manage authentication, state, and API routing. "
        "Traditional single-page application (SPA) architectures rely on client-side authentication guards, wherein private route checks execute "
        "within client JavaScript bundles. This introduces severe security vulnerabilities: unauthorized users can manipulate client-side state, "
        "inspect hidden DOM elements, or bypass route gates entirely before making unauthenticated API requests."
    )
    add_para(
        "Next.js 16 introduces an advanced Edge Proxy paradigm (src/proxy.ts, formerly middleware.ts), enabling cryptographic token validation "
        "directly at the network boundary before requests penetrate application or database layers. By coupling signed JSON Web Tokens (JWT) "
        "with HTTP-only, SameSite-strict session cookies, the Edge Proxy intercepts incoming requests, validates role privileges against "
        "hierarchical role-based access control (RBAC) matrices, and performs immediate edge redirects for unauthorized sessions. Furthermore, "
        "Next.js Server Actions execute mutative domain logic strictly server-side, eliminating exposed public REST endpoints that could be "
        "vulnerable to automated credential stuffing or bot scripting."
    )

    add_heading_1("2.5 Event Sourcing, Audit Integrity and Replay Engines")
    add_para(
        "In mission-critical enterprise applications, traditional CRUD (Create, Read, Update, Delete) data models exhibit a fundamental "
        "architectural limitation: state mutations overwrite previous data values, erasing historical context. When a student cancels an elective "
        "or switches courses, a naive CRUD update simply overwrites the course reference, leaving academic coordinators incapable of determining "
        "who held the seat at 09:01:14 AM versus 09:02:05 AM. In event-sourced architectures (Fowler, 2005), all state mutations are recorded "
        "as an immutable, append-only chronological stream of events. Electify operationalizes this concept through its replay_events table: "
        "every course selection, cancellation, seat swap, and administrative reset is stamped with nanosecond-resolution timestamps and actor "
        "identifiers, powering an interactive Time-Travel Replay Engine that provides absolute audit transparency."
    )

    add_heading_1("2.6 Critical Analysis and Identified Research Gaps")
    add_para(
        "Our systematic review of existing collegiate registration systems and technical literature highlights four prominent research gaps "
        "that Electify directly resolves:"
    )
    add_para("• Gap 1: Existing academic ERPs fail to decouple multi-year institutional structures, allowing legacy cohort data to pollute active registration events.")
    add_para("• Gap 2: Commercial systems treat course capacity as a soft limit, relying on manual clerical pruning to fix oversubscribed sections post-registration.")
    add_para("• Gap 3: Authentication frameworks lack real-time single-session enforcement, permitting students to operate multi-device seat-sniping sessions.")
    add_para("• Gap 4: Academic coordinators lack temporal surveillance tooling to monitor live seat saturation or reconstruct dispute timelines without querying complex raw database logs.")

    # =========================================================================
    # CHAPTER 3: REQUIREMENTS ANALYSIS AND SPECIFICATION
    # =========================================================================
    add_chapter_title(3, "Requirements Analysis and Specification")

    add_heading_1("3.1 Functional Requirements Specification")
    add_para(
        "The functional requirements define the core operational capabilities that Electify must deliver to satisfy institutional "
        "stakeholders. Table 3.1 delineates the twelve primary functional requirements (FR-01 through FR-12) implemented in the system."
    )

    fr_headers = ["Req ID", "Functional Requirement Name", "Target Persona", "Detailed Functional Description", "Verification Method"]
    fr_data = [
        ["FR-01", "Institutional Authentication", "All Users", "Enforce authenticated login using official @srmist.edu.in emails, bcrypt password hashing, and signed JWT session cookies.", "Automated Unit Tests & Proxy Route Guards"],
        ["FR-02", "Single-Active-Session Enforcement", "Students", "Terminate prior active sessions immediately upon fresh login from an alternative device or browser window.", "Session ID Sentinel Validation"],
        ["FR-03", "Year Servers Workspace Isolation", "Admin / Staff", "Manage university operations within annual workspaces (e.g. 2025, 2026), isolating programmes, classes, and batches.", "Relational Foreign Key Isolation Tests"],
        ["FR-04", "Class-Based Self-Onboarding", "Students / Tutors", "Allow students to onboard into specific classes using tutor-generated unique signup codes, auto-assigning section IDs.", "Class Code Expiration & Limit Tests"],
        ["FR-05", "Pre-Registration Subject Explorer", "Students", "Provide read-only catalog discovery of course descriptions, prerequisites, and syllabi prior to window opening without reserving seats.", "Catalogue Access & Lockout Tests"],
        ["FR-06", "Scheduled Event Window Lifecycle", "Coordinators", "Control registration windows via automated timestamps (DRAFT -> PUBLISHED -> OPEN -> PAUSED -> CLOSED -> ARCHIVED).", "Registration Window Rule Tests"],
        ["FR-07", "Transactional Seat Booking", "Students", "Atomically allocate elective seats within PostgreSQL transactions, enforcing group constraints and section quotas.", "High-Concurrency Pessimistic Lock Tests"],
        ["FR-08", "Zero-Waitlist Immediate Feedback", "Students", "Reject full elective selections deterministically with SEAT_TAKEN error; prompt immediate alternative selection.", "Zero-Waitlist Capacity Limit Tests"],
        ["FR-09", "Registration Modifications & Unlocks", "Students / Tutors", "Permit students to modify or cancel confirmed electives only if unlocked by an assigned class tutor.", "Tutor Authorization & Seat Move Tests"],
        ["FR-10", "Digital PDF Receipt Synthesis", "Students", "Synthesize tamper-evident PDF receipts bearing sequential receipt numbers (REC-YYYYMMDD-XXXXX) upon confirmation.", "jsPDF Client-Side Generation Tests"],
        ["FR-11", "Surveillance Telemetry & Live Monitor", "Coordinators", "Broadcast real-time seat saturation percentages, recent event feeds, and unregistered cohort rosters via WebSockets.", "Live Polling & CDC Stream Tests"],
        ["FR-12", "Time-Travel Audit Replay", "Coordinators / Admin", "Enable staff to drag a chronological timeline slider to inspect second-by-second seat state transitions.", "Replay Event Log Reconstruction Tests"]
    ]
    create_styled_table(fr_headers, fr_data, col_widths=[0.8, 1.4, 1.0, 2.8, 1.2])

    add_heading_1("3.2 Non-Functional Requirements and Service Level Agreements")
    add_para(
        "To ensure robust operational reliability, security, and responsiveness during high-stakes registration windows, Electify enforces "
        "strict non-functional requirements (NFRs) and service level agreements (SLAs), documented in Table 3.2."
    )

    nfr_headers = ["NFR ID", "Quality Dimension", "Service Level Target", "Implementation Mechanism", "Validation Metric"]
    nfr_data = [
        ["NFR-01", "Transactional Concurrency", "Zero overbooking anomalies across 100+ concurrent requests per seat", "Pessimistic row locking (SELECT FOR UPDATE) & DB check constraints", "100% pass on concurrent allocation tests"],
        ["NFR-02", "Server Response Latency", "Server Action execution < 250ms under median operational load", "Node-Postgres connection pooling (PgBouncer) & optimized indexes", "Sub-100ms average query latency"],
        ["NFR-03", "Cryptographic Security", "Session cookies signed with HS256 JWT; passwords hashed with bcrypt", "Strict 32+ character JWT_SECRET; salt cost factor 12 in auth.ts", "Zero plaintext credentials in database"],
        ["NFR-04", "Role-Based Security", "100% isolation across roles; tutors confined to assigned sections", "Server-side session inspection in all mutating Server Actions", "Unauthorized access tests rejected (403)"],
        ["NFR-05", "UI Responsiveness", "Fully responsive layout across mobile, tablet, and desktop viewports", "Tailwind CSS v4 flex/grid layouts & Accessible Base UI components", "Lighthouse mobile accessibility score >= 95"],
        ["NFR-06", "Data Integrity", "Zero orphaned records; cascading referential foreign keys", "PostgreSQL foreign keys with ON DELETE CASCADE / RESTRICT rules", "Clean schema integrity on deletion tests"],
        ["NFR-07", "System Availability", "99.9% uptime during active registration window schedules", "Stateless Next.js serverless functions with managed DB pooling", "Zero-downtime deployment compatibility"],
        ["NFR-08", "Auditability", "100% event log completeness; immutable event history", "Immutable append-only replay_events and audit_logs tables", "Complete historical reconstruction"]
    ]
    create_styled_table(nfr_headers, nfr_data, col_widths=[0.8, 1.3, 1.5, 1.8, 1.6])

    add_heading_1("3.3 User Persona and Role-Based Access Control Specifications")
    add_para(
        "Electify enforces strict role separation. Table 3.3 documents the granular permission matrix across all four institutional roles."
    )

    rbac_headers = ["Functional Capability / Operation", "Student", "Class Tutor", "Course Coordinator", "System Admin"]
    rbac_data = [
        ["Authenticate & View Pre-Registration Catalog", "Allowed", "Allowed", "Allowed", "Allowed"],
        ["Submit Elective Choices & Confirm Registration", "Allowed (Own only)", "Denied", "Denied", "Denied"],
        ["Download PDF Confirmation Receipt", "Allowed (Own only)", "Allowed (Assigned class)", "Allowed (All batches)", "Allowed (Universal)"],
        ["Modify / Unlock Confirmed Elective Selections", "Denied (Unless unlocked)", "Allowed (Assigned class)", "Allowed (Own batch)", "Denied"],
        ["Generate Class Signup Codes & Manage Roster", "Denied", "Allowed (Assigned class)", "Allowed (Own batch)", "Denied"],
        ["Configure Registration Events & Elective Groups", "Denied", "Denied", "Allowed (Own batch)", "Denied"],
        ["Access Live Monitor & Surveillance Feed", "Denied", "Denied", "Allowed (Own batch)", "Allowed (Universal)"],
        ["Access Time-Travel Replay Audit Engine", "Denied", "Denied", "Allowed (Own batch)", "Allowed (Universal)"],
        ["Manage Academic Year Servers & Faculties", "Denied", "Denied", "Denied", "Allowed (Universal)"],
        ["Generate Role-Based Staff Invite Codes", "Denied", "Denied", "Denied", "Allowed (Universal)"],
        ["Toggle University Maintenance Mode", "Denied", "Denied", "Denied", "Allowed (Universal)"]
    ]
    create_styled_table(rbac_headers, rbac_data, col_widths=[2.5, 1.2, 1.2, 1.2, 1.2])

    add_heading_1("3.4 Academic Data Governance and Cohort Isolation Rules")
    add_para(
        "To ensure academic data governance, Electify establishes five inviolable cohort isolation rules: (1) Students can only register "
        "for elective events explicitly targeting their academic batch and section. (2) Class Tutors are strictly restricted to students belonging "
        "to sections mapped via tutor_sections. (3) Course Coordinators can only administer elective baskets belonging to their assigned programme. "
        "(4) Elective offerings cannot share seat pools across unrelated programmes. (5) Deleting an academic Year Server workspace safely unlinks "
        "attached registration events without destroying historical student receipts or audit logs."
    )

    add_heading_1("3.5 System Dependencies and Deployment Assumptions")
    add_para(
        "Electify relies on five core external runtime dependencies: Node.js (>= 20.0.0), PostgreSQL (>= 15), Supabase Realtime WebSocket service, "
        "a connection pooler (PgBouncer), and modern ECMAScript browsers (Chrome, Safari, Firefox, Edge). Development and production environments "
        "are strictly separated via .env and .env.local configuration templates, ensuring that local testing scripts never modify live production data."
    )

    # =========================================================================
    # CHAPTER 4: SYSTEM ANALYSIS AND DESIGN
    # =========================================================================
    add_chapter_title(4, "System Analysis and Design")

    add_heading_1("4.1 Existing System Deficiencies and Bottlenecks")
    add_para(
        "The legacy university elective allocation workflow relied on an unoptimized ERP portal built on top of traditional multi-tier J2EE "
        "and PHP monoliths. Analysis of historical operational telemetry revealed three crippling bottlenecks: (1) Connection Starvation: "
        "Opening registration to 2,000 students simultaneously generated over 15,000 HTTP requests per minute, exhausting Apache/PHP thread pools "
        "and leading to HTTP 504 Gateway Timeouts. (2) Unsynchronized Client State: Students submitted forms based on stale seat numbers displayed "
        "in their browsers, leading to widespread disappointment when submissions failed silently. (3) Cluttered Administrative Views: Staff had to "
        "navigate fragmented screens across multiple academic years, leading to accidental modifications of historical records."
    )

    add_heading_1("4.2 Proposed Electify System Architecture")
    add_para(
        "The proposed Electify platform fundamentally redesigns elective management by introducing: (1) A clean Year Servers operational model "
        "that cleanly isolates academic workspaces. (2) Pessimistic database concurrency that serializes seat decrement operations at the row level, "
        "guaranteeing ACID transactional integrity. (3) An Edge Proxy security boundary that intercepts and authenticates every incoming request "
        "before it touches backend resources. (4) An event-sourced Time-Travel Replay Engine that provides absolute auditability."
    )

    add_heading_1("4.3 Feasibility Analysis")
    add_para(
        "A rigorous feasibility analysis was conducted across three essential dimensions:"
    )
    add_para("1. Technical Feasibility: The chosen technology stack—Next.js 16, React 19, TypeScript, PostgreSQL, and Drizzle ORM—represents industry-standard, battle-tested modern web technologies. Serverless deployment capabilities on Vercel or Node.js Docker containers coupled with PostgreSQL connection pooling (PgBouncer) easily accommodate collegiate traffic peaks with sub-second response times.")
    add_para("2. Operational Feasibility: Electify features persona-tailored user interfaces designed in accordance with modern accessibility standards. Students require zero onboarding training due to the intuitive countdown and card-selection UI. Class Tutors and Coordinators benefit from consolidated dashboards that automate roster imports and seat surveillance, reducing administrative workload by an estimated 80%.")
    add_para("3. Economic Feasibility: By utilizing open-source software libraries, standard PostgreSQL hosting (Supabase, Neon, or on-premises university servers), and lightweight serverless compute, Electify entails zero commercial licensing fees, making it exceptionally cost-effective for departmental deployment.")

    add_heading_1("4.4 Use Case Modeling and Actor Interactions")
    add_para(
        "As established in Figure 1.1, the system actors interact with specialized functional modules. The Student actor triggers use cases "
        "such as Explore Catalog, Submit Electives, and Download Receipt. The Class Tutor actor triggers Manage Roster, Generate Signup Codes, "
        "and Unlock Selections. The Course Coordinator triggers Configure Events, Set Capacities, Monitor Live Telemetry, and Audit Replay. "
        "The System Administrator oversees Year Servers, Faculties, Invite Codes, and System Settings."
    )

    add_heading_1("4.5 Activity Diagrams of Registration Workflows")
    add_para(
        "Figure 4.1 illustrates the complete activity workflow executed when a student engages with an elective registration window, "
        "from initial eligibility validation and schedule checks through course selection, atomic database transaction processing, "
        "deterministic rollback on oversubscription, and final digital receipt synthesis."
    )
    add_figure("documentation/final-report/assets/fig_activity_registration.png", "Figure 4.1: Activity Diagram — End-to-End Student Elective Registration Workflow", width=Inches(5.8))

    add_heading_1("4.6 Sequence Diagrams of Concurrent Seat Allocation")
    add_para(
        "Figure 4.2 presents the sequence diagram detailing the high-concurrency interaction between the Student Client, the Next.js Edge Proxy, "
        "the Server Action handler, and the PostgreSQL database engine during transactional seat allocation with pessimistic row locking."
    )
    add_figure("documentation/final-report/assets/fig_sequence_transaction.png", "Figure 4.2: Sequence Diagram — Concurrent Registration with Pessimistic Locking", width=Inches(6.0))

    add_heading_1("4.7 State Machine Diagram of Registration Windows and Seat States")
    add_para(
        "Registration events progress through a strictly controlled state machine. Figure 4.3 depicts the permissible state transitions "
        "for academic registration events (DRAFT -> PUBLISHED -> OPEN -> PAUSED -> CLOSED -> ARCHIVED) alongside corresponding student registration "
        "record states (UNREGISTERED -> CONFIRMED -> CANCELLED / UNLOCKED)."
    )
    add_figure("documentation/final-report/assets/fig_state_lifecycle.png", "Figure 4.3: State Machine Diagram — Registration Event Lifecycle and Seat States", width=Inches(6.0))

    add_heading_1("4.8 Data Flow Modeling (Level 0 and Level 1 DFD)")
    add_para(
        "At Level 0 (Context Level), Electify functions as an academic boundary entity receiving authentication credentials, course selections, "
        "and roster configurations from Students, Staff, and Administrators, and emitting verified course allocations, live telemetry, and cryptographic "
        "PDF receipts. At Level 1, data flows are partitioned into four discrete sub-processes: (1.0) Identity & Session Sentinel, (2.0) Academic "
        "Workspace Routing, (3.0) Concurrency & Seat Booking Engine, and (4.0) Telemetry & Audit Stream Processor."
    )

    # =========================================================================
    # CHAPTER 5: SYSTEM ARCHITECTURE AND METHODOLOGY
    # =========================================================================
    add_chapter_title(5, "System Architecture and Methodology")

    add_heading_1("5.1 High-Level Architecture Overview")
    add_para(
        "Electify is architected as an enterprise-grade full-stack web application employing modern modular layering. Figure 5.1 illustrates "
        "the end-to-end architectural topology spanning the Client Layer, the Edge & Application Logic Layer, and the Persistence & Realtime Data Layer."
    )
    add_figure("documentation/final-report/assets/fig_architecture.png", "Figure 5.1: High-Level System Architecture of Electify", width=Inches(6.0))

    add_heading_1("5.2 Frontend Layer: Next.js 16 App Router and Component Design")
    add_para(
        "The presentation tier is implemented using Next.js 16 (App Router), leveraging React 19 Server Components for data pre-fetching "
        "and client hydration. The user interface utilizes Tailwind CSS v4 for utility-first styling combined with accessible components from "
        "Base UI and shadcn/ui. The client architecture emphasizes performance and responsiveness: heavy administrative screens (such as Year "
        "Servers and the Live Monitor) leverage optimistic UI updates and React Server Actions to achieve fluid transitions without full-page reloads."
    )

    add_heading_1("5.3 Edge Proxy and Route Guard Layer (src/proxy.ts)")
    add_para(
        "To enforce defense-in-depth, Electify modernizes traditional middleware routing into the official Next.js 16 Edge Proxy convention "
        "(src/proxy.ts). Every HTTP request traversing the network boundary is evaluated by the proxy function. Using the lightweight jose library, "
        "the proxy cryptographically verifies the electify_session JWT token against the institutional secret key (JWT_SECRET). If the token is "
        "missing, expired, or tampered with, the user is immediately redirected to /login. If an authenticated user attempts to access a route "
        "reserved for another role (e.g., a student requesting /faculty/events or a tutor requesting /faculty/settings), the proxy enforces immediate "
        "RBAC redirection, preventing unauthorized requests from ever reaching backend application logic."
    )

    add_heading_1("5.4 Mutating Server Actions and Domain Processing Logic")
    add_para(
        "In contrast to legacy architectures that expose vulnerable public REST endpoints, Electify encapsulates all mutative business logic "
        "inside type-safe Next.js Server Actions (located in src/app/actions/). Key server action modules include: register.ts (handling student "
        "elective bookings, seat modifications, and cancellations), tutor.ts (handling section roster management and signup code generation), "
        "admin.ts (handling staff invite code generation, Year Server lifecycle, and maintenance mode), and replay.ts (reconstructing historical "
        "state timelines). All server actions strictly validate incoming payloads using Zod schemas and enforce secondary server-side role checks."
    )

    add_heading_1("5.5 Transactional Seat Allocation and Pessimistic Concurrency Engine")
    add_para(
        "The core technical innovation of Electify is its deterministic seat allocation algorithm executed within PostgreSQL transactions "
        "using Drizzle ORM. The exact algorithmic processing flow executed during registerForElectives is as follows:"
    )
    add_para(
        "1. Open Postgres Transaction: The database driver initiates an explicit transaction (BEGIN TRANSACTION)."
    )
    add_para(
        "2. Eligibility Verification: The system verifies that the student is enrolled in an eligible section and that the event status is currently OPEN."
    )
    add_para(
        "3. Row-Level Pessimistic Locking: For each requested elective course ID, the transaction executes: SELECT id, available_seats, max_seats "
        "FROM electives WHERE id = $1 FOR UPDATE. This locks the database row; competing transactions requesting the same elective are paused until "
        "this transaction completes."
    )
    add_para(
        "4. Capacity Constraint Check: The engine verifies that available_seats > 0. If available_seats <= 0, the transaction throws an immediate "
        "SEAT_TAKEN exception and rolls back (ROLLBACK TRANSACTION), releasing locks without modifying any records."
    )
    add_para(
        "5. Atomic Decrement: The transaction executes an atomic update: UPDATE electives SET available_seats = available_seats - 1, is_full = "
        "(available_seats - 1 <= 0) WHERE id = $1. A database CHECK constraint (available_seats >= 0) provides a secondary hardware-level guard."
    )
    add_para(
        "6. Audit Logging & Commit: The registration record is inserted into registrations, line items are saved in student_registrations, "
        "and an event is appended to replay_events. The transaction commits (COMMIT TRANSACTION), and an official receipt number is issued."
    )

    add_heading_1("5.6 Single-Active-Session Sentinel and Brute-Force Throttling")
    add_para(
        "To prevent students from deploying automated scripts or multi-tab bots across different machines, Electify enforces a Single-Active-Session "
        "Sentinel. Each user row in the users table maintains a current_session_id column. When a student logs in, a unique cryptographic session "
        "UUID is generated and stamped onto the user row and encoded within the session JWT. On every subsequent protected operation, the system "
        "verifies that session.sessionId === dbUser.current_session_id. If a student logs in from a second browser, the database session ID is updated, "
        "causing the earlier device's token to fail instantly on its next request. Furthermore, the login_attempts table records failed password "
        "attempts by IP and user identifier, automatically locking accounts after five consecutive failures."
    )

    add_heading_1("5.7 Event-Sourced Time-Travel Replay Engine")
    add_para(
        "Electify's audit architecture implements event sourcing via the replay_events table. Every mutative transaction records an append-only "
        "event entry containing: eventId, eventType (STUDENT_REGISTERED, REGISTRATION_CANCELLED, SEAT_RELEASED, WINDOW_PAUSED), userId, payload "
        "(course IDs and available seats before and after), and timestamp. In the Coordinator portal (/faculty/replay), staff can drag an interactive "
        "time-travel slider across the event window to reconstruct the exact seat occupancy and class rosters at any specific second in the past."
    )

    add_heading_1("5.8 Real-Time Seat Broadcasting via Supabase CDC")
    add_para(
        "To keep connected students and administrative surveillance dashboards synchronized without overwhelming backend servers with aggressive "
        "HTTP polling, Electify integrates Supabase Realtime Change Data Capture (CDC). PostgreSQL's write-ahead log (WAL) streams row-level changes "
        "on the electives table to Supabase Realtime, which immediately broadcasts updated seat counts over persistent WebSocket channels to active "
        "clients. When an elective course hits capacity, student buttons disable instantly in real time, preventing futile submission attempts."
    )

    print("Completed Chapters 2, 3, 4, 5.")
    return doc
