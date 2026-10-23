# Electify Architecture Documentation

> **Partly superseded (23 Oct 2026).** This file is kept for history. It is out of date on the receipt format and timing (receipts are now `ELC-<year>-<ODD|EVEN>-<seq>` and are issued only at finalization). Use [documentation/PROJECT_MAINTENANCE_MANUAL.md](../documentation/PROJECT_MAINTENANCE_MANUAL.md) and the guides next to it.

## 1. System Overview

**Electify** is an enterprise-grade university elective registration system engineered for high concurrency, fair seat allocation, and clean academic hierarchy management.

The system is built on **Next.js 16 (App Router)**, **React 19**, **Drizzle ORM**, and **PostgreSQL**, with real-time dynamic seat monitoring via **Supabase Realtime**.

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│  Next.js 16 (App Router) + React 19 + Tailwind CSS + Lucide │
│  Student Dashboard | Faculty Admin | Monitor | Year Servers │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / Cookies / Server Actions
┌──────────────────────────────▼──────────────────────────────┐
│                  Edge & Application Layer                   │
│   src/proxy.ts (JWT Route Guards & Role Enforcements)       │
│   src/app/actions/* (Type-Safe Mutating Server Actions)     │
│   src/app/api/* (Healthchecks, Realtime sync, CSV APIs)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ Drizzle ORM (Node Postgres Pool)
┌──────────────────────────────▼──────────────────────────────┐
│                      Data Store & PubSub                    │
│   PostgreSQL: Atomic Transactions, Row-Level Locks, FKs     │
│   Supabase Realtime: Postgres CDC -> WebSocket Broadcaster  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. University Hierarchy: The Year Server Architecture

Electify models university academics as distinct **Year Servers** (e.g. 2024, 2025, 2026, 2027):

```
Year Server (e.g., 2026)
  └── Faculty (e.g., College of Engineering and Technology)
        └── Department (e.g., Computing Technologies)
              └── Programme (e.g., Master of Computer Applications - MCA)
                    └── Academic Batch (e.g., MCA 2024-2026)
                          ├── Sections (e.g., Section A, Section B)
                          │     ├── Students (users with role=STUDENT)
                          │     └── Class Tutors (linked via tutor_sections)
                          └── Registration Events
                                └── Elective Groups
                                      └── Elective Offerings (with capacity & live counts)
```

Each year server is an isolated workspace for a graduation or admission cohort, enabling clean administrative separation without polluting multi-year queries.

---

## 3. Registration Workflow & Concurrency Safeguards

### Flow of a Student Registration:
1. **Countdown & Eligibility Check**:
   - The student accesses `/dashboard`.
   - The system validates that the student belongs to an eligible `section` mapped to an `OPEN` `registration_event`.
   - If the event is scheduled for the future, the student is held at `/countdown` with a synchronized countdown timer.
2. **Elective Selection & Submission**:
   - When the window opens, the student selects electives matching group constraints (e.g., min 1, max 1 in PE-I; min 1, max 1 in OE-I).
   - Upon clicking "Confirm & Submit", the request executes `registerForElectives` server action.
3. **Atomic Postgres Transaction**:
   ```sql
   BEGIN;
   -- 1. Check if student already registered (or verify unlocked status for edits)
   -- 2. Check current seat capacity for each elective
   -- 3. Atomically decrement available_seats (available_seats = available_seats - 1)
   -- 4. Verify available_seats >= 0 constraint; ROLLBACK if violated (overbooked)
   -- 5. Mark is_full = true if available_seats == 0
   -- 6. Insert student_registrations record with audit timestamp
   -- 7. Insert audit_logs entry and log into replay_events
   COMMIT;
   ```
4. **Receipt Generation**:
   - A cryptographic receipt number (`REC-YYYYMMDD-XXXXX`) is generated and stamped onto the student's confirmed registration record.
   - The student can immediately generate and download a digitally structured PDF confirmation receipt via client-side `jsPDF` / `jsPDF-AutoTable`.

---

## 4. Realtime Seat Monitoring & Presence

- Every elective seat allocation update triggers a PostgreSQL change data capture (CDC) event.
- **Supabase Realtime** pushes the updated `availableSeats` count across open WebSockets to:
  - Active student dashboards (disabling full electives in real time).
  - The Live Registration Monitor (`/faculty/monitor`).
  - Class Tutor and Course Coordinator dashboards.
- Presence tracking monitors the volume of connected active students per section.

---

## 5. Security & Authentication Model

- **Session Tokens**: Custom signed JWTs containing `userId`, `role`, and academic cohort attributes (`facultyId`, `departmentId`, `programmeId`, `sectionId`).
- **Single-Device Enforcement**: Each user record stores `current_session_id`. When a token's session ID does not match the active session in the database, the request is terminated, preventing shared accounts or simultaneous multi-device logins.
- **Password Hardening**: Passwords hashed with `bcryptjs` (salt rounds 12).
- **Temporary Upgrades**: Freshly created student accounts on default passwords receive short-lived (10-minute) cryptographic tickets requiring password updates before entering unrestricted portals.
