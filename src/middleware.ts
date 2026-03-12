import { NextRequest, NextResponse } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/auth";

// Public routes that don't require authentication
const publicRoutes = ["/login", "/api/auth/login", "/"];

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
    
    // Refresh cookie on API requests too
    const res = NextResponse.next();
    const { encrypt } = await import("@/lib/auth");
    res.cookies.set({
      name: SESSION_COOKIE,
      value: await encrypt(session),
      httpOnly: true,
      expires: new Date(Date.now() + 2 * 60 * 60 * 1000), // bump 2 hours
    });
    return res;
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

  const res = NextResponse.next();
  if (session) {
    const { encrypt } = await import("@/lib/auth");
    res.cookies.set({
      name: SESSION_COOKIE,
      value: await encrypt(session),
      httpOnly: true,
      expires: new Date(Date.now() + 2 * 60 * 60 * 1000), // bump 2 hours
    });
  }
  return res;
}

export const config = {
  matcher: [
    // Cover all page routes and /api/admin/* API routes
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
