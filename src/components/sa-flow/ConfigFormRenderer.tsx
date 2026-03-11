'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
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
    defaultValue?: any;
}

interface ConfigFormRendererProps {
    schema: {
        fields: ConfigField[];
    } | null;
    values: Record<string, any>;
    onChange: (values: Record<string, any>) => void;
}

export function ConfigFormRenderer({ schema, values, onChange }: ConfigFormRendererProps) {
    if (!schema || !schema.fields) return null;

    const handleChange = (name: string, value: any) => {
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

                    {field.type === 'enum' && (
                        <Select
                            value={values[field.name] || field.defaultValue || ""}
                            onValueChange={(val: string) => handleChange(field.name, val)}
                        >
                            <SelectTrigger id={field.name} className="w-full bg-white rounded-xl border-slate-200">
                                <SelectValue placeholder="Select option..." />
                            </SelectTrigger>
                            <SelectContent>
                                {field.options?.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {field.type === 'number' && (
                        <div className="space-y-4 pt-2">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-xs text-slate-400 italic">Range: {field.min} - {field.max}</span>
                                <span className="text-sm font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                    {values[field.name] || field.defaultValue || 0}
                                </span>
                            </div>
                            <Slider
                                defaultValue={[values[field.name] || field.defaultValue || 0]}
                                max={field.max}
                                min={field.min}
                                step={field.step || 1}
                                onValueChange={(val: number[]) => handleChange(field.name, val[0])}
                                className="py-2"
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
