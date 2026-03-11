'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

type FieldType = 'string' | 'number' | 'boolean' | 'enum';

interface EnumOption {
    value: string;
    label: string;
}

interface FieldDef {
    key: string;
    title: string;
    type: FieldType;
    description?: string;
    defaultValue?: string;
    required: boolean;
    options: EnumOption[]; // only used when type === 'enum'
}

function fieldToSchema(field: FieldDef): Record<string, any> {
    const prop: Record<string, any> = { type: field.type === 'enum' ? 'string' : field.type };
    if (field.title) prop.title = field.title;
    if (field.description) prop.description = field.description;
    if (field.type === 'enum' && field.options.length > 0) {
        prop.enum = field.options.map(o => o.value);
        prop.enumLabels = field.options.map(o => o.label);
    }
    if (field.defaultValue !== undefined && field.defaultValue !== '') {
        prop.default = field.type === 'number' ? Number(field.defaultValue)
            : field.type === 'boolean' ? field.defaultValue === 'true'
            : field.defaultValue;
    }
    return prop;
}

function schemaToFields(schema: any): FieldDef[] {
    if (!schema?.properties) return [];
    const required: string[] = schema.required ?? [];
    return Object.entries(schema.properties).map(([key, prop]: [string, any]) => ({
        key,
        title: prop.title ?? key,
        type: prop.enum ? 'enum' : (prop.type as FieldType) ?? 'string',
        description: prop.description ?? '',
        defaultValue: prop.default !== undefined ? String(prop.default) : '',
        required: required.includes(key),
        options: prop.enum
            ? prop.enum.map((v: string, i: number) => ({ value: v, label: prop.enumLabels?.[i] ?? v }))
            : [],
    }));
}

function fieldsToSchema(fields: FieldDef[]): Record<string, any> {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const f of fields) {
        if (!f.key) continue;
        properties[f.key] = fieldToSchema(f);
        if (f.required) required.push(f.key);
    }
    return { type: 'object', properties, ...(required.length > 0 ? { required } : {}) };
}

function emptyField(): FieldDef {
    return { key: '', title: '', type: 'string', description: '', defaultValue: '', required: false, options: [] };
}

interface ConfigSchemaBuilderProps {
    value?: Record<string, any> | null;
    onChange: (schema: Record<string, any> | null) => void;
}

export function ConfigSchemaBuilder({ value, onChange }: ConfigSchemaBuilderProps) {
    const [fields, setFields] = useState<FieldDef[]>(() => schemaToFields(value));

    useEffect(() => {
        setFields(schemaToFields(value));
    }, []);

    function update(newFields: FieldDef[]) {
        setFields(newFields);
        const schema = fieldsToSchema(newFields);
        onChange(Object.keys(schema.properties ?? {}).length > 0 ? schema : null);
    }

    function addField() {
        update([...fields, emptyField()]);
    }

    function removeField(i: number) {
        update(fields.filter((_, idx) => idx !== i));
    }

    function moveField(i: number, dir: -1 | 1) {
        const next = [...fields];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        update(next);
    }

    function setField(i: number, patch: Partial<FieldDef>) {
        const next = fields.map((f, idx) => idx === i ? { ...f, ...patch } : f);
        update(next);
    }

    function addOption(i: number) {
        const f = fields[i];
        setField(i, { options: [...f.options, { value: '', label: '' }] });
    }

    function setOption(fieldIdx: number, optIdx: number, patch: Partial<EnumOption>) {
        const f = fields[fieldIdx];
        const opts = f.options.map((o, i) => i === optIdx ? { ...o, ...patch } : o);
        setField(fieldIdx, { options: opts });
    }

    function removeOption(fieldIdx: number, optIdx: number) {
        const f = fields[fieldIdx];
        setField(fieldIdx, { options: f.options.filter((_, i) => i !== optIdx) });
    }

    return (
        <div className="space-y-3">
            {fields.length === 0 && (
                <div className="text-center py-6 text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-xl">
                    No fields defined. Add one below.
                </div>
            )}

            {fields.map((field, i) => (
                <div key={i} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <GripVertical size={14} className="text-slate-700 shrink-0" />
                        <div className="grid grid-cols-2 gap-2 flex-1">
                            <Input
                                placeholder="key (e.g. topology)"
                                value={field.key}
                                onChange={e => setField(i, { key: e.target.value })}
                                className="bg-slate-900 text-xs font-mono"
                            />
                            <Input
                                placeholder="Title (e.g. Topology)"
                                value={field.title}
                                onChange={e => setField(i, { title: e.target.value })}
                                className="bg-slate-900 text-xs"
                            />
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <button onClick={() => moveField(i, -1)} className="p-1 text-slate-600 hover:text-slate-300">
                                <ChevronUp size={14} />
                            </button>
                            <button onClick={() => moveField(i, 1)} className="p-1 text-slate-600 hover:text-slate-300">
                                <ChevronDown size={14} />
                            </button>
                            <button onClick={() => removeField(i)} className="p-1 text-slate-600 hover:text-red-400">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Type</label>
                            <select
                                value={field.type}
                                onChange={e => setField(i, { type: e.target.value as FieldType, options: [] })}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 outline-none"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="enum">Dropdown</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Default</label>
                            {field.type === 'boolean' ? (
                                <select
                                    value={field.defaultValue}
                                    onChange={e => setField(i, { defaultValue: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 outline-none"
                                >
                                    <option value="">None</option>
                                    <option value="true">true</option>
                                    <option value="false">false</option>
                                </select>
                            ) : (
                                <Input
                                    placeholder="Default value"
                                    value={field.defaultValue}
                                    onChange={e => setField(i, { defaultValue: e.target.value })}
                                    className="bg-slate-900 text-xs"
                                />
                            )}
                        </div>
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Required</label>
                            <div className="flex items-center h-9">
                                <button
                                    type="button"
                                    onClick={() => setField(i, { required: !field.required })}
                                    className={`relative w-10 h-5 rounded-full transition-colors ${field.required ? 'bg-blue-600' : 'bg-slate-700'}`}
                                >
                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${field.required ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <Input
                        placeholder="Description (optional)"
                        value={field.description}
                        onChange={e => setField(i, { description: e.target.value })}
                        className="bg-slate-900 text-xs"
                    />

                    {field.type === 'enum' && (
                        <div className="space-y-2">
                            <label className="text-[9px] uppercase font-bold tracking-widest text-slate-600">Options</label>
                            {field.options.map((opt, oi) => (
                                <div key={oi} className="flex gap-2 items-center">
                                    <Input
                                        placeholder="value"
                                        value={opt.value}
                                        onChange={e => setOption(i, oi, { value: e.target.value })}
                                        className="bg-slate-900 text-xs font-mono flex-1"
                                    />
                                    <Input
                                        placeholder="label"
                                        value={opt.label}
                                        onChange={e => setOption(i, oi, { label: e.target.value })}
                                        className="bg-slate-900 text-xs flex-1"
                                    />
                                    <button onClick={() => removeOption(i, oi)} className="text-slate-600 hover:text-red-400 shrink-0">
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={() => addOption(i)}
                                className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
                            >
                                <Plus size={12} /> Add option
                            </button>
                        </div>
                    )}
                </div>
            ))}

            <Button type="button" variant="ghost" onClick={addField} className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-white gap-2">
                <Plus size={14} /> Add Field
            </Button>
        </div>
    );
}
