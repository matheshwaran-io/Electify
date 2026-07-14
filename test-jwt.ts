import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode("fallback-secret-key-at-least-32-chars-long-for-jwt-signing");

async function run() {
  const payload = { userId: "123", role: "CLASS_TUTOR", iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) };
  
  try {
    const token = await new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(SECRET);
    console.log("Token signed successfully!");
    console.log("Token:", token);
    
    const verified = await jwtVerify(token, SECRET);
    console.log("Verified:", verified.payload);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
