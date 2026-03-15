'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Edit3, Filter, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import {
    EMPTY_TAXONOMY_FORM,
    HIDDEN_TAXONOMY_TERM_CATEGORIES,
    ITEM_TYPES,
    PANEL_CATEGORIES,
    type TaxonomyFormState,
    type TaxonomyTerm,
    type TermsWorkspaceProps,
} from '../types';
import { InlineNotice } from '../components/inline-notice';

export function TermsWorkspace({
    isActive,
    terms,
    termsLoading,
    termsError,
    clearTermsError,
    reloadTerms,
}: TermsWorkspaceProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [localError, setLocalError] = useState<string | null>(null);
    const [editingTaxonomyId, setEditingTaxonomyId] = useState<string | null>(null);
    const [taxonomyForm, setTaxonomyForm] = useState<TaxonomyFormState>(EMPTY_TAXONOMY_FORM);
    const [taxonomySaving, setTaxonomySaving] = useState(false);
    const [taxonomyDeleting, setTaxonomyDeleting] = useState(false);

    const visibleTaxonomyTerms = useMemo(
        () => terms.filter((term) => !HIDDEN_TAXONOMY_TERM_CATEGORIES.has(term.category)),
        [terms]
    );

    const categories = useMemo(() => {
        return ['ALL', ...Array.from(new Set(visibleTaxonomyTerms.map((term) => term.category)))];
    }, [visibleTaxonomyTerms]);

    const filteredTerms = useMemo(() => {
        return visibleTaxonomyTerms.filter((term) => {
            const needle = searchTerm.toLowerCase();
            const matchesSearch =
                term.label.toLowerCase().includes(needle) ||
                term.category.toLowerCase().includes(needle) ||
                term.value.toLowerCase().includes(needle);
            const matchesCategory = activeCategory === 'ALL' || term.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [visibleTaxonomyTerms, searchTerm, activeCategory]);

    const displayedError = localError ?? termsError;
    const tableLoading = termsLoading || taxonomyDeleting;
    const isPanelCategory = PANEL_CATEGORIES.includes(taxonomyForm.category as (typeof PANEL_CATEGORIES)[number]);

    function beginNewTaxonomyTerm() {
        setEditingTaxonomyId('new');
        setTaxonomyForm({ ...EMPTY_TAXONOMY_FORM });
        setLocalError(null);
    }

    function beginEditTaxonomyTerm(term: TaxonomyTerm) {
        setEditingTaxonomyId(term.id);
        setTaxonomyForm({
            id: term.id,
            category: term.category,
            label: term.label,
            value: term.value,
            lifecycleStatus: term.lifecycleStatus,
            description: term.description ?? '',
            constraintsText: '',
            assumptionsText: '',
        });
        setLocalError(null);
    }

    function cancelTaxonomyEdit() {
        setEditingTaxonomyId(null);
        setTaxonomyForm({ ...EMPTY_TAXONOMY_FORM });
    }

    async function saveTaxonomyTerm() {
        if (!taxonomyForm.category.trim() || !taxonomyForm.value.trim()) {
            setLocalError('Category and value are required.');
            return;
        }

        if (isPanelCategory && !ITEM_TYPES.includes(taxonomyForm.value as (typeof ITEM_TYPES)[number])) {
            setLocalError('Panel visibility terms must use a valid catalog item type value.');
            return;
        }

        setTaxonomySaving(true);
        setLocalError(null);
        try {
            const normalizedCategory = taxonomyForm.category.trim();
            const normalizedValue = taxonomyForm.value.trim();
            const duplicateTerm = terms.find((term) =>
                term.category === normalizedCategory &&
                term.value === normalizedValue &&
                term.id !== (editingTaxonomyId && editingTaxonomyId !== 'new' ? editingTaxonomyId : '')
            );

            if (duplicateTerm) {
                setEditingTaxonomyId(duplicateTerm.id);
                setTaxonomyForm({
                    id: duplicateTerm.id,
                    category: duplicateTerm.category,
                    label: duplicateTerm.label,
                    value: duplicateTerm.value,
                    lifecycleStatus: duplicateTerm.lifecycleStatus,
                    description: duplicateTerm.description ?? '',
                    constraintsText: '',
                    assumptionsText: '',
                });
                setLocalError('A rule for this category and item type already exists. The existing rule was opened for editing.');
                setTaxonomySaving(false);
                return;
            }

            const normalizedLabel = isPanelCategory
                ? `${normalizedCategory.replace('PANEL_', '').replaceAll('_', ' ')} for ${normalizedValue.replaceAll('_', ' ')}`
                : taxonomyForm.label.trim();

            if (!normalizedLabel) {
                setLocalError('Label is required.');
                setTaxonomySaving(false);
                return;
            }

            const payload = {
                ...(editingTaxonomyId && editingTaxonomyId !== 'new' ? { id: editingTaxonomyId } : {}),
                category: normalizedCategory,
                label: normalizedLabel,
                value: normalizedValue,
                description: taxonomyForm.description.trim() || null,
            };

            const res = await fetch('/api/admin/taxonomy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                const errorMessage = (data as { error?: string }).error || 'Failed to save taxonomy term';
                if (errorMessage.toLowerCase().includes('duplicate')) {
                    const currentDuplicate = terms.find((term) =>
                        term.category === normalizedCategory &&
                        term.value === normalizedValue
                    );
                    if (currentDuplicate) {
                        beginEditTaxonomyTerm(currentDuplicate);
                    }
                    setLocalError('A rule for this category and item type already exists. Edit or delete the existing one instead.');
                    setTaxonomySaving(false);
                    return;
                }
                throw new Error(errorMessage);
            }

            await reloadTerms();
            cancelTaxonomyEdit();
        } catch (error) {
            console.error(error);
            setLocalError(error instanceof Error ? error.message : 'Failed to save taxonomy term');
        } finally {
            setTaxonomySaving(false);
        }
    }

    async function deleteTaxonomyTerm(id: string) {
        if (!confirm('Delete this taxonomy term? This may affect catalog items that use it.')) return;

        setTaxonomyDeleting(true);
        setLocalError(null);
        try {
            const res = await fetch(`/api/admin/taxonomy?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error || 'Failed to delete taxonomy term');
            }
            await reloadTerms();
        } catch (error) {
            console.error(error);
            setLocalError(error instanceof Error ? error.message : 'Failed to delete taxonomy term');
        } finally {
            setTaxonomyDeleting(false);
        }
    }

    if (!isActive) return null;

    return (
        <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-2xl font-bold tracking-tight">Taxonomy Terms</h3>
                    <p className="text-slate-600 font-medium">Lookup terms and panel visibility metadata.</p>
                    <p className="text-xs text-slate-500 mt-1">
                        For `PANEL_*` categories: value must be the item type (`MANAGED_SERVICE`, `CONNECTIVITY`, etc.). Add term to show panel; delete term to hide panel.
                    </p>
                </div>
                <Button onClick={beginNewTaxonomyTerm} className="gap-2 bg-slate-900 hover:bg-slate-800">
                    <Plus size={16} /> New Term
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <Input
                        placeholder="Search label, category, or value..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    <Filter size={18} className="text-slate-500 shrink-0" />
                    {categories.map((category) => (
                        <button
                            key={category}
                            onClick={() => setActiveCategory(category)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${activeCategory === category
                                ? 'bg-zippy-green text-white'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-600'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {displayedError && (
                <InlineNotice
                    variant="error"
                    size="md"
                    message={displayedError}
                    onDismiss={() => {
                        if (localError) {
                            setLocalError(null);
                        } else {
                            clearTermsError();
                        }
                    }}
                />
            )}

            {editingTaxonomyId && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Category</label>
                            <Input
                                value={taxonomyForm.category}
                                onChange={(event) => setTaxonomyForm((previous) => ({ ...previous, category: event.target.value.toUpperCase() }))}
                                placeholder="CATEGORY"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Value</label>
                            {isPanelCategory ? (
                                <select
                                    value={taxonomyForm.value}
                                    onChange={(event) => setTaxonomyForm((previous) => ({ ...previous, value: event.target.value }))}
                                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-2 text-sm"
                                >
                                    <option value="">Select Item Type...</option>
                                    {ITEM_TYPES.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    value={taxonomyForm.value}
                                    onChange={(event) => setTaxonomyForm((previous) => ({ ...previous, value: event.target.value }))}
                                    placeholder="Technical value"
                                />
                            )}
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Label</label>
                            <Input
                                value={taxonomyForm.label}
                                onChange={(event) => setTaxonomyForm((previous) => ({ ...previous, label: event.target.value }))}
                                placeholder={isPanelCategory ? 'Auto-generated for panel visibility terms' : 'Display label'}
                                disabled={isPanelCategory}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Description</label>
                            <Input
                                value={taxonomyForm.description}
                                onChange={(event) => setTaxonomyForm((previous) => ({ ...previous, description: event.target.value }))}
                                placeholder="Short description"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" onClick={cancelTaxonomyEdit} disabled={taxonomySaving}>
                            <X size={14} className="mr-1" /> Cancel
                        </Button>
                        <Button onClick={saveTaxonomyTerm} disabled={taxonomySaving}>
                            {taxonomySaving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Check size={14} className="mr-1" />}
                            Save Term
                        </Button>
                    </div>
                </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white/50 overflow-hidden shadow-2xl">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-white text-slate-600 uppercase text-[10px] tracking-widest font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Label</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Value</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                        {tableLoading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                    <Loader2 className="animate-spin inline mr-2" size={16} /> Loading taxonomy terms...
                                </td>
                            </tr>
                        ) : filteredTerms.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-10 text-center text-slate-500">No taxonomy terms matched your filter.</td>
                            </tr>
                        ) : (
                            filteredTerms.map((term) => (
                                <tr
                                    key={term.id}
                                    className="hover:bg-slate-100/60 transition-colors group cursor-pointer"
                                    onClick={() => beginEditTaxonomyTerm(term)}
                                >
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700">
                                            {term.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{term.label}</td>
                                    <td className="px-6 py-4 text-slate-600 text-xs max-w-[22rem] truncate">{term.description || '—'}</td>
                                    <td className="px-6 py-4 font-mono text-[11px] text-slate-700">{term.value}</td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    beginEditTaxonomyTerm(term);
                                                }}
                                                className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                                            >
                                                <Edit3 size={14} />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    deleteTaxonomyTerm(term.id);
                                                }}
                                                className="h-8 w-8 p-0 text-slate-600 hover:text-rose-500"
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
