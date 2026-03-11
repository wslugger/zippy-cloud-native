'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Building2, Plus, ArrowLeft, Loader2, ChevronRight,
    MapPin, DollarSign, AlertTriangle, FileText, Sparkles, FolderKanban, ShieldCheck, Download, Trash2, Shield,
    Compass
} from 'lucide-react';
import { GuidedFlowWizard } from '@/components/sa-flow/GuidedFlowWizard';
import { Badge } from '@/components/ui/badge';

interface SolutionSite {
    id: string;
    name: string;
    address: string | null;
    region: string | null;
    primaryServiceId: string | null;
    siteSelections: any[];
}

interface ProjectItem {
    id: string;
    catalogItemId: string;
    quantity: number;
    catalogItem: {
        id: string;
        name: string;
        sku: string;
        type: string;
        description: string;
        collaterals?: Collateral[];
    };
}

interface Collateral {
    id: string;
    title: string;
    url: string;
    type: string;
}

interface Project {
    id: string;
    name: string;
    customerName: string | null;
    rawRequirements: string | null;
    status: string;
    termMonths: number;
    sites: SolutionSite[];
    items: ProjectItem[];
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
    const [activeTab, setActiveTab] = useState<'kickoff' | 'services' | 'collateral' | 'sites' | 'bom'>('kickoff');
    
    const [requirements, setRequirements] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showWizard, setShowWizard] = useState(false);

    const [showAddSite, setShowAddSite] = useState(false);
    const [siteName, setSiteName] = useState('');
    const [siteRegion, setSiteRegion] = useState('');
    const [siteAddress, setSiteAddress] = useState('');

    useEffect(() => { fetchProject(); }, [id]);

    async function fetchProject() {
        const res = await fetch(`/api/projects/${id}`);
        const data = await res.json();
        setProject(data);
        if (data.rawRequirements && !requirements) {
            setRequirements(data.rawRequirements);
        }
        setLoading(false);
    }

    async function saveAndAnalyze() {
        setAnalyzing(true);
        // Save requirements
        await fetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawRequirements: requirements }),
        });
        
        // Analyze
        const res = await fetch('/api/sa/suggest-services', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rawRequirements: requirements })
        });
        const data = await res.json();
        if (data.suggestions) {
            setSuggestions(data.suggestions);
        }
        
        await fetchProject();
        setAnalyzing(false);
        setActiveTab('services');
    }

    async function addService(catalogItemId: string) {
        await fetch(`/api/projects/${id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ catalogItemId, quantity: 1 }),
        });
        fetchProject();
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
                    <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
                    {project.customerName && <p className="text-slate-600">{project.customerName}</p>}
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={calculateBOM} disabled={bomLoading} className="gap-2">
                        {bomLoading ? <Loader2 size={16} className="animate-spin" /> : <DollarSign size={16} />}
                        Calculate BOM
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 overflow-x-auto pb-px">
                {(['kickoff', 'services', 'collateral', 'sites', 'bom'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 whitespace-nowrap ${
                            activeTab === tab
                                ? 'border-blue-500 text-blue-400'
                                : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {tab === 'bom' ? 'BOM Summary' : tab}
                    </button>
                ))}
            </div>

            {activeTab === 'kickoff' && (
                <div className="space-y-6 max-w-3xl">
                    <div className="bg-white/50 border border-slate-200 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-4 text-blue-400">
                            <FileText size={24} />
                            <h2 className="text-xl font-bold text-slate-900">Project Kickoff</h2>
                        </div>
                        <p className="text-slate-600 text-sm mb-6">
                            Paste customer meeting notes, RFC requirements, or typed summaries here. 
                            Our SA SA-bot will analyze the input to intelligently suggest standard managed services, connectivity profiles, and packaged solutions.
                        </p>
                        
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[250px] text-slate-700 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-sm resize-y"
                            placeholder="Customer needs highly available connectivity across 45 retail sites..."
                            value={requirements}
                            onChange={e => setRequirements(e.target.value)}
                        />
                        
                        <div className="flex justify-end mt-4">
                            <Button 
                                onClick={saveAndAnalyze} 
                                disabled={!requirements || analyzing}
                                className="bg-blue-600 hover:bg-blue-500 text-slate-900 border-none gap-2"
                            >
                                {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                Analyze & Suggest Services
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'services' && (
                <div className="space-y-6">
                    {!showWizard && (
                        <div className="flex justify-end">
                            <Button 
                                onClick={() => setShowWizard(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-500/20"
                            >
                                <Compass size={18} />
                                Start Guided Design
                            </Button>
                        </div>
                    )}

                    {showWizard ? (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                             <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
                                    <Compass size={24} className="text-blue-500" />
                                    SA Guided Flow
                                </h2>
                                <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)} className="text-slate-500">
                                    Cancel & Close
                                </Button>
                            </div>
                            <GuidedFlowWizard 
                                projectId={id} 
                                onComplete={() => {
                                    setShowWizard(false);
                                    fetchProject();
                                }} 
                            />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            {/* Suggestions Panel */}
                            <div className="space-y-4">
                                <h3 className="font-bold flex items-center gap-2 text-blue-500">
                                    <Sparkles size={18} /> AI Recommended Services
                                </h3>
                                
                                {suggestions.length === 0 ? (
                                    <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                                        <p>No suggestions generated yet.</p>
                                        <Button variant="link" onClick={() => setActiveTab('kickoff')} className="text-blue-500">Go back and analyze requirements</Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {suggestions.map((s, i) => (
                                            <div key={i} className="bg-white/80 border border-slate-200 rounded-xl p-5 hover:border-blue-500/30 transition-all">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                                            {s.name}
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-500/10 border-blue-500/20 text-blue-400">
                                                                {s.type}
                                                            </span>
                                                        </h4>
                                                        <p className="text-xs font-mono text-slate-500 mt-1">{s.sku}</p>
                                                        <p className="text-sm text-slate-600 mt-2">{s.description}</p>
                                                    </div>
                                                    <Button size="sm" variant="secondary" onClick={() => addService(s.id)} 
                                                        disabled={project.items.some(it => it.catalogItemId === s.id)}
                                                    >
                                                        {project.items.some(it => it.catalogItemId === s.id) ? 'Added' : 'Add'}
                                                    </Button>
                                                </div>
                                                <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-200/50">
                                                    <p className="text-xs text-emerald-400 flex items-start gap-2">
                                                        <Sparkles size={12} className="shrink-0 mt-0.5" />
                                                        <span>{s.reason}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected Manual Items Panel */}
                            <div className="space-y-4 bg-white/30 rounded-2xl p-6 border border-slate-200/50">
                                <h3 className="font-bold flex items-center gap-2 text-slate-900">
                                    <FolderKanban size={18} /> Selected Services
                                </h3>
                                
                                {project.items.length === 0 ? (
                                    <div className="text-center text-slate-600 py-10">
                                        <p>No services selected. Try the Guided Flow!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {project.items.map(item => (
                                            <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-slate-800">{item.catalogItem.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.catalogItem.sku}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] bg-white capitalize">
                                                        {item.catalogItem.type.replace('_', ' ')}
                                                    </Badge>
                                                    <ShieldCheck size={18} className="text-emerald-500" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'collateral' && (
                <div className="space-y-6">
                    <div className="bg-white/50 border border-slate-200 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <FileText size={20} className="text-blue-400" />
                            <h2 className="text-lg font-bold text-slate-900">Solution Assets</h2>
                        </div>
                        
                        {project.items.length === 0 ? (
                            <p className="text-slate-500">Select services to view tailored collateral.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {project.items.flatMap(item => item.catalogItem.collaterals || []).length === 0 ? (
                                    <div className="col-span-full py-8 text-center border-2 border-dashed border-slate-200 rounded-xl">
                                        <p className="text-slate-500 text-sm">No specific collateral found for current selections.</p>
                                    </div>
                                ) : (
                                    project.items.map(item => (
                                        item.catalogItem.collaterals && item.catalogItem.collaterals.map((col, idx) => (
                                            <a key={`${item.id}-${idx}`} href={col.url} target="_blank" rel="noopener noreferrer" 
                                               className="group bg-slate-50 border border-slate-200 hover:border-blue-500/50 rounded-xl p-4 flex items-start gap-4 transition-all">
                                                <div className="bg-blue-500/10 p-2.5 rounded-lg border border-blue-500/20 text-blue-400 group-hover:scale-105 transition-transform">
                                                    <FileText size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-400 transition-colors line-clamp-1">{col.title}</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">{item.catalogItem.name}</p>
                                                </div>
                                                <Download size={16} className="text-slate-600 group-hover:text-blue-500" />
                                            </a>
                                        ))
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}


            {activeTab === 'sites' && (
                <div className="space-y-4">
                    <div className="flex justify-end">
                        <Button variant="ghost" onClick={() => setShowAddSite(true)} className="gap-2 border border-slate-200">
                            <Plus size={16} /> Add Site
                        </Button>
                    </div>

                    {showAddSite && (
                        <form onSubmit={addSite} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 max-w-md">
                            <h3 className="font-bold">New Site</h3>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Site Name</label>
                                <Input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="e.g. New York HQ" className="bg-slate-50" required />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Address</label>
                                <Input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Street address" className="bg-slate-50" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Region</label>
                                <select
                                    value={siteRegion}
                                    onChange={e => setSiteRegion(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 outline-none"
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
                                    className="group bg-white/50 border border-slate-200 rounded-2xl p-5 hover:border-blue-500/30 transition-all flex items-center justify-between"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <Building2 size={20} className="text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 group-hover:text-blue-400 transition-colors">{site.name}</p>
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
                        <div className="h-48 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-200 rounded-3xl gap-2">
                            <Building2 size={36} className="opacity-20" />
                            <p>No sites yet. Add a site to start designing.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'bom' && (
                <div className="space-y-6">
                    {!bom ? (
                        <div className="h-48 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-200 rounded-3xl gap-2">
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
                                    <div key={stat.label} className="bg-white border border-slate-200 rounded-2xl p-5">
                                        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">{stat.label}</p>
                                        <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                                        <p className="text-xs text-slate-600 mt-0.5">{stat.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Per-site breakdown */}
                            {bom.sites.map(site => (
                                <div key={site.siteId} className="bg-white/50 border border-slate-200 rounded-2xl overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white/80">
                                        <div className="flex items-center gap-2">
                                            <Building2 size={14} className="text-blue-400" />
                                            <span className="font-bold text-sm">{site.siteName}</span>
                                            {site.region && <span className="text-[10px] text-slate-500">{site.region}</span>}
                                        </div>
                                        <div className="flex gap-4 text-xs text-slate-600">
                                            <span>NRC: <span className="text-slate-900 font-bold">${site.bom.totals.totalNrc.toFixed(2)}</span></span>
                                            <span>MRC: <span className="text-slate-900 font-bold">${site.bom.totals.totalMrc.toFixed(2)}</span></span>
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
                                            <tr className="text-[9px] uppercase tracking-widest text-slate-600 border-b border-slate-200">
                                                <th className="text-left px-5 py-2">Item</th>
                                                <th className="text-left px-3 py-2">SKU</th>
                                                <th className="text-center px-3 py-2">Qty</th>
                                                <th className="text-right px-3 py-2">NRC</th>
                                                <th className="text-right px-5 py-2">MRC</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {site.bom.lineItems.map(item => (
                                                <tr key={item.id} className="border-b border-slate-200/50 hover:bg-slate-100/20">
                                                    <td className="px-5 py-2.5">
                                                        <span className="text-slate-900 font-medium">{item.name}</span>
                                                        {item.role && (
                                                            <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                                item.role === 'PRIMARY'
                                                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                                    : 'bg-slate-100 border-slate-300 text-slate-500'
                                                            }`}>{item.role}</span>
                                                        )}
                                                        {item.parentSku && (
                                                            <span className="ml-2 text-[10px] text-slate-600">↳ {item.parentSku}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 font-mono text-[10px] text-blue-500">{item.sku}</td>
                                                    <td className="px-3 py-2.5 text-center text-slate-600">{item.quantity}</td>
                                                    <td className="px-3 py-2.5 text-right text-slate-700">${item.pricing.nrc.toFixed(2)}</td>
                                                    <td className="px-5 py-2.5 text-right text-slate-700">${item.pricing.mrc.toFixed(2)}/mo</td>
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
