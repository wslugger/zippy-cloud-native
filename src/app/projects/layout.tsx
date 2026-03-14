import Link from 'next/link';
import { Settings } from 'lucide-react';
import LogoutButton from '@/components/auth/LogoutButton';
import { getSession } from '@/lib/auth';
import { ZippyLogo } from '@/components/ZippyLogo';

export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession();
    const initials = (session?.name || session?.email || "U").substring(0, 2).toUpperCase();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="h-14 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center px-6 gap-6">
                <Link href="/projects" className="flex items-center">
                    <ZippyLogo size="sm" showText={true} variant="dark" />
                </Link>
                <nav className="flex items-center gap-4 flex-1">
                    <Link
                        href="/projects"
                        className="text-xs font-medium text-slate-600 hover:text-zippy-navy transition-colors pb-0.5 border-b-2 border-zippy-green"
                    >
                        All Projects
                    </Link>
                </nav>
                <div className="flex items-center gap-4">
                    {session?.role === 'ADMIN' && (
                        <Link
                            href="/admin"
                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900 transition-colors mr-2"
                        >
                            <Settings size={14} />
                            Admin
                        </Link>
                    )}
                    <div className="flex flex-col items-end mr-2">
                        <span className="text-xs font-bold text-slate-900">{session?.name || session?.email}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{session?.role}</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-zippy-green flex items-center justify-center font-bold text-xs uppercase text-white">
                        {initials}
                    </div>
                    <div className="w-px h-6 bg-slate-100"></div>
                    <LogoutButton
                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
                        iconSize={16}
                        showText={false}
                    />
                </div>
            </header>
            <main className="p-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}
