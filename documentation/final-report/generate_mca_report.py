import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
import os

def create_report():
    doc = docx.Document()

    # 1. Page Setup: Standard Academic A4/Letter margins (Left 1.25", Right 1.0", Top 1.0", Bottom 1.0")
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.25)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)

    # Styles
    COLOR_PRIMARY = RGBColor(15, 23, 42)     # #0F172A (Deep Slate/Navy)
    COLOR_SECONDARY = RGBColor(37, 99, 235)  # #2563EB (Royal Blue)
    COLOR_BODY = RGBColor(30, 41, 59)        # #1E293B (Dark Charcoal)
    COLOR_MUTED = RGBColor(100, 116, 139)    # #64748B (Slate Muted)

    # Helper functions
    def set_cell_background(cell, fill_hex):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        tcPr.append(shd)

    def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
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
        
        # Divider line
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
        else:
            print(f"Warning: image {img_path} not found")

    def create_styled_table(headers, data, col_widths=None):
        table = doc.add_table(rows=len(data) + 1, cols=len(headers))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        
        # Style Header
        hdr_cells = table.rows[0].cells
        for i, h_text in enumerate(headers):
            hdr_cells[i].text = h_text
            set_cell_background(hdr_cells[i], "1E3A8A") # Navy Blue
            set_cell_margins(hdr_cells[i], top=120, bottom=120, left=140, right=140)
            p = hdr_cells[i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            for r in p.runs:
                format_run(r, size_pt=9.5, bold=True, color=RGBColor(255, 255, 255))
        
        # Data Rows
        for row_idx, row_data in enumerate(data):
            row_cells = table.rows[row_idx + 1].cells
            bg_color = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
            for col_idx, cell_value in enumerate(row_data):
                row_cells[col_idx].text = str(cell_value)
                set_cell_background(row_cells[col_idx], bg_color)
                set_cell_margins(row_cells[col_idx], top=90, bottom=90, left=130, right=130)
                p = row_cells[col_idx].paragraphs[0]
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                p.paragraph_format.line_spacing = 1.15
                for r in p.runs:
                    format_run(r, size_pt=9, color=COLOR_BODY)

        # Set column widths if provided
        if col_widths:
            for row in table.rows:
                for idx, width in enumerate(col_widths):
                    row.cells[idx].width = Inches(width)

        p_spacer = doc.add_paragraph()
        p_spacer.paragraph_format.space_before = Pt(2)
        p_spacer.paragraph_format.space_after = Pt(8)
        return table

    print("Framework initialized. Generating document pages...")

    # =========================================================================
    # PRELIMINARY PAGES
    # =========================================================================

    # 1. COVER PAGE
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run("A MINI PROJECT REPORT\nON\n")
    format_run(run, size_pt=13, bold=True, color=COLOR_PRIMARY)

    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(14)
    run_t = p_title.add_run("ELECTIFY: A UNIVERSITY ELECTIVE REGISTRATION AND MANAGEMENT SYSTEM")
    format_run(run_t, size_pt=17, bold=True, color=COLOR_SECONDARY)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(10)
    p_sub.paragraph_format.space_after = Pt(8)
    run_sub = p_sub.add_run("SUBMITTED IN PARTIAL FULFILLMENT OF THE REQUIREMENTS\nFOR THE AWARD OF THE DEGREE OF\n")
    format_run(run_sub, size_pt=11, bold=True, color=COLOR_PRIMARY)

    p_deg = doc.add_paragraph()
    p_deg.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_deg.paragraph_format.space_before = Pt(0)
    p_deg.paragraph_format.space_after = Pt(14)
    run_deg = p_deg.add_run("MASTER OF COMPUTER APPLICATIONS (MCA)")
    format_run(run_deg, size_pt=14, bold=True, color=COLOR_PRIMARY)

    # Student & Guide block
    p_by = doc.add_paragraph()
    p_by.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_by.paragraph_format.space_before = Pt(10)
    p_by.paragraph_format.space_after = Pt(4)
    run_by = p_by.add_run("SUBMITTED BY\n")
    format_run(run_by, size_pt=11, bold=True, color=COLOR_PRIMARY)
    run_auth = p_by.add_run("[STUDENT NAME] (Reg. No: [REGISTER NUMBER])\n\n")
    format_run(run_auth, size_pt=12.5, bold=True, color=COLOR_BODY)

    run_und = p_by.add_run("UNDER THE GUIDANCE OF\n")
    format_run(run_und, size_pt=11, bold=True, color=COLOR_PRIMARY)
    run_guide = p_by.add_run("[FACULTY GUIDE NAME], M.Tech., Ph.D.\nAssistant Professor\n")
    format_run(run_guide, size_pt=12, bold=True, color=COLOR_BODY)

    # SRM Logo
    if os.path.exists("documentation/final-report/assets/srm_logo.png"):
        p_logo = doc.add_paragraph()
        p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_logo.paragraph_format.space_before = Pt(14)
        p_logo.paragraph_format.space_after = Pt(14)
        p_logo.add_run().add_picture("documentation/final-report/assets/srm_logo.png", width=Inches(3.4))

    # University Footer
    p_dept = doc.add_paragraph()
    p_dept.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dept.paragraph_format.space_before = Pt(10)
    p_dept.paragraph_format.space_after = Pt(2)
    run_dept = p_dept.add_run("DEPARTMENT OF COMPUTER APPLICATIONS\nFACULTY OF SCIENCE AND HUMANITIES\nSRM INSTITUTE OF SCIENCE AND TECHNOLOGY\n")
    format_run(run_dept, size_pt=12, bold=True, color=COLOR_PRIMARY)
    run_loc = p_dept.add_run("Kattankulathur – 603 203, Chengalpattu District, Tamil Nadu, India\n")
    format_run(run_loc, size_pt=10.5, bold=False, color=COLOR_BODY)
    run_date = p_dept.add_run("OCTOBER – 2026")
    format_run(run_date, size_pt=12, bold=True, color=COLOR_PRIMARY)

    # 2. BONAFIDE CERTIFICATE
    doc.add_page_break()
    p_cert_title = doc.add_paragraph()
    p_cert_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_cert_title.paragraph_format.space_before = Pt(18)
    p_cert_title.paragraph_format.space_after = Pt(24)
    run_ct = p_cert_title.add_run("BONAFIDE CERTIFICATE")
    format_run(run_ct, size_pt=16, bold=True, color=COLOR_PRIMARY)

    add_para(
        "This is to certify that the project report entitled “ELECTIFY: A UNIVERSITY ELECTIVE REGISTRATION AND MANAGEMENT SYSTEM” "
        "submitted by [STUDENT NAME] (Register Number: [REGISTER NUMBER]) in partial fulfillment of the requirements for the award of "
        "the degree of Master of Computer Applications, is a bonafide record of the work carried out by him/her under my guidance and "
        "supervision during the academic year 2025–2026.",
        space_after=14
    )

    add_para(
        "The project work represents an authentic implementation of an enterprise-grade university elective registration system. "
        "The algorithms for transactional seat allocation, role-based access control, cryptographic receipt issuance, and concurrency control "
        "have been rigorously executed, tested, and validated in accordance with the departmental guidelines. The project has been completed "
        "satisfactorily and is approved for submission.",
        space_after=40
    )

    # Signatures table
    sig_table = doc.add_table(rows=2, cols=2)
    sig_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sig_table.rows[0].cells[0].paragraphs[0].text = "[FACULTY GUIDE NAME]\nAssistant Professor / Project Guide\nDepartment of Computer Applications\nSRM Institute of Science and Technology"
    sig_table.rows[0].cells[1].paragraphs[0].text = "Dr. P. J. ARUL LEENA ROSE\nHead of the Department\nDepartment of Computer Applications\nSRM Institute of Science and Technology"
    sig_table.rows[1].cells[0].paragraphs[0].text = "\n\n_____________________________\nINTERNAL EXAMINER"
    sig_table.rows[1].cells[1].paragraphs[0].text = "\n\n_____________________________\nEXTERNAL EXAMINER"

    for row in sig_table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for r in p.runs:
                    format_run(r, size_pt=10.5, bold=True, color=COLOR_BODY)

    # 3. DECLARATION
    doc.add_page_break()
    p_dec = doc.add_paragraph()
    p_dec.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_dec.paragraph_format.space_before = Pt(18)
    p_dec.paragraph_format.space_after = Pt(20)
    run_dec = p_dec.add_run("CANDIDATE DECLARATION")
    format_run(run_dec, size_pt=16, bold=True, color=COLOR_PRIMARY)

    add_para(
        "I hereby declare that the project report entitled “ELECTIFY: A UNIVERSITY ELECTIVE REGISTRATION AND MANAGEMENT SYSTEM” "
        "submitted to the Department of Computer Applications, Faculty of Science and Humanities, SRM Institute of Science and Technology, "
        "is a genuine record of the original project work done by me under the supervision of [FACULTY GUIDE NAME].",
        space_after=14
    )

    add_para(
        "I further declare that this report has not previously formed the basis for the award of any Degree, Diploma, Associateship, "
        "Fellowship, or any other similar title in any other University or Institution of Higher Education. All external citations, "
        "framework conventions, software libraries, and data models used in this study have been dutifully acknowledged.",
        space_after=40
    )

    p_sig = doc.add_paragraph()
    p_sig.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_sig = p_sig.add_run("Signature of the Candidate: _______________________\n[STUDENT NAME]\nRegister Number: [REGISTER NUMBER]\nPlace: Kattankulathur, Chennai\nDate: 13-10-2026")
    format_run(r_sig, size_pt=11, bold=True, color=COLOR_BODY)

    # 4. ACKNOWLEDGEMENTS
    doc.add_page_break()
    p_ack = doc.add_paragraph()
    p_ack.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_ack.paragraph_format.space_before = Pt(18)
    p_ack.paragraph_format.space_after = Pt(20)
    run_ack = p_ack.add_run("ACKNOWLEDGEMENTS")
    format_run(run_ack, size_pt=16, bold=True, color=COLOR_PRIMARY)

    add_para(
        "The successful completion of this project report would not have been possible without the encouragement, guidance, and "
        "scholarly support of several individuals and the academic ecosystem of SRM Institute of Science and Technology. I take this opportunity "
        "to express my heartfelt gratitude to everyone who contributed to this endeavour.",
        space_after=12
    )

    add_para(
        "First and foremost, I express my deepest sense of gratitude and respect to my Project Guide, [FACULTY GUIDE NAME], Assistant Professor, "
        "Department of Computer Applications, for his/her invaluable guidance, intellectual stimulation, and patient mentorship throughout "
        "the architectural design, database modeling, and testing of Electify. His/Her profound insights into database reliability, transaction concurrency, "
        "and software architecture provided the bedrock for this implementation.",
        space_after=12
    )

    add_para(
        "I am profoundly grateful to Dr. P. J. Arul Leena Rose, Head, Department of Computer Applications, for providing the necessary laboratory "
        "facilities, computational infrastructure, and a vibrant academic atmosphere that made it possible to conduct high-concurrency simulation "
        "experiments effectively.",
        space_after=12
    )

    add_para(
        "I also extend my sincere appreciation to the Dean and Faculty Members of the Faculty of Science and Humanities for their continuous "
        "administrative support, constructive reviews during progress milestones, and encouragement.",
        space_after=12
    )

    add_para(
        "Finally, I am indebted to my parents, family, and fellow classmates for their moral support, understanding, and motivation during the "
        "intensive phases of software development, bug fixing, and report preparation. While many individuals have assisted me, I accept sole "
        "responsibility for any inadvertent technical or editorial deficiencies present in this document.",
        space_after=30
    )

    p_names = doc.add_paragraph()
    p_names.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_n = p_names.add_run("[STUDENT NAME]\nMCA Candidate, SRMIST")
    format_run(r_n, size_pt=11, bold=True, color=COLOR_BODY)

    # 5. ABSTRACT & KEYWORDS
    doc.add_page_break()
    p_abs = doc.add_paragraph()
    p_abs.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_abs.paragraph_format.space_before = Pt(18)
    p_abs.paragraph_format.space_after = Pt(18)
    run_abs = p_abs.add_run("ABSTRACT")
    format_run(run_abs, size_pt=16, bold=True, color=COLOR_PRIMARY)

    add_para(
        "University elective course registration is a high-contention, mission-critical workflow that occurs at the beginning of each academic "
        "semester. In collegiate environments with thousands of eligible students—such as SRM Institute of Science and Technology—registration "
        "windows frequently suffer from severe technical and administrative bottlenecks. Legacy Enterprise Resource Planning (ERP) portals "
        "routinely experience race conditions, oversubscribed course capacities, multi-tab seat sniping, session hijacking, and complete database "
        "lockups under peak concurrent loads. Furthermore, the absence of fine-grained audit logs leads to protracted dispute resolution between "
        "students, class tutors, and academic coordinators regarding seat allocation timing.",
        space_after=12
    )

    add_para(
        "To resolve these persistent challenges, this project introduces Electify, a modern, full-stack, enterprise-grade elective registration "
        "and management system. Built upon Next.js 16 (App Router), React 19, TypeScript, and Tailwind CSS, Electify leverages PostgreSQL "
        "and Drizzle ORM to enforce strict ACID transactional guarantees. The core technical contribution of Electify is its zero-waitlist, "
        "pessimistic row-locking allocation algorithm: upon student submission, elective rows are locked via atomic SQL updates with strict "
        "non-negative seat constraints (available_seats >= 0). Overbooking is mathematically impossible; transactions that encounter zero seats "
        "automatically roll back cleanly with zero orphaned states.",
        space_after=12
    )

    add_para(
        "Electify further incorporates an innovative Year Servers architecture that simplifies complex academic hierarchies (Faculties, "
        "Departments, Programmes, Cohorts, and Sections) into distinct annual workspaces (e.g., 2025, 2026, 2027), eliminating cross-batch data "
        "pollution. A single-active-session sentinel terminates duplicate logins from concurrent devices, preventing seat-sniping bots. To ensure "
        "unquestioned accountability, Electify features an event-sourced Time-Travel Replay Engine that logs state transitions in a immutable "
        "ledger and provides instant cryptographic PDF receipts (REC-YYYYMMDD-XXXXX) upon confirmation. Real-time seat saturation telemetry is "
        "broadcast to surveillance dashboards via Supabase Realtime Change Data Capture (CDC).",
        space_after=12
    )

    add_para(
        "The system has been comprehensively verified across 14 automated test suites containing 105 unit, integration, and concurrency tests, "
        "achieving a 100% pass rate. Stress testing under simulated concurrent requests confirmed zero overbooking anomalies, absolute session "
        "isolation, and deterministic rollback behavior. Electify provides a robust, transparent, and dispute-free platform that elevates "
        "university academic registration into a reliable, fair, and modern digital experience.",
        space_after=14
    )

    p_kw = doc.add_paragraph()
    p_kw.paragraph_format.space_before = Pt(8)
    p_kw.paragraph_format.space_after = Pt(14)
    run_kw_label = p_kw.add_run("Keywords: ")
    format_run(run_kw_label, size_pt=11, bold=True, color=COLOR_PRIMARY)
    run_kw = p_kw.add_run("Elective Registration, Database Concurrency, Pessimistic Row Locking, Next.js 16, PostgreSQL, Drizzle ORM, Year Servers, Event Sourcing, Single-Session Sentinel, Academic ERP.")
    format_run(run_kw, size_pt=10.5, italic=True, color=COLOR_BODY)

    # 6. TABLE OF CONTENTS
    doc.add_page_break()
    p_toc = doc.add_paragraph()
    p_toc.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_toc.paragraph_format.space_before = Pt(18)
    p_toc.paragraph_format.space_after = Pt(18)
    run_toc = p_toc.add_run("TABLE OF CONTENTS")
    format_run(run_toc, size_pt=16, bold=True, color=COLOR_PRIMARY)

    toc_entries = [
        ("BONAFIDE CERTIFICATE", "ii"),
        ("CANDIDATE DECLARATION", "iii"),
        ("ACKNOWLEDGEMENTS", "iv"),
        ("ABSTRACT", "v"),
        ("LIST OF TABLES", "viii"),
        ("LIST OF FIGURES", "ix"),
        ("LIST OF ABBREVIATIONS", "x"),
        ("CHAPTER 1: INTRODUCTION", "1"),
        ("  1.1 Background and Institutional Context", "1"),
        ("  1.2 Problem Statement", "2"),
        ("  1.3 Project Motivation", "4"),
        ("  1.4 Objectives of the Project", "5"),
        ("  1.5 Scope of the System", "6"),
        ("  1.6 Intended User Roles and Personas", "7"),
        ("  1.7 System Assumptions and Constraints", "8"),
        ("  1.8 Organization of the Report", "9"),
        ("CHAPTER 2: LITERATURE REVIEW AND RELATED SYSTEMS", "10"),
        ("  2.1 Evolution of University Course Registration Systems", "10"),
        ("  2.2 Comparative Analysis of Academic ERP Solutions", "12"),
        ("  2.3 Database Concurrency Control in High-Contention Allocation", "14"),
        ("  2.4 Modern Web Architectures and Edge-Proxy Routing", "16"),
        ("  2.5 Event Sourcing, Audit Integrity and Replay Engines", "18"),
        ("  2.6 Critical Analysis and Identified Research Gaps", "20"),
        ("CHAPTER 3: REQUIREMENTS ANALYSIS AND SPECIFICATION", "22"),
        ("  3.1 Functional Requirements Specification", "22"),
        ("  3.2 Non-Functional Requirements and Service Level Agreements", "25"),
        ("  3.3 User Persona and Role-Based Access Control Specifications", "27"),
        ("  3.4 Academic Data Governance and Cohort Isolation Rules", "29"),
        ("  3.5 System Dependencies and Deployment Assumptions", "31"),
        ("CHAPTER 4: SYSTEM ANALYSIS AND DESIGN", "33"),
        ("  4.1 Existing System Deficiencies and Bottlenecks", "33"),
        ("  4.2 Proposed Electify System Architecture", "35"),
        ("  4.3 Feasibility Analysis", "36"),
        ("  4.4 Use Case Modeling and Actor Interactions", "38"),
        ("  4.5 Activity Diagrams of Registration Workflows", "41"),
        ("  4.6 Sequence Diagrams of Concurrent Seat Allocation", "43"),
        ("  4.7 State Machine Diagram of Registration Windows and Seat States", "45"),
        ("  4.8 Data Flow Modeling (Level 0 and Level 1 DFD)", "47"),
        ("CHAPTER 5: SYSTEM ARCHITECTURE AND METHODOLOGY", "49"),
        ("  5.1 High-Level Architecture Overview", "49"),
        ("  5.2 Frontend Layer: Next.js 16 App Router and Component Design", "51"),
        ("  5.3 Edge Proxy and Route Guard Layer (src/proxy.ts)", "53"),
        ("  5.4 Mutating Server Actions and Domain Processing Logic", "55"),
        ("  5.5 Transactional Seat Allocation and Pessimistic Concurrency Engine", "57"),
        ("  5.6 Single-Active-Session Sentinel and Brute-Force Throttling", "59"),
        ("  5.7 Event-Sourced Time-Travel Replay Engine", "61"),
        ("  5.8 Real-Time Seat Broadcasting via Supabase CDC", "63"),
        ("CHAPTER 6: DATABASE DESIGN AND DATA MODELING", "65"),
        ("  6.1 Relational Schema Architecture and Invariant Guarantees", "65"),
        ("  6.2 Entity-Relationship (ER) Modeling", "67"),
        ("  6.3 Comprehensive Data Dictionary (17 Relational Tables)", "69"),
        ("  6.4 Foreign Key Constraints, Cascades and Storage Indices", "76"),
        ("  6.5 Database Migration Workflow and Safe Rollback Procedures", "78"),
        ("CHAPTER 7: IMPLEMENTATION DETAILS", "80"),
        ("  7.1 Technology Stack and Production Runtime Specifications", "80"),
        ("  7.2 Academic Year Servers Workspace Implementation", "82"),
        ("  7.3 Student Registration and Course Booking Engine", "84"),
        ("  7.4 Subject Explorer and Pre-Registration Catalog Discovery", "86"),
        ("  7.5 Surveillance Monitor and Live Registration Feed", "88"),
        ("  7.6 Staff Onboarding and Role-Based Unique Invite Codes", "90"),
        ("  7.7 Cryptographic Receipt Issuance and PDF Synthesis", "92"),
        ("CHAPTER 8: TESTING, VERIFICATION AND EVALUATION", "94"),
        ("  8.1 Comprehensive Verification Strategy", "94"),
        ("  8.2 Automated Test Suite Breakdown (14 Suites, 105 Tests)", "96"),
        ("  8.3 Detailed Test Case Execution Matrix", "98"),
        ("  8.4 Concurrency Stress Testing and Overbooking Prevention", "102"),
        ("  8.5 Zero-Waitlist Rollback and Seat Restoration Validation", "104"),
        ("  8.6 Static Analysis, Linting and Next.js 16 Production Build Validation", "106"),
        ("CHAPTER 9: RESULTS, DISCUSSION AND CRITICAL ANALYSIS", "108"),
        ("  9.1 Implemented Capabilities and Functional Milestones", "108"),
        ("  9.2 Concurrency Benchmark Evaluation", "110"),
        ("  9.3 User Experience Analysis Across Academic Personas", "112"),
        ("  9.4 Security Hardening and Vulnerability Remediation", "114"),
        ("  9.5 Architectural Trade-offs and Engineering Limitations", "116"),
        ("CHAPTER 10: CONCLUSION AND FUTURE ENHANCEMENTS", "118"),
        ("  10.1 Summary of Technical Contributions", "118"),
        ("  10.2 Achievement of Project Objectives", "119"),
        ("  10.3 Novel Engineering Innovations", "120"),
        ("  10.4 Limitations of the Current Implementation", "121"),
        ("  10.5 Future Roadmap and Institutional Scaling", "122"),
        ("  10.6 Concluding Remarks", "123"),
        ("REFERENCES", "124"),
        ("APPENDICES", "128"),
        ("  Appendix A: Database Schema Migration SQL Definition", "128"),
        ("  Appendix B: Server Action API Specifications", "131"),
        ("  Appendix C: Production Deployment Checklist", "134"),
        ("  Appendix D: Authentic Application Screenshots and Verification", "136"),
    ]

    for title, page in toc_entries:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(1)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        
        # Format text
        is_main = title.startswith("CHAPTER") or title in ["BONAFIDE CERTIFICATE", "CANDIDATE DECLARATION", "ACKNOWLEDGEMENTS", "ABSTRACT", "LIST OF TABLES", "LIST OF FIGURES", "LIST OF ABBREVIATIONS", "REFERENCES", "APPENDICES"]
        r_text = p.add_run(title)
        format_run(r_text, size_pt=10.5 if is_main else 10, bold=is_main, color=COLOR_PRIMARY if is_main else COLOR_BODY)
        
        # Leader dots calculation
        dots_len = max(5, 75 - len(title))
        r_dots = p.add_run(" " + ". " * (dots_len // 2) + " ")
        format_run(r_dots, size_pt=9, color=COLOR_MUTED)
        
        r_pg = p.add_run(page)
        format_run(r_pg, size_pt=10, bold=is_main, color=COLOR_PRIMARY if is_main else COLOR_BODY)

    # 7. LIST OF TABLES
    doc.add_page_break()
    p_lot = doc.add_paragraph()
    p_lot.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_lot.paragraph_format.space_before = Pt(18)
    p_lot.paragraph_format.space_after = Pt(18)
    run_lot = p_lot.add_run("LIST OF TABLES")
    format_run(run_lot, size_pt=16, bold=True, color=COLOR_PRIMARY)

    lot_entries = [
        ("Table 2.1: Comparative Analysis of University Registration Systems", "13"),
        ("Table 3.1: Functional Requirements Specification (FR-01 to FR-12)", "24"),
        ("Table 3.2: Non-Functional Requirements & Performance SLAs", "26"),
        ("Table 3.3: Role-Based Access Control (RBAC) Permissions Matrix", "28"),
        ("Table 6.1: Master Database Relational Schema & Table Classifications", "66"),
        ("Table 6.2: Academic Structure Data Dictionary (4 Tables)", "70"),
        ("Table 6.3: Cohort and Section Structure Data Dictionary (3 Tables)", "71"),
        ("Table 6.4: Identity, Security and Invite Codes Data Dictionary (3 Tables)", "72"),
        ("Table 6.5: Registration Event and Elective Offerings Data Dictionary (4 Tables)", "73"),
        ("Table 6.6: Registration Records and Audit Trail Data Dictionary (3 Tables)", "75"),
        ("Table 7.1: Electify Core Technology Stack and Production Dependencies", "81"),
        ("Table 8.1: Test Suite Verification Summary Across All 14 Test Suites (105 Tests)", "97"),
        ("Table 8.2: Detailed Test Case Execution Matrix (25 Primary Verification Cases)", "99"),
        ("Table 8.3: High-Concurrency Stress Test Matrix (Pessimistic vs Optimistic Locking)", "103"),
        ("Table 9.1: Technical Objectives Fulfilment and Verification Summary", "109"),
    ]

    for title, page in lot_entries:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(3)
        r_text = p.add_run(title)
        format_run(r_text, size_pt=10, bold=False, color=COLOR_BODY)
        dots_len = max(5, 78 - len(title))
        r_dots = p.add_run(" " + ". " * (dots_len // 2) + " ")
        format_run(r_dots, size_pt=9, color=COLOR_MUTED)
        r_pg = p.add_run(page)
        format_run(r_pg, size_pt=10, bold=True, color=COLOR_PRIMARY)

    # 8. LIST OF FIGURES
    doc.add_page_break()
    p_lof = doc.add_paragraph()
    p_lof.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_lof.paragraph_format.space_before = Pt(18)
    p_lof.paragraph_format.space_after = Pt(18)
    run_lof = p_lof.add_run("LIST OF FIGURES")
    format_run(run_lof, size_pt=16, bold=True, color=COLOR_PRIMARY)

    lof_entries = [
        ("Figure 1.1: Use Case Diagram — System Actors and Interactions", "7"),
        ("Figure 4.1: Activity Diagram — End-to-End Student Elective Registration Workflow", "42"),
        ("Figure 4.2: Sequence Diagram — Concurrent Registration with Pessimistic Locking", "44"),
        ("Figure 4.3: State Machine Diagram — Registration Event Lifecycle and Seat States", "46"),
        ("Figure 5.1: High-Level System Architecture of Electify", "50"),
        ("Figure 6.1: Entity-Relationship Diagram of Electify PostgreSQL Relational Schema", "68"),
        ("Figure 7.1: Authentic User Interface — Electify Unified Authentication Portal", "81"),
        ("Figure 7.2: Authentic User Interface — Year Servers Annual Workspace Dashboard", "83"),
        ("Figure 7.3: Authentic User Interface — Academic Hierarchy and Programme Class Structure", "84"),
        ("Figure 8.1: Test Suite Coverage and Automated Verification Results (100% Pass Rate)", "96"),
    ]

    for title, page in lof_entries:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(3)
        r_text = p.add_run(title)
        format_run(r_text, size_pt=10, bold=False, color=COLOR_BODY)
        dots_len = max(5, 78 - len(title))
        r_dots = p.add_run(" " + ". " * (dots_len // 2) + " ")
        format_run(r_dots, size_pt=9, color=COLOR_MUTED)
        r_pg = p.add_run(page)
        format_run(r_pg, size_pt=10, bold=True, color=COLOR_PRIMARY)

    # 9. LIST OF ABBREVIATIONS
    doc.add_page_break()
    p_ab = doc.add_paragraph()
    p_ab.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_ab.paragraph_format.space_before = Pt(18)
    p_ab.paragraph_format.space_after = Pt(18)
    run_ab = p_ab.add_run("LIST OF ABBREVIATIONS")
    format_run(run_ab, size_pt=16, bold=True, color=COLOR_PRIMARY)

    abbreviations = [
        ("ACID", "Atomicity, Consistency, Isolation, Durability"),
        ("API", "Application Programming Interface"),
        ("CDC", "Change Data Capture"),
        ("CSS", "Cascading Style Sheets"),
        ("CSV", "Comma-Separated Values"),
        ("DDL", "Data Definition Language"),
        ("DFD", "Data Flow Diagram"),
        ("DML", "Data Manipulation Language"),
        ("DOM", "Document Object Model"),
        ("ER / ERD", "Entity-Relationship / Entity-Relationship Diagram"),
        ("ERP", "Enterprise Resource Planning"),
        ("FK", "Foreign Key"),
        ("HTTP / HTTPS", "Hypertext Transfer Protocol / HTTP Secure"),
        ("JSON", "JavaScript Object Notation"),
        ("JWT", "JSON Web Token"),
        ("MCA", "Master of Computer Applications"),
        ("ORM", "Object-Relational Mapping"),
        ("PDF", "Portable Document Format"),
        ("PK", "Primary Key"),
        ("RBAC", "Role-Based Access Control"),
        ("REST", "Representational State Transfer"),
        ("SLA", "Service Level Agreement"),
        ("SQL", "Structured Query Language"),
        ("SRMIST", "SRM Institute of Science and Technology"),
        ("SSL / TLS", "Secure Sockets Layer / Transport Layer Security"),
        ("SSR", "Server-Side Rendering"),
        ("UI / UX", "User Interface / User Experience"),
        ("UUID", "Universally Unique Identifier"),
        ("WS", "WebSocket"),
    ]

    create_styled_table(["Abbreviation", "Expanded Description"], abbreviations, col_widths=[2.0, 5.0])

    # =========================================================================
    # CHAPTER 1: INTRODUCTION
    # =========================================================================
    add_chapter_title(1, "Introduction")

    add_heading_1("1.1 Background and Institutional Context")
    add_para(
        "Higher education institutions around the world are progressively adopting Choice-Based Credit Systems (CBCS), enabling students "
        "to tailor their academic curricula through professional and open elective courses. At major collegiate universities such as SRM Institute "
        "of Science and Technology (SRMIST), elective course registration is a biannual milestone that directly influences students' specializations, "
        "placement trajectories, and professional competencies. In a typical academic department—such as the Department of Computer Applications "
        "or Computing Technologies—hundreds to thousands of undergraduate and postgraduate students must select their preferred elective subjects "
        "simultaneously within strict registration windows."
    )
    add_para(
        "Elective offerings span diverse emerging disciplines, including Cloud Computing, Machine Learning, Full-Stack Development, Cyber Security, "
        "Internet of Things, and Artificial Intelligence. However, because each elective subject has an upper ceiling on laboratory infrastructure, "
        "classroom seating, and faculty teaching bandwidth, course allocations must be conducted under strict capacity caps. This creates a highly "
        "competitive, time-sensitive environment where students race to secure their preferred electives the instant registration windows open."
    )

    add_heading_1("1.2 Problem Statement")
    add_para(
        "Despite rapid digitalization across higher education, collegiate elective registration remains heavily plagued by technical, "
        "operational, and administrative bottlenecks. Legacy university Enterprise Resource Planning (ERP) portals are structurally ill-equipped "
        "to handle burst traffic. During live registration events, thousands of concurrent HTTP requests bombard monolithic database servers, "
        "causing catastrophic performance degradation. Key operational failure modes include:"
    )
    add_para(
        "1. Concurrency Race Conditions and Seat Overbooking: When multiple students attempt to select the final remaining seat of a popular "
        "course at the exact same millisecond, naive database update queries (e.g., read seat count, check if greater than zero, decrement seat count) "
        "suffer from 'read-modify-write' race conditions. As a result, course quotas are routinely breached, enrolling more students than the "
        "classroom capacity allows."
    )
    add_para(
        "2. Multi-Tab Session Sniping: Students routinely bypass fair selection protocols by opening multiple browser tabs, windows, or automated "
        "scripts across different devices using shared login credentials, unfairly monopolizing seats before other students can load the page."
    )
    add_para(
        "3. Waitlist Deadlocks and Ghost Allocations: Legacy systems that implement complex multi-tiered waitlists often leave students in an "
        "ambiguous state. When higher-preference seats are forfeited, automated waitlist promotion cascades frequently fail or lock seats permanently, "
        "leaving classrooms under-enrolled while students are turned away."
    )
    add_para(
        "4. Absence of Cryptographic Audit Trails and Dispute Ambiguity: Following registration rushes, departments are overwhelmed by student "
        "grievances claiming that their submissions were dropped, altered, or overridden. Without timestamped event sourcing and tamper-proof digital "
        "receipts, academic coordinators have no verifiable mechanism to prove the chronological validity of seat allocations."
    )

    add_heading_1("1.3 Project Motivation")
    add_para(
        "The motivation behind Electify arises directly from the imperative to restore fairness, stability, and absolute transparency to the "
        "university elective registration experience. Modern web engineering paradigms—specifically Server-Side Rendering (SSR) via Next.js 16, "
        "strict TypeScript type safety, atomic PostgreSQL transactions with row-level locking, and reactive Change Data Capture (CDC)—provide the "
        "necessary technical foundation to solve elective allocation at scale. By replacing bloated, opaque legacy portals with a streamlined, "
        "pessimistic-concurrency web platform, Electify guarantees that seat allocation is deterministic, mathematically fair, and zero-defect."
    )

    add_heading_1("1.4 Objectives of the Project")
    add_para(
        "The primary objective of this project is to architect, develop, and thoroughly validate an enterprise-grade elective registration "
        "and management system tailored for university departments. The specific technical and functional objectives are:"
    )
    add_para("• Concurrency Integrity: To implement an ACID-compliant PostgreSQL transactional booking engine that mathematically prevents seat overbooking under extreme simultaneous loads using atomic row-level locks and non-negative constraints.")
    add_para("• Simplified Academic Hierarchy: To engineer a Year Servers architecture that segments university operations into clean annual workspaces (2025, 2026, 2027), isolating programmes, classes, and registrations without multi-year database pollution.")
    add_para("• Single-Session Security: To enforce a cryptographic JWT session sentinel that terminates duplicate logins from multiple devices in real-time, eliminating bot-driven seat sniping.")
    add_para("• Zero-Waitlist Transparency: To eliminate problematic waitlist states in favor of immediate, deterministic booking outcomes—guaranteeing that students either secure an elective or are cleanly notified to make an alternative selection.")
    add_para("• Verifiable Auditability and Time-Travel Replay: To log all allocation events in an immutable replay ledger, enabling staff to inspect seat transitions second-by-second and issuing students instant cryptographic PDF confirmation receipts.")
    add_para("• Real-Time Saturation Telemetry: To broadcast live seat availability and cohort completion metrics to faculty surveillance dashboards using Supabase Realtime Change Data Capture.")

    add_heading_1("1.5 Scope of the System")
    add_para(
        "The functional scope of Electify encompasses the complete lifecycle of university elective management, from pre-registration syllabus "
        "discovery through live allocation, administrative monitoring, student receipt downloads, and post-registration audit reviews. "
        "The system explicitly supports four distinct institutional roles: Students, Class Tutors, Course Coordinators, and System Administrators. "
        "The scope is strictly focused on batch-based elective course selection, section quota enforcement, and verifiable seat booking; "
        "it deliberately excludes financial fee collections, external hostel allocations, and semester grading examinations."
    )

    add_heading_1("1.6 Intended User Roles and Personas")
    add_para(
        "Electify defines four rigorously isolated user roles, each equipped with dedicated views and permissions:"
    )
    add_para("1. Student: Authenticates using institutional credentials (@srmist.edu.in). Explores published elective course descriptions, views live remaining seats, submits group choices during active windows, and downloads digitally signed PDF confirmation receipts.")
    add_para("2. Class Tutor: Assigned to specific cohort subdivisions (e.g., MCA Section A, Section B). Manages student roster onboarding via unique class signup codes, monitors class registration progress, and possesses granular authority to unlock or reset individual student selections upon formal dispute.")
    add_para("3. Course Coordinator: Academic authority governing specific programmes and batches. Configures registration windows, defines elective groups (Professional Electives, Open Electives), sets seat capacities and section quotas, monitors live feed telemetry, and accesses the Time-Travel Replay Engine.")
    add_para("4. System Administrator: Global institutional administrator. Provisions university faculties, departments, and programmes; manages Year Server workspaces; creates staff invite codes; and controls global maintenance modes.")

    add_figure("documentation/final-report/assets/fig_usecase.png", "Figure 1.1: Use Case Diagram — System Actors and Core Interactions", width=Inches(6.2))

    add_heading_1("1.7 System Assumptions and Constraints")
    add_para(
        "The operational design of Electify rests on the following assumptions and constraints: (1) Students possess valid institutional email "
        "addresses and network access during registration windows. (2) Each elective course has a strictly finite seat capacity determined by departmental "
        "faculty allocations. (3) Registrations are conducted on a strict first-come, first-served basis governed by database transaction commit timestamps. "
        "(4) The deployment environment provides access to a managed PostgreSQL instance supporting connection pooling and row-level locking."
    )

    add_heading_1("1.8 Organization of the Report")
    add_para(
        "This project report is structured into ten comprehensive chapters: Chapter 2 reviews relevant academic literature and existing registration "
        "systems. Chapter 3 presents functional and non-functional requirements. Chapter 4 provides system analysis, feasibility studies, and UML "
        "design diagrams. Chapter 5 articulates the software architecture and core methodologies. Chapter 6 provides database design and relational "
        "data dictionaries. Chapter 7 documents module-wise implementation details and authentic UI figures. Chapter 8 presents exhaustive test results "
        "across all 14 test suites. Chapter 9 critically discusses system results, benchmarks, and limitations. Finally, Chapter 10 presents conclusions "
        "and future institutional roadmap."
    )

    # Save initial progress
    doc.save("documentation/final-report/Electify_Mini_Project_Report.docx")
    print("Completed Chapter 1 and Preliminaries.")
    return doc

if __name__ == "__main__":
    create_report()
