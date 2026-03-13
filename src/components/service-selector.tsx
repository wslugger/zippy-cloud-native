'use client';

import { useEffect, useState } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { ConfigFormRenderer } from './config-form-renderer';

interface CatalogItem {
    id: string;
    sku: string;
    name: string;
    type: string;
    description?: string;
    configSchema?: Record<string, unknown> | null;
}

interface Selection {
    itemId: string;
    configValues: Record<string, unknown>;
}

interface ServiceSelectorProps {
    selectedIds: string[];
    onSelectionChange: (selections: Selection[]) => void;
    primaryServiceId?: string;
    onPrimaryChange?: (id: string) => void;
}

export function ServiceSelector({
    selectedIds,
    onSelectionChange,
    primaryServiceId,
    onPrimaryChange,
}: ServiceSelectorProps) {
    const [services, setServices] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selections, setSelections] = useState<Map<string, Record<string, unknown>>>(
        () => new Map(selectedIds.map((itemId) => [itemId, {}]))
    );

    const fetchServices = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/catalog/services');
            if (!response.ok) throw new Error(`Failed to load services (${response.status})`);
            const data = await response.json();
            setServices(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('ServiceSelector fetch failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to load services');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        async function loadServices() {
            try {
                const response = await fetch('/api/catalog/services');
                if (!response.ok) throw new Error(`Failed to load services (${response.status})`);
                const data = await response.json();
                if (mounted) {
                    setServices(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('ServiceSelector fetch failed:', err);
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load services');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        void loadServices();
        return () => {
            mounted = false;
        };
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

    function setConfig(itemId: string, configValues: Record<string, unknown>) {
        const next = new Map(selections);
        next.set(itemId, configValues);
        setSelections(next);
        emit(next);
    }

    function emit(selectionMap: Map<string, Record<string, unknown>>) {
        onSelectionChange(Array.from(selectionMap.entries()).map(([itemId, configValues]) => ({ itemId, configValues })));
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
                    onClick={fetchServices}
                    className="text-xs font-bold px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-400 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {services.map((service) => {
                const isSelected = selections.has(service.id);
                const configValues = selections.get(service.id) ?? {};
                const isPrimary = primaryServiceId === service.id;

                return (
                    <div
                        key={service.id}
                        className={`border rounded-xl p-4 transition-all ${
                            isSelected
                                ? 'border-blue-500/40 bg-blue-500/5'
                                : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div
                                className="flex items-start gap-3 flex-1 cursor-pointer"
                                onClick={() => toggleItem(service)}
                            >
                                <div
                                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                    }`}
                                >
                                    {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20">
                                        <Layers size={16} className="text-indigo-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{service.name}</p>
                                        <p className="text-[10px] font-mono text-blue-500">{service.sku}</p>
                                        {service.description && (
                                            <p className="text-xs text-slate-500 mt-1">{service.description}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isSelected && onPrimaryChange && (
                                <button
                                    type="button"
                                    onClick={() => onPrimaryChange(isPrimary ? '' : service.id)}
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

                        {isSelected && service.configSchema && (
                            <div className="mt-4 pt-4 border-t border-slate-200/50 space-y-2">
                                <p className="text-[9px] uppercase font-bold tracking-widest text-slate-600">
                                    Design Options
                                </p>
                                <ConfigFormRenderer
                                    schema={service.configSchema}
                                    values={configValues}
                                    onChange={(values) => setConfig(service.id, values)}
                                />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
