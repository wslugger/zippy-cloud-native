import Link from 'next/link';
import { LayoutDashboard, Database, MessageSquare, Settings, Workflow, FolderKanban, BarChart3 } from 'lucide-react';
import LogoutButton from '@/components/auth/LogoutButton';
import { getSession } from '@/lib/auth';
import { ZippyLogo } from '@/components/ZippyLogo';

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/projects', label: 'Projects', icon: FolderKanban },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/catalog', label: 'Catalog Items', icon: Settings },
    { href: '/admin/rules', label: 'Calculator Rules', icon: Workflow },
    { href: '/admin/taxonomy', label: 'Taxonomy', icon: Database },
    { href: '/admin/prompts', label: 'AI Prompts', icon: MessageSquare },
];

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    const initials = (session?.name || session?.email || "U").substring(0, 2).toUpperCase();

    return (
        <div className="flex min-h-screen bg-background text-foreground">
            {/* Navy sidebar */}
            <aside className="w-64 flex flex-col" style={{ backgroundColor: '#1B2A4A' }}>
                <div className="flex h-16 items-center px-5 border-b border-white/10">
                    <Link href="/admin">
                        <ZippyLogo size="sm" showText={true} variant="light" />
                    </Link>
                </div>
                <nav className="p-3 space-y-0.5 flex-1">
                    {navItems.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-white/60 hover:text-white hover:bg-white/8 relative"
                        >
                            {/* Active indicator — handled via server component; use CSS sibling or just style consistently */}
                            <Icon size={18} />
                            <span className="text-sm font-medium">{label}</span>
                        </Link>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/10">
                    <LogoutButton className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center px-8 justify-between">
                    <h1 className="text-sm font-medium text-slate-600 uppercase tracking-widest">
                        Zippy Networks — Operations Console
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-slate-900">{session?.name || session?.email}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{session?.role}</span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-zippy-green flex items-center justify-center font-bold text-xs uppercase text-white">
                            {initials}
                        </div>
                    </div>
                </header>
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
