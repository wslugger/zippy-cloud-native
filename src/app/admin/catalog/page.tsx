'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Search,
    Filter,
    Box,
    Loader2,
    Package,
    HardDrive,
    FileText,
    Workflow,
    Settings,
    Briefcase,
    Layers,
    Trash2
} from 'lucide-react';
import Link from 'next/link';

interface CatalogItem {
    id: string;
    sku: string;
    name: string;
    shortDescription: string | null;
    detailedDescription: string | null;
    type: string;
    attributes: any[];
    pricing: any[];
}

interface TaxonomyTerm {
    id: string;
    category: string;
    label: string;
    value: string;
}

export default function CatalogPage() {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [taxonomyTerms, setTaxonomyTerms] = useState<TaxonomyTerm[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const LIMIT = 50;

    useEffect(() => {
        setPage(1);
    }, [search, filterType]);

    useEffect(() => {
        fetchItems();
        fetchTaxonomies();
    }, [search, filterType, page]);

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
            setItems(prev => prev.filter(i => i.id !== id));
            setTotal(prev => prev - 1);
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
            if (filterType !== 'ALL') url.searchParams.set('type', filterType);
            url.searchParams.set('page', String(page));
            url.searchParams.set('limit', String(LIMIT));

            const res = await fetch(url.toString());
            const data = await res.json();
            setItems(data.items ?? []);
            setTotal(data.total ?? 0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'HARDWARE': return <HardDrive size={16} className="text-blue-400" />;
            case 'MANAGED_SERVICE':
            case 'SERVICE_OPTION': return <Briefcase size={16} className="text-purple-400" />;

            case 'PACKAGE': return <Package size={16} className="text-amber-400" />;
            case 'CONNECTIVITY': return <Workflow size={16} className="text-cyan-400" />;
            case 'SERVICE_FAMILY': return <Layers size={16} className="text-indigo-400" />;
            default: return <Box size={16} className="text-slate-600" />;
        }
    };

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Catalog Items</h2>
                    <p className="text-slate-600">Manage hardware, software, and services inventory.</p>
                </div>
                <Link href="/admin/catalog/new">
                    <Button className="gap-2">
                        <Plus size={18} />
                        Add Item
                    </Button>
                </Link>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                        placeholder="Search by SKU or name..."
                        className="pl-10 bg-white border-slate-200 focus:ring-blue-500/20"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
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
                    {taxonomyTerms
                        .filter(t => t.category === 'CLASSIFICATION')
                        .map((t) => (
                        <button
                            key={t.value}
                            onClick={() => setFilterType(t.value || 'ALL')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm whitespace-nowrap ${filterType === t.value
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {t.label?.toUpperCase()}
                        </button>
                    ))}
                    {/* Fallback if no taxonomy terms are loaded yet or database is empty */}
                    {taxonomyTerms.filter(t => t.category === 'CLASSIFICATION').length === 0 && 
                        ['HARDWARE', 'MANAGED_SERVICE', 'SERVICE_OPTION', 'PACKAGE', 'CONNECTIVITY', 'SERVICE_FAMILY'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm ${filterType === type
                                    ? 'bg-slate-900 border-slate-900 text-white'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {type === 'MANAGED_SERVICE' ? 'SERVICE' : type === 'SERVICE_FAMILY' ? 'FAMILY' : type === 'SERVICE_OPTION' ? 'OPTION' : type}
                        </button>
                    ))}
                </div>
            </div>

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
                            className="bg-white/50 border border-slate-200 rounded-[24px] p-6 hover:border-blue-500/30 transition-all group relative flex flex-col min-h-[220px]"
                        >
                            {/* Header Section */}
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

                            {/* Content Section */}
                            <div className="flex-1 space-y-2">
                                <h3 className="text-xl font-bold line-clamp-1">
                                    <Link
                                        href={`/admin/catalog/${item.id}`}
                                        className="text-slate-900 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-sm"
                                        title={`Open settings for ${item.name}`}
                                    >
                                        {item.name}
                                    </Link>
                                </h3>
                                <div className="flex items-center gap-2">
                                    <code className="text-[10px] text-blue-600 font-mono tracking-tight bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                        {item.sku}
                                    </code>
                                </div>
                                <p className="text-base text-slate-600 line-clamp-3 leading-relaxed pt-2">
                                    {item.shortDescription || 'No description provided.'}
                                </p>
                            </div>

                            {/* Footer Section - Reliable Bottom Right */}
                            <div className="flex justify-end items-center mt-6">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        deleteItem(item.id);
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

                            {/* Decorative background glow */}
                            <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-blue-600/[0.03] rounded-full blur-3xl group-hover:bg-blue-600/[0.06] transition-all pointer-events-none -z-10" />
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
                        <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                            Previous
                        </Button>
                        <Button variant="outline" size="sm" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
