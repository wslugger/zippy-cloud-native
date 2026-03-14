'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Workflow,
    Plus,
    Trash2,
    ArrowRight,
    AlertCircle,
    Loader2,
    Settings2
} from 'lucide-react';

interface Rule {
    id: string;
    type: string;
    quantityMultiplier: number;
    parentItem: { name: string; sku: string };
    childItem: { name: string; sku: string };
}

interface CatalogItem {
    id: string;
    name: string;
    sku: string;
}

export default function RulesPage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [parentId, setParentId] = useState('');
    const [childId, setChildId] = useState('');
    const [type, setType] = useState('REQUIRES');
    const [multiplier, setMultiplier] = useState('1');

    useEffect(() => {
        Promise.all([fetchRules(), fetchCatalog()]);
    }, []);

    async function fetchRules() {
        const res = await fetch('/api/admin/rules');
        const data = await res.json();
        setRules(data);
        setLoading(false);
    }

    async function fetchCatalog() {
        const res = await fetch('/api/admin/catalog');
        const data = await res.json();
        setCatalogItems(data.items || []);
    }

    const handleCreateRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!parentId || !childId) return;

        try {
            const res = await fetch('/api/admin/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ parentId, childId, type, quantityMultiplier: multiplier }),
            });
            if (res.ok) {
                fetchRules();
                setParentId('');
                setChildId('');
            }
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-zippy-green" size={32} />
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Calculator Rules</h2>
                <p className="text-slate-600">Establish logical dependencies and bundling rules across your catalog.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Creation Form */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 h-fit sticky top-8">
                    <div className="flex items-center gap-3 mb-6">
                        <Settings2 className="text-blue-400" size={20} />
                        <h3 className="font-bold text-lg">Define New Logic</h3>
                    </div>

                    <form onSubmit={handleCreateRule} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Parent Item (Trigger)</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:ring-1 focus:ring-zippy-green outline-none"
                                value={parentId}
                                onChange={(e) => setParentId(e.target.value)}
                            >
                                <option value="">Select Trigger Item...</option>
                                {catalogItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-center py-2 text-slate-700">
                            <ArrowRight size={20} />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Child Item (Effect)</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:ring-1 focus:ring-zippy-green outline-none"
                                value={childId}
                                onChange={(e) => setChildId(e.target.value)}
                            >
                                <option value="">Select Target Item...</option>
                                {catalogItems.map(item => (
                                    <option key={item.id} value={item.id}>{item.name} ({item.sku})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Relationship</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700"
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                >
                                    <option value="REQUIRES">REQUIRES</option>
                                    <option value="INCLUDES">INCLUDES</option>
                                    <option value="MANDATORY_ATTACHMENT">MANDATORY</option>
                                    <option value="OPTIONAL_ATTACHMENT">OPTIONAL</option>
                                    <option value="INCOMPATIBLE">INCOMPATIBLE</option>
                                    <option value="RECOMMENDS">RECOMMENDS</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Multiplier</label>
                                <Input
                                    type="number"
                                    value={multiplier}
                                    onChange={(e) => setMultiplier(e.target.value)}
                                    className="bg-slate-50"
                                    placeholder="1"
                                />
                            </div>
                        </div>

                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3 text-xs text-blue-400">
                            <AlertCircle size={16} className="shrink-0" />
                            This rule will be evaluated by the BOM engine for all future quotes.
                        </div>

                        <Button type="submit" className="w-full" disabled={!parentId || !childId}>
                            Commit Logic Rule
                        </Button>
                    </form>
                </div>

                {/* Existing Rules List */}
                <div className="lg:col-span-2 space-y-4">
                    {rules.length > 0 ? (
                        rules.map((rule) => (
                            <div key={rule.id} className="bg-white/50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between group hover:border-slate-300 transition-all">
                                <div className="flex items-center gap-6">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <Workflow size={20} className="text-zippy-green" />
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-slate-900">{rule.parentItem.name}</p>
                                            <p className="text-[10px] font-mono text-slate-500 uppercase">{rule.parentItem.sku}</p>
                                        </div>

                                        <div className="flex flex-col items-center px-4">
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded border mb-1 ${
                                                rule.type === 'REQUIRES' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                rule.type === 'INCLUDES' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                                rule.type === 'INCOMPATIBLE' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                                                rule.type === 'RECOMMENDS' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                                                'bg-slate-100 border-slate-300 text-slate-600'
                                            }`}>
                                                {rule.type}
                                            </span>
                                            <ArrowRight size={14} className="text-slate-700" />
                                            <span className="text-[9px] text-slate-600 font-bold mt-1">x{rule.quantityMultiplier}</span>
                                        </div>

                                        <div className="space-y-0.5">
                                            <p className="text-sm font-bold text-slate-900">{rule.childItem.name}</p>
                                            <p className="text-[10px] font-mono text-slate-500 uppercase">{rule.childItem.sku}</p>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={async () => {
                                        await fetch(`/api/admin/rules?id=${rule.id}`, { method: 'DELETE' });
                                        fetchRules();
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg text-slate-500"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="h-64 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-200 rounded-3xl">
                            <Workflow size={48} className="opacity-20 mb-2" />
                            <p>No calculator rules defined yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
