'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    FolderKanban, Plus, Building2, DollarSign,
    Loader2, ChevronRight, CheckCircle2
} from 'lucide-react';

interface Project {
    id: string;
    name: string;
    customerName: string | null;
    status: string;
    termMonths: number;
    createdAt: string;
    sites: Array<{
        id: string;
        name: string;
        siteSelections: Array<{
            catalogItem: { pricing: Array<{ priceMrc: number }> };
        }>;
    }>;
}

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'bg-slate-100 border-slate-300 text-slate-600',
    IN_REVIEW: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
    APPROVED: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
    ORDERED: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    ARCHIVED: 'bg-slate-900 border-slate-200 text-slate-50',
};

export default function ProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState('');
    const [customerName, setCustomerName] = useState('');

    useEffect(() => { fetchProjects(); }, []);

    async function fetchProjects() {
        const res = await fetch('/api/projects');
        const data = await res.json();
        setProjects(data);
        setLoading(false);
    }

    async function createProject(e: React.FormEvent) {
        e.preventDefault();
        if (!name) return;
        const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, customerName }),
        });
        if (res.ok) {
            setShowCreate(false);
            setName('');
            setCustomerName('');
            fetchProjects();
        }
    }

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Projects</h1>
                    <p className="text-slate-600">Multi-site solution quotes for your customers.</p>
                </div>
                <Button onClick={() => setShowCreate(true)} className="gap-2">
                    <Plus size={18} /> New Project
                </Button>
            </div>

            {showCreate && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-lg">
                    <h3 className="font-bold text-lg mb-4">Create Project</h3>
                    <form onSubmit={createProject} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Project Name</label>
                            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp SD-WAN Rollout" className="bg-slate-50" required />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer Name</label>
                            <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Acme Corporation" className="bg-slate-50" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="submit" disabled={!name}>Create Project</Button>
                            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                        </div>
                    </form>
                </div>
            )}

            {projects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map(project => {
                        const siteCount = project.sites.length;
                        return (
                            <Link
                                key={project.id}
                                href={`/projects/${project.id}`}
                                className="group bg-white/50 border border-slate-200 rounded-2xl p-5 hover:border-blue-500/30 transition-all relative overflow-hidden"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`text-[9px] font-bold px-2 py-0.5 rounded border ${STATUS_COLORS[project.status] ?? STATUS_COLORS.DRAFT}`}>
                                        {project.status}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-400 transition-colors">{project.name}</h3>
                                    {project.customerName && (
                                        <p className="text-xs text-slate-500">{project.customerName}</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <Building2 size={12} />
                                        {siteCount} {siteCount === 1 ? 'site' : 'sites'}
                                    </div>
                                </div>

                                <ChevronRight size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-700 group-hover:text-blue-500 transition-colors" />
                                <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-600/5 rounded-full blur-2xl group-hover:bg-blue-600/10 transition-all pointer-events-none" />
                            </Link>
                        );
                    })}
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-200 rounded-3xl gap-4">
                    <FolderKanban size={48} className="opacity-20" />
                    <p>No projects yet. Create one to get started.</p>
                </div>
            )}
        </div>
    );
}
