# ADR 0003: Single-Session Sentinel for Anti-Sniping Protection

## Status
Accepted

## Context
During high-stakes elective registration, students often attempt to game the system by logging in across multiple laptops, smartphones, and browser tabs simultaneously ("seat sniping") to hold multiple seats or submit conflicting preference combinations.

## Decision
We enforce a **Single-Session Sentinel** architecture:
1. Every successful authentication generates a cryptographically random `sessionId` stored both inside the signed JWT cookie and in the database column `users.current_session_id`.
2. On every request, `getSession()` verifies that the token's `sessionId` matches `users.current_session_id`.
3. If a student logs in from a second device, the database updates `current_session_id`, instantly revoking the previous session.
4. Any in-flight submission from the revoked session is rejected with an `UNAUTHORIZED` code.

## Consequences
### Positive
* **Prevents Multi-Tab / Multi-Device Sniping**: A student account can only hold one active session at a time.
* **Instant Revocation**: Compromised or unwanted sessions can be revoked immediately by signing in again or changing passwords.

### Trade-offs
* Requires a lightweight database check on session validation to confirm the `current_session_id` is still valid.
