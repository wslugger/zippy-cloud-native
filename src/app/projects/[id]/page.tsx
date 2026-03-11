'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Building2, Plus, ArrowLeft, Loader2, ChevronRight,
    MapPin, DollarSign, AlertTriangle
} from 'lucide-react';

interface SolutionSite {
    id: string;
    name: string;
    address: string | null;
    region: string | null;
    primaryServiceId: string | null;
    siteSelections: any[];
}

interface Project {
    id: string;
    name: string;
    customerName: string | null;
    status: string;
    termMonths: number;
    sites: SolutionSite[];
}

interface BOMSite {
    siteId: string;
    siteName: string;
    region: string | null;
    bom: {
        lineItems: any[];
        totals: { totalNrc: number; totalMrc: number; totalTcv?: number };
        warnings: string[];
    };
}

interface ProjectBOM {
    projectId: string;
    termMonths: number;
    sites: BOMSite[];
    totals: { totalNrc: number; totalMrc: number; totalTcv: number };
}

const REGIONS = [
    { value: 'northeast', label: 'Northeast US' },
    { value: 'southeast', label: 'Southeast US' },
    { value: 'midwest', label: 'Midwest US' },
    { value: 'west', label: 'West US' },
];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<Project | null>(null);
    const [bom, setBOM] = useState<ProjectBOM | null>(null);
    const [loading, setLoading] = useState(true);
    const [bomLoading, setBOMLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'sites' | 'bom'>('sites');
    const [showAddSite, setShowAddSite] = useState(false);
    const [siteName, setSiteName] = useState('');
    const [siteRegion, setSiteRegion] = useState('');
    const [siteAddress, setSiteAddress] = useState('');

    useEffect(() => { fetchProject(); }, [id]);

    async function fetchProject() {
        const res = await fetch(`/api/projects/${id}`);
        const data = await res.json();
        setProject(data);
        setLoading(false);
    }

    async function calculateBOM() {
        setBOMLoading(true);
        const res = await fetch(`/api/projects/${id}/calculate`, { method: 'POST' });
        const data = await res.json();
        setBOM(data);
        setBOMLoading(false);
        setActiveTab('bom');
    }

    async function addSite(e: React.FormEvent) {
        e.preventDefault();
        if (!siteName) return;
        await fetch(`/api/projects/${id}/sites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: siteName, address: siteAddress, region: siteRegion }),
        });
        setShowAddSite(false);
        setSiteName('');
        setSiteAddress('');
        setSiteRegion('');
        fetchProject();
    }


    if (loading || !project) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <Link href="/projects" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2 transition-colors">
                        <ArrowLeft size={12} /> All Projects
                    </Link>
                    <h1 className="text-3xl font-bold text-white">{project.name}</h1>
                    {project.customerName && <p className="text-slate-400">{project.customerName}</p>}
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={calculateBOM} disabled={bomLoading} className="gap-2">
                        {bomLoading ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                        Calculate BOM
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-800">
                {(['sites', 'bom'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                            activeTab === tab
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {tab === 'bom' ? 'BOM Summary' : 'Sites'}
                    </button>
                ))}
            </div>

            {activeTab === 'sites' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="ghost" onClick={() => setShowAddSite(true)} className="gap-2 border border-slate-800">
                            <Plus size={16} /> Add Site
                        </Button>
                    </div>

                    {showAddSite && (
                        <form onSubmit={addSite} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 max-w-md">
                            <h3 className="font-bold">New Site</h3>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Site Name</label>
                                <Input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="e.g. New York HQ" className="bg-slate-950" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Address</label>
                                <Input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Street address" className="bg-slate-950" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Region</label>
                                <select
                                    value={siteRegion}
                                    onChange={e => setSiteRegion(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-300 outline-none"
                                >
                                    <option value="">Select region...</option>
                                    {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            <div className="flex gap-3">
                                <Button type="submit" disabled={!siteName}>Add Site</Button>
                                <Button type="button" variant="ghost" onClick={() => setShowAddSite(false)}>Cancel</Button>
                            </div>
                        </form>
                    )}

                    {project.sites.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {project.sites.map(site => (
                                <Link
                                    key={site.id}
                                    href={`/projects/${id}/sites/${site.id}`}
                                    className="group bg-slate-900/50 border border-slate-800 rounded-2xl p-5 hover:border-blue-500/30 transition-all flex items-center justify-between"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                                            <Building2 size={20} className="text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{site.name}</p>
                                            {site.address && <p className="text-xs text-slate-500">{site.address}</p>}
                                            <div className="flex items-center gap-3 mt-1">
                                                {site.region && (
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                                        <MapPin size={10} />
                                                        {REGIONS.find(r => r.value === site.region)?.label ?? site.region}
                                                    </div>
                                                )}
                                                <p className="text-[10px] text-slate-600">{site.siteSelections.length} services</p>
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-700 group-hover:text-blue-500 transition-colors" />
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl gap-2">
                            <Building2 size={36} className="opacity-20" />
                            <p>No sites yet. Add a site to start designing.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'bom' && (
                <div className="space-y-6">
                    {!bom ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-3xl gap-2">
                            <DollarSign size={36} className="opacity-20" />
                            <p>Click "Calculate BOM" to generate the bill of materials.</p>
                        </div>
                    ) : (
                        <>
                            {/* Project Totals */}
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { label: 'Total NRC', value: `$${bom.totals.totalNrc.toFixed(2)}`, sub: 'One-time' },
                                    { label: 'Total MRC', value: `$${bom.totals.totalMrc.toFixed(2)}`, sub: 'Per month' },
                                ].map(stat => (
                                    <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{stat.label}</p>
                                        <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">{stat.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Per-site breakdown */}
                            {bom.sites.map(site => (
                                <div key={site.siteId} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} className="text-blue-400" />
                                            <span className="font-bold text-sm">{site.siteName}</span>
                                            {site.region && <span className="text-[10px] text-slate-500">{site.region}</span>}
                                        </div>
                                        <div className="flex gap-4 text-xs text-slate-400">
                                            <span>NRC: <span className="text-white font-bold">${site.bom.totals.totalNrc.toFixed(2)}</span></span>
                                            <span>MRC: <span className="text-white font-bold">${site.bom.totals.totalMrc.toFixed(2)}</span></span>
                                        </div>
                                    </div>

                                    {site.bom.warnings.length > 0 && (
                                        <div className="px-5 py-2 bg-amber-500/5 border-b border-amber-500/10">
                                            {site.bom.warnings.map((w, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-amber-400">
                                                    <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                                                    {w}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[9px] uppercase tracking-widest text-slate-600 border-b border-slate-800">
                                                <th className="text-left px-5 py-2">Item</th>
                                                <th className="text-left px-3 py-2">SKU</th>
                                                <th className="text-center px-3 py-2">Qty</th>
                                                <th className="text-right px-3 py-2">NRC</th>
                                                <th className="text-right px-5 py-2">MRC</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {site.bom.lineItems.map(item => (
                                                <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                                                    <td className="px-5 py-2.5">
                                                        <span className="text-white font-medium">{item.name}</span>
                                                        {item.role && (
                                                            <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                                item.role === 'PRIMARY'
                                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-500'
                                                            }`}>{item.role}</span>
                                                        )}
                                                        {item.parentSku && (
                                                            <span className="ml-2 text-[10px] text-slate-600">↳ {item.parentSku}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-mono text-[10px] text-blue-500">{item.sku}</td>
                                                    <td className="px-3 py-2.5 text-center text-slate-400">{item.quantity}</td>
                                                    <td className="px-3 py-2.5 text-right text-slate-300">${item.pricing.nrc.toFixed(2)}</td>
                                                    <td className="px-5 py-2.5 text-right text-slate-300">${item.pricing.mrc.toFixed(2)}/mo</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
