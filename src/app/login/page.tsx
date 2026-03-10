'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldAlert, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
    const [passphrase, setPassphrase] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // In a real app, we'd hit an API to verify.
            // For this stateless POC, we set a cookie directly via a simple route handler or browser JS.
            // To be safe, let's use a server action or API route.
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passphrase }),
            });

            if (res.ok) {
                router.push('/admin');
                router.refresh();
            } else {
                setError('Invalid passphrase. Please try again.');
                setPassphrase('');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-white">
            <div className="w-full max-w-md space-y-8 rounded-3xl border border-white/10 bg-zinc-900/50 p-8 shadow-2xl backdrop-blur-xl transition-all hover:border-white/20">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="rounded-full bg-blue-500/10 p-3 text-blue-400">
                        <ShieldAlert size={32} />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Admin Portal</h1>
                    <p className="text-zinc-400">Enter the secret passphrase to access management tools.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                            Passphrase
                        </label>
                        <Input
                            type="password"
                            placeholder="••••••••••••"
                            value={passphrase}
                            onChange={(e) => setPassphrase(e.target.value)}
                            className="bg-zinc-950 text-center text-lg tracking-widest transition-all focus:ring-blue-500/50"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <p className="animate-pulse text-sm font-medium text-red-400 text-center">
                            {error}
                        </p>
                    )}

                    <Button
                        type="submit"
                        className="w-full h-12 gap-2"
                        disabled={!passphrase || loading}
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (
                            <>
                                Continue to Dashboard
                                <ArrowRight size={18} />
                            </>
                        )}
                    </Button>
                </form>

                <p className="text-center text-xs text-zinc-600">
                    Stateless session. Securely encrypted.
                </p>
            </div>
        </div>
    );
}
