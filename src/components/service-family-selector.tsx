'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Layers, Loader2 } from 'lucide-react';
import { ConfigFormRenderer } from './config-form-renderer';

interface CatalogItem {
    id: string;
    sku: string;
    name: string;
    type: string;
    description?: string;
    configSchema?: Record<string, any> | null;
    attributes?: any[];
    pricing?: any[];
}

interface ServiceFamily {
    id: string;
    sku: string;
    name: string;
    description?: string;
    options: CatalogItem[];
}

interface Selection {
    itemId: string;
    configValues: Record<string, any>;
}

interface ServiceFamilySelectorProps {
    selectedIds: string[];
    onSelectionChange: (selections: Selection[]) => void;
    primaryServiceId?: string;
    onPrimaryChange?: (id: string) => void;
}

export function ServiceFamilySelector({
    selectedIds,
    onSelectionChange,
    primaryServiceId,
    onPrimaryChange,
}: ServiceFamilySelectorProps) {
    const [families, setFamilies] = useState<ServiceFamily[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
    const [selections, setSelections] = useState<Map<string, Record<string, any>>>(new Map());

    const fetchFamilies = () => {
        setLoading(true);
        setError(null);
        fetch('/api/catalog/families')
            .then(r => {
                if (!r.ok) throw new Error(`Failed to load services (${r.status})`);
                return r.json();
            })
            .then(data => {
                setFamilies(data);
                if (data.length > 0) setExpandedFamily(data[0].id);
            })
            .catch(err => {
                console.error('ServiceFamilySelector fetch failed:', err);
                setError(err.message || 'Failed to load services');
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchFamilies();
    }, []);

    function toggleItem(item: CatalogItem) {
        const next = new Map(selections);
        if (next.has(item.id)) {
            next.delete(item.id);
        } else {
            next.set(item.id, {});
        }
        setSelections(next);
        emit(next);
    }

    function setConfig(itemId: string, configValues: Record<string, any>) {
        const next = new Map(selections);
        next.set(itemId, configValues);
        setSelections(next);
        emit(next);
    }

    function emit(sel: Map<string, Record<string, any>>) {
        onSelectionChange(Array.from(sel.entries()).map(([itemId, configValues]) => ({ itemId, configValues })));
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="animate-spin mr-2" size={20} /> Loading services...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-3">
                <p className="text-sm text-red-500">{error}</p>
                <button
                    type="button"
                    onClick={fetchFamilies}
                    className="text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-400 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {families.map(family => (
                <div key={family.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setExpandedFamily(expandedFamily === family.id ? null : family.id)}
                        className="w-full flex items-center justify-between p-4 hover:bg-slate-100/50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                                <Layers size={16} className="text-indigo-400" />
                            </div>
                            <div className="text-left">
                                <p className="font-bold text-slate-900 text-sm">{family.name}</p>
                                <p className="text-[10px] text-slate-500">{family.options.length} options available</p>
                            </div>
                        </div>
                        <ChevronRight
                            size={16}
                            className={`text-slate-500 transition-transform ${expandedFamily === family.id ? 'rotate-90' : ''}`}
                        />
                    </button>

                    {expandedFamily === family.id && (
                        <div className="border-t border-slate-200 p-4 space-y-3">
                            {family.options.map(option => {
                                const isSelected = selections.has(option.id);
                                const configValues = selections.get(option.id) ?? {};
                                const isPrimary = primaryServiceId === option.id;

                                return (
                                    <div
                                        key={option.id}
                                        className={`border rounded-xl p-4 transition-all ${
                                            isSelected
                                                ? 'border-blue-500/40 bg-blue-500/5'
                                                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div
                                                className="flex items-start gap-3 flex-1 cursor-pointer"
                                                onClick={() => toggleItem(option)}
                                            >
                                                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                                }`}>
                                                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">{option.name}</p>
                                                    <p className="text-[10px] font-mono text-blue-500">{option.sku}</p>
                                                    {option.description && (
                                                        <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {isSelected && onPrimaryChange && (
                                                <button
                                                    type="button"
                                                    onClick={() => onPrimaryChange(isPrimary ? '' : option.id)}
                                                    className={`text-[9px] font-bold px-2 py-0.5 rounded border shrink-0 transition-colors ${
                                                        isPrimary
                                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                                            : 'bg-slate-100 border-slate-300 text-slate-500 hover:border-slate-600'
                                                    }`}
                                                >
                                                    {isPrimary ? 'PRIMARY' : 'SET PRIMARY'}
                                                </button>
                                            )}
                                        </div>

                                        {isSelected && option.configSchema && (
                                            <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-2">
                                                <p className="text-[9px] uppercase font-bold tracking-widest text-slate-600">
                                                    Design Options
                                                </p>
                                                <ConfigFormRenderer
                                                    schema={option.configSchema}
                                                    values={configValues}
                                                    onChange={v => setConfig(option.id, v)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
