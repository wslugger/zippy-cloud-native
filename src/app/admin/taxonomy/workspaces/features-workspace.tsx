'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Save, Search } from 'lucide-react';
import {
    EMPTY_FEATURE_FORM,
    type FeaturesWorkspaceProps,
    type TaxonomyFormState,
    type TaxonomyTerm,
    type WorkspaceStatus,
} from '../types';
import { normalizeDesignOptionKey, parseList } from '../utils';
import { InlineNotice } from '../components/inline-notice';
import { ServiceSelector } from '../components/service-selector';

export function FeaturesWorkspace({
    isActive,
    terms,
    services,
    selectedServiceId,
    setSelectedServiceId,
    termsLoading,
    termsError,
    servicesLoading,
    servicesError,
    reloadTerms,
}: FeaturesWorkspaceProps) {
    const [featureSearchTerm, setFeatureSearchTerm] = useState('');
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
    const [featureForm, setFeatureForm] = useState<TaxonomyFormState>(EMPTY_FEATURE_FORM);
    const [featureStatus, setFeatureStatus] = useState<WorkspaceStatus | null>(null);
    const [featureSaving, setFeatureSaving] = useState(false);
    const [serviceFeatureIds, setServiceFeatureIds] = useState<string[]>([]);
    const [serviceFeatureLoading, setServiceFeatureLoading] = useState(false);
    const [serviceFeatureSaving, setServiceFeatureSaving] = useState(false);
    const [serviceFeatureStatus, setServiceFeatureStatus] = useState<WorkspaceStatus | null>(null);

    const featureTerms = useMemo(() => terms.filter((term) => term.category === 'FEATURE'), [terms]);
    const filteredFeatureTerms = useMemo(() => {
        const needle = featureSearchTerm.trim().toLowerCase();
        if (!needle) return featureTerms;
        return featureTerms.filter((feature) =>
            feature.label.toLowerCase().includes(needle) || feature.value.toLowerCase().includes(needle)
        );
    }, [featureTerms, featureSearchTerm]);

    useEffect(() => {
        if (!isActive || !selectedServiceId) return;
        void fetchServiceFeatures(selectedServiceId);
    }, [isActive, selectedServiceId]);

    function resetFeatureForm() {
        setEditingFeatureId(null);
        setFeatureForm({ ...EMPTY_FEATURE_FORM });
        setFeatureStatus(null);
    }

    function startCreateFeature() {
        setEditingFeatureId('new');
        setFeatureForm({ ...EMPTY_FEATURE_FORM });
        setFeatureStatus(null);
    }

    function startEditFeature(feature: TaxonomyTerm) {
        setEditingFeatureId(feature.id);
        setFeatureForm({
            id: feature.id,
            category: 'FEATURE',
            label: feature.label,
            value: feature.value,
            description: feature.description ?? '',
            constraintsText: (feature.constraints ?? []).join('\n'),
            assumptionsText: (feature.assumptions ?? []).join('\n'),
        });
        setFeatureStatus(null);
    }

    async function saveFeatureDefinition() {
        if (!featureForm.label.trim()) {
            setFeatureStatus({ type: 'error', message: 'Feature label is required.' });
            return;
        }

        const value = normalizeDesignOptionKey(featureForm.value || featureForm.label);
        if (!value) {
            setFeatureStatus({ type: 'error', message: 'Feature value key is required.' });
            return;
        }

        setFeatureSaving(true);
        setFeatureStatus(null);
        try {
            const payload = {
                ...(editingFeatureId && editingFeatureId !== 'new' ? { id: editingFeatureId } : {}),
                category: 'FEATURE',
                label: featureForm.label.trim(),
                value,
                description: featureForm.description.trim() || null,
                constraints: parseList(featureForm.constraintsText),
                assumptions: parseList(featureForm.assumptionsText),
            };

            const res = await fetch('/api/admin/taxonomy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((data as { error?: string }).error || 'Failed to save feature definition');
            }
            const savedFeature = data as TaxonomyTerm;

            await reloadTerms();
            setEditingFeatureId(savedFeature.id);
            setFeatureForm({
                id: savedFeature.id,
                category: 'FEATURE',
                label: savedFeature.label,
                value: savedFeature.value,
                description: savedFeature.description ?? '',
                constraintsText: (savedFeature.constraints ?? []).join('\n'),
                assumptionsText: (savedFeature.assumptions ?? []).join('\n'),
            });
            setFeatureStatus({ type: 'success', message: 'Feature definition saved.' });
        } catch (error) {
            setFeatureStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save feature definition',
            });
        } finally {
            setFeatureSaving(false);
        }
    }

    async function fetchServiceFeatures(catalogItemId: string) {
        setServiceFeatureLoading(true);
        setServiceFeatureStatus(null);
        try {
            const res = await fetch(`/api/admin/catalog/${catalogItemId}/features`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((data as { error?: string }).error || 'Failed to load service features');
            }
            setServiceFeatureIds((data as { assignedFeatureTermIds?: string[] }).assignedFeatureTermIds ?? []);
        } catch (error) {
            setServiceFeatureStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to load service features',
            });
            setServiceFeatureIds([]);
        } finally {
            setServiceFeatureLoading(false);
        }
    }

    function toggleCurrentFeatureAssignment(checked: boolean) {
        if (!editingFeatureId || editingFeatureId === 'new') return;
        const featureId = editingFeatureId;
        setServiceFeatureIds((previous) => {
            if (checked) {
                return Array.from(new Set([...previous, featureId]));
            }
            return previous.filter((id) => id !== featureId);
        });
    }

    async function saveServiceFeatures() {
        if (!selectedServiceId) {
            setServiceFeatureStatus({ type: 'error', message: 'Select a service first.' });
            return;
        }

        setServiceFeatureSaving(true);
        setServiceFeatureStatus(null);
        try {
            const res = await fetch(`/api/admin/catalog/${selectedServiceId}/features`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ featureTermIds: serviceFeatureIds }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((data as { error?: string }).error || 'Failed to save service features');
            }

            setServiceFeatureStatus({ type: 'success', message: 'Service feature assignments saved.' });
            await fetchServiceFeatures(selectedServiceId);
        } catch (error) {
            setServiceFeatureStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to save service features',
            });
        } finally {
            setServiceFeatureSaving(false);
        }
    }

    if (!isActive) return null;

    return (
        <section className="space-y-6">
            <div>
                <h3 className="text-2xl font-bold tracking-tight">Features Builder</h3>
                <p className="text-slate-600 font-medium">Define features and assign them to services.</p>
            </div>

            {termsError && <InlineNotice variant="error" message={termsError} />}

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
                <aside className="rounded-xl border border-slate-200 bg-white p-4 space-y-4 lg:sticky lg:top-4">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Features</p>
                        <Button size="sm" variant="outline" onClick={startCreateFeature}>
                            <Plus size={12} className="mr-1" /> New
                        </Button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                        <Input
                            value={featureSearchTerm}
                            onChange={(event) => setFeatureSearchTerm(event.target.value)}
                            placeholder="Search features..."
                            className="pl-7 h-8 text-xs"
                        />
                    </div>

                    <p className="text-[11px] text-slate-500">{filteredFeatureTerms.length} features</p>

                    <div className="max-h-[65vh] overflow-auto space-y-2 pr-1">
                        {termsLoading ? (
                            <p className="text-sm text-slate-500">Loading feature definitions...</p>
                        ) : filteredFeatureTerms.length === 0 ? (
                            <p className="text-sm text-slate-500">No feature definitions found.</p>
                        ) : (
                            filteredFeatureTerms.map((feature) => (
                                <button
                                    key={feature.id}
                                    type="button"
                                    onClick={() => startEditFeature(feature)}
                                    className={`w-full text-left rounded-lg border p-3 transition-colors ${editingFeatureId === feature.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                                        }`}
                                >
                                    <p className="text-sm font-semibold text-slate-900">{feature.label}</p>
                                    <p className="text-xs text-slate-600">{feature.value}</p>
                                </button>
                            ))
                        )}
                    </div>
                </aside>

                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                            {editingFeatureId ? 'Edit Feature' : 'Create Feature'}
                        </p>
                        {editingFeatureId && (
                            <Button size="sm" variant="ghost" onClick={resetFeatureForm}>Clear</Button>
                        )}
                    </div>

                    {featureStatus && <InlineNotice variant={featureStatus.type} message={featureStatus.message} />}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Feature Label</label>
                            <Input
                                value={featureForm.label}
                                onChange={(event) => setFeatureForm((previous) => ({
                                    ...previous,
                                    label: event.target.value,
                                    value: normalizeDesignOptionKey(previous.value || event.target.value),
                                }))}
                                placeholder="Managed LAN"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-600">Feature Key</label>
                            <Input
                                value={featureForm.value}
                                onChange={(event) => setFeatureForm((previous) => ({ ...previous, value: event.target.value }))}
                                placeholder="managed_lan"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Description</label>
                        <Textarea
                            value={featureForm.description}
                            onChange={(event) => setFeatureForm((previous) => ({ ...previous, description: event.target.value }))}
                            className="min-h-[70px]"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Textarea
                            value={featureForm.constraintsText}
                            onChange={(event) => setFeatureForm((previous) => ({ ...previous, constraintsText: event.target.value }))}
                            placeholder="Constraints (one per line)"
                            className="min-h-[70px]"
                        />
                        <Textarea
                            value={featureForm.assumptionsText}
                            onChange={(event) => setFeatureForm((previous) => ({ ...previous, assumptionsText: event.target.value }))}
                            placeholder="Assumptions (one per line)"
                            className="min-h-[70px]"
                        />
                    </div>

                    <Button onClick={saveFeatureDefinition} disabled={featureSaving} className="w-full gap-2">
                        {featureSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {editingFeatureId ? 'Update Feature' : 'Create Feature'}
                    </Button>

                    {editingFeatureId && editingFeatureId !== 'new' ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-700">Assign This Feature to Services</p>
                                <Button
                                    size="sm"
                                    onClick={saveServiceFeatures}
                                    disabled={serviceFeatureSaving || !selectedServiceId}
                                    className="h-7"
                                >
                                    {serviceFeatureSaving ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Save size={12} className="mr-1" />}
                                    Save Assignment
                                </Button>
                            </div>

                            {serviceFeatureStatus && <InlineNotice variant={serviceFeatureStatus.type} message={serviceFeatureStatus.message} />}

                            <ServiceSelector
                                services={services}
                                selectedServiceId={selectedServiceId}
                                setSelectedServiceId={setSelectedServiceId}
                                loading={servicesLoading}
                                error={servicesError}
                                showSelectionCaption
                            />

                            {serviceFeatureLoading ? (
                                <p className="text-xs text-slate-500">
                                    <Loader2 size={12} className="inline mr-1 animate-spin" /> Loading service features...
                                </p>
                            ) : (
                                <label className="text-xs text-slate-700 flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={serviceFeatureIds.includes(editingFeatureId)}
                                        onChange={(event) => toggleCurrentFeatureAssignment(event.target.checked)}
                                    />
                                    Assign this feature to selected service
                                </label>
                            )}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-300 p-3">
                            Save a new feature first, then its service assignment controls appear here.
                        </p>
                    )}
                </div>
            </div>
        </section>
    );
}
