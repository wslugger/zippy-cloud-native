'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

export function FeaturesWorkspace(props: FeaturesWorkspaceProps) {
    const {
        isActive,
        terms,
        services,
        termsLoading,
        termsError,
        servicesLoading,
        servicesError,
        reloadTerms,
    } = props;
    const [featureSearchTerm, setFeatureSearchTerm] = useState('');
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
    const [featureForm, setFeatureForm] = useState<TaxonomyFormState>(EMPTY_FEATURE_FORM);
    const [featureStatus, setFeatureStatus] = useState<WorkspaceStatus | null>(null);
    const [featureSaving, setFeatureSaving] = useState(false);
    const [serviceFeatureLoading, setServiceFeatureLoading] = useState(false);
    const [serviceFeatureSaving, setServiceFeatureSaving] = useState(false);
    const [serviceFeatureStatus, setServiceFeatureStatus] = useState<WorkspaceStatus | null>(null);
    const [assignmentSearchTerm, setAssignmentSearchTerm] = useState('');
    const [serviceFeatureIdsByService, setServiceFeatureIdsByService] = useState<Record<string, string[]>>({});
    const [assignedServiceIds, setAssignedServiceIds] = useState<string[]>([]);

    const featureTerms = useMemo(() => terms.filter((term) => term.category === 'FEATURE'), [terms]);
    const filteredFeatureTerms = useMemo(() => {
        const needle = featureSearchTerm.trim().toLowerCase();
        if (!needle) return featureTerms;
        return featureTerms.filter((feature) =>
            feature.label.toLowerCase().includes(needle) || feature.value.toLowerCase().includes(needle)
        );
    }, [featureTerms, featureSearchTerm]);
    const assignedServiceIdSet = useMemo(() => new Set(assignedServiceIds), [assignedServiceIds]);
    const filteredServices = useMemo(() => {
        const needle = assignmentSearchTerm.trim().toLowerCase();
        if (!needle) return services;
        return services.filter((service) =>
            service.name.toLowerCase().includes(needle)
            || service.sku.toLowerCase().includes(needle)
            || service.type.toLowerCase().includes(needle)
        );
    }, [services, assignmentSearchTerm]);
    const assignedServices = useMemo(
        () => services.filter((service) => assignedServiceIdSet.has(service.id)),
        [services, assignedServiceIdSet]
    );

    const fetchFeatureAssignments = useCallback(async (featureId: string) => {
        setServiceFeatureLoading(true);
        setServiceFeatureStatus(null);
        try {
            const results = await Promise.all(
                services.map(async (service) => {
                    const res = await fetch(`/api/admin/catalog/${service.id}/features`);
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                        throw new Error((data as { error?: string }).error || `Failed to load features for ${service.name}`);
                    }
                    const assigned = (
                        data as { supportedFeatureTermIds?: string[]; assignedFeatureTermIds?: string[] }
                    ).supportedFeatureTermIds
                        ?? (data as { supportedFeatureTermIds?: string[]; assignedFeatureTermIds?: string[] }).assignedFeatureTermIds
                        ?? [];
                    return { serviceId: service.id, assignedFeatureIds: assigned };
                })
            );

            const nextByService = Object.fromEntries(
                results.map((result) => [result.serviceId, result.assignedFeatureIds])
            );
            const nextAssignedServiceIds = results
                .filter((result) => result.assignedFeatureIds.includes(featureId))
                .map((result) => result.serviceId);

            setServiceFeatureIdsByService(nextByService);
            setAssignedServiceIds(nextAssignedServiceIds);
        } catch (error) {
            setServiceFeatureStatus({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to load service features',
            });
            setServiceFeatureIdsByService({});
            setAssignedServiceIds([]);
        } finally {
            setServiceFeatureLoading(false);
        }
    }, [services]);

    useEffect(() => {
        if (!isActive || !editingFeatureId || editingFeatureId === 'new') return;
        void fetchFeatureAssignments(editingFeatureId);
    }, [isActive, editingFeatureId, fetchFeatureAssignments]);

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

    function toggleServiceAssignment(serviceId: string, checked: boolean) {
        setAssignedServiceIds((previous) => {
            if (checked) {
                return Array.from(new Set([...previous, serviceId]));
            }
            return previous.filter((id) => id !== serviceId);
        });
    }

    async function saveServiceFeatures() {
        if (!editingFeatureId || editingFeatureId === 'new') {
            setServiceFeatureStatus({ type: 'error', message: 'Select a saved feature first.' });
            return;
        }
        const featureId = editingFeatureId;

        setServiceFeatureSaving(true);
        setServiceFeatureStatus(null);
        try {
            const updates = services.map(async (service) => {
                const currentFeatureIds = serviceFeatureIdsByService[service.id] ?? [];
                const shouldAssign = assignedServiceIdSet.has(service.id);
                const nextFeatureIds = shouldAssign
                    ? Array.from(new Set([...currentFeatureIds, featureId]))
                    : currentFeatureIds.filter((id) => id !== featureId);

                const unchanged =
                    currentFeatureIds.length === nextFeatureIds.length
                    && currentFeatureIds.every((id, index) => id === nextFeatureIds[index]);
                if (unchanged) return;

                const res = await fetch(`/api/admin/catalog/${service.id}/features`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ featureTermIds: nextFeatureIds }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error((data as { error?: string }).error || `Failed to save features for ${service.name}`);
                }
            });
            await Promise.all(updates);

            setServiceFeatureStatus({
                type: 'success',
                message: `Assignments saved for ${assignedServiceIds.length} service${assignedServiceIds.length === 1 ? '' : 's'}.`,
            });
            await fetchFeatureAssignments(featureId);
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
                                    disabled={serviceFeatureSaving || services.length === 0}
                                    className="h-7"
                                >
                                    {serviceFeatureSaving ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Save size={12} className="mr-1" />}
                                    Save Assignment
                                </Button>
                            </div>

                            {serviceFeatureStatus && <InlineNotice variant={serviceFeatureStatus.type} message={serviceFeatureStatus.message} />}
                            <div className="space-y-2">
                                <p className="text-[11px] text-slate-600">
                                    Assigned to <span className="font-semibold text-slate-900">{assignedServices.length}</span> service{assignedServices.length === 1 ? '' : 's'}
                                </p>
                                {servicesLoading && (
                                    <p className="text-[11px] text-slate-500">
                                        <Loader2 size={11} className="inline mr-1 animate-spin" />
                                        Loading services...
                                    </p>
                                )}
                                {servicesError && <p className="text-[11px] text-rose-600">{servicesError}</p>}
                                {assignedServices.length > 0 ? (
                                    <div className="rounded-md border border-slate-200 bg-white p-2 max-h-28 overflow-auto">
                                        <ul className="space-y-1">
                                            {assignedServices.map((service) => (
                                                <li key={`assigned-${service.id}`} className="text-xs text-slate-700">
                                                    <span className="font-semibold text-slate-900">{service.name}</span> ({service.sku}) - {service.type}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-500">No service assignments yet.</p>
                                )}
                            </div>

                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                                <Input
                                    value={assignmentSearchTerm}
                                    onChange={(event) => setAssignmentSearchTerm(event.target.value)}
                                    placeholder="Search services..."
                                    className="pl-7 h-8 text-xs bg-white"
                                />
                            </div>

                            {serviceFeatureLoading ? (
                                <p className="text-xs text-slate-500">
                                    <Loader2 size={12} className="inline mr-1 animate-spin" /> Loading service features...
                                </p>
                            ) : (
                                <div className="rounded-md border border-slate-200 bg-white max-h-56 overflow-auto">
                                    {filteredServices.length === 0 ? (
                                        <p className="text-xs text-slate-500 p-3">No services match your search.</p>
                                    ) : (
                                        <ul className="divide-y divide-slate-100">
                                            {filteredServices.map((service) => (
                                                <li key={`service-assign-${service.id}`} className="p-2">
                                                    <label className="text-xs text-slate-700 flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={assignedServiceIdSet.has(service.id)}
                                                            onChange={(event) => toggleServiceAssignment(service.id, event.target.checked)}
                                                        />
                                                        <span>
                                                            <span className="font-semibold text-slate-900">{service.name}</span> ({service.sku}) - {service.type}
                                                        </span>
                                                    </label>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
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
