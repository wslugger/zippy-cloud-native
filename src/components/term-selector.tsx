'use client';

import { useState, useEffect } from 'react';

const FALLBACK_TERMS = [
    { value: 1, label: 'MTM' },
    { value: 12, label: '12 mo' },
    { value: 36, label: '36 mo' },
    { value: 60, label: '60 mo' },
];

interface TermSelectorProps {
    value: number;
    onChange: (months: number) => void;
}

export function TermSelector({ value, onChange }: TermSelectorProps) {
    const [terms, setTerms] = useState(FALLBACK_TERMS);

    useEffect(() => {
        fetch('/api/admin/taxonomy')
            .then(r => r.ok ? r.json() : null)
            .then((all: { category: string; value: string; label: string }[] | null) => {
                if (!all) return;
                const contractTerms = all
                    .filter(t => t.category === 'CONTRACT_TERM')
                    .map(t => ({ value: parseInt(t.value), label: t.label }))
                    .filter(t => !isNaN(t.value))
                    .sort((a, b) => a.value - b.value);
                if (contractTerms.length > 0) setTerms(contractTerms);
            })
            .catch(() => { /* keep fallback */ });
    }, []);

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Term</span>
            <div className="flex gap-1">
                {terms.map(t => (
                    <button
                        key={t.value}
                        type="button"
                        onClick={() => onChange(t.value)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            value === t.value
                                ? 'bg-blue-600 text-slate-900'
                                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
