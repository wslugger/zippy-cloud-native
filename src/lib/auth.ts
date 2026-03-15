import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const JWT_SECRET_MIN_LENGTH = 32;
export const SESSION_DURATION_MS = 2 * 60 * 60 * 1000;
export const SESSION_REFRESH_THRESHOLD_MS = SESSION_DURATION_MS / 2;

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

let cachedSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (!cachedSecret) {
    cachedSecret = loadJwtSecret();
  }
  return cachedSecret;
}

export const SESSION_COOKIE = "zippy_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "SA" | "ADMIN";
  name?: string;
  exp?: number;
  iat?: number;
}

export async function encrypt(payload: SessionPayload) {
  const secret = getJwtSecret();
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  const secret = getJwtSecret();
  try {
    const { payload } = await jwtVerify(input, secret, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;
  return await decrypt(session);
}

export function shouldRefreshSession(session: SessionPayload, nowMs = Date.now()): boolean {
  if (typeof session.exp !== "number" || !Number.isFinite(session.exp)) {
    return true;
  }
  const expiresAtMs = session.exp * 1000;
  return expiresAtMs - nowMs <= SESSION_REFRESH_THRESHOLD_MS;
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!session) return;

  const parsed = await decrypt(session);
  if (!parsed) return;
  if (!shouldRefreshSession(parsed)) return NextResponse.next();

  const res = NextResponse.next();
  res.cookies.set({
    name: SESSION_COOKIE,
    value: await encrypt(parsed),
    httpOnly: true,
    expires: new Date(Date.now() + SESSION_DURATION_MS),
  });
  return res;
}
