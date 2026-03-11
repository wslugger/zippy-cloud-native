import { NextResponse } from 'next/server';
import { encrypt, SESSION_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
    try {
        const { passphrase } = await request.json();
        const adminPassphrase = process.env.ADMIN_PASSPHRASE;

        if (!adminPassphrase || passphrase !== adminPassphrase) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Issue a signed JWT session for the admin (same mechanism as regular users)
        const token = await encrypt({ userId: 'admin', email: 'admin', role: 'ADMIN' });

        (await cookies()).set(SESSION_COOKIE, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
