'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ConfigField {
    name: string;
    label: string;
    type: 'boolean' | 'enum' | 'number';
    options?: { label: string; value: string }[];
    min?: number;
    max?: number;
    step?: number;
    description?: string;
    defaultValue?: unknown;
}

interface ConfigFormRendererProps {
    schema: {
        fields: ConfigField[];
    } | null;
    values: Record<string, unknown>;
    onChange: (values: Record<string, unknown>) => void;
    optionConstraints?: Record<
        string,
        {
            forcedValues?: string[];
            forbiddenValues?: string[];
            allowOnlyValues?: string[];
        }
    >;
}

export function ConfigFormRenderer({ schema, values, onChange, optionConstraints = {} }: ConfigFormRendererProps) {
    if (!schema || !schema.fields) return null;

    const handleChange = (name: string, value: unknown) => {
        onChange({ ...values, [name]: value });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {schema.fields.map((field) => (
                <div key={field.name} className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Label htmlFor={field.name} className="text-sm font-bold text-slate-700">
                                {field.label}
                            </Label>
                            {field.description && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info size={14} className="text-slate-400 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p className="text-xs">{field.description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    </div>

                    {field.type === 'boolean' && (
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-xs text-slate-500">
                                {values[field.name] ? 'Enabled' : 'Disabled'}
                            </span>
                            <Switch 
                                id={field.name}
                                checked={values[field.name] || false}
                                onCheckedChange={(checked: boolean) => handleChange(field.name, checked)}
                            />
                        </div>
                    )}

                    {field.type === 'enum' && (() => {
                        const constraints = optionConstraints[field.name] || {};
                        const forcedSet = new Set(constraints.forcedValues || []);
                        const forbiddenSet = new Set(constraints.forbiddenValues || []);
                        const allowOnlySet = new Set(constraints.allowOnlyValues || []);
                        const hasAllowOnly = allowOnlySet.size > 0;
                        const hasForced = forcedSet.size > 0;
                        const selectedValue = String(values[field.name] || field.defaultValue || "");

                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {field.options?.map((opt) => {
                                    const blockedByAllowOnly = hasAllowOnly && !allowOnlySet.has(opt.value);
                                    const forbidden = forbiddenSet.has(opt.value) || blockedByAllowOnly;
                                    const forcedMismatch = hasForced && !forcedSet.has(opt.value);
                                    const disabled = forbidden || forcedMismatch;
                                    const isSelected = selectedValue === opt.value;
                                    const forced = forcedSet.has(opt.value);

                                    let reason = '';
                                    if (forbiddenSet.has(opt.value)) reason = 'Forbidden by package policy';
                                    else if (blockedByAllowOnly) reason = 'Not allowed by package policy';
                                    else if (forcedMismatch) reason = 'Locked to forced package value';

                                    const button = (
                                        <button
                                            type="button"
                                            onClick={() => !disabled && handleChange(field.name, opt.value)}
                                            disabled={disabled}
                                            className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                                isSelected
                                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                    : disabled
                                                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'
                                            }`}
                                        >
                                            <p className="text-xs font-semibold">{opt.label}</p>
                                            {forced && (
                                                <p className="mt-1 text-[10px] text-blue-700">Forced by package</p>
                                            )}
                                        </button>
                                    );

                                    if (!disabled) return <div key={opt.value}>{button}</div>;

                                    return (
                                        <TooltipProvider key={opt.value}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>{button}</TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="text-xs">{reason}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        );
                    })()}

                    {field.type === 'number' && (
                        <div className="space-y-4 pt-2">
                            {(() => {
                                const rawValue = values[field.name];
                                const numericValue = typeof rawValue === 'number'
                                    ? rawValue
                                    : typeof field.defaultValue === 'number'
                                        ? field.defaultValue
                                        : 0;
                                return (
                                    <>
                            <div className="flex justify-between items-center px-1">
                                <span className="text-xs text-slate-400 italic">Range: {field.min} - {field.max}</span>
                                <span className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                    {numericValue}
                                </span>
                            </div>
                            <Slider
                                defaultValue={[numericValue]}
                                max={field.max}
                                min={field.min}
                                step={field.step || 1}
                                onValueChange={(val: number[]) => handleChange(field.name, val[0])}
                                className="py-2"
                            />
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
