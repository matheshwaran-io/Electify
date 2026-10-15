# ADR 0004: Next.js 16 Proxy Convention for Network Boundary

## Status
Accepted

## Context
In Next.js 16, the traditional `middleware.ts` convention was officially deprecated in favor of `proxy.ts`. The renamed convention emphasizes its role as a network boundary rather than an application-level chain of Express-style middlewares, clarifying responsibility for request filtering, JWT inspection, and header manipulation.

## Decision
We adopt the native Next.js 16 `src/proxy.ts` convention:
1. `src/proxy.ts` intercepts incoming requests at the network edge before hitting server components.
2. It verifies the presence and signature of the `electify_session` JWT cookie.
3. It performs fast boundary redirects: unauthenticated users accessing `/dashboard` or `/faculty` are redirected to `/login`, while authenticated users are directed to their role-appropriate portal.
4. It sets the `x-electify-pathname` header to allow server layouts to determine the active navigation route without client hooks.

## Consequences
### Positive
* **Framework Alignment**: Follows modern Next.js 16 standards without deprecated APIs.
* **Fast Edge Rejection**: Unauthenticated requests are redirected before executing server actions or database queries.

### Trade-offs
* Requires Next.js 16 runtime compatibility.
