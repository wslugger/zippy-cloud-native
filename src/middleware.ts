import { NextRequest, NextResponse } from "next/server";
import {
  decrypt,
  encrypt,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  shouldRefreshSession,
  type SessionPayload,
} from "@/lib/auth";

// Public routes that don't require authentication
const publicRoutes = ["/login", "/api/auth/login", "/"];

async function applySessionRefresh(res: NextResponse, session: SessionPayload) {
  if (!shouldRefreshSession(session)) {
    return res;
  }
  res.cookies.set({
    name: SESSION_COOKIE,
    value: await encrypt(session),
    httpOnly: true,
    expires: new Date(Date.now() + SESSION_DURATION_MS),
  });
  return res;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);
  const isAdminApiRoute = path.startsWith("/api/admin/") && path !== "/api/admin/login";

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // Admin API routes: require ADMIN session, return JSON errors (no redirect)
  if (isAdminApiRoute) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return applySessionRefresh(NextResponse.next(), session);
  }

  // 1. Redirect to /login if there's no session and path is not public
  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 2. Redirect to dashboard if session exists and path is /login
  if (path === "/login" && session) {
    const redirectUrl = session.role === "ADMIN" ? "/admin" : "/projects";
    return NextResponse.redirect(new URL(redirectUrl, req.nextUrl));
  }

  // 3. Role-based access control for /admin pages
  if (path.startsWith("/admin") && session?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/projects", req.nextUrl));
  }

  if (!session) return NextResponse.next();
  return applySessionRefresh(NextResponse.next(), session);
}

export const config = {
  matcher: [
    // Cover all page routes and /api/admin/* API routes
    "/((?!_next/static|_next/image|favicon.ico|mockups/).*)",
  ],
};
