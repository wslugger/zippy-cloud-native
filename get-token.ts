import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "zippy-super-secret-key-for-demo-purposes"
);

async function main() {
  const token = await new SignJWT({ userId: "admin-id", email: "admin@zippy.com", role: "ADMIN", name: "Admin User" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET);
  console.log(token);
}

main();
