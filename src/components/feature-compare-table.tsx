'use client';

import { CheckCircle2, XCircle } from 'lucide-react';

interface Term {
    termId: string;
    category: string;
    value: string;
    label: string;
}

interface CompareItem {
    id: string;
    sku: string;
    name: string;
    type: string;
    features: { termId: string; has: boolean }[];
}

interface FeatureCompareTableProps {
    terms: Term[];
    items: CompareItem[];
}

export function FeatureCompareTable({ terms, items }: FeatureCompareTableProps) {
    if (items.length === 0 || terms.length === 0) return null;

    const features = terms.filter(t => t.category === 'FEATURE');
    const slas = terms.filter(t => t.category === 'SLA');

    function hasFeature(item: CompareItem, termId: string) {
        return item.features.find(f => f.termId === termId)?.has ?? false;
    }

    function renderRow(term: Term) {
        return (
            <tr key={term.termId} className="border-b border-slate-800 hover:bg-slate-900/30">
                <td className="py-2 px-4 text-xs text-slate-400">{term.label}</td>
                {items.map(item => (
                    <td key={item.id} className="py-2 px-4 text-center">
                        {hasFeature(item, term.termId)
                            ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" />
                            : <XCircle size={16} className="text-slate-700 mx-auto" />
                        }
                    </td>
                ))}
            </tr>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                        <th className="text-left py-3 px-4 text-[10px] uppercase font-bold tracking-widest text-slate-500 w-48">
                            Attribute
                        </th>
                        {items.map(item => (
                            <th key={item.id} className="py-3 px-4 text-center">
                                <div className="text-xs font-bold text-white">{item.name}</div>
                                <div className="text-[10px] font-mono text-blue-500">{item.sku}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {features.length > 0 && (
                        <>
                            <tr className="bg-slate-900/80">
                                <td colSpan={items.length + 1} className="py-1.5 px-4 text-[9px] uppercase font-bold tracking-widest text-slate-600">
                                    Features
                                </td>
                            </tr>
                            {features.map(renderRow)}
                        </>
                    )}
                    {slas.length > 0 && (
                        <>
                            <tr className="bg-slate-900/80">
                                <td colSpan={items.length + 1} className="py-1.5 px-4 text-[9px] uppercase font-bold tracking-widest text-slate-600">
                                    SLA
                                </td>
                            </tr>
                            {slas.map(renderRow)}
                        </>
                    )}
                </tbody>
            </table>
        </div>
    );
}
