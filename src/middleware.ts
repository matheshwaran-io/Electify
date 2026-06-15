import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-key-at-least-32-chars-long-for-jwt-signing"
);

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "STUDENT" | "FACULTY" | "SUPER_ADMIN";
  registerNumber?: string;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Read the session cookie
  const token = request.cookies.get("electify_session")?.value;
  let session: UserSession | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      session = payload as unknown as UserSession;
    } catch {
      // Token is invalid/expired
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
    // Exclude the login page itself to avoid infinite loops
    if (pathname === "/faculty/login") {
      if (session && (session.role === "FACULTY" || session.role === "SUPER_ADMIN")) {
        return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
      }
      return NextResponse.next();
    }

    if (!session) {
      return NextResponse.redirect(new URL("/faculty/login", request.url));
    }

    if (session.role !== "FACULTY" && session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Super Admin specific route guarding
    if (pathname.startsWith("/faculty/settings")) {
      if (session.role !== "SUPER_ADMIN") {
        // Redirect non-superadmins back to dashboard
        return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
      }
    }
  }

  // Guard Student Login page (/login)
  if (pathname === "/login") {
    if (session) {
      if (session.role === "STUDENT") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } else {
        return NextResponse.redirect(new URL("/faculty/dashboard", request.url));
      }
    }
  }

  return NextResponse.next();
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
