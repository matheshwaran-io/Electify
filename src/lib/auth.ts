import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-key-at-least-32-chars-long-for-jwt-signing"
);

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: "STUDENT" | "FACULTY" | "SUPER_ADMIN";
  registerNumber?: string; // only for students
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
 */
export async function getSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("electify_session")?.value;
  if (!token) return null;
  return await verifyJWT(token);
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
}
