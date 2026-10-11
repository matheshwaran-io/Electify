import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { cleanDisplayName } from "@/lib/format";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-key-at-least-32-chars-long-for-jwt-signing"
);

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "SYSTEM_ADMIN" | "COURSE_COORDINATOR" | "CLASS_TUTOR" | "STUDENT";
  sessionId?: string;
  employeeId?: string;
  registerNumber?: string;
  facultyId?: string;
  departmentId?: string;
  programmeId?: string;
  academicBatchId?: string;
  sectionId?: string;
}

/**
 * Signs a JWT with the user details. Valid for 2 hours.
 */
export async function signJWT(payload: UserSession): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET);
}

/**
 * Verifies a JWT token. Returns the payload or null if invalid.
 */
export async function verifyJWT(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

/**
 * Gets the current session from cookies.
 * Enforces single active session per login:
 * If the user has logged in from another device or window, previous sessions are revoked.
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("electify_session")?.value;
  if (!token) return null;
  const session = await verifyJWT(token);
  if (!session) return null;

  // Enforce single session per login:
  // If the token contains a sessionId, verify that it matches the user's currentSessionId in DB
  if (session.sessionId) {
    try {
      const [userRecord] = await db
        .select({ currentSessionId: users.currentSessionId, isActive: users.isActive, name: users.name })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!userRecord || !userRecord.isActive || (userRecord.currentSessionId && userRecord.currentSessionId !== session.sessionId)) {
        // Superseded by another login or deactivated! Delete cookies and invalidate session
        cookieStore.delete("electify_session");
        cookieStore.delete("electify_active_section");
        cookieStore.delete("electify_active_workspace");
        return null;
      }

      if (userRecord.name) {
        session.name = cleanDisplayName(userRecord.name);
      }
    } catch (err) {
      console.error("Session single-login verification error:", err);
    }
  }

  session.name = cleanDisplayName(session.name);

  // Override sectionId if there's an active section cookie
  if (session.role === "CLASS_TUTOR" || session.role === "COURSE_COORDINATOR") {
    const activeSectionId = cookieStore.get("electify_active_section")?.value;
    if (activeSectionId) {
      session.sectionId = activeSectionId;
    }
  }

  return session;
}

/**
 * Sets the session cookie.
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("electify_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 2 * 60 * 60, // 2 hours in seconds
  });
}

/**
 * Removes the session cookie.
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("electify_session");
  cookieStore.delete("electify_active_section");
  cookieStore.delete("electify_active_workspace");
}
