'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import {
    EMPTY_DESIGN_OPTION_FORM,
    type DesignOptionDefinition,
    type DesignOptionFormState,
    type DesignOptionValue,
    type DesignOptionsResponse,
    type DesignOptionsWorkspaceProps,
    type WorkspaceStatus,
} from '../types';
import { normalizeDesignOptionKey, parseList, sanitizeList } from '../utils';
import { InlineNotice } from '../components/inline-notice';

export function DesignOptionsWorkspace({
    isActive,
}: DesignOptionsWorkspaceProps) {
    const [designOptions, setDesignOptions] = useState<DesignOptionDefinition[]>([]);
    const [designSearchTerm, setDesignSearchTerm] = useState('');
    const [designLoading, setDesignLoading] = useState(true);
    const [designSaving, setDesignSaving] = useState(false);
    const [designStatus, setDesignStatus] = useState<WorkspaceStatus | null>(null);

    const [editingDesignOptionId, setEditingDesignOptionId] = useState<string | null>(null);
    const [designOptionForm, setDesignOptionForm] = useState<DesignOptionFormState>(EMPTY_DESIGN_OPTION_FORM);
    const [autoGenerateKey, setAutoGenerateKey] = useState(true);

    const filteredDesignOptions = useMemo(() => {
        const needle = designSearchTerm.trim().toLowerCase();
        if (!needle) return designOptions;
        return designOptions.filter((option) =>
            option.label.toLowerCase().includes(needle) || option.key.toLowerCase().includes(needle)
        );
    }, [designOptions, designSearchTerm]);

    useEffect(() => {
        void fetchDesignOptions();
    }, []);

    async function fetchDesignOptions() {
        setDesignLoading(true);
        setDesignStatus(null);
        try {
            const res = await fetch('/api/admin/design-options');
            const payload = (await res.json().catch(() => ({}))) as Partial<DesignOptionsResponse> & { error?: string };
            if (!res.ok) {
                throw new Error(payload.error || 'Failed to load design options');
            }
            setDesignOptions(payload.options ?? []);
        } catch (error) {
            console.error(error);
            setDesignStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to load design options',
            });
        } finally {
            setDesignLoading(false);
        }
    }

    function resetDesignOptionForm() {
        setEditingDesignOptionId(null);
        setDesignOptionForm({ ...EMPTY_DESIGN_OPTION_FORM });
        setAutoGenerateKey(true);
    }

    function startEditDesignOption(option: DesignOptionDefinition) {
        setEditingDesignOptionId(option.id);
        setDesignOptionForm({
            key: option.key,
            label: option.label,
            values:
                option.values.length > 0
                    ? option.values.map((value, index) => ({
                        id: value.id,
                        value: value.value,
                        label: value.label,
                        autoKey: normalizeDesignOptionKey(value.label) === value.value,
                        description: value.description ?? '',
                        constraints: [...(value.constraints ?? [])],
                        assumptions: [...(value.assumptions ?? [])],
                        sortOrder: value.sortOrder ?? index,
                        isActive: value.isActive ?? true,
                    }))
                    : [{ value: '', label: '', autoKey: true, description: '', constraints: [], assumptions: [], sortOrder: 0, isActive: true }],
        });
        setAutoGenerateKey(false);
        setDesignStatus(null);
    }

    function addDesignOptionValue() {
        setDesignOptionForm((previous) => ({
            ...previous,
            values: [
                ...previous.values,
                {
                    value: '',
                    label: '',
                    autoKey: true,
                    description: '',
                    constraints: [],
                    assumptions: [],
                    sortOrder: previous.values.length,
                    isActive: true,
                },
            ],
        }));
    }

    function updateDesignOptionValue(index: number, patch: Partial<DesignOptionValue>) {
        setDesignOptionForm((previous) => ({
            ...previous,
            values: previous.values.map((value, valueIndex) =>
                valueIndex === index ? { ...value, ...patch } : value
            ),
        }));
    }

    function removeDesignOptionValue(index: number) {
        setDesignOptionForm((previous) => ({
            ...previous,
            values: previous.values
                .filter((_, valueIndex) => valueIndex !== index)
                .map((value, valueIndex) => ({ ...value, sortOrder: valueIndex })),
        }));
    }

    async function saveDesignOptionDefinition() {
        const key = normalizeDesignOptionKey(designOptionForm.key || designOptionForm.label);
        const label = designOptionForm.label.trim();
        const values = designOptionForm.values
            .map((value, index) => ({
                value: normalizeDesignOptionKey(value.value || value.label),
                label: value.label.trim(),
                description: value.description?.trim() || null,
                constraints: sanitizeList(value.constraints ?? []),
                assumptions: sanitizeList(value.assumptions ?? []),
                sortOrder: index,
                isActive: value.isActive ?? true,
            }))
            .filter((value) => value.value && value.label);

        if (!key || !label || values.length === 0) {
            setDesignStatus({ type: 'error', message: 'Design option key, label, and at least one value are required.' });
            return;
        }

        setDesignSaving(true);
        setDesignStatus(null);
        try {
            const method = editingDesignOptionId ? 'PATCH' : 'POST';
            const payload = {
                ...(editingDesignOptionId ? { id: editingDesignOptionId } : {}),
                key,
                label,
                description: null,
                constraints: [],
                assumptions: [],
                valueType: 'STRING',
                isActive: true,
                values,
            };

            const res = await fetch('/api/admin/design-options', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((data as { error?: string }).error || 'Failed to save design option');
            }

            setDesignStatus({
                type: 'success',
                message: editingDesignOptionId ? 'Design option updated.' : 'Design option created.',
            });
            resetDesignOptionForm();
            await fetchDesignOptions();
        } catch (error) {
            console.error(error);
            setDesignStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save design option',
            });
        } finally {
            setDesignSaving(false);
        }
    }

    if (!isActive) return null;

    return (
        <section className="space-y-6">
            <div>
                <h3 className="text-2xl font-bold tracking-tight">Design Option Definitions</h3>
                <p className="text-slate-600 font-medium">Create and maintain reusable design option definitions and values.</p>
            </div>

            {designStatus && <InlineNotice variant={designStatus.type} size="md" message={designStatus.message} />}

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
                <aside className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 lg:sticky lg:top-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Design Options</p>
                        <Button size="sm" variant="outline" onClick={resetDesignOptionForm}>
                            <Plus size={12} className="mr-1" /> New
                        </Button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <Input
                            value={designSearchTerm}
                            onChange={(event) => setDesignSearchTerm(event.target.value)}
                            placeholder="Search options..."
                            className="pl-7 h-8 text-xs"
                        />
                    </div>

                    <p className="text-[11px] text-slate-500">{filteredDesignOptions.length} options</p>

                    <div className="max-h-[65vh] overflow-auto space-y-2 pr-1">
                        {designLoading ? (
                            <div className="text-sm text-slate-500 py-6 text-center">
                                <Loader2 size={14} className="animate-spin inline mr-2" /> Loading design options...
                            </div>
                        ) : filteredDesignOptions.length === 0 ? (
                            <p className="text-sm text-slate-500">No design option definitions yet.</p>
                        ) : (
                            filteredDesignOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => startEditDesignOption(option)}
                                    className={`w-full text-left rounded-lg border p-3 transition-colors ${editingDesignOptionId === option.id
                                        ? 'border-zippy-green bg-zippy-green-light'
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                        }`}
                                >
                                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                    <p className="text-xs text-slate-600">{option.key}</p>
                                    <p className="text-[11px] text-slate-500 mt-1">{option.values.length} values</p>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                            {editingDesignOptionId ? 'Edit Design Option' : 'Create Design Option'}
                        </p>
                        {editingDesignOptionId && (
                            <Button size="sm" variant="ghost" onClick={resetDesignOptionForm}>Clear</Button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Key</label>
                            <Input
                                value={designOptionForm.key}
                                onChange={(event) => {
                                    const nextKey = event.target.value;
                                    setDesignOptionForm((previous) => ({ ...previous, key: nextKey }));
                                    if (!editingDesignOptionId) {
                                        setAutoGenerateKey(nextKey.trim().length === 0);
                                    }
                                }}
                                placeholder="topology"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Label</label>
                            <Input
                                value={designOptionForm.label}
                                onChange={(event) => {
                                    const nextLabel = event.target.value;
                                    setDesignOptionForm((previous) => ({
                                        ...previous,
                                        label: nextLabel,
                                        key: !editingDesignOptionId && autoGenerateKey
                                            ? normalizeDesignOptionKey(nextLabel)
                                            : previous.key,
                                    }));
                                }}
                                placeholder="Topology"
                            />
                        </div>
                    </div>
                    {!editingDesignOptionId && autoGenerateKey && (
                        <p className="text-[11px] text-slate-500">
                            Key is auto-generated from label. Edit key to override.
                        </p>
                    )}

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-600">Values (description/constraints/assumptions are per value)</label>
                            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={addDesignOptionValue}>
                                <Plus size={12} />
                            </Button>
                        </div>
                        {designOptionForm.values.map((value, index) => (
                            <div key={`value-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                                <div className="grid grid-cols-[1fr_1fr_auto] gap-1 items-center">
                                    <Input
                                        value={value.label}
                                        onChange={(event) => {
                                            const nextLabel = event.target.value;
                                            updateDesignOptionValue(index, {
                                                label: nextLabel,
                                                value: value.autoKey === false ? value.value : normalizeDesignOptionKey(nextLabel),
                                            });
                                        }}
                                        placeholder="Value label (e.g. Hub and Spoke)"
                                        className="h-8"
                                    />
                                    <Input
                                        value={value.value}
                                        onChange={(event) => {
                                            const nextValue = event.target.value;
                                            updateDesignOptionValue(index, {
                                                value: nextValue,
                                                autoKey: nextValue.trim().length === 0,
                                            });
                                        }}
                                        placeholder="value_key (e.g. hub_and_spoke)"
                                        className="h-8"
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 p-0 text-rose-500"
                                        onClick={() => removeDesignOptionValue(index)}
                                        disabled={designOptionForm.values.length === 1}
                                    >
                                        <Trash2 size={12} />
                                    </Button>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Value key auto-generates from value label until manually edited.
                                </p>
                                <Textarea
                                    value={value.description || ''}
                                    onChange={(event) => updateDesignOptionValue(index, { description: event.target.value })}
                                    placeholder="Value description"
                                    className="min-h-[70px]"
                                />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <Textarea
                                        value={(value.constraints ?? []).join('\n')}
                                        onChange={(event) => updateDesignOptionValue(index, { constraints: parseList(event.target.value) })}
                                        placeholder="Constraints (one per line)"
                                        className="min-h-[70px]"
                                    />
                                    <Textarea
                                        value={(value.assumptions ?? []).join('\n')}
                                        onChange={(event) => updateDesignOptionValue(index, { assumptions: parseList(event.target.value) })}
                                        placeholder="Assumptions (one per line)"
                                        className="min-h-[70px]"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-800">Assignments now live on catalog items</p>
                        <p className="text-xs text-amber-700">
                            Define options here, then assign them from <span className="font-semibold">Admin &gt; Catalog &gt; open item &gt; Design Options for This Item</span>.
                        </p>
                    </div>

                    <Button onClick={saveDesignOptionDefinition} disabled={designSaving} className="w-full gap-2">
                        {designSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {editingDesignOptionId ? 'Update Design Option' : 'Create Design Option'}
                    </Button>
                </div>
            </div>
        </section>
    );
}
