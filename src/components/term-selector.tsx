'use client';

const TERMS = [
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
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Term</span>
            <div className="flex gap-1">
                {TERMS.map(t => (
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
