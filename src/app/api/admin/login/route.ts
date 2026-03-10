import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { passphrase } = await request.json();
        const adminPassphrase = process.env.ADMIN_PASSPHRASE;

        if (!adminPassphrase || passphrase !== adminPassphrase) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Set a long-lived HTTP-only cookie
        // In production, use secure: true and sameSite: 'strict'
        const response = NextResponse.json({ success: true });

        // Using native cookies API for Next.js 13+
        (await cookies()).set('admin_token', adminPassphrase, {
            httpOnly: true,
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });

        return response;
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
