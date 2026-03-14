'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

type ProjectDetail = {
    id: string;
    name: string;
    customerName: string | null;
    status: string;
    workflowStage: string;
    termMonths: number;
    rawRequirements: string | null;
    manualNotes: string | null;
    createdAt: string;
    updatedAt: string;
    user: { id: string; email: string; name: string | null } | null;
    requirementDocs: Array<{
        id: string;
        fileName: string;
        mimeType: string;
        status: string;
        createdAt: string;
        extractedText: string | null;
    }>;
    items: Array<{
        id: string;
        catalogItemId: string;
        quantity: number;
        createdAt: string;
        catalogItem: {
            id: string;
            sku: string;
            name: string;
            type: string;
            collaterals: Array<{ id: string; title: string; type: string; documentUrl: string }>;
        };
    }>;
    recommendations: Array<{
        id: string;
        catalogItemId: string;
        state: string;
        score: string | number;
        reason: string;
        sourceModel: string;
        createdAt: string;
        catalogItem: { id: string; sku: string; name: string; type: string };
    }>;
    recommendationRuns: Array<{
        id: string;
        sourceModel: string;
        recommendationCount: number;
        createdAt: string;
        user: { id: string; email: string; name: string | null } | null;
        items: Array<{
            id: string;
            rank: number;
            catalogItemId: string;
            score: string | number;
            certaintyPercent: number;
            reason: string;
            shortReason: string | null;
            matchedCharacteristics: string[];
            coverageAreas: string[];
            riskFactors: string[];
            catalogItem: { id: string; sku: string; name: string; type: string };
        }>;
    }>;
    events: Array<{
        id: string;
        eventType: string;
        workflowStage: string | null;
        catalogItemId: string | null;
        collateralId: string | null;
        metadata: unknown;
        createdAt: string;
        user: { id: string; email: string; name: string | null } | null;
        catalogItem: { id: string; sku: string; name: string; type: string } | null;
    }>;
};

export default function AdminProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadProject = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/analytics/projects/${id}`);
            const payload = await res.json();
            if (!res.ok) throw new Error(payload?.error || 'Failed to load project analytics detail');
            setProject(payload as ProjectDetail);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load project analytics detail');
            setProject(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void loadProject();
    }, [loadProject]);

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="space-y-3">
                <p className="text-sm text-red-600">{error || 'Project not found'}</p>
                <Button onClick={() => void loadProject()}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/admin/analytics/projects" className="text-xs text-slate-500 hover:text-slate-900">
                        Back to all projects
                    </Link>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">{project.name}</h2>
                    <p className="text-slate-600">{project.customerName || 'No customer name'} • {project.user?.email || 'No owner email'}</p>
                </div>
                <Button variant="outline" onClick={() => void loadProject()}>Refresh</Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Workflow Stage</p><p className="mt-2 font-semibold">{project.workflowStage.replaceAll('_', ' ')}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Business Status</p><p className="mt-2 font-semibold">{project.status.replaceAll('_', ' ')}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Requirement Docs</p><p className="mt-2 font-semibold">{project.requirementDocs.length}</p></div>
                <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">Selected Services</p><p className="mt-2 font-semibold">{project.items.length}</p></div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Requirement Inputs</h3>
                    <div className="mt-4 space-y-4">
                        <div>
                            <p className="text-xs font-semibold text-slate-500">Manual Notes</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{project.manualNotes || 'No manual notes'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-slate-500">Uploaded Documents</p>
                            <div className="mt-2 space-y-2">
                                {project.requirementDocs.length > 0 ? project.requirementDocs.map((doc) => (
                                    <div key={doc.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                                        <p className="font-medium text-slate-800">{doc.fileName}</p>
                                        <p className="text-slate-500">{doc.mimeType} • {doc.status}</p>
                                        <p className="text-slate-500">{new Date(doc.createdAt).toLocaleString()}</p>
                                    </div>
                                )) : <p className="text-sm text-slate-500">No documents uploaded.</p>}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Selections</h3>
                    <div className="mt-4 space-y-2">
                        {project.items.length > 0 ? project.items.map((item) => (
                            <div key={item.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                                <p className="font-medium text-slate-800">{item.catalogItem.name}</p>
                                <p className="text-slate-500">{item.catalogItem.sku} • {item.catalogItem.type} • Qty {item.quantity}</p>
                                <p className="text-slate-500">{item.catalogItem.collaterals.length} collateral file(s)</p>
                            </div>
                        )) : <p className="text-sm text-slate-500">No services selected.</p>}
                    </div>
                </section>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Recommendation Runs</h3>
                <div className="mt-4 space-y-4">
                    {project.recommendationRuns.length > 0 ? project.recommendationRuns.map((run) => (
                        <div key={run.id} className="rounded-lg border border-slate-200 p-4">
                            <p className="text-xs text-slate-500">
                                {new Date(run.createdAt).toLocaleString()} • {run.sourceModel} • {run.recommendationCount} recommendations
                            </p>
                            <div className="mt-2 space-y-1">
                                {run.items.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                                        <span>{item.rank}. {item.catalogItem.name} ({item.catalogItem.sku})</span>
                                        <span className="font-semibold">{item.certaintyPercent}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )) : <p className="text-sm text-slate-500">No recommendation runs yet.</p>}
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Recent Event Timeline</h3>
                <div className="mt-4 space-y-2">
                    {project.events.length > 0 ? project.events.map((event) => (
                        <div key={event.id} className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                            <p className="font-medium text-slate-800">{event.eventType.replaceAll('_', ' ')}</p>
                            <p className="text-slate-500">
                                {new Date(event.createdAt).toLocaleString()} • {event.user?.email || 'Unknown user'}
                                {event.catalogItem ? ` • ${event.catalogItem.name} (${event.catalogItem.sku})` : ''}
                            </p>
                        </div>
                    )) : <p className="text-sm text-slate-500">No events recorded yet.</p>}
                </div>
            </section>
        </div>
    );
}
