import Link from 'next/link';
import { LayoutDashboard, Database, MessageSquare, Settings, LogOut, Workflow, FolderKanban } from 'lucide-react';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-slate-950 text-slate-50">
            {/* Sidebar */}
            <aside className="w-64 border-r border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                <div className="flex h-16 items-center px-6 border-b border-slate-800">
                    <Link href="/admin" className="text-xl font-bold tracking-tighter text-blue-500">
                        ZIPPY <span className="text-slate-500 font-normal">ADMIN</span>
                    </Link>
                </div>
                <nav className="p-4 space-y-2">
                    <Link
                        href="/admin"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
                    >
                        <LayoutDashboard size={20} />
                        Dashboard
                    </Link>
                    <Link
                        href="/projects"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
                    >
                        <FolderKanban size={20} />
                        Projects
                    </Link>
                    <Link
                        href="/admin/catalog"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
                    >
                        <Settings size={20} />
                        Catalog Items
                    </Link>
                    <Link
                        href="/admin/rules"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
                    >
                        <Workflow size={20} />
                        Calculator Rules
                    </Link>
                    <Link
                        href="/admin/taxonomy"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
                    >
                        <Database size={20} />
                        Taxonomy
                    </Link>
                    <Link
                        href="/admin/prompts"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
                    >
                        <MessageSquare size={20} />
                        AI Prompts
                    </Link>
                </nav>
                <div className="absolute bottom-4 w-64 px-4">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300"
                    >
                        <LogOut size={20} />
                        Return to App
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl flex items-center px-8 justify-between">
                    <h1 className="text-sm font-medium text-slate-400 uppercase tracking-widest">
                        Zippy Networks Operations Console
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-xs">
                            AD
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
