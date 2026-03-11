import { NextRequest, NextResponse } from "next/server";
import { decrypt, SESSION_COOKIE } from "@/lib/auth";

// Public routes that don't require authentication
const publicRoutes = ["/login", "/api/auth/login", "/"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const session = cookie ? await decrypt(cookie) : null;

  // 1. Redirect to /login if there's no session and path is not public
  if (!isPublicRoute && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 2. Redirect to dashboard if session exists and path is /login
  if (path === "/login" && session) {
    const redirectUrl = session.role === "ADMIN" ? "/admin" : "/dashboard"; // We'll need a dashboard or similar
    return NextResponse.redirect(new URL(redirectUrl, req.nextUrl));
  }

  // 3. Role-based access control for /admin
  if (path.startsWith("/admin") && session?.role !== "ADMIN") {
    // If user is SA tried to access admin, send back to home or dashboard
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) -> we handle auth inside specific API routes if needed, 
     *   though some could be protected here too.
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
