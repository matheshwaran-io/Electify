import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode("fallback-secret-key-at-least-32-chars-long-for-jwt-signing");

async function run() {
  const session = { userId: "123", role: "CLASS_TUTOR", sectionId: "C_ID", iat: 12345, exp: 67890 };
  const { iat, exp, ...sessionData } = session as any;
  
  const token = await new SignJWT({
    ...sessionData,
    sectionId: "F_ID",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET);
    
  const verified = await jwtVerify(token, SECRET);
  console.log("Verified:", verified.payload);
}
run();
