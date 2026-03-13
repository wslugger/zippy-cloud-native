'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ServiceSelector } from '@/components/service-selector';
import { ArrowLeft, DollarSign, AlertTriangle, Loader2, Building2, RefreshCw } from 'lucide-react';

interface BOMResult {
    lineItems: any[];
    totals: { totalNrc: number; totalMrc: number; totalTcv?: number };
    termMonths?: number;
    warnings: string[];
}

interface SiteData {
    id: string;
    name: string;
    primaryServiceId: string | null;
    project: { id: string; name: string; termMonths: number };
    siteSelections: Array<{ catalogItemId: string; configValues: any; role: string | null }>;
}

export default function SiteConfigPage({ params }: { params: Promise<{ id: string; siteId: string }> }) {
    const { id: projectId, siteId } = use(params);
    const [site, setSite] = useState<SiteData | null>(null);
    const [loading, setLoading] = useState(true);
    const [bom, setBOM] = useState<BOMResult | null>(null);
    const [bomLoading, setBOMLoading] = useState(false);
    const [primaryServiceId, setPrimaryServiceId] = useState<string>('');
    const [selections, setSelections] = useState<Array<{ itemId: string; configValues: Record<string, any> }>>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchSite();
    }, [siteId]);

    async function fetchSite() {
        const res = await fetch(`/api/projects/${projectId}/sites/${siteId}`);
        const data = await res.json();
        setSite(data);
        setPrimaryServiceId(data.primaryServiceId ?? '');
        setLoading(false);
    }

    async function saveSelections() {
        setSaving(true);
        // Update primary service on the site
        await fetch(`/api/projects/${projectId}/sites/${siteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ primaryServiceId: primaryServiceId || null }),
        });

        // Upsert each selection
        for (const sel of selections) {
            await fetch(`/api/projects/${projectId}/sites/${siteId}/selections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    catalogItemId: sel.itemId,
                    configValues: sel.configValues,
                    role: sel.itemId === primaryServiceId ? 'PRIMARY' : 'SECONDARY',
                }),
            });
        }
        setSaving(false);
        calculateBOM();
    }

    async function calculateBOM() {
        if (!site) return;
        setBOMLoading(true);
        const itemIds = selections.map(s => s.itemId);
        if (itemIds.length === 0) {
            setBOM(null);
            setBOMLoading(false);
            return;
        }

        const configValues: Record<string, Record<string, any>> = {};
        for (const sel of selections) {
            if (Object.keys(sel.configValues).length > 0) {
                configValues[sel.itemId] = sel.configValues;
            }
        }

        const res = await fetch('/api/bom/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sku_ids: itemIds,
                termMonths: site.project.termMonths,
                primaryServiceId: primaryServiceId || undefined,
                configValues,
            }),
        });
        const data = await res.json();
        setBOM(data);
        setBOMLoading(false);
    }

    // Auto-recalculate when selections change
    useEffect(() => {
        if (selections.length > 0 && site) {
            const debounce = setTimeout(calculateBOM, 600);
            return () => clearTimeout(debounce);
        }
    }, [selections, primaryServiceId]);

    if (loading || !site) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2 transition-colors">
                    <ArrowLeft size={12} /> {site.project.name}
                </Link>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-3 rounded-xl border border-slate-200">
                            <Building2 size={20} className="text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{site.name}</h1>
                        </div>
                    </div>
                    <Button onClick={saveSelections} disabled={saving || selections.length === 0} className="gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                        Save & Recalculate
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Service Selector — 3 cols */}
                <div className="lg:col-span-3 space-y-4">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 mb-1">Select Services</h2>
                        <p className="text-xs text-slate-500">Choose service options and configure design parameters for this site.</p>
                    </div>
                    <ServiceSelector
                        selectedIds={selections.map(s => s.itemId)}
                        onSelectionChange={setSelections}
                        primaryServiceId={primaryServiceId}
                        onPrimaryChange={setPrimaryServiceId}
                    />
                </div>

                {/* Live BOM Preview — 2 cols */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold text-slate-900">Live BOM Preview</h2>
                        {bomLoading && <Loader2 size={14} className="animate-spin text-blue-400" />}
                        {!bomLoading && bom && (
                            <button onClick={calculateBOM} className="text-slate-600 hover:text-slate-300">
                                <RefreshCw size={14} />
                            </button>
                        )}
                    </div>

                    {!bom ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-200 rounded-2xl gap-2 text-sm">
                            <DollarSign size={28} className="opacity-20" />
                            Select services to preview pricing
                        </div>
                    ) : (
                        <div className="bg-white/50 border border-slate-200 rounded-2xl overflow-hidden">
                            {/* Totals */}
                            <div className="grid grid-cols-3 divide-x divide-slate-800 border-b border-slate-200">
                                {[
                                    { label: 'NRC', value: `$${bom.totals.totalNrc.toFixed(0)}` },
                                    { label: 'MRC', value: `$${bom.totals.totalMrc.toFixed(0)}/mo` },
                                    { label: 'TCV', value: bom.totals.totalTcv ? `$${bom.totals.totalTcv.toFixed(0)}` : '—' },
                                ].map(stat => (
                                    <div key={stat.label} className="p-3 text-center">
                                        <p className="text-[9px] uppercase font-bold tracking-widest text-slate-600">{stat.label}</p>
                                        <p className="text-sm font-bold text-slate-900 mt-0.5">{stat.value}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Warnings */}
                            {bom.warnings.length > 0 && (
                                <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/10 space-y-1">
                                    {bom.warnings.map((w, i) => (
                                        <div key={i} className="flex items-start gap-2 text-[10px] text-amber-400">
                                            <AlertTriangle size={10} className="shrink-0 mt-0.5" />
                                            {w}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Line Items */}
                            <div className="divide-y divide-slate-800/50">
                                {bom.lineItems.map(item => (
                                    <div key={item.id} className="px-4 py-2.5 flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-medium text-slate-900 truncate">{item.name}</span>
                                                {item.role && (
                                                    <span className={`text-[8px] font-bold px-1 py-0.5 rounded border shrink-0 ${
                                                        item.role === 'PRIMARY'
                                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                            : 'bg-slate-100 border-slate-300 text-slate-500'
                                                    }`}>{item.role}</span>
                                                )}
                                            </div>
                                            {item.parentSku && (
                                                <p className="text-[10px] text-slate-600">↳ {item.parentSku}</p>
                                            )}
                                            <p className="text-[10px] font-mono text-blue-600">{item.sku} ×{item.quantity}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            {item.pricing.nrc > 0 && (
                                                <p className="text-[10px] text-slate-500">${item.pricing.nrc.toFixed(0)} NRC</p>
                                            )}
                                            <p className="text-xs font-bold text-slate-900">${item.pricing.mrc.toFixed(0)}/mo</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
