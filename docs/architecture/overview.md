# Electify Architecture Overview

## 1. High-Level System Architecture

**Electify** is an enterprise-grade academic elective registration platform engineered for zero-waitlist, concurrency-safe course allocation across university cohorts.

The platform follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│  Next.js 16 (App Router) + React 19 + Tailwind CSS + Lucide │
│  - Student Portal: Countdown, Subject Explorer, Selection    │
│  - Staff Portal: Year Server Dashboard, Events, Live Feed   │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / Session Cookies / Server Actions
┌──────────────────────────────▼──────────────────────────────┐
│                  Edge & Application Layer                   │
│   src/proxy.ts (Network Boundary & Session Verification)    │
│   src/app/actions/* (ACID-Mutating Server Actions)          │
│   src/app/api/* (Health, Cross-session Switching)           │
│   src/lib/* (Auth, Seats, Workspace, Password Policy)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Drizzle ORM (Connection Pool)
┌──────────────────────────────▼──────────────────────────────┐
│                      Data Store & PubSub                    │
│   PostgreSQL 16: Atomic Transactions, Row-Level Locks       │
│   Supabase Realtime: Postgres CDC -> WebSocket Broadcaster  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. University Academic Hierarchy (Year Servers)

The university academic structure is organized into distinct **Year Servers** (e.g., 2025, 2026, 2027) to isolate cohorts and avoid cross-batch pollution:

```
Year Server (Academic Session: e.g. 2026)
  └── Faculty (e.g. College of Engineering & Technology)
        └── Department (e.g. Computing Technologies)
              └── Programme (e.g. Master of Computer Applications - MCA)
                    └── Academic Batch (e.g. MCA 2024–2026)
                          ├── Sections (e.g. Section A, Section B)
                          │     ├── Students (users with role=STUDENT)
                          │     └── Class Tutors (mapped via tutor_sections)
                          └── Registration Events
                                └── Elective Groups
                                      └── Elective Offerings (maxSeats, availableSeats)
```

---

## 3. Concurrency & Allocation Strategy

### The Race Condition Problem
During registration open windows, thousands of students click the submission button within the same fraction of a second. Naive checks (`SELECT available_seats > 0`) followed by `UPDATE` suffer from race conditions and lead to overbooking.

### The Electify Solution
Electify eliminates race conditions through **pessimistic row locking** inside atomic PostgreSQL transactions:

```sql
BEGIN;
-- 1. Lock the candidate elective row exclusively
SELECT * FROM electives WHERE id = $1 FOR UPDATE;

-- 2. Verify non-negative seat threshold
-- If seats exhausted: ROLLBACK and throw SeatTakenError
UPDATE electives 
SET available_seats = available_seats - 1,
    is_full = CASE WHEN available_seats - 1 <= 0 THEN true ELSE false END,
    updated_at = NOW()
WHERE id = $1 AND available_seats > 0;

-- 3. If section quota exists, lock and decrement section quota
UPDATE elective_seat_allocations
SET available_seats = available_seats - 1,
    is_full = CASE WHEN available_seats - 1 <= 0 THEN true ELSE false END,
    updated_at = NOW()
WHERE elective_id = $1 AND section_id = $2 AND available_seats > 0;

-- 4. Record confirmed registration and replay audit entry
COMMIT;
```

---

## 4. Real-Time Telemetry & Change Data Capture (CDC)

1. The client subscribes to Supabase Realtime channels (`realtime:public:electives`).
2. When a transaction commits, PostgreSQL triggers a CDC event.
3. Connected student browsers immediately receive the decrement payload over WebSockets and decrement their counter without refreshing.

---

## 5. Security & Session Sentinel

* **Network Boundary**: Handled via `src/proxy.ts` (Next.js 16 proxy convention).
* **Single-Session Sentinel**: Each login generates a unique `sessionId` stored in the JWT cookie and the `users.current_session_id` column. If a student attempts to log in from another browser or device to snipe seats, the previous session is immediately revoked.
* **Role-Based Authorization**: Every server action and route verifies session credentials against server state (`getSession()`). Client-supplied roles and IDs are never trusted.
