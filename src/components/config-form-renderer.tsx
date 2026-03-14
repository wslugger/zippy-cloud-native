'use client';

import { Input } from '@/components/ui/input';

interface ConfigFormRendererProps {
    schema: Record<string, any> | null;
    values: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
}

export function ConfigFormRenderer({ schema, values, onChange }: ConfigFormRendererProps) {
    if (!schema?.properties || Object.keys(schema.properties).length === 0) {
        return null;
    }

    function set(key: string, val: any) {
        onChange({ ...values, [key]: val });
    }

    return (
        <div className="space-y-3">
            {Object.entries(schema.properties).map(([key, prop]: [string, any]) => {
                const label = prop.title ?? key;
                const description = prop.description;
                const value = values[key] ?? prop.default ?? '';

                return (
                    <div key={key} className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</label>
                        {description && <p className="text-[10px] text-slate-600">{description}</p>}

                        {prop.enum ? (
                            <select
                                value={value}
                                onChange={e => set(key, e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 focus:ring-1 focus:ring-zippy-green outline-none"
                            >
                                <option value="">Select...</option>
                                {prop.enum.map((v: string, i: number) => (
                                    <option key={v} value={v}>
                                        {prop.enumLabels?.[i] ?? v}
                                    </option>
                                ))}
                            </select>
                        ) : prop.type === 'boolean' ? (
                            <button
                                type="button"
                                onClick={() => set(key, !value)}
                                className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-slate-200'}`}
                            >
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                        ) : prop.type === 'number' ? (
                            <Input
                                type="number"
                                value={value}
                                onChange={e => set(key, Number(e.target.value))}
                                className="bg-slate-50"
                            />
                        ) : (
                            <Input
                                value={value}
                                onChange={e => set(key, e.target.value)}
                                className="bg-slate-50"
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
