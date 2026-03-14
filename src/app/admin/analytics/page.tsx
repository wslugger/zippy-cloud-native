'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2, BarChart3, FolderSearch } from 'lucide-react';

type OverviewResponse = {
    summary: {
        totalProjects: number;
        usersReachedRecommendations: number;
        usersSelectedService: number;
        usersUploadedDocs: number;
        usersEnteredNotes: number;
        usersUsedBothDocsAndNotes: number;
        totalCollateralClicks: number;
    };
    projectsByStage: Array<{ stage: string; count: number }>;
    projectsByStatus: Array<{ status: string; count: number }>;
    requirementsInputMix: {
        docsOnly: number;
        notesOnly: number;
        both: number;
        neither: number;
    };
    topRecommended: Array<{
        catalogItemId: string;
        count: number;
        item: { id: string; sku: string; name: string; type: string } | null;
    }>;
    topPicked: Array<{
        catalogItemId: string | null;
        count: number;
        item: { id: string; sku: string; name: string; type: string } | null;
    }>;
    topCollateral: Array<{
        collateralId: string | null;
        count: number;
        collateral: {
            id: string;
            title: string;
            type: string;
            catalogItem: { id: string; name: string; sku: string };
        } | null;
    }>;
};

export default function AnalyticsOverviewPage() {
    const [data, setData] = useState<OverviewResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const loadOverview = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = new URL('/api/admin/analytics/overview', window.location.origin);
            if (startDate) url.searchParams.set('start', startDate);
            if (endDate) url.searchParams.set('end', endDate);
            const res = await fetch(url.toString());
            const payload = await res.json();
            if (!res.ok) {
                throw new Error(payload?.error || 'Failed to load analytics overview');
            }
            setData(payload as OverviewResponse);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load analytics overview');
        } finally {
            setLoading(false);
        }
    }, [endDate, startDate]);

    useEffect(() => {
        void loadOverview();
    }, [loadOverview]);

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zippy-green" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-4">
                <p className="text-sm text-red-600">{error || 'Failed to load analytics data'}</p>
                <Button onClick={() => void loadOverview()}>Retry</Button>
            </div>
        );
    }

    const summaryCards = [
        { label: 'Total Projects', value: data.summary.totalProjects },
        { label: 'Users Reached Recommendation', value: data.summary.usersReachedRecommendations },
        { label: 'Users Selected Service', value: data.summary.usersSelectedService },
        { label: 'Users Uploaded Docs', value: data.summary.usersUploadedDocs },
        { label: 'Users Entered Notes', value: data.summary.usersEnteredNotes },
        { label: 'Users With Docs + Notes', value: data.summary.usersUsedBothDocsAndNotes },
        { label: 'Collateral Clicks', value: data.summary.totalCollateralClicks },
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <BarChart3 className="h-7 w-7 text-zippy-green" />
                        Project Analytics
                    </h2>
                    <p className="text-slate-600">Requirements and service-picking funnel metrics across all users.</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm"
                    />
                    <Link href="/admin/analytics/projects">
                        <Button variant="outline" className="gap-2">
                            <FolderSearch size={16} />
                            Browse Projects
                        </Button>
                    </Link>
                    {(startDate || endDate) && (
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setStartDate('');
                                setEndDate('');
                            }}
                        >
                            Clear Dates
                        </Button>
                    )}
                    <Button onClick={() => void loadOverview()} variant="secondary">Refresh</Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.label}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Projects By Stage</h3>
                    <div className="mt-4 space-y-2">
                        {data.projectsByStage.map((row) => (
                            <div key={row.stage} className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-700">{row.stage.replaceAll('_', ' ')}</span>
                                <span className="font-semibold text-slate-900">{row.count}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Projects By Status</h3>
                    <div className="mt-4 space-y-2">
                        {data.projectsByStatus.map((row) => (
                            <div key={row.status} className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-700">{row.status.replaceAll('_', ' ')}</span>
                                <span className="font-semibold text-slate-900">{row.count}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Input Mix</h3>
                    <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span>Docs only</span><span className="font-semibold">{data.requirementsInputMix.docsOnly}</span></div>
                        <div className="flex justify-between"><span>Notes only</span><span className="font-semibold">{data.requirementsInputMix.notesOnly}</span></div>
                        <div className="flex justify-between"><span>Both</span><span className="font-semibold">{data.requirementsInputMix.both}</span></div>
                        <div className="flex justify-between"><span>Neither</span><span className="font-semibold">{data.requirementsInputMix.neither}</span></div>
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Top Recommended</h3>
                    <div className="mt-4 space-y-2 text-sm">
                        {data.topRecommended.length > 0 ? data.topRecommended.map((row) => (
                            <div key={row.catalogItemId} className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium text-slate-800">{row.item?.name || row.catalogItemId}</p>
                                    <p className="text-[11px] text-slate-500">{row.item?.sku || 'Unknown SKU'}</p>
                                </div>
                                <span className="font-semibold text-slate-900">{row.count}</span>
                            </div>
                        )) : <p className="text-slate-500">No recommendation runs yet.</p>}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Top Picked Services</h3>
                    <div className="mt-4 space-y-2 text-sm">
                        {data.topPicked.length > 0 ? data.topPicked.map((row) => (
                            <div key={row.catalogItemId || `unknown-${row.count}`} className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-medium text-slate-800">{row.item?.name || row.catalogItemId || 'Unknown item'}</p>
                                    <p className="text-[11px] text-slate-500">{row.item?.sku || 'Unknown SKU'}</p>
                                </div>
                                <span className="font-semibold text-slate-900">{row.count}</span>
                            </div>
                        )) : <p className="text-slate-500">No picked services yet.</p>}
                    </div>
                </section>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Top Collateral Clicks</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {data.topCollateral.length > 0 ? data.topCollateral.map((row) => (
                        <div key={row.collateralId || `col-${row.count}`} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                            <p className="text-sm font-medium text-slate-800">{row.collateral?.title || row.collateralId || 'Unknown collateral'}</p>
                            <p className="text-[11px] text-slate-500">
                                {row.collateral?.catalogItem.name || 'Unknown item'} {row.collateral?.catalogItem.sku ? `(${row.collateral.catalogItem.sku})` : ''}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-700">Clicks: {row.count}</p>
                        </div>
                    )) : <p className="text-sm text-slate-500">No collateral clicks recorded yet.</p>}
                </div>
            </section>
        </div>
    );
}
