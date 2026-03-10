import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // Only protect /admin routes
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const adminPassphrase = process.env.ADMIN_PASSPHRASE;

        // If no passphrase is set in ENV, we lean on the side of caution and block
        if (!adminPassphrase) {
            return new NextResponse('Admin access not configured', { status: 401 });
        }

        const authCookie = request.cookies.get('admin_token');

        // Simple stateless check: basic token comparison
        // In a production app, this would be a JWT verified against a secret
        if (authCookie?.value !== adminPassphrase) {
            // Redirect to a login page or return unauthorized
            // For now, let's allow the user to set the cookie via a simple prompt or just check the URL for a setup phase
            const url = request.nextUrl.clone();
            url.pathname = '/login'; // We'll need to build a simple login page
            return NextResponse.redirect(url);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: '/admin/:path*',
};
