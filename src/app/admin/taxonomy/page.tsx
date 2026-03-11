'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Search,
    Filter,
    Trash2,
    Edit3,
    Check,
    X,
    Loader2
} from 'lucide-react';

interface TaxonomyTerm {
    id: string;
    category: string;
    label: string;
    value: string;
}

const PANEL_CATEGORIES = [
    'PANEL_PRICING',
    'PANEL_ATTACHMENTS',
    'PANEL_SERVICE_OPTIONS',
    'PANEL_FEATURES'
];

const ITEM_TYPES = [
    'SERVICE_FAMILY',
    'HARDWARE',
    'MANAGED_SERVICE',
    'CONNECTIVITY',
    'PACKAGE',
    'SERVICE_OPTION'
];

export default function TaxonomyPage() {
    const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('ALL');

    // Form State
    const [form, setForm] = useState<Partial<TaxonomyTerm>>({
        category: '',
        label: '',
        value: ''
    });

    useEffect(() => {
        fetchTerms();
    }, []);

    async function fetchTerms() {
        try {
            const res = await fetch('/api/admin/taxonomy');
            const data = await res.json();
            setTerms(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const categories = ['ALL', ...Array.from(new Set(terms.map(t => t.category)))];

    const filteredTerms = terms.filter(t => {
        const matchesSearch = t.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = activeCategory === 'ALL' || t.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const handleEdit = (term: TaxonomyTerm) => {
        setEditingId(term.id);
        setForm(term);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/taxonomy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            if (res.ok) {
                await fetchTerms();
                setEditingId(null);
                setForm({ category: '', label: '', value: '' });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this taxonomy term? This may affect catalog items that use it.')) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/taxonomy?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTerms(prev => prev.filter(t => t.id !== id));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Taxonomy Manager</h2>
                    <p className="text-slate-600">Manage the lookup tables and metadata categories.</p>
                </div>
                <Button onClick={() => setEditingId('new')} className="gap-2">
                    <Plus size={16} /> New Term
                </Button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                        placeholder="Search label or category..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    <Filter size={18} className="text-slate-500 shrink-0" />
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${activeCategory === cat
                                    ? 'bg-blue-600 text-slate-900'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-600'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Interface */}
            <div className="rounded-xl border border-slate-200 bg-white/50 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-white text-slate-600 uppercase text-[10px] tracking-widest font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Label</th>
                            <th className="px-6 py-4">Value (Database Entry)</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {/* New Record Inline Row */}
                        {editingId === 'new' && (
                            <tr className="bg-blue-500/5 transition-colors">
                                <td className="px-6 py-4">
                                    <select 
                                        value={form.category} 
                                        onChange={e => setForm({ ...form, category: e.target.value.toUpperCase() })} 
                                        className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                                    >
                                        <option value="">Select Category...</option>
                                        <optgroup label="Panel Visibility">
                                            {PANEL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </optgroup>
                                        <optgroup label="Other">
                                            {Array.from(new Set(terms.map(t => t.category))).filter(c => !PANEL_CATEGORIES.includes(c)).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                            <option value="CUSTOM">+ New Category...</option>
                                        </optgroup>
                                    </select>
                                    {form.category === 'CUSTOM' && (
                                        <Input 
                                            placeholder="Enter Custom Category" 
                                            className="h-8 mt-1" 
                                            onChange={e => setForm({ ...form, category: e.target.value.toUpperCase() })} 
                                        />
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <Input placeholder="Human Label" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="h-8" />
                                </td>
                                <td className="px-6 py-4">
                                    {PANEL_CATEGORIES.includes(form.category || '') ? (
                                        <select
                                            value={form.value || ''}
                                            onChange={e => setForm({ ...form, value: e.target.value })}
                                            className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                                        >
                                            <option value="">Select Item Type...</option>
                                            {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    ) : (
                                        <Input placeholder="Technical Value" value={form.value || ''} onChange={e => setForm({ ...form, value: e.target.value })} className="h-8" />
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="text-red-500 border-red-500/20 hover:bg-red-500/10">
                                            <X size={14} />
                                        </Button>
                                        <Button onClick={handleSave} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                            <Check size={14} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {loading && terms.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    <Loader2 className="animate-spin inline mr-2" size={18} />
                                    Initializing catalog records...
                                </td>
                            </tr>
                        ) : filteredTerms.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                    No taxonomy terms matched your filter.
                                </td>
                            </tr>
                        ) : filteredTerms.map(term => (
                            <tr key={term.id} className="hover:bg-slate-100/50 transition-colors group">
                                <td className="px-6 py-4 font-medium text-slate-900 uppercase text-[11px]">
                                    {editingId === term.id ? (
                                        <select 
                                            value={form.category} 
                                            onChange={e => setForm({ ...form, category: e.target.value.toUpperCase() })} 
                                            className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                                        >
                                            {PANEL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                            {Array.from(new Set(terms.map(t => t.category))).filter(c => !PANEL_CATEGORIES.includes(c)).map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700">
                                            {term.category}
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-800">
                                    {editingId === term.id ? (
                                        <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="h-8 shadow-sm" />
                                    ) : (
                                        term.label
                                    )}
                                </td>
                                <td className="px-6 py-4 text-slate-600 font-mono text-[11px]">
                                    {editingId === term.id ? (
                                        PANEL_CATEGORIES.includes(form.category || '') ? (
                                            <select
                                                value={form.value || ''}
                                                onChange={e => setForm({ ...form, value: e.target.value })}
                                                className="w-full h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs"
                                            >
                                                {ITEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        ) : (
                                            <Input value={form.value || ''} onChange={e => setForm({ ...form, value: e.target.value })} className="h-8 shadow-sm" />
                                        )
                                    ) : (
                                        term.value || '—'
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {editingId === term.id ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)} className="text-red-500 border-red-500/20 hover:bg-red-500/10">
                                                <X size={14} />
                                            </Button>
                                            <Button onClick={handleSave} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                                                <Check size={14} />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="outline" size="sm" onClick={() => handleEdit(term)} className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900">
                                                <Edit3 size={14} />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleDelete(term.id)} className="h-8 w-8 p-0 text-slate-600 hover:text-red-500">
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
