import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-key-at-least-32-chars-long-for-jwt-signing"
);

import type { UserSession } from "@/types";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read the session cookie
  const token = request.cookies.get("electify_session")?.value;
  let session: UserSession | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      session = payload as unknown as UserSession;
    } catch {
      session = null;
    }
  }

  // Handle Root Path /
  if (pathname === "/") {
    if (session) {
      if (session.role === "STUDENT") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
      }
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Guard Student Dashboard routes (/dashboard/*)
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.role !== "STUDENT") {
      return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
    }
  }

  // Guard Faculty Dashboard routes (/faculty/*)
  if (pathname.startsWith("/faculty")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (session.role === "STUDENT") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // System Admin specific route guarding
    if (pathname.startsWith("/faculty/audit")) {
      if (session.role !== "SYSTEM_ADMIN") {
        return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
      }
    }
  }

  // A page found this session revoked (signed in elsewhere or deactivated) but
  // could not clear cookies during rendering: clear them here and show sign-in,
  // instead of bouncing back to the dashboard on the still-valid signature.
  if (pathname === "/login" && request.nextUrl.searchParams.get("expired") === "1") {
    const response = NextResponse.next();
    for (const name of ["electify_session", "electify_active_section", "electify_active_workspace", "electify_academic_session"]) {
      response.cookies.delete(name);
    }
    return response;
  }

  // Guard Login page (/login)
  if (pathname === "/login") {
    if (session) {
      if (session.role === "STUDENT") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
      }
    }
  }

  // Tell server layouts which page is being rendered (used by the faculty
  // layout to require an academic session on session-specific pages).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-electify-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

export { proxy as middleware };

