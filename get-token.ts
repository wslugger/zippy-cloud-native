import { SignJWT } from "jose";

const JWT_SECRET_MIN_LENGTH = 32;

function loadJwtSecret(): Uint8Array {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  if (jwtSecret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`);
  }
  return new TextEncoder().encode(jwtSecret);
}

const SECRET = loadJwtSecret();

async function main() {
  const token = await new SignJWT({ userId: "admin-id", email: "admin@zippy.com", role: "ADMIN", name: "Admin User" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET);
  console.log(token);
}

main();
