'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

type ProjectRow = {
    id: string;
    name: string;
    customerName: string | null;
    status: string;
    workflowStage: string;
    createdAt: string;
    updatedAt: string;
    userId: string | null;
    user: { id: string; email: string; name: string | null } | null;
    _count: {
        requirementDocs: number;
        recommendations: number;
        recommendationRuns: number;
        items: number;
        events: number;
    };
};

type ResponsePayload = {
    projects: ProjectRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

const STAGES = ['', 'PROJECT_CREATED', 'REQUIREMENTS_CAPTURED', 'RECOMMENDATIONS_READY', 'SERVICE_SELECTED'];
const STATUSES = ['', 'DRAFT', 'IN_REVIEW', 'APPROVED', 'ORDERED', 'ARCHIVED'];

export default function AnalyticsProjectsPage() {
    const [projects, setProjects] = useState<ProjectRow[]>([]);
    const [search, setSearch] = useState('');
    const [stage, setStage] = useState('');
    const [status, setStatus] = useState('');
    const [docs, setDocs] = useState('');
    const [notes, setNotes] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setPage(1);
    }, [search, stage, status, docs, notes]);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/admin/analytics/projects', window.location.origin);
            if (search.trim()) url.searchParams.set('search', search.trim());
            if (stage) url.searchParams.set('stage', stage);
            if (status) url.searchParams.set('status', status);
            if (docs) url.searchParams.set('docs', docs);
            if (notes) url.searchParams.set('notes', notes);
            url.searchParams.set('page', String(page));
            url.searchParams.set('limit', '25');

            const res = await fetch(url.toString());
            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error || 'Failed to load projects');

            const data = payload as ResponsePayload;
            setProjects(data.projects);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load projects');
            setProjects([]);
            setTotal(0);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [docs, notes, page, search, stage, status]);

    useEffect(() => {
        void loadProjects();
    }, [loadProjects]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">All Projects</h2>
                    <p className="text-slate-600">Admin-level project search and funnel visibility across all users.</p>
                </div>
                <Link href="/admin/analytics">
                    <Button variant="outline">Back to Analytics</Button>
                </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search project, customer, user..."
                    className="md:col-span-3"
                />
                <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                    {STAGES.map((value) => (
                        <option key={value || 'all'} value={value}>
                            {value ? value.replaceAll('_', ' ') : 'All stages'}
                        </option>
                    ))}
                </select>
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                    {STATUSES.map((value) => (
                        <option key={value || 'all'} value={value}>
                            {value ? value.replaceAll('_', ' ') : 'All statuses'}
                        </option>
                    ))}
                </select>
                <select
                    value={docs}
                    onChange={(e) => setDocs(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                    <option value="">Docs: Any</option>
                    <option value="yes">Docs: Yes</option>
                    <option value="no">Docs: No</option>
                </select>
                <select
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                    <option value="">Notes: Any</option>
                    <option value="yes">Notes: Yes</option>
                    <option value="no">Notes: No</option>
                </select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm">
                    <span className="text-slate-600">{total} project(s)</span>
                    <Button variant="ghost" size="sm" onClick={() => void loadProjects()}>Refresh</Button>
                </div>
                {loading ? (
                    <div className="flex h-56 items-center justify-center">
                        <Loader2 className="h-7 w-7 animate-spin text-zippy-green" />
                    </div>
                ) : error ? (
                    <div className="px-4 py-8 text-sm text-red-600">{error}</div>
                ) : projects.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-slate-500">No projects match your filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="px-4 py-3">Project</th>
                                    <th className="px-4 py-3">Owner</th>
                                    <th className="px-4 py-3">Stage</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Docs</th>
                                    <th className="px-4 py-3">Rec Runs</th>
                                    <th className="px-4 py-3">Selected</th>
                                    <th className="px-4 py-3">Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map((project) => (
                                    <tr key={project.id} className="border-t border-slate-100">
                                        <td className="px-4 py-3">
                                            <Link href={`/admin/analytics/projects/${project.id}`} className="font-medium text-blue-600 hover:underline">
                                                {project.name}
                                            </Link>
                                            <p className="text-xs text-slate-500">{project.customerName || 'No customer'}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p>{project.user?.name || project.user?.email || 'Unknown'}</p>
                                            <p className="text-xs text-slate-500">{project.user?.email || 'No email'}</p>
                                        </td>
                                        <td className="px-4 py-3">{project.workflowStage.replaceAll('_', ' ')}</td>
                                        <td className="px-4 py-3">{project.status.replaceAll('_', ' ')}</td>
                                        <td className="px-4 py-3">{project._count.requirementDocs}</td>
                                        <td className="px-4 py-3">{project._count.recommendationRuns}</td>
                                        <td className="px-4 py-3">{project._count.items}</td>
                                        <td className="px-4 py-3">{new Date(project.updatedAt).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Previous
                    </Button>
                    <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
