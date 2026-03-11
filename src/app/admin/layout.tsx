import Link from 'next/link';
import { LayoutDashboard, Database, MessageSquare, Settings, Workflow, FolderKanban } from 'lucide-react';
import LogoutButton from '@/components/auth/LogoutButton';
import { getSession } from '@/lib/auth';

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getSession();
    return (
        <div className="flex min-h-screen bg-slate-50 text-slate-900">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-200 bg-white/50 backdrop-blur-xl flex flex-col">
                <div className="flex h-16 items-center px-6 border-b border-slate-200">
                    <Link href="/admin" className="text-xl font-bold tracking-tighter text-blue-500">
                        ZIPPY <span className="text-slate-500 font-normal">ADMIN</span>
                    </Link>
                </div>
                <nav className="p-4 space-y-2">
                    <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 hover:text-slate-900"
                    >
                        <LayoutDashboard size={20} />
                        Dashboard
                    </Link>
                    <Link
                        href="/projects"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 hover:text-slate-900"
                    >
                        <FolderKanban size={20} />
                        Projects
                    </Link>
                    <Link
                        href="/admin/catalog"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 hover:text-slate-900"
                    >
                        <Settings size={20} />
                        Catalog Items
                    </Link>
                    <Link
                        href="/admin/rules"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 hover:text-slate-900"
                    >
                        <Workflow size={20} />
                        Calculator Rules
                    </Link>
                    <Link
                        href="/admin/taxonomy"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 hover:text-slate-900"
                    >
                        <Database size={20} />
                        Taxonomy
                    </Link>
                    <Link
                        href="/admin/prompts"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-700 hover:text-slate-900"
                    >
                        <MessageSquare size={20} />
                        AI Prompts
                    </Link>
                </nav>
                <div className="mt-auto p-4 border-t border-slate-200/50">
                    <LogoutButton />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-16 border-b border-slate-200 bg-white/50 backdrop-blur-xl flex items-center px-8 justify-between">
                    <h1 className="text-sm font-medium text-slate-600 uppercase tracking-widest">
                        Zippy Networks Operations Console
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end mr-2">
                            <span className="text-xs font-bold text-slate-900">{session?.name || session?.email}</span>
                            <span className="text-[10px] text-slate-500 uppercase">{session?.role}</span>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs uppercase text-white">
                            {(session?.name || session?.email || "U").substring(0, 2)}
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
