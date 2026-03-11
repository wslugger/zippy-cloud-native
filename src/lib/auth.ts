import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "zippy-super-secret-key-for-demo-purposes"
);

export const SESSION_COOKIE = "zippy_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "SA" | "ADMIN";
  name?: string;
}

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(SECRET);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, SECRET, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (e) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return;

  // Refresh the session so it doesn't expire
  const parsed = await decrypt(session);
  if (!parsed) return;

  const res = NextResponse.next();
  res.cookies.set({
    name: SESSION_COOKIE,
    value: await encrypt(parsed),
    httpOnly: true,
    expires: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
  });
  return res;
}
