'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Search,
    Filter,
    Box,
    Tag as TagIcon,
    DollarSign,
    ChevronRight,
    Loader2,
    Package,
    HardDrive,
    FileText,
    Workflow,
    ExternalLink,
    Briefcase,
    Layers
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

export default function CatalogPage() {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const LIMIT = 50;

    useEffect(() => {
        setPage(1);
    }, [search, filterType]);

    useEffect(() => {
        fetchItems();
    }, [search, filterType, page]);

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
                    {['ALL', 'HARDWARE', 'MANAGED_SERVICE', 'SERVICE_OPTION', 'PACKAGE', 'CONNECTIVITY', 'SERVICE_FAMILY'].map((type) => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 ${filterType === type
                                    ? 'bg-blue-600 text-slate-900'
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
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
                            className="bg-white/50 border border-slate-200 rounded-2xl p-5 hover:border-blue-500/30 transition-all group overflow-hidden relative"
                        >
                            {/* Type Badge */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded-lg border border-slate-200">
                                    {getTypeIcon(item.type)}
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-600">
                                        {item.type}
                                    </span>
                                </div>
                                <button className="text-slate-500 hover:text-slate-900 transition-colors">
                                    <ExternalLink size={16} />
                                </button>
                            </div>

                            <div className="space-y-1 mb-6">
                                <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-400 transition-colors truncate">
                                    {item.name}
                                </h3>
                                <code className="text-[10px] text-blue-500 font-mono tracking-tighter">
                                    SKU: {item.sku}
                                </code>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                                    <div className="flex items-center gap-2 text-slate-500 text-[9px] uppercase font-bold tracking-wider mb-1">
                                        <TagIcon size={10} />
                                        Attributes
                                    </div>
                                    <div className="text-xs text-slate-700 font-medium">
                                        {item.attributes.length} Linked
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50">
                                    <div className="flex items-center gap-2 text-slate-500 text-[9px] uppercase font-bold tracking-wider mb-1">
                                        <DollarSign size={10} />
                                        Pricing
                                    </div>
                                    <div className="text-xs text-slate-700 font-medium">
                                        {item.pricing.length > 0 ? `$${item.pricing[0].priceMrc}/mo` : 'Not Set'}
                                    </div>
                                </div>
                            </div>

                            <Link href={`/admin/catalog/${item.id}`}>
                                <Button
                                    variant="ghost"
                                    className="w-full justify-between text-xs hover:bg-blue-600/10 hover:text-blue-400 border border-transparent hover:border-blue-600/20"
                                >
                                    Manage Dependencies & Rules
                                    <ChevronRight size={14} />
                                </Button>
                            </Link>

                            {/* Subtle background glow */}
                            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-600/5 rounded-full blur-2xl group-hover:bg-blue-600/10 transition-all pointer-events-none" />
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
