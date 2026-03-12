'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Plus,
    Search,
    Filter,
    Trash2,
    Edit3,
    Check,
    X,
    Loader2,
    Save,
} from 'lucide-react';

interface TaxonomyTerm {
    id: string;
    category: string;
    label: string;
    value: string;
    description: string | null;
    constraints: string[];
    assumptions: string[];
}

interface TaxonomyFormState {
    id?: string;
    category: string;
    label: string;
    value: string;
    description: string;
    constraintsText: string;
    assumptionsText: string;
}

interface DesignOptionValue {
    id?: string;
    value: string;
    label: string;
    autoKey?: boolean;
    description?: string | null;
    constraints?: string[];
    assumptions?: string[];
    sortOrder?: number;
    isActive?: boolean;
}

interface DesignOptionDefinition {
    id: string;
    key: string;
    label: string;
    valueType: 'STRING' | 'NUMBER' | 'BOOLEAN';
    isActive: boolean;
    values: DesignOptionValue[];
}

interface DesignOptionFormState {
    key: string;
    label: string;
    values: DesignOptionValue[];
}

interface ServiceCatalogItem {
    id: string;
    sku: string;
    name: string;
    type: string;
}

interface ServiceDesignOptionRow {
    designOptionId: string;
    isRequired: boolean;
    allowMulti: boolean;
    defaultValueId: string | null;
    allowedValueIds: string[];
}

interface DesignOptionsResponse {
    options: DesignOptionDefinition[];
}

interface CatalogItemsResponse {
    items: ServiceCatalogItem[];
}

interface ServiceDesignOptionsResponse {
    options: Array<{
        designOptionId: string;
        isRequired: boolean;
        allowMulti: boolean;
        defaultValueId: string | null;
        allowedValues: Array<{ designOptionValueId: string }>;
    }>;
}

const PANEL_CATEGORIES = [
    'CLASSIFICATION',
    'PANEL_PRICING',
    'PANEL_ATTACHMENTS',
    'PANEL_SERVICE_OPTIONS',
    'PANEL_FEATURES'
];

const ITEM_TYPES = [
    'SERVICE_FAMILY',
    'HARDWARE',
    'MANAGED_SERVICE',
    'CONNECTIVITY',
    'PACKAGE',
    'SERVICE_OPTION'
];

const ASSIGNABLE_SERVICE_TYPES = ['MANAGED_SERVICE', 'SERVICE_OPTION', 'CONNECTIVITY'] as const;
const HIDDEN_TAXONOMY_TERM_CATEGORIES = new Set(['FEATURE', 'REGION', 'VENDOR']);

const EMPTY_TAXONOMY_FORM: TaxonomyFormState = {
    category: 'CLASSIFICATION',
    label: '',
    value: '',
    description: '',
    constraintsText: '',
    assumptionsText: '',
};

const EMPTY_DESIGN_OPTION_FORM: DesignOptionFormState = {
    key: '',
    label: '',
    values: [{ value: '', label: '', autoKey: true, description: '', constraints: [], assumptions: [], sortOrder: 0, isActive: true }],
};

function normalizeDesignOptionKey(key: string) {
    return key.trim().toLowerCase().replace(/\s+/g, '_');
}

function parseList(text: string): string[] {
    return text
        .split('\n')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function sanitizeList(values: string[]): string[] {
    return values.map((value) => value.trim()).filter(Boolean);
}

export default function TaxonomyPage() {
    const [workspaceTab, setWorkspaceTab] = useState<'terms' | 'design-options' | 'features'>('design-options');
    const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('ALL');
    const [error, setError] = useState<string | null>(null);

    const [editingTaxonomyId, setEditingTaxonomyId] = useState<string | null>(null);
    const [taxonomyForm, setTaxonomyForm] = useState<TaxonomyFormState>(EMPTY_TAXONOMY_FORM);
    const [taxonomySaving, setTaxonomySaving] = useState(false);

    const [designOptions, setDesignOptions] = useState<DesignOptionDefinition[]>([]);
    const [designSearchTerm, setDesignSearchTerm] = useState('');
    const [services, setServices] = useState<ServiceCatalogItem[]>([]);
    const [designLoading, setDesignLoading] = useState(true);
    const [designSaving, setDesignSaving] = useState(false);
    const [designStatus, setDesignStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const [editingDesignOptionId, setEditingDesignOptionId] = useState<string | null>(null);
    const [designOptionForm, setDesignOptionForm] = useState<DesignOptionFormState>(EMPTY_DESIGN_OPTION_FORM);
    const [autoGenerateKey, setAutoGenerateKey] = useState(true);

    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [serviceDesignOptions, setServiceDesignOptions] = useState<ServiceDesignOptionRow[]>([]);
    const [assignmentLoading, setAssignmentLoading] = useState(false);
    const [assignmentSaving, setAssignmentSaving] = useState(false);
    const [assignmentStatus, setAssignmentStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [featureSearchTerm, setFeatureSearchTerm] = useState('');
    const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null);
    const [featureForm, setFeatureForm] = useState<TaxonomyFormState>({
        category: 'FEATURE',
        label: '',
        value: '',
        description: '',
        constraintsText: '',
        assumptionsText: '',
    });
    const [featureStatus, setFeatureStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [featureSaving, setFeatureSaving] = useState(false);
    const [serviceFeatureIds, setServiceFeatureIds] = useState<string[]>([]);
    const [serviceFeatureLoading, setServiceFeatureLoading] = useState(false);
    const [serviceFeatureSaving, setServiceFeatureSaving] = useState(false);
    const [serviceFeatureStatus, setServiceFeatureStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        fetchTerms();
        fetchDesignOptionWorkspace();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!selectedServiceId) {
            setServiceDesignOptions([]);
            return;
        }
        fetchServiceDesignOptions(selectedServiceId);
    }, [selectedServiceId]);

    useEffect(() => {
        if (workspaceTab !== 'features' || !selectedServiceId) return;
        fetchServiceFeatures(selectedServiceId);
    }, [workspaceTab, selectedServiceId]);

    const visibleTaxonomyTerms = useMemo(
        () => terms.filter((term) => !HIDDEN_TAXONOMY_TERM_CATEGORIES.has(term.category)),
        [terms]
    );

    const categories = useMemo(() => {
        return ['ALL', ...Array.from(new Set(visibleTaxonomyTerms.map((term) => term.category)))];
    }, [visibleTaxonomyTerms]);

    const filteredTerms = useMemo(() => {
        return visibleTaxonomyTerms.filter((term) => {
            const matchesSearch =
                term.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                term.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                term.value.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = activeCategory === 'ALL' || term.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [visibleTaxonomyTerms, searchTerm, activeCategory]);

    const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;
    const currentOptionAssignmentIndex = getCurrentOptionAssignmentIndex();
    const currentOptionAssignment = currentOptionAssignmentIndex >= 0
        ? serviceDesignOptions[currentOptionAssignmentIndex]
        : null;
    const filteredDesignOptions = useMemo(() => {
        const needle = designSearchTerm.trim().toLowerCase();
        if (!needle) return designOptions;
        return designOptions.filter((option) =>
            option.label.toLowerCase().includes(needle) || option.key.toLowerCase().includes(needle)
        );
    }, [designOptions, designSearchTerm]);
    const featureTerms = useMemo(() => terms.filter((term) => term.category === 'FEATURE'), [terms]);
    const filteredFeatureTerms = useMemo(() => {
        const needle = featureSearchTerm.trim().toLowerCase();
        if (!needle) return featureTerms;
        return featureTerms.filter((feature) =>
            feature.label.toLowerCase().includes(needle) || feature.value.toLowerCase().includes(needle)
        );
    }, [featureTerms, featureSearchTerm]);

    async function fetchTerms() {
        try {
            setError(null);
            setLoading(true);
            const res = await fetch('/api/admin/taxonomy');
            if (!res.ok) throw new Error('Failed to fetch taxonomy terms');
            const data = (await res.json()) as TaxonomyTerm[];
            setTerms(data);
        } catch (termError) {
            console.error(termError);
            setError('Failed to load taxonomy data');
        } finally {
            setLoading(false);
        }
    }

    function beginNewTaxonomyTerm() {
        setEditingTaxonomyId('new');
        setTaxonomyForm(EMPTY_TAXONOMY_FORM);
        setError(null);
    }

    function beginEditTaxonomyTerm(term: TaxonomyTerm) {
        setEditingTaxonomyId(term.id);
        setTaxonomyForm({
            id: term.id,
            category: term.category,
            label: term.label,
            value: term.value,
            description: term.description ?? '',
            constraintsText: '',
            assumptionsText: '',
        });
        setError(null);
    }

    function cancelTaxonomyEdit() {
        setEditingTaxonomyId(null);
        setTaxonomyForm(EMPTY_TAXONOMY_FORM);
    }

    async function saveTaxonomyTerm() {
        if (!taxonomyForm.category.trim() || !taxonomyForm.label.trim() || !taxonomyForm.value.trim()) {
            setError("Category, label, and value are required.");
            return;
        }

        setTaxonomySaving(true);
        setError(null);
        try {
            const payload = {
                ...(editingTaxonomyId && editingTaxonomyId !== 'new' ? { id: editingTaxonomyId } : {}),
                category: taxonomyForm.category.trim(),
                label: taxonomyForm.label.trim(),
                value: taxonomyForm.value.trim(),
                description: taxonomyForm.description.trim() || null,
                constraints: [],
                assumptions: [],
            };

            const res = await fetch('/api/admin/taxonomy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((data as { error?: string }).error || 'Failed to save taxonomy term');
            }

            await fetchTerms();
            cancelTaxonomyEdit();
        } catch (saveError) {
            console.error(saveError);
            setError(saveError instanceof Error ? saveError.message : 'Failed to save taxonomy term');
        } finally {
            setTaxonomySaving(false);
        }
    }

    async function deleteTaxonomyTerm(id: string) {
        if (!confirm('Delete this taxonomy term? This may affect catalog items that use it.')) return;

        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/taxonomy?id=${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error((data as { error?: string }).error || 'Failed to delete taxonomy term');
            }
            setTerms((previous) => previous.filter((term) => term.id !== id));
        } catch (deleteError) {
            console.error(deleteError);
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete taxonomy term');
        } finally {
            setLoading(false);
        }
    }

    async function fetchDesignOptionWorkspace() {
        setDesignLoading(true);
        setDesignStatus(null);
        try {
            const [optionsRes, catalogRes] = await Promise.all([
                fetch('/api/admin/design-options'),
                fetch('/api/admin/catalog?limit=200'),
            ]);

            const optionPayload = (await optionsRes.json().catch(() => ({}))) as Partial<DesignOptionsResponse> & { error?: string };
            const catalogPayload = (await catalogRes.json().catch(() => ({}))) as Partial<CatalogItemsResponse> & { error?: string };

            if (!optionsRes.ok) {
                throw new Error(optionPayload.error || 'Failed to load design options');
            }
            if (!catalogRes.ok) {
                throw new Error(catalogPayload.error || 'Failed to load catalog items');
            }

            const optionList = optionPayload.options ?? [];
            const serviceList = (catalogPayload.items ?? []).filter((item) =>
                ASSIGNABLE_SERVICE_TYPES.includes(item.type as (typeof ASSIGNABLE_SERVICE_TYPES)[number])
            );

            setDesignOptions(optionList);
            setServices(serviceList);

            const nextServiceId = serviceList.some((service) => service.id === selectedServiceId)
                ? selectedServiceId
                : (serviceList[0]?.id ?? '');
            setSelectedServiceId(nextServiceId);
        } catch (workspaceError) {
            console.error(workspaceError);
            setDesignStatus({
                type: 'error',
                message: workspaceError instanceof Error ? workspaceError.message : 'Failed to load design option workspace',
            });
        } finally {
            setDesignLoading(false);
        }
    }

    function resetDesignOptionForm() {
        setEditingDesignOptionId(null);
        setDesignOptionForm(EMPTY_DESIGN_OPTION_FORM);
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
            await fetchDesignOptionWorkspace();
        } catch (saveError) {
            console.error(saveError);
            setDesignStatus({
                type: 'error',
                message: saveError instanceof Error ? saveError.message : 'Failed to save design option',
            });
        } finally {
            setDesignSaving(false);
        }
    }

    async function fetchServiceDesignOptions(catalogItemId: string) {
        setAssignmentLoading(true);
        setAssignmentStatus(null);
        try {
            const res = await fetch(`/api/admin/catalog/${catalogItemId}/design-options`);
            const data = (await res.json().catch(() => ({}))) as Partial<ServiceDesignOptionsResponse> & { error?: string };
            if (!res.ok) {
                throw new Error(data.error || 'Failed to load service design options');
            }

            const rows = (data.options ?? []).map((row) => ({
                designOptionId: row.designOptionId,
                isRequired: row.isRequired,
                allowMulti: row.allowMulti,
                defaultValueId: row.defaultValueId,
                allowedValueIds: row.allowedValues?.map((entry) => entry.designOptionValueId) ?? [],
            }));
            setServiceDesignOptions(rows);
        } catch (assignmentError) {
            console.error(assignmentError);
            setAssignmentStatus({
                type: 'error',
                message: assignmentError instanceof Error ? assignmentError.message : 'Failed to load service assignments',
            });
            setServiceDesignOptions([]);
        } finally {
            setAssignmentLoading(false);
        }
    }

    function getDefinitionValues(designOptionId: string): DesignOptionValue[] {
        return designOptions.find((definition) => definition.id === designOptionId)?.values ?? [];
    }

    function updateServiceDesignOptionRow(index: number, patch: Partial<ServiceDesignOptionRow>) {
        setServiceDesignOptions((previous) =>
            previous.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
        );
    }

    function getCurrentOptionAssignmentIndex() {
        if (!editingDesignOptionId) return -1;
        return serviceDesignOptions.findIndex((row) => row.designOptionId === editingDesignOptionId);
    }

    function assignCurrentOptionToSelectedService() {
        if (!editingDesignOptionId) return;
        const existingIndex = getCurrentOptionAssignmentIndex();
        if (existingIndex !== -1) return;
        setServiceDesignOptions((previous) => [
            ...previous,
            {
                designOptionId: editingDesignOptionId,
                isRequired: false,
                allowMulti: false,
                defaultValueId: null,
                allowedValueIds: [],
            },
        ]);
    }

    function unassignCurrentOptionFromSelectedService() {
        if (!editingDesignOptionId) return;
        setServiceDesignOptions((previous) => previous.filter((row) => row.designOptionId !== editingDesignOptionId));
    }

    async function saveServiceAssignments() {
        if (!selectedServiceId) {
            setAssignmentStatus({ type: 'error', message: 'Select a service before saving.' });
            return;
        }

        const seen = new Set<string>();
        for (const row of serviceDesignOptions) {
            if (seen.has(row.designOptionId)) {
                setAssignmentStatus({ type: 'error', message: 'Duplicate design options are not allowed on one service.' });
                return;
            }
            seen.add(row.designOptionId);
        }

        setAssignmentSaving(true);
        setAssignmentStatus(null);
        try {
            const res = await fetch(`/api/admin/catalog/${selectedServiceId}/design-options`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options: serviceDesignOptions }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error((data as { error?: string }).error || 'Failed to save service design options');
            }

            setAssignmentStatus({ type: 'success', message: 'Service design options saved.' });
            await fetchServiceDesignOptions(selectedServiceId);
        } catch (saveError) {
            console.error(saveError);
            setAssignmentStatus({
                type: 'error',
                message: saveError instanceof Error ? saveError.message : 'Failed to save service design options',
            });
        } finally {
            setAssignmentSaving(false);
        }
    }

    function resetFeatureForm() {
        setEditingFeatureId(null);
        setFeatureForm({
            category: 'FEATURE',
            label: '',
            value: '',
            description: '',
            constraintsText: '',
            assumptionsText: '',
        });
        setFeatureStatus(null);
    }

    function startCreateFeature() {
        setEditingFeatureId('new');
        setFeatureForm({
            category: 'FEATURE',
            label: '',
            value: '',
            description: '',
            constraintsText: '',
            assumptionsText: '',
        });
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

            await fetchTerms();
            setEditingFeatureId((data as TaxonomyTerm).id);
            setFeatureForm({
                id: (data as TaxonomyTerm).id,
                category: 'FEATURE',
                label: (data as TaxonomyTerm).label,
                value: (data as TaxonomyTerm).value,
                description: (data as TaxonomyTerm).description ?? '',
                constraintsText: ((data as TaxonomyTerm).constraints ?? []).join('\n'),
                assumptionsText: ((data as TaxonomyTerm).assumptions ?? []).join('\n'),
            });
            setFeatureStatus({ type: 'success', message: 'Feature definition saved.' });
        } catch (saveError) {
            setFeatureStatus({
                type: 'error',
                message: saveError instanceof Error ? saveError.message : 'Failed to save feature definition',
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
        } catch (loadError) {
            setServiceFeatureStatus({
                type: 'error',
                message: loadError instanceof Error ? loadError.message : 'Failed to load service features',
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
        } catch (saveError) {
            setServiceFeatureStatus({
                type: 'error',
                message: saveError instanceof Error ? saveError.message : 'Failed to save service features',
            });
        } finally {
            setServiceFeatureSaving(false);
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Taxonomy Manager</h2>
                        <p className="text-slate-600 font-medium">Manage taxonomy terms and design option builder from one place.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setWorkspaceTab('design-options')}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${workspaceTab === 'design-options'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200'
                                }`}
                        >
                            Design Options Builder
                        </button>
                        <button
                            onClick={() => setWorkspaceTab('terms')}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${workspaceTab === 'terms'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200'
                                }`}
                        >
                            Taxonomy Terms
                        </button>
                        <button
                            onClick={() => setWorkspaceTab('features')}
                            className={`px-3 py-2 rounded-lg text-sm font-semibold border ${workspaceTab === 'features'
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-slate-600 border-slate-200'
                                }`}
                        >
                            Features Builder
                        </button>
                    </div>
                </div>
            </section>

            {workspaceTab === 'terms' && (
            <section className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-2xl font-bold tracking-tight">Taxonomy Terms</h3>
                        <p className="text-slate-600 font-medium">Lookup terms and panel visibility metadata.</p>
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
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-600'
                                    }`}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg flex items-center gap-2">
                        <X size={16} className="shrink-0" />
                        <p className="text-sm font-medium">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
                            <X size={14} />
                        </button>
                    </div>
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
                                {PANEL_CATEGORIES.includes(taxonomyForm.category) ? (
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
                                    placeholder="Display label"
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
                            {loading ? (
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
                                    <tr key={term.id} className="hover:bg-slate-100/60 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-700">
                                                {term.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900">{term.label}</td>
                                        <td className="px-6 py-4 text-slate-600 text-xs max-w-[22rem] truncate">{term.description || '—'}</td>
                                        <td className="px-6 py-4 font-mono text-[11px] text-slate-700">{term.value}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => beginEditTaxonomyTerm(term)}
                                                    className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                                                >
                                                    <Edit3 size={14} />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => deleteTaxonomyTerm(term.id)}
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
            )}

            {workspaceTab === 'design-options' && (
            <section className="space-y-6">
                <div>
                    <h3 className="text-2xl font-bold tracking-tight">Design Option Builder</h3>
                    <p className="text-slate-600 font-medium">Select an option on the left, then edit identity, values, and service assignment on the right.</p>
                </div>

                {designStatus && (
                    <div className={`px-4 py-3 rounded-lg border text-sm font-medium ${designStatus.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                        }`}>
                        {designStatus.message}
                    </div>
                )}

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
                                            ? 'border-blue-500 bg-blue-50'
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

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-700">Assign This Design Option to Services</p>
                                <div className="flex items-center gap-2">
                                    {editingDesignOptionId && currentOptionAssignment ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={unassignCurrentOptionFromSelectedService}
                                            className="h-7 text-rose-600 border-rose-200"
                                        >
                                            Unassign
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={assignCurrentOptionToSelectedService}
                                            disabled={!editingDesignOptionId || !selectedServiceId}
                                            className="h-7"
                                        >
                                            Assign
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        onClick={saveServiceAssignments}
                                        disabled={assignmentSaving || !selectedServiceId || !editingDesignOptionId}
                                        className="h-7"
                                    >
                                        {assignmentSaving ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Save size={12} className="mr-1" />}
                                        Save Assignment
                                    </Button>
                                </div>
                            </div>

                            {assignmentStatus && (
                                <div className={`px-3 py-2 rounded-lg border text-xs font-medium ${assignmentStatus.type === 'success'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-rose-50 border-rose-200 text-rose-700'
                                    }`}>
                                    {assignmentStatus.message}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600">Service</label>
                                <select
                                    value={selectedServiceId}
                                    onChange={(event) => setSelectedServiceId(event.target.value)}
                                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                >
                                    {services.length === 0 && <option value="">No assignable services found</option>}
                                    {services.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {service.name} ({service.sku}) - {service.type}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedService && (
                                <p className="text-xs text-slate-600">
                                    Editing assignment on <span className="font-semibold text-slate-900">{selectedService.name}</span> ({selectedService.sku})
                                </p>
                            )}

                            {assignmentLoading ? (
                                <p className="text-xs text-slate-500">
                                    <Loader2 size={12} className="inline mr-1 animate-spin" /> Loading service assignments...
                                </p>
                            ) : !editingDesignOptionId ? (
                                <p className="text-xs text-slate-500">Select a design option definition to manage assignment.</p>
                            ) : !currentOptionAssignment ? (
                                <p className="text-xs text-slate-500">This design option is not assigned to the selected service.</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-2 gap-2">
                                        <label className="text-xs text-slate-700 flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={currentOptionAssignment.isRequired}
                                                onChange={(event) => updateServiceDesignOptionRow(currentOptionAssignmentIndex, { isRequired: event.target.checked })}
                                            />
                                            Required
                                        </label>
                                        <label className="text-xs text-slate-700 flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={currentOptionAssignment.allowMulti}
                                                onChange={(event) => updateServiceDesignOptionRow(currentOptionAssignmentIndex, { allowMulti: event.target.checked })}
                                            />
                                            Allow Multi
                                        </label>
                                    </div>

                                    <select
                                        value={currentOptionAssignment.defaultValueId ?? ''}
                                        onChange={(event) => updateServiceDesignOptionRow(currentOptionAssignmentIndex, { defaultValueId: event.target.value || null })}
                                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                    >
                                        <option value="">No default value</option>
                                        {getDefinitionValues(editingDesignOptionId).map((value) => (
                                            <option key={value.id} value={value.id}>
                                                {value.label} ({value.value})
                                            </option>
                                        ))}
                                    </select>

                                    <div className="rounded-md border border-slate-200 bg-white p-2">
                                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Allowed Values</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            {getDefinitionValues(editingDesignOptionId).map((value) => (
                                                <div key={value.id} className="rounded border border-slate-100 p-2">
                                                    <label className="text-xs text-slate-700 flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={currentOptionAssignment.allowedValueIds.includes(value.id || '')}
                                                            onChange={(event) => {
                                                                const valueId = value.id || '';
                                                                const next = event.target.checked
                                                                    ? [...currentOptionAssignment.allowedValueIds, valueId]
                                                                    : currentOptionAssignment.allowedValueIds.filter((id) => id !== valueId);
                                                                updateServiceDesignOptionRow(currentOptionAssignmentIndex, {
                                                                    allowedValueIds: Array.from(new Set(next.filter(Boolean))),
                                                                });
                                                            }}
                                                        />
                                                        {value.label} ({value.value})
                                                    </label>
                                                    {(value.description || (value.constraints?.length ?? 0) > 0 || (value.assumptions?.length ?? 0) > 0) && (
                                                        <div className="ml-5 mt-1 text-[11px] text-slate-500 space-y-1">
                                                            {value.description && <p>{value.description}</p>}
                                                            {(value.constraints?.length ?? 0) > 0 && (
                                                                <p><span className="font-semibold">Constraints:</span> {value.constraints?.join('; ')}</p>
                                                            )}
                                                            {(value.assumptions?.length ?? 0) > 0 && (
                                                                <p><span className="font-semibold">Assumptions:</span> {value.assumptions?.join('; ')}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <Button onClick={saveDesignOptionDefinition} disabled={designSaving} className="w-full gap-2">
                            {designSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                            {editingDesignOptionId ? 'Update Design Option' : 'Create Design Option'}
                        </Button>
                    </div>
                </div>
            </section>
            )}

            {workspaceTab === 'features' && (
            <section className="space-y-6">
                <div>
                    <h3 className="text-2xl font-bold tracking-tight">Features Builder</h3>
                    <p className="text-slate-600 font-medium">Define features and assign them to services.</p>
                </div>

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
                            {filteredFeatureTerms.length === 0 ? (
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

                        {featureStatus && (
                            <div className={`px-3 py-2 rounded-lg border text-xs font-medium ${featureStatus.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-rose-50 border-rose-200 text-rose-700'
                                }`}>
                                {featureStatus.message}
                            </div>
                        )}

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

                                {serviceFeatureStatus && (
                                    <div className={`px-3 py-2 rounded-lg border text-xs font-medium ${serviceFeatureStatus.type === 'success'
                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                        : 'bg-rose-50 border-rose-200 text-rose-700'
                                        }`}>
                                        {serviceFeatureStatus.message}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-600">Service</label>
                                    <select
                                        value={selectedServiceId}
                                        onChange={(event) => setSelectedServiceId(event.target.value)}
                                        className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                                    >
                                        {services.length === 0 && <option value="">No assignable services found</option>}
                                        {services.map((service) => (
                                            <option key={service.id} value={service.id}>
                                                {service.name} ({service.sku}) - {service.type}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {selectedService && (
                                    <p className="text-xs text-slate-600">
                                        Editing assignment on <span className="font-semibold text-slate-900">{selectedService.name}</span> ({selectedService.sku})
                                    </p>
                                )}

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
            )}
        </div>
    );
}
