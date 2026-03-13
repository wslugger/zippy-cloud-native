'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, ArrowRight, Package, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Step1BaseSelectionProps {
    onSelect: (item: any) => void;
    selectedId?: string;
}

export function Step1BaseSelection({ onSelect, selectedId }: Step1BaseSelectionProps) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchBases() {
            setLoading(true);
            try {
                // Fetch packages and managed services from SA-safe APIs
                const [pkgRes, svcRes] = await Promise.all([
                    fetch('/api/catalog/packages'),
                    fetch('/api/catalog/services'),
                ]);

                const packages = await pkgRes.json();
                const services = await svcRes.json();

                setItems([...(Array.isArray(packages) ? packages : []), ...(Array.isArray(services) ? services : [])]);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchBases();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-blue-500" />
                <p className="text-sm text-slate-500">Loading core services...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
                <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`text-left p-6 border-2 rounded-2xl transition-all group ${
                        selectedId === item.id 
                            ? 'border-blue-500 bg-blue-50/10' 
                            : 'border-slate-100 hover:border-slate-300 bg-white'
                    }`}
                >
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl border ${
                            selectedId === item.id 
                                ? 'bg-blue-600 border-blue-500 text-white' 
                                : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:text-blue-500 transition-colors'
                        }`}>
                            {item.type === 'PACKAGE' ? <Package size={24} /> : <Box size={24} />}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {item.name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {item.shortDescription || 'Standardized managed service offering.'}
                            </p>
                            <div className="mt-4 flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {item.type}
                                </span>
                                {item.type === 'PACKAGE' && (
                                    <span className="text-[10px] text-slate-500">
                                        {(item.packageCompositions || []).filter((row: any) => row.role === 'REQUIRED' || row.role === 'AUTO_INCLUDED').length} required / {(item.packageCompositions || []).filter((row: any) => row.role === 'OPTIONAL').length} optional
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}
