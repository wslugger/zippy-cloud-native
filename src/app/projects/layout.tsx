import Link from 'next/link';
import { FolderKanban, Settings, ArrowLeft } from 'lucide-react';

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-50">
            <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-xl flex items-center px-6 gap-6">
                <Link href="/projects" className="flex items-center gap-2 text-sm font-bold text-white">
                    <FolderKanban size={18} className="text-blue-400" />
                    ZIPPY <span className="text-slate-500 font-normal">PROJECTS</span>
                </Link>
                <nav className="flex items-center gap-4 flex-1">
                    <Link href="/projects" className="text-xs text-slate-400 hover:text-white transition-colors">
                        All Projects
                    </Link>
                </nav>
                <Link
                    href="/admin"
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    <Settings size={14} />
                    Admin
                </Link>
            </header>
            <main className="p-8 max-w-7xl mx-auto">
                {children}
            </main>
        </div>
    );
}
