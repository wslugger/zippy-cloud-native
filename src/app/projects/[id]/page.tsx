'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft, Loader2,
    FileText, Sparkles, FolderKanban, ShieldCheck, Download,
    Compass, CheckCircle2, Trash2
} from 'lucide-react';
import { GuidedFlowWizard } from '@/components/sa-flow/GuidedFlowWizard';
import { Badge } from '@/components/ui/badge';

interface SolutionSite {
    id: string;
    name: string;
    address: string | null;
    primaryServiceId: string | null;
    siteSelections: Array<{ id: string }>;
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
        shortDescription?: string | null;
        detailedDescription?: string | null;
        collaterals?: Collateral[];
    };
}

interface Collateral {
    id: string;
    title: string;
    documentUrl: string;
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
    requirementDocs?: Array<{
        id: string;
        fileName: string;
        mimeType: string;
        status: string;
        extractedText: string | null;
        createdAt: string;
    }>;
    recommendations?: Array<{
        id: string;
        reason: string;
        shortReason?: string;
        score: string | number;
        certaintyPercent?: number;
        matchedCharacteristics?: string[];
        requiredIncluded: string[];
        optionalRecommended: string[];
        catalogItem: {
            id: string;
            sku: string;
            name: string;
            type: string;
            shortDescription: string | null;
        };
    }>;
}

type Recommendation = NonNullable<Project['recommendations']>[number];

interface Suggestion {
    id: string;
    sku: string;
    name: string;
    type: string;
    description: string | null;
    reason: string;
    shortReason?: string;
    certaintyPercent: number;
    matchedCharacteristics: string[];
    requiredIncluded: string[];
    optionalRecommended: string[];
    recommendationId?: string;
}

function toCertaintyPercent(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric <= 1) return Math.round(Math.max(0, Math.min(1, numeric)) * 100);
    return Math.round(Math.max(0, Math.min(100, numeric)));
}

function parseMatchedCharacteristicsFromReason(reason: string): string[] {
    const marker = 'Matched characteristics:';
    const idx = reason.indexOf(marker);
    if (idx === -1) return [];
    const tail = reason.slice(idx + marker.length).trim();
    const normalized = tail.endsWith('.') ? tail.slice(0, -1) : tail;
    return normalized
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
}

function normalizeProjectResponse(payload: unknown): Project | null {
    if (!payload || typeof payload !== 'object') return null;
    const raw = payload as Partial<Project>;
    if (!raw.id || !raw.name) return null;

    return {
        id: raw.id,
        name: raw.name,
        customerName: raw.customerName ?? null,
        rawRequirements: raw.rawRequirements ?? null,
        status: raw.status ?? 'DRAFT',
        termMonths: typeof raw.termMonths === 'number' ? raw.termMonths : 36,
        sites: Array.isArray(raw.sites) ? raw.sites : [],
        items: Array.isArray(raw.items) ? raw.items : [],
        requirementDocs: Array.isArray(raw.requirementDocs) ? raw.requirementDocs : [],
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
    };
}

function mapRecommendation(rec: Recommendation): Suggestion {
    return {
        id: rec.catalogItem.id,
        sku: rec.catalogItem.sku,
        name: rec.catalogItem.name,
        type: rec.catalogItem.type,
        description: rec.catalogItem.shortDescription,
        reason: rec.reason,
        shortReason: rec.shortReason,
        certaintyPercent: typeof rec.certaintyPercent === 'number' ? rec.certaintyPercent : toCertaintyPercent(rec.score),
        matchedCharacteristics: rec.matchedCharacteristics ?? parseMatchedCharacteristicsFromReason(rec.reason),
        requiredIncluded: rec.requiredIncluded ?? [],
        optionalRecommended: rec.optionalRecommended ?? [],
        recommendationId: rec.id,
    };
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [serviceStepUnlocked, setServiceStepUnlocked] = useState(false);
    
    const [requirements, setRequirements] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showWizard, setShowWizard] = useState(false);
    const [removingItemId, setRemovingItemId] = useState<string | null>(null);

    const fetchProject = useCallback(async () => {
        try {
            setLoadError(null);
            const res = await fetch(`/api/projects/${id}`);
            const payload = await res.json();
            const data = normalizeProjectResponse(payload);

            if (!res.ok || !data) {
                setProject(null);
                setLoadError('Failed to load project data');
                setLoading(false);
                return;
            }

            setProject(data);
            if (data.rawRequirements && (data.requirementDocs?.length ?? 0) === 0) {
                setRequirements((prev) => prev || data.rawRequirements || '');
            }
            if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
                setSuggestions(data.recommendations.map(mapRecommendation));
            }
            if ((Array.isArray(data.recommendations) && data.recommendations.length > 0) || data.items.length > 0) {
                setServiceStepUnlocked(true);
            }
            setLoading(false);
        } catch {
            setProject(null);
            setLoadError('Failed to load project data');
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void fetchProject();
    }, [fetchProject]);

    async function saveAndAnalyze() {
        const uploadedDocContext = (project?.requirementDocs ?? [])
            .map((doc) => `Uploaded document: ${doc.fileName} (${doc.mimeType || 'unknown'}).`)
            .join('\n');
        const uploadedDocText = (project?.requirementDocs ?? [])
            .map((doc) => doc.extractedText?.trim() ?? '')
            .filter((text) => text.length > 0)
            .join('\n\n');
        const combinedRequirements = [uploadedDocContext, uploadedDocText, requirements.trim()]
            .filter((text) => text.length > 0)
            .join('\n\n');

        if (!combinedRequirements) return;

        setAnalyzing(true);
        try {
            // Analyze with package-aware matcher using direct requirement text (DB-persistence optional)
            const res = await fetch(`/api/projects/${id}/match`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawRequirements: combinedRequirements }),
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
                setSuggestions((data.recommendations as Recommendation[]).map(mapRecommendation));
            } else {
                // Fallback: direct Gemini suggest endpoint (service/package recommendations)
                const fallbackRes = await fetch('/api/sa/suggest-services', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rawRequirements: combinedRequirements }),
                });
                const fallbackData = await fallbackRes.json().catch(() => ({}));
                if (fallbackRes.ok && Array.isArray(fallbackData.suggestions)) {
                    setSuggestions(
                        fallbackData.suggestions.map((s: {
                            id: string;
                            sku: string;
                            name: string;
                            type: string;
                            description?: string | null;
                            shortDescription?: string | null;
                            reason?: string;
                            shortReason?: string;
                            score?: number;
                            certaintyPercent?: number;
                            matchedCharacteristics?: string[];
                        }) => ({
                            id: s.id,
                            sku: s.sku,
                            name: s.name,
                            type: s.type,
                            description: s.description ?? s.shortDescription ?? null,
                            reason: s.reason ?? 'Matched by AI requirement analysis.',
                            shortReason: s.shortReason,
                            certaintyPercent: typeof s.certaintyPercent === 'number'
                                ? s.certaintyPercent
                                : toCertaintyPercent(s.score),
                            matchedCharacteristics: Array.isArray(s.matchedCharacteristics) ? s.matchedCharacteristics : [],
                            requiredIncluded: [],
                            optionalRecommended: [],
                        }))
                    );
                } else {
                    setSuggestions([]);
                }
            }

            // Best-effort persistence of raw requirements; do not block AI flow on failure.
            await fetch(`/api/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawRequirements: combinedRequirements }),
            }).catch(() => undefined);

            await fetchProject();
            setServiceStepUnlocked(true);
        } finally {
            setAnalyzing(false);
        }
    }

    async function uploadRequirementsFiles(files: File[]) {
        if (files.length === 0) return;

        setUploading(true);
        setUploadError(null);
        try {
            const failedUploads: string[] = [];

            for (const file of files) {
                const formData = new FormData();
                formData.append('file', file);

                const res = await fetch(`/api/projects/${id}/requirements/upload`, {
                    method: 'POST',
                    body: formData,
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    failedUploads.push(`${file.name}: ${data.error || 'Upload failed'}`);
                }
            }

            if (failedUploads.length > 0) {
                setUploadError(failedUploads.join(' | '));
            }

            await fetchProject();
        } catch (err: unknown) {
            setUploadError(err instanceof Error ? err.message : 'Failed to upload requirements file');
        } finally {
            setUploading(false);
        }
    }

    async function addService(catalogItemId: string, recommendationId?: string) {
        if (recommendationId) {
            await fetch(`/api/projects/${id}/recommendations/${recommendationId}/adopt`, {
                method: 'POST',
            });
        } else {
            await fetch(`/api/projects/${id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ catalogItemId, quantity: 1 }),
            });
        }
        await fetchProject();
    }

    async function removeService(itemId: string) {
        setRemovingItemId(itemId);
        try {
            await fetch(`/api/projects/${id}/items/${itemId}`, {
                method: 'DELETE',
            });
            await fetchProject();
        } finally {
            setRemovingItemId(null);
        }
    }


    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
                <p className="text-sm text-slate-600">{loadError || 'Project not found'}</p>
                <Button variant="outline" onClick={() => { setLoading(true); void fetchProject(); }}>
                    Retry
                </Button>
            </div>
        );
    }

    const uploadedDocCount = (project.requirementDocs ?? []).length;
    const canAnalyze = requirements.trim().length > 0 || uploadedDocCount > 0;

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
            </div>

            <div className="space-y-6 max-w-3xl">
                <div className="bg-white/50 border border-slate-200 rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4 text-blue-400">
                        <FileText size={24} />
                        <h2 className="text-xl font-bold text-slate-900">Step 1: Project Kickoff Requirements</h2>
                    </div>
                    <p className="text-slate-600 text-sm mb-6">
                        Upload one or more requirement documents, then add any additional SA context below.
                        The analysis combines both sources to suggest managed services and package options.
                    </p>

                    <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold text-slate-700">Upload Requirement Documents</p>
                                <p className="text-[11px] text-slate-500">You can upload multiple TXT/JSON/PDF/DOC files.</p>
                            </div>
                            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files ?? []);
                                        void uploadRequirementsFiles(files);
                                        e.currentTarget.value = '';
                                    }}
                                />
                                {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                                {uploading ? 'Uploading...' : 'Upload Files'}
                            </label>
                        </div>
                        {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
                        {(project.requirementDocs ?? []).length > 0 && (
                            <div className="mt-3 space-y-2">
                                {(project.requirementDocs ?? []).map((doc) => (
                                    <div key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                            <span className="text-slate-800">{doc.fileName}</span>
                                            <span className="text-slate-500">({doc.mimeType || 'unknown'})</span>
                                        </div>
                                        <span className="text-slate-500">
                                            {doc.extractedText?.trim() ? 'Ready for analysis' : 'Uploaded'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="mb-1">
                        <p className="text-xs font-semibold text-slate-700">SA Additional Notes (Optional)</p>
                        <p className="text-[11px] text-slate-500">Use this for extra context that is not in uploaded files.</p>
                    </div>
                    <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[250px] text-slate-700 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono text-sm resize-y"
                        placeholder="Add clarifications, assumptions, constraints, or priorities for the SA-bot..."
                        value={requirements}
                        onChange={e => setRequirements(e.target.value)}
                    />
                    
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setServiceStepUnlocked(true)}
                        >
                            Skip Requirements & Choose Services/Packages
                        </Button>
                        <Button 
                            onClick={saveAndAnalyze} 
                            disabled={!canAnalyze || analyzing}
                            className="bg-blue-600 hover:bg-blue-500 text-slate-900 border-none gap-2"
                        >
                            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                            Analyze & Suggest Services
                        </Button>
                    </div>
                </div>
            </div>

            {serviceStepUnlocked && (
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <FolderKanban size={24} className="text-blue-500" />
                        <h2 className="text-xl font-bold text-slate-900">Step 2: Choose Services & Packages</h2>
                    </div>

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
                                    void fetchProject();
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
                                        <p className="mt-2 text-xs text-slate-500">Run analysis in Step 1 or start guided design.</p>
                                    </div>
                                ) : (() => {
                                    const pkgs = suggestions.filter(s => s.type === 'PACKAGE');
                                    const svcs = suggestions.filter(s => s.type !== 'PACKAGE');

                                    const SuggestionCard = ({ s, i }: { s: Suggestion; i: number }) => {
                                        const isAdded = project.items.some(it => it.catalogItemId === s.id);
                                        return (
                                            <div key={i} className="bg-white/80 border border-slate-200 rounded-xl p-5 hover:border-blue-500/30 transition-all">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                                                            {s.name}
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shrink-0">
                                                                {s.certaintyPercent}% certainty
                                                            </span>
                                                        </h4>
                                                        <p className="text-xs font-mono text-slate-400 mt-0.5">{s.sku}</p>
                                                        <p className="text-sm text-slate-600 mt-2">{s.description}</p>
                                                        {s.requiredIncluded?.length > 0 && (
                                                            <p className="text-[11px] text-slate-500 mt-2">
                                                                <span className="font-medium">Required:</span> {s.requiredIncluded.join(', ')}
                                                            </p>
                                                        )}
                                                        {s.optionalRecommended?.length > 0 && (
                                                            <p className="text-[11px] text-slate-500 mt-1">
                                                                <span className="font-medium">Optional:</span> {s.optionalRecommended.join(', ')}
                                                            </p>
                                                        )}
                                                        {s.matchedCharacteristics.length > 0 && (
                                                            <p className="text-[11px] text-slate-400 mt-1">
                                                                Matched: {s.matchedCharacteristics.join(', ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <Button size="sm" variant="secondary" className="shrink-0" onClick={() => addService(s.id, s.recommendationId)} disabled={isAdded}>
                                                        {isAdded ? 'Added' : 'Add'}
                                                    </Button>
                                                </div>
                                                <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-200/50">
                                                    <p className="text-xs text-emerald-500 flex items-start gap-2">
                                                        <Sparkles size={12} className="shrink-0 mt-0.5" />
                                                        <span>{s.shortReason ?? s.reason}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    };

                                    return (
                                        <div className="space-y-5">
                                            {/* ── Design Packages ── */}
                                            {pkgs.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold uppercase tracking-widest text-violet-500">Design Packages</span>
                                                        <span className="h-px flex-1 bg-violet-200/60" />
                                                    </div>
                                                    {/* Guided workflow callout */}
                                                    <div className="flex items-start gap-2.5 bg-violet-50 border border-violet-200/70 rounded-lg px-3.5 py-2.5">
                                                        <Compass size={14} className="text-violet-500 shrink-0 mt-0.5" />
                                                        <p className="text-[11px] text-violet-700 leading-relaxed">
                                                            <span className="font-semibold">Packages include a guided design workflow</span> — step-by-step configuration of topology, internet breakout, hardware, and design options for every site.
                                                        </p>
                                                    </div>
                                                    {pkgs.map((s, i) => <SuggestionCard key={s.id} s={s} i={i} />)}
                                                </div>
                                            )}

                                            {/* ── Standalone Services ── */}
                                            {svcs.length > 0 && (
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Standalone Services</span>
                                                        <span className="h-px flex-1 bg-slate-200/80" />
                                                    </div>
                                                    {svcs.map((s, i) => <SuggestionCard key={s.id} s={s} i={i} />)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
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
                                        {project.items.map(item => {
                                            const isPackage = item.catalogItem.type === 'PACKAGE';
                                            const collaterals = item.catalogItem.collaterals ?? [];
                                            const description = item.catalogItem.detailedDescription || item.catalogItem.shortDescription;

                                            return (
                                            <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium text-slate-800">{item.catalogItem.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.catalogItem.sku}</p>
                                                    {description && (
                                                        <p className="text-xs text-slate-600 mt-2">{description}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-[10px] bg-white capitalize">
                                                        {item.catalogItem.type.replace('_', ' ')}
                                                    </Badge>
                                                    <ShieldCheck size={18} className="text-emerald-500" />
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => removeService(item.id)}
                                                        disabled={removingItemId === item.id}
                                                        className="h-7 px-2 text-xs"
                                                    >
                                                        {removingItemId === item.id ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Trash2 size={12} />
                                                                Remove
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                                    <p className="text-xs font-semibold text-slate-700">Collateral</p>
                                                    {collaterals.length > 0 ? (
                                                        <div className="space-y-2">
                                                            {collaterals.map((col) => (
                                                                <a
                                                                    key={col.id}
                                                                    href={col.documentUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2 hover:border-blue-300"
                                                                >
                                                                    <div>
                                                                        <p className="text-xs font-medium text-slate-800">{col.title}</p>
                                                                        <p className="text-[10px] text-slate-500">{col.type}</p>
                                                                    </div>
                                                                    <Download size={14} className="text-blue-500" />
                                                                </a>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-slate-500">No collateral linked for this service yet.</p>
                                                    )}
                                                </div>
                                                {isPackage && (
                                                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                                        <p className="text-xs font-semibold text-slate-700">Package Details</p>
                                                        <p className="text-xs text-slate-600">
                                                            This package is selected and ready for collateral download.
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {collaterals.length > 0
                                                                ? `${collaterals.length} collateral item(s) available above.`
                                                                : 'No collateral linked for this package yet.'}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );})}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}
