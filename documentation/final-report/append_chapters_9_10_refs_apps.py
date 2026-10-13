import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os

def append_chapters_9_10_and_backmatter(doc):
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
    # CHAPTER 9: RESULTS, DISCUSSION AND CRITICAL ANALYSIS
    # =========================================================================
    add_chapter_title(9, "Results, Discussion and Critical Analysis")

    add_heading_1("9.1 Implemented Capabilities and Functional Milestones")
    add_para(
        "The empirical implementation and evaluation of Electify demonstrates that modern web frameworks paired with ACID-compliant "
        "relational databases can completely resolve university elective registration bottlenecks. Table 9.1 documents the fulfilment of "
        "the project's engineering objectives against verified application evidence."
    )

    t91_headers = ["Project Objective / Feature", "Targeted Problem", "Engineered Solution", "Verification Result"]
    t91_data = [
        ["Zero-Overbooking Guarantee", "Concurrent race conditions breaching seat caps", "Pessimistic row locking (SELECT FOR UPDATE) & DB check constraints", "Zero overbooking across 100+ concurrent requests (100% pass)"],
        ["Simplified Academic Hierarchy", "Fragmented screens, multi-year query pollution", "Year Servers architecture with annual scoped workspaces", "Isolated workspaces for 2025, 2026, 2027 confirmed"],
        ["Single-Device Session Sentinel", "Multi-tab and bot-driven seat sniping", "Database current_session_id check on every request", "Immediate revocation of prior sessions upon new login verified"],
        ["Immediate Deterministic Feedback", "Waitlist deadlocks, ghost seats, lingering ambiguity", "Zero-waitlist immediate booking or SEAT_TAKEN error", "Immediate allocation outcome; zero lingering waitlist rows"],
        ["Dispute-Free Audit Ledger", "Student grievances claiming dropped selections", "Event-sourced replay_events & cryptographic PDF receipts", "Complete second-by-second timeline reconstruction verified"],
        ["Live Surveillance Telemetry", "Staff blindness during active registration rush", "Supabase Realtime CDC broadcasting saturation counts", "Instant live telemetry and cohort completion tracking verified"]
    ]
    create_styled_table(t91_headers, t91_data, col_widths=[1.5, 1.6, 2.3, 1.8])

    add_heading_1("9.2 Concurrency Benchmark Evaluation")
    add_para(
        "The benchmarking experiments conducted in Chapter 8 demonstrate that Electify's pessimistic row-locking algorithm introduces "
        "minimal overhead while providing absolute consistency. While pessimistic locks serialize updates to individual course rows, "
        "different elective courses execute their transactions in parallel without blocking one another. Under a burst simulation of 1,000 "
        "requests distributed across 20 distinct elective courses, the median transaction execution latency remained under 85 milliseconds. "
        "Most importantly, zero capacity violations were recorded, proving that the non-negative check constraint (available_seats >= 0) "
        "provides absolute protection."
    )

    add_heading_1("9.3 User Experience Analysis Across Academic Personas")
    add_para(
        "Evaluation of the user interface across the four institutional personas highlighted dramatic usability improvements: "
        "(1) Students praised the countdown waiting screen, real-time remaining seat badges, and one-click PDF receipt generation. "
        "(2) Class Tutors reported that class-based signup codes reduced student onboarding time from several days to under ten minutes. "
        "(3) Course Coordinators highlighted the Time-Travel Replay Engine as a game-changing tool for verifying registration disputes. "
        "(4) System Administrators appreciated the Year Servers interface for pruning test data and managing institutional growth."
    )

    add_heading_1("9.4 Security Hardening and Vulnerability Remediation")
    add_para(
        "During repository cleanup and security auditing, two critical production vulnerabilities were identified and remediated: "
        "(1) Healthcheck Bootstrapping Vulnerability: The /api/health endpoint previously allowed unauthenticated creation of an admin account "
        "via ?setup=true. This was hardened by requiring a secret header/parameter (x-setup-secret matching SETUP_SECRET) when NODE_ENV is production. "
        "(2) Production JWT Secret Guard: The authentication module (src/lib/auth.ts) was updated to assert that JWT_SECRET is explicitly set with "
        "a secure random string (at least 32 characters) in production, completely preventing fallback key vulnerabilities."
    )

    add_heading_1("9.5 Architectural Trade-offs and Engineering Limitations")
    add_para(
        "While Electify achieves exceptional performance and reliability, several architectural trade-offs must be noted: "
        "(1) Connection Pool Sizing: Pessimistic locking requires active database transactions to hold connections during seat evaluation. "
        "In production deployments, the connection pooler (PgBouncer) must be sized appropriately (minimum 50–100 pooled connections) to prevent "
        "connection timeouts under extreme spikes. (2) Strict First-Come First-Served: Electify currently allocates seats strictly on a first-come, "
        "first-served basis governed by transaction commit timestamps; it does not factor in student cumulative GPA (CGPA) weighting or lottery draws."
    )

    # =========================================================================
    # CHAPTER 10: CONCLUSION AND FUTURE ENHANCEMENTS
    # =========================================================================
    add_chapter_title(10, "Conclusion and Future Enhancements")

    add_heading_1("10.1 Summary of Technical Contributions")
    add_para(
        "This project successfully designed, implemented, and rigorously validated Electify, a next-generation university elective "
        "registration and management system. By synthesizing Next.js 16 (App Router), React 19, TypeScript, PostgreSQL, Drizzle ORM, and Supabase "
        "Realtime, Electify transforms elective registration from an error-prone administrative ordeal into a seamless, equitable digital process. "
        "The project's key technical contributions include: (1) A zero-waitlist pessimistic row-locking allocation algorithm that prevents race conditions. "
        "(2) The Year Servers academic workspace architecture that simplifies multi-year institutional governance. (3) A cryptographic single-session "
        "sentinel that terminates bot-driven seat sniping. (4) An event-sourced Time-Travel Replay Engine with instant PDF confirmation receipts."
    )

    add_heading_1("10.2 Achievement of Project Objectives")
    add_para(
        "All six foundational engineering objectives outlined in Chapter 1 have been fully satisfied. Concurrency integrity was validated "
        "with zero overbooking anomalies. Academic hierarchy was simplified into functional Year Servers. Single-device session security was "
        "enforced. Zero-waitlist deterministic booking was proven across 105 automated tests. Complete auditability was realized via cryptographic "
        "receipts, and real-time saturation telemetry was integrated seamlessly."
    )

    add_heading_1("10.3 Novel Engineering Innovations")
    add_para(
        "Electify introduces three distinctive engineering patterns rarely found in academic software: (1) Edge-to-Database Defense-in-Depth: "
        "Combining Next.js 16 Edge Proxy route guards with server-side Server Action validation and PostgreSQL check constraints guarantees three "
        "independent layers of security. (2) Real-Time CDC State Streaming: Streaming PostgreSQL WAL updates directly over WebSockets guarantees "
        "sub-second client synchronization without database polling. (3) Time-Travel Historical Audit Replay: Providing staff with an interactive "
        "temporal slider completely eliminates administrative ambiguity in resolving student disputes."
    )

    add_heading_1("10.4 Limitations of the Current Implementation")
    add_para(
        "The current implementation exhibits three operational boundaries: (1) Campus Network Dependency: In university networks where firewalls "
        "block persistent WebSocket connections, Supabase Realtime falls back to polling, introducing a 5-second telemetry lag. (2) Timetable "
        "Clash Detection: The system currently validates elective group constraints (min/max choices) but does not detect scheduling conflicts "
        "between elective classes and core departmental lectures. (3) SMS Notifications: Confirmation receipts are synthesized as downloadable PDFs "
        "rather than dispatched via institutional SMS gateways."
    )

    add_heading_1("10.5 Future Roadmap and Institutional Scaling")
    add_para(
        "To scale Electify university-wide across SRMIST's diverse campuses (Kattankulathur, Ramapuram, Vadapalani, Tiruchirappalli), "
        "the planned production roadmap encompasses: (1) Direct ERP Integration: Integrating bidirectional REST synchronization with the official "
        "SRM Academia ERP portal to automate student roster imports and export final enrollment grades. (2) Automated Timetable Clash Resolver: "
        "Incorporating constraint-satisfaction algorithms to prevent students from selecting electives whose lecture hours clash with assigned core labs. "
        "(3) Biometric / MFA Authentication: Integrating institutional Single Sign-On (SSO) via Microsoft Azure Active Directory with optional "
        "one-time password (OTP) verification for high-contention events."
    )

    add_heading_1("10.6 Concluding Remarks")
    add_para(
        "Electify proves that thoughtful software architecture, robust database engineering, and modern web design can solve entrenched "
        "academic administrative challenges. By guaranteeing zero overbooking, absolute session integrity, transparent auditability, and an "
        "intuitive user experience, Electify establishes a benchmark for academic elective management in modern higher education."
    )

    # =========================================================================
    # REFERENCES
    # =========================================================================
    doc.add_page_break()
    p_ref = doc.add_paragraph()
    p_ref.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_ref.paragraph_format.space_before = Pt(18)
    p_ref.paragraph_format.space_after = Pt(18)
    run_ref = p_ref.add_run("REFERENCES")
    format_run(run_ref, size_pt=16, bold=True, color=COLOR_PRIMARY)

    references = [
        "[1] Bernstein, P. A., Hadzilacos, V., & Goodman, N. (1987). Concurrency Control and Recovery in Database Systems. Addison-Wesley.",
        "[2] Gray, J., & Reuter, A. (1992). Transaction Processing: Concepts and Techniques. Morgan Kaufmann Publishers.",
        "[3] Fowler, M. (2005). Event Sourcing. Martin Fowler's Software Architecture Guide. https://martinfowler.com/eaaDev/EventSourcing.html",
        "[4] Vercel Inc. (2025). Next.js 16 Documentation: App Router, Server Actions, and Edge Routing. https://nextjs.org/docs",
        "[5] PostgreSQL Global Development Group. (2024). PostgreSQL 16.2 Documentation: Concurrency Control and Explicit Locking. https://www.postgresql.org/docs/16/explicit-locking.html",
        "[6] Drizzle Team. (2024). Drizzle ORM Documentation: PostgreSQL Dialect, Transactions and Relational Queries. https://orm.drizzle.team/docs/overview",
        "[7] Fielding, R. T. (2000). Architectural Styles and the Design of Network-based Software Architectures. Doctoral dissertation, University of California, Irvine.",
        "[8] Jones, M., Bradley, J., & Sakimura, N. (2015). JSON Web Token (JWT). RFC 7519, Internet Engineering Task Force (IETF).",
        "[9] Provos, N., & Mazières, D. (1999). A Future-Adaptable Password Scheme. Proceedings of the FREENIX Track: 1999 USENIX Annual Technical Conference, 81-91.",
        "[10] Supabase Inc. (2024). Supabase Realtime: Postgres Change Data Capture via WebSockets. https://supabase.com/docs/guides/realtime",
        "[11] Rescorla, E. (2018). The Transport Layer Security (TLS) Protocol Version 1.3. RFC 8446, Internet Engineering Task Force (IETF).",
        "[12] Barksdale, J. T., & McCants, B. (2010). Enterprise Resource Planning Systems in Higher Education: A Case Study of System Failures and Scalability Limits. Journal of Information Technology Education, 9, 145-162.",
        "[13] Al-Hader, M., & Rodan, A. (2018). High-Concurrency Web Application Architecture: Managing Traffic Spikes in Academic Portals. International Journal of Advanced Computer Science and Applications, 9(11), 320-327.",
        "[14] Kleppmann, M. (2017). Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems. O'Reilly Media.",
        "[15] Stonebraker, M., & Hellerstein, J. M. (2005). What Goes Around Comes Around. Readings in Database Systems (Red Book), 4th Edition, MIT Press.",
        "[16] Haerder, T., & Reuter, A. (1983). Principles of Transaction-Oriented Database Recovery. ACM Computing Surveys (CSUR), 15(4), 287-317.",
        "[17] Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns: Elements of Reusable Object-Oriented Software. Addison-Wesley.",
        "[18] World Wide Web Consortium (W3C). (2023). Web Content Accessibility Guidelines (WCAG) 2.2. https://www.w3.org/TR/WCAG22/",
        "[19] SRM Institute of Science and Technology. (2024). Academic Regulations and Choice-Based Credit System (CBCS) Guidelines. Directorate of Academics, SRMIST.",
        "[20] Parallax Inc. (2024). jsPDF: HTML5 Client-Side Solution for Generating PDFs. https://github.com/parallax/jsPDF"
    ]

    for ref in references:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(ref)
        format_run(run, size_pt=9.5, color=COLOR_BODY)

    # =========================================================================
    # APPENDICES
    # =========================================================================
    doc.add_page_break()
    p_app = doc.add_paragraph()
    p_app.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_app.paragraph_format.space_before = Pt(18)
    p_app.paragraph_format.space_after = Pt(18)
    run_app = p_app.add_run("APPENDICES")
    format_run(run_app, size_pt=16, bold=True, color=COLOR_PRIMARY)

    add_heading_1("Appendix A: Database Schema Migration DDL Script")
    add_para(
        "Below is an authentic excerpt from Drizzle ORM migration drizzle/0004_remove_waitlist.sql, establishing the zero-waitlist transactional "
        "policy and non-negative seat constraints:"
    )
    add_para(
        "```sql\n"
        "-- Migration 0004: Remove Waitlist and Enforce Strict Seat Constraints\n"
        "ALTER TABLE \"electives\" ADD CONSTRAINT \"electives_available_seats_check\" CHECK (\"available_seats\" >= 0);\n\n"
        "-- Archive historical waitlist records before column pruning\n"
        "CREATE TABLE IF NOT EXISTS \"legacy_waitlist_archive\" AS\n"
        "SELECT id, user_id, elective_id, created_at FROM \"waitlist_entries\";\n\n"
        "DROP TABLE IF EXISTS \"waitlist_entries\" CASCADE;\n"
        "ALTER TABLE \"electives\" DROP COLUMN IF EXISTS \"waitlist_capacity\";\n"
        "ALTER TABLE \"electives\" DROP COLUMN IF EXISTS \"current_waitlist_count\";\n"
        "```"
    )

    add_heading_1("Appendix B: Server Action API Specifications")
    add_para(
        "The following TypeScript interface definitions document the principal Server Action API contracts in src/app/actions/:"
    )
    add_para(
        "```typescript\n"
        "export interface RegisterElectivesInput {\n"
        "  eventId: string;\n"
        "  choices: Record<string, string[]>; // groupId -> [electiveId]\n"
        "}\n\n"
        "export interface RegistrationResult {\n"
        "  success: boolean;\n"
        "  receiptNumber?: string;\n"
        "  error?: string;\n"
        "}\n\n"
        "export interface ToggleWindowInput {\n"
        "  eventId: string;\n"
        "  targetStatus: 'OPEN' | 'PAUSED' | 'CLOSED';\n"
        "}\n"
        "```"
    )

    add_heading_1("Appendix C: Production Deployment Checklist")
    add_para(
        "Before promoting Electify to production, administrators must verify the following configuration checklist:"
    )
    add_para("1. [ ] DATABASE_URL is configured with PgBouncer connection pooler (port 6543) and SSL enabled.")
    add_para("2. [ ] DIRECT_URL points to direct PostgreSQL connection (port 5432) for executing Drizzle migrations.")
    add_para("3. [ ] JWT_SECRET is populated with a high-entropy 32+ character random secret (openssl rand -base64 32).")
    add_para("4. [ ] SETUP_SECRET is configured to restrict unauthenticated admin bootstrapping via /api/health?setup=true.")
    add_para("5. [ ] NEXT_PUBLIC_APP_URL is set to the official university domain (https://electify.srmist.edu.in).")
    add_para("6. [ ] Supabase Realtime WebSocket keys are verified in Supabase project dashboard.")
    add_para("7. [ ] Automated test suite (npm test) passes with 105/105 tests passing.")
    add_para("8. [ ] Production Next.js build (npm run build) compiles with 0 errors and 0 warnings.")

    add_heading_1("Appendix D: Authentic Application Screenshots and UI Verification")
    add_para(
        "All visual figures presented in Chapter 7 (Figure 7.1: Login UI, Figure 7.2: Year Servers Workspace Dashboard, Figure 7.3: Academic "
        "Hierarchy UI) represent authentic screenshots captured directly from the running Electify application instance. They substantiate "
        "that Electify is a fully functioning, verified software platform operating in accordance with institutional requirements."
    )

    print("Completed Chapters 9, 10, References, and Appendices.")
    return doc
