# Electify Code Standards & Best Practices

This document outlines the coding standards, patterns, and conventions expected across the Electify repository.

---

## 1. TypeScript & Type Safety

* **No `any`**: Avoid `any`. Use strongly typed interfaces from `@/types` or `unknown` when handling untyped external inputs that must be verified.
* **Domain Types**: Place shared domain contracts in `src/types/` (e.g. `session.ts`, `registration.ts`, `academic.ts`, `api.ts`).
* **Explicit Return Types**: All exported server actions, public API route handlers, and utility functions should have explicit return types.
* **Strict Null Checks**: Do not use non-null assertions (`!`) unless an explicit precondition or assert immediately precedes the expression.

---

## 2. Server Actions & Business Logic

* **Server-Side Authorization**: Every mutating action must call `getSession()` and enforce role-based access before performing database operations:
  ```typescript
  const session = await getSession();
  if (!session || session.role !== "SYSTEM_ADMIN") {
    throw new Error("Unauthorized");
  }
  ```
* **Scope Verification**: Staff operations must resolve the active academic workspace using `requireStaffWorkspace()` or `assertEventInWorkspace()`.
* **Atomic Transactions**: Multi-step state changes (such as taking seats, saving choices, and generating audit receipts) must run inside `db.transaction(async (tx) => { ... })`.
* **No Client Trust**: Never trust client-provided student IDs, registration numbers, or roles. Always extract identity from the validated server session.

---

## 3. Database & SQL Operations

* **Row-Level Locking**: When modifying shared counters (such as elective seats), always acquire row locks via `.for("update")` in primary key order to eliminate race conditions and avoid deadlocks.
* **Non-Negative Constraints**: Always check `available_seats > 0` at the database level when decrementing.
* **Safe Revalidation**: Use `src/lib/cache.ts` utilities (`safeRevalidatePaths`, `revalidateHierarchyCache`) rather than unmanaged dynamic imports.

---

## 4. React & UI Components

* **Client vs. Server Boundaries**:
  * Default to React Server Components (RSC) for data-fetching pages.
  * Add `"use client"` only when interactive state (`useState`, `useEffect`), browser events, or client-side libraries (such as framer-motion or sonner) are required.
* **Component Splitting**: Keep components focused on a single responsibility. Extract reusable UI elements into `src/components/ui/` or domain folders (`src/components/subjects/`, `src/components/auth/`).
* **Accessibility (a11y)**:
  * Ensure every button and interactive element has an accessible name (`aria-label` or visible text).
  * Check WCAG 2.2 AA contrast ratios for all custom color tokens.

---

## 5. Error Handling & Security

* **Centralized Password Policy**: Always enforce password rules via `@/lib/password-policy` (`passwordProblem`, `isAcceptablePassword`).
* **Safe Error Messages**: Avoid leaking sensitive database internals or SQL error messages to client responses. Return clean, user-friendly messages with machine-readable error codes (`RegisterErrorCode`).
* **Audit Trails**: Sensitive administrative actions (deletions, resets, status changes) must write an entry to `audit_logs`.
