'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CATALOG_ITEM_TYPES, CatalogItemType, normalizeCatalogItemType } from '@/lib/catalog-item-types';
import {
    Plus,
    Search,
    Filter,
    Box,
    Loader2,
    Package,
    HardDrive,
    Workflow,
    Settings,
    Briefcase,
    Trash2
} from 'lucide-react';

interface CatalogItem {
    id: string;
    sku: string;
    name: string;
    shortDescription: string | null;
    detailedDescription: string | null;
    type: string;
    primaryPurpose?: 'WAN' | 'LAN' | 'WLAN' | null;
    secondaryPurposes?: Array<'WAN' | 'LAN' | 'WLAN'>;
    equipmentProfile?: {
        make: string;
        model: string;
        reviewStatus: string;
        vendorDatasheetUrl: string | null;
    } | null;
    attributes: unknown[];
    pricing: unknown[];
}

interface TaxonomyTerm {
    id: string;
    category: string;
    label: string;
    value: string;
}

interface CatalogListViewProps {
    title: string;
    description: string;
    forcedType?: CatalogItemType;
    showIngestion?: boolean;
}

const SECTION_LINKS: Array<{ label: string; href: string; type: CatalogItemType }> = [
    { label: 'Hardware', href: '/admin/catalog/hardware', type: 'HARDWARE' },
    { label: 'Services', href: '/admin/catalog/services', type: 'MANAGED_SERVICE' },
    { label: 'Service Options', href: '/admin/catalog/service-options', type: 'SERVICE_OPTION' },
    { label: 'Connectivity', href: '/admin/catalog/connectivity', type: 'CONNECTIVITY' },
    { label: 'Packages', href: '/admin/catalog/packages', type: 'PACKAGE' },
];

export default function CatalogListView({
    title,
    description,
    forcedType,
    showIngestion = false,
}: CatalogListViewProps) {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [taxonomyTerms, setTaxonomyTerms] = useState<TaxonomyTerm[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState<'ALL' | CatalogItemType>(forcedType ?? 'ALL');
    const [purposeFilter, setPurposeFilter] = useState<'ALL' | 'WAN' | 'LAN' | 'WLAN'>('ALL');
    const [sortBy, setSortBy] = useState<'name' | 'updatedAt'>('name');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [ingestUrls, setIngestUrls] = useState('');
    const [ingesting, setIngesting] = useState(false);
    const [ingestStatus, setIngestStatus] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const LIMIT = 50;

    useEffect(() => {
        if (forcedType) {
            setFilterType(forcedType);
        }
    }, [forcedType]);

    const hardwareContext = forcedType === 'HARDWARE' || (!forcedType && (filterType === 'ALL' || filterType === 'HARDWARE'));

    const classificationFilters = useMemo(
        () => taxonomyTerms
            .filter((term) => term.category === 'CLASSIFICATION')
            .reduce<Array<{ value: CatalogItemType; label: string }>>((acc, term) => {
                const normalizedType = normalizeCatalogItemType(term.value);
                if (!normalizedType) return acc;
                if (acc.some((existing) => existing.value === normalizedType)) return acc;
                acc.push({ value: normalizedType, label: term.label || normalizedType });
                return acc;
            }, []),
        [taxonomyTerms]
    );

    useEffect(() => {
        setPage(1);
    }, [search, filterType, purposeFilter, sortBy, sortDir]);

    useEffect(() => {
        void fetchItems();
        if (!forcedType) {
            void fetchTaxonomies();
        }
    }, [search, filterType, purposeFilter, sortBy, sortDir, page, forcedType]);

    async function fetchTaxonomies() {
        try {
            const res = await fetch('/api/admin/taxonomy');
            const data = await res.json();
            setTaxonomyTerms(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error(err);
        }
    }

    async function deleteItem(id: string) {
        if (!confirm('Delete this catalog item? This cannot be undone.')) return;
        setDeletingId(id);
        try {
            await fetch(`/api/admin/catalog/${id}`, { method: 'DELETE' });
            setItems((prev) => prev.filter((i) => i.id !== id));
            setTotal((prev) => prev - 1);
        } catch (err) {
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    }

    async function fetchItems() {
        try {
            setLoading(true);
            const url = new URL('/api/admin/catalog', window.location.origin);
            if (search) url.searchParams.set('search', search);

            const activeType = forcedType ?? (filterType === 'ALL' ? null : filterType);
            if (activeType) {
                url.searchParams.set('type', activeType);
            }
            if (purposeFilter !== 'ALL') {
                url.searchParams.set('primaryPurpose', purposeFilter);
            }

            url.searchParams.set('sortBy', sortBy);
            url.searchParams.set('sortDir', sortDir);
            url.searchParams.set('page', String(page));
            url.searchParams.set('limit', String(LIMIT));

            const res = await fetch(url.toString());
            const raw = await res.text();
            const data = raw.trim().length > 0 ? JSON.parse(raw) : {};
            if (!res.ok) {
                throw new Error((data as { error?: string }).error || 'Failed to fetch catalog items');
            }
            setItems(data.items ?? []);
            setTotal(data.total ?? 0);
        } catch (err) {
            console.error(err);
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }

    async function runDatasheetIngestion() {
        const urls = ingestUrls
            .split('\n')
            .map((row) => row.trim())
            .filter(Boolean);
        if (urls.length === 0) {
            setIngestStatus('Provide at least one URL.');
            return;
        }

        try {
            setIngesting(true);
            setIngestStatus('Creating ingestion job...');
            const createRes = await fetch('/api/admin/equipment/ingestion/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls }),
            });
            const createData = await createRes.json().catch(() => ({}));
            if (!createRes.ok) {
                throw new Error(createData.error || 'Failed to create ingestion job');
            }

            const jobId = createData?.job?.id;
            if (!jobId) {
                throw new Error('Ingestion job id missing from response');
            }

            setIngestStatus('Processing ingestion job...');
            const processRes = await fetch(`/api/admin/equipment/ingestion/jobs/${jobId}/process`, { method: 'POST' });
            const processData = await processRes.json().catch(() => ({}));
            if (!processRes.ok) {
                throw new Error(processData.error || 'Failed to process ingestion job');
            }

            setIngestStatus('Ingestion finished. Refreshing catalog...');
            await fetchItems();

            const upsertedCount = typeof processData?.upsertedCount === 'number' ? processData.upsertedCount : 0;
            const failedCount = typeof processData?.failedCount === 'number' ? processData.failedCount : 0;
            const firstError = Array.isArray(processData?.job?.sources)
                ? (processData.job.sources.find((source: { errorMessage?: string | null }) => source.errorMessage)?.errorMessage ?? null)
                : null;

            if (upsertedCount > 0) {
                setIngestStatus(`Ingestion complete: ${upsertedCount} source(s) upserted${failedCount > 0 ? `, ${failedCount} failed` : ''}.`);
                setIngestUrls('');
                window.setTimeout(() => {
                    setIngestStatus((current) => (current?.startsWith('Ingestion complete:') ? null : current));
                }, 4000);
            } else {
                setIngestStatus(`No equipment was ingested.${firstError ? ` ${firstError}` : ''}`);
            }
        } catch (err) {
            setIngestStatus(err instanceof Error ? err.message : 'Ingestion failed');
        } finally {
            setIngesting(false);
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'HARDWARE':
                return <HardDrive size={16} className="text-blue-400" />;
            case 'MANAGED_SERVICE':
            case 'SERVICE_OPTION':
                return <Briefcase size={16} className="text-purple-400" />;
            case 'PACKAGE':
                return <Package size={16} className="text-amber-400" />;
            case 'CONNECTIVITY':
                return <Workflow size={16} className="text-cyan-400" />;
            default:
                return <Box size={16} className="text-slate-600" />;
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex flex-wrap items-center gap-2">
                {SECTION_LINKS.map((section) => {
                    const active = section.type === forcedType;
                    return (
                        <Link
                            key={section.href}
                            href={section.href}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {section.label}
                        </Link>
                    );
                })}
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h2>
                    <p className="text-slate-600">{description}</p>
                </div>
                <Link href="/admin/catalog/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        Add Item
                    </Button>
                </Link>
            </div>

            {showIngestion && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Equipment Datasheet Ingestion</h3>
                        <Button size="sm" onClick={() => void runDatasheetIngestion()} disabled={ingesting}>
                            {ingesting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                            {ingesting ? 'Processing...' : 'Ingest URLs'}
                        </Button>
                    </div>
                    <textarea
                        value={ingestUrls}
                        onChange={(e) => setIngestUrls(e.target.value)}
                        className="w-full min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono"
                        placeholder="Paste one HTTPS PDF URL per line"
                    />
                    {ingestStatus && <p className="text-xs text-slate-600">{ingestStatus}</p>}
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                        placeholder="Search by SKU or name..."
                        className="pl-10 bg-white border-slate-200 focus:ring-zippy-green/20"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {!forcedType && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                        <Filter size={18} className="text-slate-500 shrink-0" />
                        <button
                            onClick={() => setFilterType('ALL')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${filterType === 'ALL'
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            ALL
                        </button>
                        {classificationFilters.map((t) => (
                            <button
                                key={t.value}
                                onClick={() => setFilterType(t.value)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm whitespace-nowrap ${filterType === t.value
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {t.label?.toUpperCase()}
                            </button>
                        ))}
                        {classificationFilters.length === 0 && CATALOG_ITEM_TYPES.map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${filterType === type
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                            >
                                {type === 'MANAGED_SERVICE' ? 'SERVICES' : type === 'SERVICE_OPTION' ? 'OPTION' : type}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy((e.target.value === 'updatedAt' ? 'updatedAt' : 'name'))}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                    >
                        <option value="name">Sort: Name</option>
                        <option value="updatedAt">Sort: Updated</option>
                    </select>
                    <select
                        value={sortDir}
                        onChange={(e) => setSortDir((e.target.value === 'desc' ? 'desc' : 'asc'))}
                        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                    >
                        <option value="asc">Asc</option>
                        <option value="desc">Desc</option>
                    </select>
                </div>
            </div>

            {hardwareContext && (
                <div className="flex items-center gap-2">
                    {(['ALL', 'WAN', 'LAN', 'WLAN'] as const).map((purpose) => (
                        <button
                            key={purpose}
                            onClick={() => setPurposeFilter(purpose)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${purposeFilter === purpose
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {purpose}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-500 gap-4">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <p>Scanning relational inventory...</p>
                    </div>
                ) : items.length > 0 ? (
                    items.map((item) => (
                        <div
                            key={item.id}
                            className="bg-white/50 border border-slate-200 rounded-[24px] p-6 hover:border-zippy-green/30 transition-all group relative flex flex-col min-h-[220px]"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/60">
                                    {getTypeIcon(item.type)}
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                                        {item.type.replace('_', ' ')}
                                    </span>
                                </div>
                                <Link
                                    href={`/admin/catalog/${item.id}`}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                                    title="Item Settings"
                                >
                                    <Settings size={20} />
                                </Link>
                            </div>

                            <div className="flex-1 space-y-2">
                                <h3 className="text-xl font-bold line-clamp-1">
                                    <Link
                                        href={`/admin/catalog/${item.id}`}
                                        className="text-slate-900 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zippy-green/60 rounded-sm"
                                        title={`Open settings for ${item.name}`}
                                    >
                                        {item.name}
                                    </Link>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <code className="text-[10px] text-blue-600 font-mono tracking-tight bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                        {item.sku}
                                    </code>
                                    {item.primaryPurpose && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold">
                                            {item.primaryPurpose}
                                        </span>
                                    )}
                                </div>
                                {item.equipmentProfile && (
                                    <p className="text-[11px] text-slate-500">
                                        {item.equipmentProfile.make} {item.equipmentProfile.model} · {item.equipmentProfile.reviewStatus}
                                    </p>
                                )}
                                <p className="text-base text-slate-600 line-clamp-3 leading-relaxed pt-2">
                                    {item.shortDescription || 'No description provided.'}
                                </p>
                            </div>

                            <div className="flex justify-end items-center mt-6">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        void deleteItem(item.id);
                                    }}
                                    disabled={deletingId === item.id}
                                    className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all disabled:opacity-40"
                                    title="Delete Item"
                                >
                                    {deletingId === item.id
                                        ? <Loader2 size={18} className="animate-spin" />
                                        : <Trash2 size={18} />}
                                </button>
                            </div>

                            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-zippy-green/3 rounded-full blur-3xl group-hover:bg-zippy-green/5 transition-all pointer-events-none -z-10" />
                        </div>
                    ))
                ) : (
                    <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-600 gap-4 border-2 border-dashed border-slate-200 rounded-3xl">
                        <Box size={48} className="opacity-20" />
                        <p>No catalog items found matching your filters.</p>
                    </div>
                )}
            </div>

            {total > LIMIT && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-500">
                        Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total} items
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={page * LIMIT >= total} onClick={() => setPage((p) => p + 1)}>
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
