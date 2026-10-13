# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Electify and student/academic data very seriously.

If you believe you have discovered a vulnerability in Electify, please **do not open a public issue**. Instead, follow these steps:

1. **Email the Security Team**: Send a detailed report to security@electify.srmist.edu.in (or contact the repository administrator).
2. **Provide Details**:
   - Step-by-step reproduction instructions or proof-of-concept.
   - Component affected (e.g., authentication, registration transactions, role authorization, API route).
   - Potential impact on student records, course allocation, or user sessions.
3. **Response Timeline**:
   - Acknowledgement within 48 hours.
   - Status update within 5 business days with estimated remediation timeline.
   - Coordinated disclosure after a fix has been verified and deployed.

## Core Security Architectures in Electify

### 1. Authentication & Session Security
- **Signed Session Cookies**: All authentication cookies (`electify_session`) are cryptographically signed using HS256 JWT tokens.
- **Strict Key Requirements**: In production (`NODE_ENV === "production"`), a secure random `JWT_SECRET` of at least 32 characters is strictly mandated. Default fallbacks are rejected.
- **Single-Active-Session Enforcement**: Users are tracked by a session token ID in the database; logging in from a new device revokes previous active sessions.
- **Temporary Password Upgrade Tickets**: Password reset and upgrade tickets are short-lived (10-15 minutes), signed with a derived secret bound to the user's password fingerprint, preventing token reuse after credentials change.
- **Password Hashing**: All passwords and initial register-number credentials are salt-hashed using `bcryptjs` with cost factor 12.

### 2. Role-Based Access Control (RBAC)
- Role enforcement occurs server-side at multiple layers:
  - **Proxy/Middleware layer (`src/proxy.ts`)**: Redirects unauthorized traffic away from protected routes.
  - **Server Action layer (`src/app/actions/*`)**: Verifies `session.role` and specific resource ownership (e.g., verifying Class Tutors only access students within their assigned sections via `tutor_sections`).
- Hierarchical Roles:
  - `STUDENT`: Read eligible events, view real-time elective counts, submit choices, download PDF receipt. Cannot access other students' records or modify locked choices.
  - `CLASS_TUTOR`: Scoped to assigned cohort sections (`tutor_sections`). Can import/manage students, unlock choices, view registration status.
  - `COURSE_COORDINATOR`: Scoped to department/academic batches. Manages registration events, subject profiles, elective pools, seat caps.
  - `SYSTEM_ADMIN`: University-wide management. Manages academic year servers, faculties, staff invite codes, and system maintenance mode.

### 3. Concurrency & Allocation Integrity
- **Transactional Seat Allocation**: Elective seat booking executes within a Postgres transaction (`SERIALIZABLE` or atomic decrement with constraint checks) to prevent race conditions and overbooking.
- **Zero-Waitlist Architecture**: Once an elective reaches capacity (`availableSeats <= 0`), the transaction rolls back cleanly, ensuring no phantom reservations.

### 4. Admin Bootstrapping Protection
- In production, unauthenticated admin provisioning via `/api/health?setup=true` is strictly blocked unless verified with a matching `SETUP_SECRET` header or query parameter.

### 5. Brute Force Protection
- The `login_attempts` table tracks failed authentication attempts by identifier and IP to throttle repeated credential guessing.
