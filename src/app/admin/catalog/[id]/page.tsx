'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    ChevronLeft,
    Save,
    Plus,
    Trash2,
    FileText,
    Link as LinkIcon,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import Link from 'next/link';

interface CatalogItem {
    id: string;
    sku: string;
    name: string;
    shortDescription: string | null;
    detailedDescription: string | null;
    type: string;
    constraints: { id: string; description: string }[];
    assumptions: { id: string; description: string }[];
    collaterals: { id: string; title: string; documentUrl: string; type: string }[];
    attributes: { id: string; taxonomyTermId: string; term: { id: string; name: string; category: string } }[];
    pricing: { id: string; pricingModel: string; costMrc: number; costNrc: number }[];
    childDependencies: {
        id: string;
        childId: string;
        type: string;
        quantityMultiplier: number;
        childItem: { id: string; sku: string; name: string };
    }[];
}

export default function CatalogItemDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [item, setItem] = useState<CatalogItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{id: string, name: string, sku: string, type: string}[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [attachmentQuery, setAttachmentQuery] = useState('');
    const [attachmentResults, setAttachmentResults] = useState<{id: string, name: string, sku: string, type: string}[]>([]);
    const [isAttachmentSearching, setIsAttachmentSearching] = useState(false);
    const [taxonomyTerms, setTaxonomyTerms] = useState<{id: string, label: string, category: string, value: string | null}[]>([]);
    const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(false);

    useEffect(() => {
        if (id !== 'new') {
            fetchItem();
        } else {
            setItem({
                id: '',
                sku: '',
                name: '',
                shortDescription: '',
                detailedDescription: '',
                type: 'SERVICE_FAMILY',
                constraints: [],
                assumptions: [],
                collaterals: [],
                attributes: [],
                pricing: [{ id: `temp-p-${Date.now()}`, pricingModel: 'FLAT', costMrc: 0, costNrc: 0 }],
                childDependencies: []
            });
            setLoading(false);
        }
        fetchTaxonomy();
    }, [id]);

    const fetchTaxonomy = async () => {
        setIsTaxonomyLoading(true);
        try {
            const res = await fetch('/api/admin/taxonomy');
            const data = await res.json();
            setTaxonomyTerms(data);
        } catch (error) {
            console.error('Failed to fetch taxonomy:', error);
        } finally {
            setIsTaxonomyLoading(false);
        }
    };

    async function fetchItem() {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/catalog/${id}`);
            const data = await res.json();
            setItem(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!item) return;
        try {
            setSaving(true);
            setStatus(null);
            const method = id === 'new' ? 'POST' : 'PATCH';
            const url = id === 'new' ? '/api/admin/catalog' : `/api/admin/catalog/${id}`;
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || 'Failed to save');
            }
            
            setStatus({ type: 'success', message: 'Item saved successfully' });
            if (id === 'new') {
                const newItem = await res.json();
                router.push(`/admin/catalog/${newItem.id}`);
            }
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || 'Error saving item' });
        } finally {
            setSaving(false);
        }
    }

    const addListDetail = (field: 'constraints' | 'assumptions') => {
        if (!item) return;
        setItem({
            ...item,
            [field]: [...item[field], { id: `temp-${Date.now()}`, description: '' }]
        });
    };

    const updateListDetail = (field: 'constraints' | 'assumptions', index: number, value: string) => {
        if (!item) return;
        const newList = [...item[field]];
        newList[index].description = value;
        setItem({ ...item, [field]: newList });
    };

    const removeListDetail = (field: 'constraints' | 'assumptions', index: number) => {
        if (!item) return;
        const newList = item[field].filter((_, i) => i !== index);
        setItem({ ...item, [field]: newList });
    };

    const addCollateral = () => {
        if (!item) return;
        setItem({
            ...item,
            collaterals: [...item.collaterals, { id: `temp-${Date.now()}`, title: '', documentUrl: '', type: 'PDF' }]
        });
    };

    const updateCollateral = (index: number, field: keyof CatalogItem['collaterals'][0], value: string) => {
        if (!item) return;
        const newList = [...item.collaterals];
        newList[index] = { ...newList[index], [field]: value };
        setItem({ ...item, collaterals: newList });
    };

    const removeCollateral = (index: number) => {
        if (!item) return;
        const newList = item.collaterals.filter((_, i) => i !== index);
        setItem({ ...item, collaterals: newList });
    };

    const searchItems = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/admin/catalog?search=${encodeURIComponent(query)}&limit=20`);
            const data = await res.json();
            const results = (data.items ?? data) as any[];
            setSearchResults(results.filter((d: any) => d.id !== item?.id && !item?.childDependencies.some((cd: any) => cd.childId === d.id)));
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const searchAttachments = async (query: string) => {
        setAttachmentQuery(query);
        if (query.length < 2) { setAttachmentResults([]); return; }
        setIsAttachmentSearching(true);
        try {
            const res = await fetch(`/api/admin/catalog?search=${encodeURIComponent(query)}&limit=20`);
            const data = await res.json();
            const results = (data.items ?? data) as any[];
            setAttachmentResults(results.filter((d: any) => d.id !== item?.id && !item?.childDependencies.some((cd: any) => cd.childId === d.id)));
        } catch (err) {
            console.error(err);
        } finally {
            setIsAttachmentSearching(false);
        }
    };

    const addDependency = (childItem: {id: string, name: string, sku: string}, type?: string) => {
        if (!item) return;
        const depType = type || (item.type === 'SERVICE_FAMILY' ? 'IS_A' : 'INCLUDES');
        setItem({
            ...item,
            childDependencies: [
                ...item.childDependencies,
                {
                    id: `temp-${Date.now()}`,
                    childId: childItem.id,
                    type: depType,
                    quantityMultiplier: 1,
                    childItem: { id: childItem.id, name: childItem.name, sku: childItem.sku }
                }
            ]
        });
        setSearchQuery('');
        setSearchResults([]);
    };

    const updateDependencyMultiplier = (index: number, value: number) => {
        if (!item) return;
        const newList = [...item.childDependencies];
        newList[index] = { ...newList[index], quantityMultiplier: value };
        setItem({ ...item, childDependencies: newList });
    };

    const removeDependency = (index: number) => {
        if (!item) return;
        const newList = item.childDependencies.filter((_, i) => i !== index);
        setItem({ ...item, childDependencies: newList });
    };

    const toggleAttribute = (termId: string) => {
        if (!item) return;
        const index = item.attributes.findIndex(a => a.taxonomyTermId === termId);
        if (index > -1) {
            const newList = item.attributes.filter((_, i) => i !== index);
            setItem({ ...item, attributes: newList });
        } else {
            const term = taxonomyTerms.find(t => t.id === termId);
            if (!term) return;
            setItem({
                ...item,
                attributes: [
                    ...item.attributes,
                    {
                        id: `temp-${Date.now()}`,
                        taxonomyTermId: termId,
                        term: { id: term.id, name: term.label, category: term.category }
                    }
                ]
            });
        }
    };

    const updatePricing = (field: keyof CatalogItem['pricing'][0], value: any) => {
        if (!item || !item.pricing[0]) return;
        const newPricing = [...item.pricing];
        newPricing[0] = { ...newPricing[0], [field]: value };
        setItem({ ...item, pricing: newPricing });
    };

    // --- Visibility Logic ---
    const getVisibilityRules = (panelName: string) => {
        const terms = taxonomyTerms.filter(t => t.category === `PANEL_${panelName}`);
        return terms.map(t => t.value).filter((v): v is string => !!v);
    };

    const isPanelVisible = (panelName: string) => {
        if (!item) return false;
        const allowedTypes = getVisibilityRules(panelName);
        return allowedTypes.includes(item.type);
    };

    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
    );

    if (!item) return <div>Item not found</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between sticky top-0 bg-slate-50/80 backdrop-blur-md py-4 z-10 border-b border-slate-200 -mx-4 px-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/catalog">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ChevronLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {id === 'new' ? 'Create New Item' : `Edit ${item.name}`}
                        </h1>
                        <p className="text-sm text-slate-500 font-mono italic">{id === 'new' ? 'New SKU' : item.sku}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {status && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium animate-in fade-in slide-in-from-right-4 ${
                            status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                            {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            {status.message}
                        </div>
                    )}
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-600/20"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText size={18} className="text-blue-500" />
                            <h2 className="font-bold text-slate-900">Core Identification</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">SKU</label>
                                <Input 
                                    value={item.sku} 
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setItem({...item, sku: e.target.value})}
                                    placeholder="e.g. NET-SDWAN-001"
                                    className="bg-slate-50 border-slate-200"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</label>
                                <Input 
                                    value={item.name} 
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setItem({...item, name: e.target.value})}
                                    placeholder="e.g. Meraki SD-WAN Managed"
                                    className="bg-slate-50 border-slate-200"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Short Description</label>
                            <Input 
                                value={item.shortDescription || ''} 
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setItem({...item, shortDescription: e.target.value})}
                                placeholder="One-line summary for UI displays"
                                className="bg-slate-50 border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detailed Description</label>
                            <Textarea 
                                value={item.detailedDescription || ''} 
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setItem({...item, detailedDescription: e.target.value})}
                                placeholder="Full technical and commercial details..."
                                className="min-h-[150px] bg-slate-50 border-slate-200"
                            />
                        </div>
                    </section>

                    {/* Constraints & Assumptions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Constraints</h2>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => addListDetail('constraints')}>
                                    <Plus size={16} />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {item.constraints.map((c, i) => (
                                    <div key={c.id} className="flex gap-2">
                                        <Textarea 
                                            value={c.description} 
                                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateListDetail('constraints', i, e.target.value)}
                                            className="text-xs bg-slate-50 border-slate-200 min-h-[60px]"
                                            placeholder="Requirement or limitation..."
                                        />
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-slate-400 hover:text-rose-500 h-8 self-center"
                                            onClick={() => removeListDetail('constraints', i)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                ))}
                                {item.constraints.length === 0 && (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">No constraints defined.</p>
                                )}
                            </div>
                        </section>

                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Assumptions</h2>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => addListDetail('assumptions')}>
                                    <Plus size={16} />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {item.assumptions.map((a, i) => (
                                    <div key={a.id} className="flex gap-2">
                                        <Textarea 
                                            value={a.description} 
                                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateListDetail('assumptions', i, e.target.value)}
                                            className="text-xs bg-slate-50 border-slate-200 min-h-[60px]"
                                            placeholder="Pre-requisite or assumption..."
                                        />
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-slate-400 hover:text-rose-500 h-8 self-center"
                                            onClick={() => removeListDetail('assumptions', i)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                ))}
                                {item.assumptions.length === 0 && (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">No assumptions defined.</p>
                                )}
                            </div>
                        </section>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Item Type & Metadata */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Classification</label>
                            <select 
                                value={item.type}
                                onChange={(e) => setItem({...item, type: e.target.value})}
                                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium text-slate-900"
                            >
                                <option value="SERVICE_FAMILY">Service Family</option>
                                <option value="SERVICE_OPTION">Service Option</option>
                                <option value="PACKAGE">Design Package</option>
                                <option value="CONNECTIVITY">Connectivity</option>
                                <option value="MANAGED_SERVICE">Managed Service</option>
                                <option value="HARDWARE">Hardware</option>
                            </select>
                        </div>
                    </section>

                    {/* Pricing Methodology */}
                    {isPanelVisible('PRICING') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Pricing Configuration</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Model</label>
                                    <select 
                                        value={item.pricing[0]?.pricingModel || 'FLAT'}
                                        onChange={(e) => updatePricing('pricingModel', e.target.value)}
                                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                                    >
                                        <option value="FLAT">Flat Rate</option>
                                        <option value="TIERED">Tiered</option>
                                        <option value="PER_UNIT">Per Unit</option>
                                        <option value="USAGE_BASED">Usage Based</option>
                                        <option value="PERCENTAGE">Percentage</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default MRC</label>
                                        <Input 
                                            type="number"
                                            value={item.pricing[0]?.costMrc || 0}
                                            onChange={(e) => updatePricing('costMrc', parseFloat(e.target.value) || 0)}
                                            className="h-8 text-xs bg-slate-50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default NRC</label>
                                        <Input 
                                            type="number"
                                            value={item.pricing[0]?.costNrc || 0}
                                            onChange={(e) => updatePricing('costNrc', parseFloat(e.target.value) || 0)}
                                            className="h-8 text-xs bg-slate-50"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Service Options */}
                    {isPanelVisible('SERVICE_OPTIONS') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">
                                    {item.type === 'SERVICE_FAMILY' ? 'Service Options' : 'Included Services'}
                                </h2>
                            </div>
                            
                            {/* Search for new dependency */}
                            <div className="relative">
                                <div className="flex gap-2 mb-3">
                                    <Input 
                                        value={searchQuery}
                                        onChange={(e) => searchItems(e.target.value)}
                                        placeholder="Search..."
                                        className="text-xs h-8 bg-slate-50"
                                    />
                                </div>
                                
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 divide-y divide-slate-100">
                                        {searchResults.map(res => (
                                            <button 
                                                key={res.id}
                                                onClick={() => addDependency(res, item.type === 'SERVICE_FAMILY' ? 'IS_A' : 'INCLUDES')}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between group transition-colors rounded-lg"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-mono text-slate-400">{res.sku}</p>
                                                    <p className="text-xs font-bold text-slate-700 truncate">{res.name}</p>
                                                </div>
                                                <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {isSearching && <div className="absolute right-3 top-2"><Loader2 size={12} className="animate-spin text-blue-500" /></div>}
                            </div>

                            <div className="space-y-2">
                                {item.childDependencies
                                    .map((d, i) => {
                                        if (d.type !== 'IS_A' && d.type !== 'INCLUDES') return null;
                                        return (
                                            <div key={d.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50 border-dashed">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-mono text-slate-400">{d.childItem.sku}</p>
                                                    <p className="text-xs font-bold text-slate-700 truncate">{d.childItem.name}</p>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-500"
                                                    onClick={() => removeDependency(i)}
                                                >
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                {item.childDependencies.filter(d => d.type === 'IS_A' || d.type === 'INCLUDES').length === 0 && (
                                    <p className="text-xs text-slate-400 italic py-2 text-center text-balance">
                                        No {item.type === 'SERVICE_FAMILY' ? 'options' : 'services'} linked.
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Attachments & Licensing */}
                    {isPanelVisible('ATTACHMENTS') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Attachments & Licensing</h2>
                            </div>
                            
                            <div className="relative">
                                <Input
                                    value={attachmentQuery}
                                    onChange={(e) => searchAttachments(e.target.value)}
                                    placeholder="Search to attach..."
                                    className="text-xs h-8 bg-slate-50"
                                />
                                {isAttachmentSearching && <div className="absolute right-3 top-2"><Loader2 size={12} className="animate-spin text-blue-500" /></div>}
                                {attachmentResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 divide-y divide-slate-100">
                                        {attachmentResults.map(res => (
                                            <div key={res.id} className="p-1">
                                                <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Attach as:</p>
                                                <div className="grid grid-cols-2 gap-1">
                                                    <button
                                                        onClick={() => { addDependency(res, 'MANDATORY_ATTACHMENT'); setAttachmentQuery(''); setAttachmentResults([]); }}
                                                        className="text-[10px] font-bold py-1 px-2 bg-rose-50 text-rose-600 rounded hover:bg-rose-100 text-center"
                                                    >
                                                        Mandatory
                                                    </button>
                                                    <button
                                                        onClick={() => { addDependency(res, 'RECOMMENDS'); setAttachmentQuery(''); setAttachmentResults([]); }}
                                                        className="text-[10px] font-bold py-1 px-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-center"
                                                    >
                                                        Recommends
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                {item.childDependencies
                                    .map((d, i) => {
                                        if (d.type !== 'MANDATORY_ATTACHMENT' && d.type !== 'RECOMMENDS') return null;
                                        return (
                                            <div key={d.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 space-y-2">
                                                <div className="flex items-start justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <span className={`text-[8px] font-bold px-1 rounded ${
                                                                d.type === 'MANDATORY_ATTACHMENT' 
                                                                ? 'bg-rose-100 text-rose-600' 
                                                                : 'bg-blue-100 text-blue-600'
                                                            }`}>
                                                                {d.type === 'MANDATORY_ATTACHMENT' ? 'MANDATORY' : 'RECOMMENDED'}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-slate-400">{d.childItem.sku}</span>
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-700 truncate">{d.childItem.name}</p>
                                                    </div>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-6 w-6 p-0 text-slate-300 hover:text-rose-500"
                                                        onClick={() => removeDependency(i)}
                                                    >
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[9px] font-bold text-slate-400 uppercase">Qty Multiplier</label>
                                                    <Input 
                                                        type="number"
                                                        value={d.quantityMultiplier}
                                                        onChange={(e) => updateDependencyMultiplier(i, parseInt(e.target.value) || 1)}
                                                        className="h-6 w-16 text-[10px] px-1.5"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </section>
                    )}
                    
                    {/* Features & Capabilities */}
                    {isPanelVisible('FEATURES') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Features & Capabilities</h2>
                                {isTaxonomyLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
                            </div>
                            
                            <div className="space-y-4">
                                {/* Group terms by category */}
                                {Array.from(new Set(taxonomyTerms.filter(t => !t.category.startsWith('PANEL_')).map(t => t.category))).map(category => (
                                    <div key={category} className="space-y-2">
                                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{category}</h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {taxonomyTerms.filter(t => t.category === category).map(term => {
                                                const isActive = item.attributes.some(a => a.taxonomyTermId === term.id);
                                                return (
                                                    <button
                                                        key={term.id}
                                                        type="button"
                                                        onClick={() => toggleAttribute(term.id)}
                                                        className={`text-[10px] px-2 py-1 rounded-full transition-all border ${
                                                            isActive 
                                                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' 
                                                            : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                                                        }`}
                                                    >
                                                        {term.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                                {taxonomyTerms.length === 0 && !isTaxonomyLoading && (
                                    <p className="text-xs text-slate-400 italic py-2 text-center">No taxonomy terms found.</p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Collateral */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="font-bold text-slate-900">Collateral</h2>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={addCollateral}>
                                <Plus size={16} />
                            </Button>
                        </div>
                        <div className="space-y-3">
                            {item.collaterals.map((c, i) => (
                                <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Input 
                                            value={c.title} 
                                            onChange={(e) => updateCollateral(i, 'title', e.target.value)}
                                            placeholder="Title (e.g. Datasheet)"
                                            className="text-xs h-7 bg-white"
                                        />
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0"
                                            onClick={() => removeCollateral(i)}
                                        >
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>
                                    <Input 
                                        value={c.documentUrl} 
                                        onChange={(e) => updateCollateral(i, 'documentUrl', e.target.value)}
                                        placeholder="URL (Drive, SharePoint, etc.)"
                                        className="text-[10px] h-6 bg-white"
                                    />
                                    <select 
                                        value={c.type}
                                        onChange={(e) => updateCollateral(i, 'type', e.target.value)}
                                        className="w-full text-[10px] h-6 rounded-md border border-slate-200 bg-white px-2"
                                    >
                                        <option value="PDF">PDF</option>
                                        <option value="DOC">DOC</option>
                                        <option value="SLIDES">SLIDES</option>
                                        <option value="VIDEO">VIDEO</option>
                                        <option value="LINK">LINK</option>
                                    </select>
                                </div>
                            ))}
                            {item.collaterals.length === 0 && (
                                <p className="text-xs text-slate-400 italic py-2 text-center">No documents linked.</p>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
