'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CATALOG_ITEM_TYPES, normalizeCatalogItemType } from '@/lib/catalog-item-types';
import {
    ChevronLeft,
    Save,
    Plus,
    Trash2,
    FileText,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import Link from 'next/link';

interface CatalogItem {
    id: string;
    sku: string;
    name: string;
    shortDescription: string | null;
    detailedDescription: string | null;
    type: string;
    constraints: { id: string; description: string }[];
    assumptions: { id: string; description: string }[];
    collaterals: { id: string; title: string; documentUrl: string; type: string }[];
    attributes: { id: string; taxonomyTermId: string; term: { id: string; name: string; category: string } }[];
    pricing: { id: string; pricingModel: string; costMrc: number; costNrc: number }[];
    childDependencies: {
        id: string;
        childId: string;
        type: string;
        quantityMultiplier: number;
        childItem: { id: string; sku: string; name: string };
    }[];
}

interface DesignOptionDefinition {
    id: string;
    key: string;
    label: string;
    valueType?: string;
    values: Array<{ id: string; value: string; label: string }>;
}

interface CompositionRow {
    catalogItemId: string;
    role: 'REQUIRED' | 'OPTIONAL' | 'AUTO_INCLUDED';
    minQty: number;
    maxQty: number | null;
    defaultQty: number;
    isSelectable: boolean;
    displayOrder: number;
}

interface PolicyRow {
    targetCatalogItemId: string;
    designOptionId: string;
    operator: 'FORCE' | 'FORBID' | 'ALLOW_ONLY' | 'REQUIRE_ONE_OF';
    scope: 'PROJECT' | 'SITE';
    active: boolean;
    valueIds: string[];
}

interface ItemDesignOptionRow {
    designOptionId: string;
    isRequired: boolean;
    allowMulti: boolean;
    defaultValueId: string | null;
    allowedValueIds: string[];
}

type FeatureStatus = 'REQUIRED' | 'STANDARD' | 'OPTIONAL';

interface FeatureAssignmentRow {
    termId: string;
    status: FeatureStatus;
}

type PackageDesignOptionMode = 'NONE' | 'FIXED' | 'CONFIGURABLE';

interface PackageDesignOptionSelection {
    catalogItemId: string;
    designOptionId: string;
    mode: PackageDesignOptionMode;
    valueIds: string[];
}

interface ServiceDesignOptionWorkspace {
    designOptionId: string;
    key: string;
    label: string;
    valueChoices: Array<{ id: string; value: string; label: string }>;
}

interface ServiceFeatureWorkspace {
    id: string;
    label: string;
    value: string | null;
}

interface PackageServiceWorkspace {
    catalogItemId: string;
    designOptions: ServiceDesignOptionWorkspace[];
    supportedFeatures: ServiceFeatureWorkspace[];
    loading: boolean;
    error?: string;
}

function newTempId(prefix: string): string {
    return `temp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function createEmptyCatalogItem(): CatalogItem {
    return {
        id: '',
        sku: '',
        name: '',
        shortDescription: '',
        detailedDescription: '',
        type: 'MANAGED_SERVICE',
        constraints: [],
        assumptions: [],
        collaterals: [],
        attributes: [],
        pricing: [{ id: newTempId('pricing'), pricingModel: 'FLAT', costMrc: 0, costNrc: 0 }],
        childDependencies: [],
    };
}

function normalizeCatalogItem(raw: unknown): CatalogItem {
    const fallback = createEmptyCatalogItem();
    const input = (raw && typeof raw === 'object') ? (raw as Record<string, unknown>) : {};

    const constraints = Array.isArray(input.constraints)
        ? input.constraints.map((entry, index) => {
            const row = (entry && typeof entry === 'object') ? (entry as Record<string, unknown>) : {};
            return {
                id: typeof row.id === 'string' ? row.id : `constraint-${index}`,
                description: typeof row.description === 'string' ? row.description : '',
            };
        })
        : [];

    const assumptions = Array.isArray(input.assumptions)
        ? input.assumptions.map((entry, index) => {
            const row = (entry && typeof entry === 'object') ? (entry as Record<string, unknown>) : {};
            return {
                id: typeof row.id === 'string' ? row.id : `assumption-${index}`,
                description: typeof row.description === 'string' ? row.description : '',
            };
        })
        : [];

    const collaterals = Array.isArray(input.collaterals)
        ? input.collaterals.map((entry, index) => {
            const row = (entry && typeof entry === 'object') ? (entry as Record<string, unknown>) : {};
            return {
                id: typeof row.id === 'string' ? row.id : `collateral-${index}`,
                title: typeof row.title === 'string' ? row.title : '',
                documentUrl: typeof row.documentUrl === 'string' ? row.documentUrl : '',
                type: typeof row.type === 'string' ? row.type : 'PDF',
            };
        })
        : [];

    const attributes = Array.isArray(input.attributes)
        ? input.attributes.map((entry, index) => {
            const row = (entry && typeof entry === 'object') ? (entry as Record<string, unknown>) : {};
            const term = (row.term && typeof row.term === 'object') ? (row.term as Record<string, unknown>) : {};
            return {
                id: typeof row.id === 'string' ? row.id : `attribute-${index}`,
                taxonomyTermId: typeof row.taxonomyTermId === 'string' ? row.taxonomyTermId : '',
                term: {
                    id: typeof term.id === 'string' ? term.id : '',
                    name: typeof term.name === 'string' ? term.name : '',
                    category: typeof term.category === 'string' ? term.category : '',
                },
            };
        })
        : [];

    const pricingRaw = Array.isArray(input.pricing)
        ? input.pricing.map((entry, index) => {
            const row = (entry && typeof entry === 'object') ? (entry as Record<string, unknown>) : {};
            return {
                id: typeof row.id === 'string' ? row.id : `pricing-${index}`,
                pricingModel: typeof row.pricingModel === 'string' ? row.pricingModel : 'FLAT',
                costMrc: toNumber(row.costMrc),
                costNrc: toNumber(row.costNrc),
            };
        })
        : [];
    const pricing = pricingRaw.length > 0 ? pricingRaw : fallback.pricing;

    const childDependencies = Array.isArray(input.childDependencies)
        ? input.childDependencies.map((entry, index) => {
            const row = (entry && typeof entry === 'object') ? (entry as Record<string, unknown>) : {};
            const childItem = (row.childItem && typeof row.childItem === 'object')
                ? (row.childItem as Record<string, unknown>)
                : {};
            return {
                id: typeof row.id === 'string' ? row.id : `dependency-${index}`,
                childId: typeof row.childId === 'string' ? row.childId : '',
                type: typeof row.type === 'string' ? row.type : 'INCLUDES',
                quantityMultiplier: toNumber(row.quantityMultiplier) || 1,
                childItem: {
                    id: typeof childItem.id === 'string' ? childItem.id : '',
                    sku: typeof childItem.sku === 'string' ? childItem.sku : '',
                    name: typeof childItem.name === 'string' ? childItem.name : '',
                },
            };
        }).filter((dep) => dep.childId)
        : [];

    return {
        id: typeof input.id === 'string' ? input.id : fallback.id,
        sku: typeof input.sku === 'string' ? input.sku : fallback.sku,
        name: typeof input.name === 'string' ? input.name : fallback.name,
        shortDescription: typeof input.shortDescription === 'string' ? input.shortDescription : fallback.shortDescription,
        detailedDescription: typeof input.detailedDescription === 'string' ? input.detailedDescription : fallback.detailedDescription,
        type: normalizeCatalogItemType(typeof input.type === 'string' ? input.type : null) || fallback.type,
        constraints,
        assumptions,
        collaterals,
        attributes,
        pricing,
        childDependencies,
    };
}

export default function CatalogItemDetail() {
    const { id } = useParams();
    const router = useRouter();
    const [item, setItem] = useState<CatalogItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{id: string, name: string, sku: string, type: string}[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [taxonomyTerms, setTaxonomyTerms] = useState<{id: string, label: string, category: string, value: string | null}[]>([]);
    const [compositionRows, setCompositionRows] = useState<CompositionRow[]>([]);
    const [policyRows, setPolicyRows] = useState<PolicyRow[]>([]);
    const [itemDesignOptionRows, setItemDesignOptionRows] = useState<ItemDesignOptionRow[]>([]);
    const [designOptionDefinitions, setDesignOptionDefinitions] = useState<DesignOptionDefinition[]>([]);
    const [catalogLookup, setCatalogLookup] = useState<Array<{ id: string; sku: string; name: string; type: string }>>([]);
    const [advancedSaving, setAdvancedSaving] = useState(false);
    const [advancedStatus, setAdvancedStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [supportedFeatureTermIds, setSupportedFeatureTermIds] = useState<string[]>([]);
    const [, setAvailableFeatureTermIds] = useState<string[]>([]);
    const [featureAssignments, setFeatureAssignments] = useState<FeatureAssignmentRow[]>([]);
    const [featureSaving, setFeatureSaving] = useState(false);
    const [featureStatus, setFeatureStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [featureSearch, setFeatureSearch] = useState('');
    const [packageServiceWorkspaces, setPackageServiceWorkspaces] = useState<Record<string, PackageServiceWorkspace>>({});
    const [packageDesignSelections, setPackageDesignSelections] = useState<PackageDesignOptionSelection[]>([]);

    useEffect(() => {
        if (id !== 'new') {
            fetchItem();
        } else {
            setItem(createEmptyCatalogItem());
            setLoading(false);
        }
        fetchTaxonomy();
    }, [id]);

    useEffect(() => {
        if (!item || id === 'new') return;
        const currentItem = item;

        async function loadAdvancedEditors() {
            try {
                const [defRes, catalogRes] = await Promise.all([
                    fetch('/api/admin/design-options'),
                    fetch('/api/admin/catalog?limit=200'),
                ]);
                if (!defRes.ok) {
                    const err = await defRes.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to load design option definitions');
                }
                if (!catalogRes.ok) {
                    const err = await catalogRes.json().catch(() => ({}));
                    throw new Error(err.error || 'Failed to load catalog for advanced controls');
                }
                const defData = await defRes.json();
                const catalogData = await catalogRes.json();
                setDesignOptionDefinitions(defData.options || []);
                setCatalogLookup((catalogData.items || []).map((row: any) => ({
                    id: row.id,
                    sku: row.sku,
                    name: row.name,
                    type: row.type,
                })));

                if (currentItem.type === 'PACKAGE') {
                    setItemDesignOptionRows([]);
                    const [compRes, polRes, featureRes] = await Promise.all([
                        fetch(`/api/admin/packages/${currentItem.id}/composition`),
                        fetch(`/api/admin/packages/${currentItem.id}/policies`),
                        fetch(`/api/admin/catalog/${currentItem.id}/features`),
                    ]);
                    if (!compRes.ok || !polRes.ok || !featureRes.ok) {
                        const compErr = !compRes.ok ? await compRes.json().catch(() => ({})) : null;
                        const polErr = !polRes.ok ? await polRes.json().catch(() => ({})) : null;
                        const featureErr = !featureRes.ok ? await featureRes.json().catch(() => ({})) : null;
                        throw new Error(compErr?.error || polErr?.error || featureErr?.error || 'Failed to load package controls');
                    }

                    const compData = await compRes.json();
                    const polData = await polRes.json();
                    const featureData = await featureRes.json();

                    const nextCompositionRows: CompositionRow[] = (compData.items || []).map((row: any) => ({
                        catalogItemId: row.catalogItemId,
                        role: row.role,
                        minQty: row.minQty,
                        maxQty: row.maxQty,
                        defaultQty: row.defaultQty,
                        isSelectable: row.isSelectable,
                        displayOrder: row.displayOrder,
                    }));
                    setCompositionRows(nextCompositionRows);

                    setPolicyRows((polData.policies || []).map((row: any) => ({
                        targetCatalogItemId: row.targetCatalogItemId,
                        designOptionId: row.designOptionId,
                        operator: row.operator,
                        scope: row.scope,
                        active: row.active,
                        valueIds: row.values?.map((v: any) => v.designOptionValueId) || [],
                    })));

                    setAvailableFeatureTermIds((featureData.availableFeatureTermIds || []).filter(Boolean));
                    setSupportedFeatureTermIds((featureData.supportedFeatureTermIds || []).filter(Boolean));
                    const assignments: FeatureAssignmentRow[] = (featureData.assignments || []).map((row: any) => ({
                        termId: row.termId,
                        status: row.status,
                    }));
                    setFeatureAssignments(assignments);

                    const compositionMemberIds = Array.from(new Set(nextCompositionRows.map((row) => row.catalogItemId)));
                    if (compositionMemberIds.length === 0) {
                        setPackageServiceWorkspaces({});
                    } else {
                        const workspaces = await Promise.all(
                            compositionMemberIds.map((catalogItemId) => fetchPackageServiceWorkspace(catalogItemId))
                        );
                        setPackageServiceWorkspaces(
                            Object.fromEntries(workspaces.map((workspace) => [workspace.catalogItemId, workspace]))
                        );
                    }
                } else if (currentItem.type === 'MANAGED_SERVICE' || currentItem.type === 'SERVICE_OPTION' || currentItem.type === 'CONNECTIVITY') {
                    const [designRes, featureRes] = await Promise.all([
                        fetch(`/api/admin/catalog/${currentItem.id}/design-options`),
                        fetch(`/api/admin/catalog/${currentItem.id}/features`),
                    ]);
                    if (!designRes.ok) {
                        const err = await designRes.json().catch(() => ({}));
                        throw new Error(err.error || 'Failed to load item design options');
                    }
                    if (!featureRes.ok) {
                        const err = await featureRes.json().catch(() => ({}));
                        throw new Error(err.error || 'Failed to load item features');
                    }
                    const designData = await designRes.json();
                    const featureData = await featureRes.json();

                    setItemDesignOptionRows((designData.options || []).map((row: any) => ({
                        designOptionId: row.designOptionId,
                        isRequired: row.isRequired,
                        allowMulti: row.allowMulti,
                        defaultValueId: row.defaultValueId,
                        allowedValueIds: row.allowedValues?.map((av: any) => av.designOptionValueId) || [],
                    })));

                    setAvailableFeatureTermIds((featureData.availableFeatureTermIds || []).filter(Boolean));
                    setSupportedFeatureTermIds((featureData.supportedFeatureTermIds || []).filter(Boolean));
                    const assignments: FeatureAssignmentRow[] = (featureData.assignments || []).map((row: any) => ({
                        termId: row.termId,
                        status: row.status,
                    }));
                    setFeatureAssignments(assignments);
                    setPackageServiceWorkspaces({});
                    setPackageDesignSelections([]);
                } else {
                    setSupportedFeatureTermIds([]);
                    setAvailableFeatureTermIds([]);
                    setFeatureAssignments([]);
                    setPackageServiceWorkspaces({});
                    setPackageDesignSelections([]);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load advanced editor data';
                setAdvancedStatus({ type: 'error', message });
            }
        }

        loadAdvancedEditors();
    }, [item?.id, item?.type, id]);

    useEffect(() => {
        if (!item || item.type !== 'PACKAGE') return;

        const memberIds = new Set(compositionRows.map((row) => row.catalogItemId));
        setPackageServiceWorkspaces((prev) => {
            const filtered = Object.fromEntries(
                Object.entries(prev).filter(([catalogItemId]) => memberIds.has(catalogItemId))
            );
            if (Object.keys(filtered).length === Object.keys(prev).length) return prev;
            return filtered;
        });
    }, [compositionRows, item?.type]);

    useEffect(() => {
        if (!item || item.type !== 'PACKAGE') return;

        const memberIds = Array.from(new Set(compositionRows.map((row) => row.catalogItemId)));
        const missingIds = memberIds.filter((catalogItemId) => !packageServiceWorkspaces[catalogItemId]);
        if (missingIds.length === 0) return;

        let cancelled = false;
        (async () => {
            const loaded = await Promise.all(missingIds.map((catalogItemId) => fetchPackageServiceWorkspace(catalogItemId)));
            if (cancelled) return;
            setPackageServiceWorkspaces((prev) => ({
                ...prev,
                ...Object.fromEntries(loaded.map((workspace) => [workspace.catalogItemId, workspace])),
            }));
        })();

        return () => {
            cancelled = true;
        };
    }, [compositionRows, item?.type, item?.id, packageServiceWorkspaces]);

    useEffect(() => {
        if (!item || item.type !== 'PACKAGE') return;

        const policyMap = new Map<string, PolicyRow[]>();
        for (const policy of policyRows) {
            const key = `${policy.targetCatalogItemId}:${policy.designOptionId}`;
            const rows = policyMap.get(key) || [];
            rows.push(policy);
            policyMap.set(key, rows);
        }

        setPackageDesignSelections((previous) => {
            const previousMap = new Map<string, PackageDesignOptionSelection>(
                previous.map((selection) => [`${selection.catalogItemId}:${selection.designOptionId}`, selection])
            );
            const next: PackageDesignOptionSelection[] = [];

            const activeMemberIds = new Set(compositionRows.map((row) => row.catalogItemId));
            for (const catalogItemId of activeMemberIds) {
                const workspace = packageServiceWorkspaces[catalogItemId];
                if (!workspace) continue;
                for (const option of workspace.designOptions) {
                    const key = `${workspace.catalogItemId}:${option.designOptionId}`;
                    const existing = previousMap.get(key);
                    if (existing) {
                        next.push(existing);
                        continue;
                    }

                    const rules = policyMap.get(key) || [];
                    const forcePolicy = rules.find((row) => row.operator === 'FORCE' && row.active);
                    const allowPolicy = rules.find((row) => row.operator === 'ALLOW_ONLY' && row.active);
                    const requirePolicy = rules.find((row) => row.operator === 'REQUIRE_ONE_OF' && row.active);

                    if (forcePolicy) {
                        next.push({
                            catalogItemId: workspace.catalogItemId,
                            designOptionId: option.designOptionId,
                            mode: 'FIXED',
                            valueIds: forcePolicy.valueIds.slice(0, 1),
                        });
                        continue;
                    }

                    if (allowPolicy || requirePolicy) {
                        next.push({
                            catalogItemId: workspace.catalogItemId,
                            designOptionId: option.designOptionId,
                            mode: 'CONFIGURABLE',
                            valueIds: (allowPolicy?.valueIds || requirePolicy?.valueIds || []).slice(),
                        });
                        continue;
                    }

                    next.push({
                        catalogItemId: workspace.catalogItemId,
                        designOptionId: option.designOptionId,
                        mode: 'NONE',
                        valueIds: [],
                    });
                }
            }

            return next;
        });
    }, [item?.type, policyRows, packageServiceWorkspaces, compositionRows]);

    async function fetchPackageServiceWorkspace(catalogItemId: string): Promise<PackageServiceWorkspace> {
        try {
            const [designRes, featureRes] = await Promise.all([
                fetch(`/api/admin/catalog/${catalogItemId}/design-options`),
                fetch(`/api/admin/catalog/${catalogItemId}/features`),
            ]);
            if (!designRes.ok || !featureRes.ok) {
                const designError = !designRes.ok ? await designRes.json().catch(() => ({})) : null;
                const featureError = !featureRes.ok ? await featureRes.json().catch(() => ({})) : null;
                throw new Error(designError?.error || featureError?.error || 'Failed to load service design workspace');
            }

            const designData = await designRes.json();
            const featureData = await featureRes.json();
            const supportedIds = new Set((featureData.supportedFeatureTermIds || []) as string[]);
            const supportedFeatures: ServiceFeatureWorkspace[] = (featureData.featureTerms || [])
                .filter((term: any) => supportedIds.has(term.id))
                .map((term: any) => ({ id: term.id, label: term.label, value: term.value || null }));

            const designOptions: ServiceDesignOptionWorkspace[] = (designData.options || []).map((row: any) => {
                const fromAllowed = (row.allowedValues || []).map((av: any) => av.designOptionValue);
                const fromDefinition = row.designOption?.values || [];
                const candidates = fromAllowed.length > 0 ? fromAllowed : fromDefinition;
                const dedupe = new Map<string, { id: string; value: string; label: string }>();
                for (const candidate of candidates) {
                    if (!candidate?.id) continue;
                    dedupe.set(candidate.id, { id: candidate.id, value: candidate.value, label: candidate.label });
                }
                return {
                    designOptionId: row.designOptionId,
                    key: row.designOption?.key || row.designOptionId,
                    label: row.designOption?.label || row.designOptionId,
                    valueChoices: Array.from(dedupe.values()),
                };
            });

            return {
                catalogItemId,
                designOptions,
                supportedFeatures,
                loading: false,
            };
        } catch (error) {
            return {
                catalogItemId,
                designOptions: [],
                supportedFeatures: [],
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to load workspace',
            };
        }
    }

    const fetchTaxonomy = async () => {
        try {
            const res = await fetch('/api/admin/taxonomy');
            const data = await res.json();
            setTaxonomyTerms(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch taxonomy:', error);
        }
    };

    async function fetchItem() {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/catalog/${id}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error((data as { error?: string })?.error || 'Failed to load catalog item');
            }
            setItem(normalizeCatalogItem(data));
        } catch (err) {
            console.error('Failed to fetch catalog item:', err);
            setItem(null);
            setStatus({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load catalog item' });
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        if (!item) return;
        try {
            setSaving(true);
            setStatus(null);
            const method = id === 'new' ? 'POST' : 'PATCH';
            const url = id === 'new' ? '/api/admin/catalog' : `/api/admin/catalog/${id}`;
            const savePayload = (({ attributes, ...rest }) => rest)(item);
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(savePayload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || errorData.details || 'Failed to save');
            }
            
            setStatus({ type: 'success', message: 'Item saved successfully' });
            if (id === 'new') {
                const newItem = await res.json();
                router.push(`/admin/catalog/${newItem.id}`);
            }
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message || 'Error saving item' });
        } finally {
            setSaving(false);
        }
    }

    async function savePackageControls() {
        if (!item || item.type !== 'PACKAGE') return;
        try {
            setAdvancedSaving(true);
            setAdvancedStatus(null);
            const packagePolicyPayload: PolicyRow[] = packageDesignSelections.flatMap((selection): PolicyRow[] => {
                if (selection.mode === 'FIXED' && selection.valueIds.length > 0) {
                    return [{
                        targetCatalogItemId: selection.catalogItemId,
                        designOptionId: selection.designOptionId,
                        operator: 'FORCE' as const,
                        scope: 'PROJECT' as const,
                        active: true,
                        valueIds: selection.valueIds.slice(0, 1),
                    }];
                }
                if (selection.mode === 'CONFIGURABLE' && selection.valueIds.length > 0) {
                    return [{
                        targetCatalogItemId: selection.catalogItemId,
                        designOptionId: selection.designOptionId,
                        operator: 'ALLOW_ONLY' as const,
                        scope: 'PROJECT' as const,
                        active: true,
                        valueIds: Array.from(new Set(selection.valueIds)),
                    }];
                }
                return [];
            });

            const [compRes, policyRes] = await Promise.all([
                fetch(`/api/admin/packages/${item.id}/composition`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: compositionRows }),
                }),
                fetch(`/api/admin/packages/${item.id}/policies`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ policies: packagePolicyPayload }),
                }),
            ]);

            if (!compRes.ok || !policyRes.ok) {
                const compError = !compRes.ok ? await compRes.json().catch(() => ({})) : null;
                const policyError = !policyRes.ok ? await policyRes.json().catch(() => ({})) : null;
                throw new Error(compError?.error || policyError?.error || 'Failed to save package controls');
            }

            const [compData, policyData, featureRes] = await Promise.all([
                compRes.json().catch(() => ({})),
                policyRes.json().catch(() => ({})),
                fetch(`/api/admin/catalog/${item.id}/features`),
            ]);

            if (!featureRes.ok) {
                const featureError = await featureRes.json().catch(() => ({}));
                throw new Error(featureError.error || 'Package controls saved, but failed to refresh package features');
            }

            const featureData = await featureRes.json();
            const availableIds = new Set((featureData.availableFeatureTermIds || []) as string[]);
            const normalizedAssignments = featureAssignments.filter((row) => availableIds.has(row.termId));
            const featureWriteRes = await fetch(`/api/admin/catalog/${item.id}/features`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignments: normalizedAssignments }),
            });
            const featureWriteData = await featureWriteRes.json().catch(() => ({}));
            if (!featureWriteRes.ok) {
                throw new Error(featureWriteData.error || 'Failed to save package feature statuses');
            }
            setCompositionRows((compData.items || []).map((row: any) => ({
                catalogItemId: row.catalogItemId,
                role: row.role,
                minQty: row.minQty,
                maxQty: row.maxQty,
                defaultQty: row.defaultQty,
                isSelectable: row.isSelectable,
                displayOrder: row.displayOrder,
            })));
            setPolicyRows((policyData.policies || []).map((row: any) => ({
                targetCatalogItemId: row.targetCatalogItemId,
                designOptionId: row.designOptionId,
                operator: row.operator,
                scope: row.scope,
                active: row.active,
                valueIds: row.values?.map((v: any) => v.designOptionValueId) || [],
            })));
            setAvailableFeatureTermIds((featureWriteData.availableFeatureTermIds || featureData.availableFeatureTermIds || []).filter(Boolean));
            setSupportedFeatureTermIds((featureWriteData.supportedFeatureTermIds || featureData.supportedFeatureTermIds || []).filter(Boolean));
            setFeatureAssignments((featureWriteData.assignments || []).map((row: any) => ({
                termId: row.termId,
                status: row.status,
            })));
            const compositionMemberIds: string[] = Array.from(
                new Set(
                    ((compData.items || []) as Array<{ catalogItemId?: string }>)
                        .map((row) => row.catalogItemId)
                        .filter((catalogItemId): catalogItemId is string => Boolean(catalogItemId))
                )
            );
            const workspaces = await Promise.all(
                compositionMemberIds.map((catalogItemId) => fetchPackageServiceWorkspace(catalogItemId))
            );
            setPackageServiceWorkspaces(Object.fromEntries(workspaces.map((workspace) => [workspace.catalogItemId, workspace])));

            setAdvancedStatus({ type: 'success', message: 'Package controls saved' });
        } catch (err: any) {
            setAdvancedStatus({ type: 'error', message: err.message || 'Failed to save package controls' });
        } finally {
            setAdvancedSaving(false);
        }
    }

    async function saveItemDesignOptions() {
        if (!item || (item.type !== 'MANAGED_SERVICE' && item.type !== 'SERVICE_OPTION' && item.type !== 'CONNECTIVITY')) return;
        try {
            setAdvancedSaving(true);
            setAdvancedStatus(null);
            const normalizedOptions = itemDesignOptionRows.map((row) => ({
                designOptionId: row.designOptionId,
                isRequired: false,
                allowMulti: false,
                defaultValueId: null,
                allowedValueIds: row.allowedValueIds,
            }));

            const res = await fetch(`/api/admin/catalog/${item.id}/design-options`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ options: normalizedOptions }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to save design options');
            }

            setAdvancedStatus({ type: 'success', message: 'Design options saved' });
        } catch (err: any) {
            setAdvancedStatus({ type: 'error', message: err.message || 'Failed to save design options' });
        } finally {
            setAdvancedSaving(false);
        }
    }

    const addListDetail = (field: 'constraints' | 'assumptions') => {
        if (!item) return;
        setItem({
            ...item,
            [field]: [...item[field], { id: `temp-${Date.now()}`, description: '' }]
        });
    };

    const updateListDetail = (field: 'constraints' | 'assumptions', index: number, value: string) => {
        if (!item) return;
        const newList = [...item[field]];
        newList[index].description = value;
        setItem({ ...item, [field]: newList });
    };

    const removeListDetail = (field: 'constraints' | 'assumptions', index: number) => {
        if (!item) return;
        const newList = item[field].filter((_, i) => i !== index);
        setItem({ ...item, [field]: newList });
    };

    const addCollateral = () => {
        if (!item) return;
        setItem({
            ...item,
            collaterals: [...item.collaterals, { id: `temp-${Date.now()}`, title: '', documentUrl: '', type: 'PDF' }]
        });
    };

    const updateCollateral = (index: number, field: keyof CatalogItem['collaterals'][0], value: string) => {
        if (!item) return;
        const newList = [...item.collaterals];
        newList[index] = { ...newList[index], [field]: value };
        setItem({ ...item, collaterals: newList });
    };

    const removeCollateral = (index: number) => {
        if (!item) return;
        const newList = item.collaterals.filter((_, i) => i !== index);
        setItem({ ...item, collaterals: newList });
    };

    const searchItems = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) { setSearchResults([]); return; }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/admin/catalog?search=${encodeURIComponent(query)}&limit=20`);
            const data = await res.json();
            const results = (data.items ?? data) as any[];
            setSearchResults(results.filter((d: any) => d.id !== item?.id && !item?.childDependencies.some((cd: any) => cd.childId === d.id)));
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };


    const addDependency = (childItem: {id: string, name: string, sku: string}, type?: string) => {
        if (!item) return;
        const depType = type || 'INCLUDES';
        setItem({
            ...item,
            childDependencies: [
                ...item.childDependencies,
                {
                    id: `temp-${Date.now()}`,
                    childId: childItem.id,
                    type: depType,
                    quantityMultiplier: 1,
                    childItem: { id: childItem.id, name: childItem.name, sku: childItem.sku }
                }
            ]
        });
        setSearchQuery('');
        setSearchResults([]);
    };


    const removeDependency = (index: number) => {
        if (!item) return;
        const newList = item.childDependencies.filter((_, i) => i !== index);
        setItem({ ...item, childDependencies: newList });
    };

    const addCompositionRow = () => {
        const defaultTarget = serviceCompositionOptions[0];
        if (!defaultTarget) return;
        setCompositionRows((prev) => [
            ...prev,
            {
                catalogItemId: defaultTarget.id,
                role: 'OPTIONAL',
                minQty: 1,
                maxQty: null,
                defaultQty: 1,
                isSelectable: true,
                displayOrder: prev.length,
            },
        ]);
    };

    const updateCompositionRow = (index: number, patch: Partial<CompositionRow>) => {
        setCompositionRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
    };

    const removeCompositionRow = (index: number) => {
        setCompositionRows((prev) => prev.filter((_, idx) => idx !== index).map((row, idx) => ({ ...row, displayOrder: idx })));
    };

    const addDesignOptionRow = () => {
        const firstOption = designOptionDefinitions[0];
        if (!firstOption) return;
        setItemDesignOptionRows((prev) => [
            ...prev,
            {
                designOptionId: firstOption.id,
                isRequired: false,
                allowMulti: false,
                defaultValueId: null,
                allowedValueIds: [],
            },
        ]);
    };

    const updateDesignOptionRow = (index: number, patch: Partial<ItemDesignOptionRow>) => {
        setItemDesignOptionRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
    };

    const removeDesignOptionRow = (index: number) => {
        setItemDesignOptionRows((prev) => prev.filter((_, idx) => idx !== index));
    };

    const getDefinitionValues = (designOptionId: string) => {
        return designOptionDefinitions.find((opt) => opt.id === designOptionId)?.values || [];
    };

    const getPackageDesignSelection = (catalogItemId: string, designOptionId: string): PackageDesignOptionSelection | null => {
        return packageDesignSelections.find(
            (selection) => selection.catalogItemId === catalogItemId && selection.designOptionId === designOptionId
        ) || null;
    };

    const updatePackageDesignSelection = (
        catalogItemId: string,
        designOptionId: string,
        patch: Partial<PackageDesignOptionSelection>
    ) => {
        setPackageDesignSelections((prev) => {
            const keyMatch = (row: PackageDesignOptionSelection) =>
                row.catalogItemId === catalogItemId && row.designOptionId === designOptionId;
            const existing = prev.find(keyMatch);
            if (!existing) {
                return [
                    ...prev,
                    {
                        catalogItemId,
                        designOptionId,
                        mode: (patch.mode as PackageDesignOptionMode) || 'NONE',
                        valueIds: patch.valueIds || [],
                    },
                ];
            }
            return prev.map((row) => {
                if (!keyMatch(row)) return row;
                const nextMode = (patch.mode || row.mode) as PackageDesignOptionMode;
                const nextValues = patch.valueIds
                    ? Array.from(new Set(patch.valueIds))
                    : row.valueIds;
                return {
                    ...row,
                    ...patch,
                    mode: nextMode,
                    valueIds: nextMode === 'NONE' ? [] : nextValues,
                };
            });
        });
    };

    const featureTerms = taxonomyTerms.filter((term) => term.category === 'FEATURE');
    const classificationOptions = taxonomyTerms
        .filter((term) => term.category === 'CLASSIFICATION')
        .reduce<Array<{ value: string; label: string }>>((acc, term) => {
            const normalizedType = normalizeCatalogItemType(term.value);
            if (!normalizedType) return acc;
            if (acc.some((existing) => existing.value === normalizedType)) return acc;
            acc.push({ value: normalizedType, label: term.label || normalizedType });
            return acc;
        }, []);
    const supportSelectedSet = new Set(supportedFeatureTermIds);
    const filteredSupportFeatureTerms = featureTerms
        .filter((term) => {
            const needle = featureSearch.trim().toLowerCase();
            if (!needle) return true;
            return term.label.toLowerCase().includes(needle) || (term.value || '').toLowerCase().includes(needle);
        })
        .sort((a, b) => a.label.localeCompare(b.label));

    const updateFeatureStatus = (termId: string, status: FeatureStatus | '') => {
        setFeatureAssignments((prev) => {
            const filtered = prev.filter((row) => row.termId !== termId);
            if (!status) return filtered;
            return [...filtered, { termId, status }];
        });
    };

    const toggleSupportedFeature = (termId: string, checked: boolean) => {
        setSupportedFeatureTermIds((prev) => {
            if (checked) return Array.from(new Set([...prev, termId]));
            return prev.filter((id) => id !== termId);
        });
    };

    async function saveFeatureAssignments() {
        if (!item || (item.type !== 'MANAGED_SERVICE' && item.type !== 'SERVICE_OPTION' && item.type !== 'CONNECTIVITY')) return;
        try {
            setFeatureSaving(true);
            setFeatureStatus(null);

            const res = await fetch(`/api/admin/catalog/${item.id}/features`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ featureTermIds: supportedFeatureTermIds }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Failed to save features');
            }

            const assignedIds = (data.featureTermIds || []) as string[];
            const assignedTermIds = new Set(assignedIds);
            setSupportedFeatureTermIds(assignedIds);
            setFeatureAssignments([]);

            setItem((current) => {
                if (!current) return current;
                const nonFeatureAttributes = current.attributes.filter((attribute) => attribute.term.category !== 'FEATURE');
                const updatedFeatureAttributes = featureTerms
                    .filter((term) => assignedTermIds.has(term.id))
                    .map((term) => ({
                        id: `feature-${term.id}`,
                        taxonomyTermId: term.id,
                        term: { id: term.id, name: term.label, category: term.category },
                    }));
                return {
                    ...current,
                    attributes: [...nonFeatureAttributes, ...updatedFeatureAttributes],
                };
            });

            setFeatureStatus({ type: 'success', message: 'Features saved' });
        } catch (error: any) {
            setFeatureStatus({ type: 'error', message: error.message || 'Failed to save features' });
        } finally {
            setFeatureSaving(false);
        }
    }

    const editableCatalogOptions = catalogLookup.filter((c) => c.id !== item?.id);
    const serviceCompositionOptions = editableCatalogOptions.filter((c) =>
        ['MANAGED_SERVICE', 'SERVICE_OPTION', 'CONNECTIVITY'].includes(c.type)
    );
    const compositionRowsByOrder = compositionRows
        .map((row, index) => ({ row, index }))
        .sort((a, b) => a.row.displayOrder - b.row.displayOrder);

    // --- Visibility Logic ---
    const getVisibilityRules = (panelName: string) => {
        const terms = taxonomyTerms.filter(t => t.category === `PANEL_${panelName}`);
        return terms.map(t => t.value).filter((v): v is string => !!v);
    };

    const isPanelVisible = (panelName: string) => {
        if (!item) return false;
        const allowedTypes = getVisibilityRules(panelName);
        // If no rules are set in the database, the panel is hidden by default.
        // This ensures visibility is solely determined by taxonomy entries.
        return allowedTypes.includes(item.type);
    };

    if (loading) return (
        <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
    );

    if (!item) return <div>Item not found</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between sticky top-0 bg-slate-50/80 backdrop-blur-md py-4 z-10 border-b border-slate-200 -mx-4 px-4">
                <div className="flex items-center gap-4">
                    <Link href="/admin/catalog">
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <ChevronLeft size={20} />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            {id === 'new' ? 'Create New Item' : `Edit ${item.name}`}
                        </h1>
                        <p className="text-sm text-slate-500 font-mono italic">{id === 'new' ? 'New SKU' : item.sku}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {status && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium animate-in fade-in slide-in-from-right-4 ${
                            status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                        }`}>
                            {status.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            {status.message}
                        </div>
                    )}
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-600/20"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText size={18} className="text-blue-500" />
                            <h2 className="font-bold text-slate-900">Core Identification</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">SKU</label>
                                <Input 
                                    value={item.sku} 
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setItem({...item, sku: e.target.value})}
                                    placeholder="e.g. NET-SDWAN-001"
                                    className="bg-slate-50 border-slate-200"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Name</label>
                                <Input 
                                    value={item.name} 
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => setItem({...item, name: e.target.value})}
                                    placeholder="e.g. Meraki SD-WAN Managed"
                                    className="bg-slate-50 border-slate-200"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Short Description</label>
                            <Input 
                                value={item.shortDescription || ''} 
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setItem({...item, shortDescription: e.target.value})}
                                placeholder="One-line summary for UI displays"
                                className="bg-slate-50 border-slate-200"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detailed Description</label>
                            <Textarea 
                                value={item.detailedDescription || ''} 
                                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setItem({...item, detailedDescription: e.target.value})}
                                placeholder="Full technical and commercial details..."
                                className="min-h-[150px] bg-slate-50 border-slate-200"
                            />
                        </div>
                    </section>

                    {/* Constraints & Assumptions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Constraints</h2>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => addListDetail('constraints')}>
                                    <Plus size={16} />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {item.constraints.map((c, i) => (
                                    <div key={c.id} className="flex gap-2">
                                        <Textarea 
                                            value={c.description} 
                                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateListDetail('constraints', i, e.target.value)}
                                            className="text-xs bg-slate-50 border-slate-200 min-h-[60px]"
                                            placeholder="Requirement or limitation..."
                                        />
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-slate-400 hover:text-rose-500 h-8 self-center"
                                            onClick={() => removeListDetail('constraints', i)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                ))}
                                {item.constraints.length === 0 && (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">No constraints defined.</p>
                                )}
                            </div>
                        </section>

                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Assumptions</h2>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => addListDetail('assumptions')}>
                                    <Plus size={16} />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {item.assumptions.map((a, i) => (
                                    <div key={a.id} className="flex gap-2">
                                        <Textarea 
                                            value={a.description} 
                                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateListDetail('assumptions', i, e.target.value)}
                                            className="text-xs bg-slate-50 border-slate-200 min-h-[60px]"
                                            placeholder="Pre-requisite or assumption..."
                                        />
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="text-slate-400 hover:text-rose-500 h-8 self-center"
                                            onClick={() => removeListDetail('assumptions', i)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                ))}
                                {item.assumptions.length === 0 && (
                                    <p className="text-xs text-slate-400 italic py-4 text-center">No assumptions defined.</p>
                                )}
                            </div>
                        </section>
                    </div>

                    {item.type === 'PACKAGE' && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 shadow-sm">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="font-bold text-slate-900">Design Options</h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Define package pre-design by included service: select fixed options vs guided-phase configurable options, and set feature posture.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={addCompositionRow}
                                        className="gap-2 whitespace-nowrap shrink-0"
                                        disabled={serviceCompositionOptions.length === 0}
                                    >
                                        <Plus size={12} /> Add Included Service
                                    </Button>
                                    <Button
                                        onClick={savePackageControls}
                                        disabled={advancedSaving}
                                        className="gap-2 whitespace-nowrap shrink-0"
                                    >
                                        {advancedSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                        Save Package Design
                                    </Button>
                                </div>
                            </div>

                            {compositionRowsByOrder.length === 0 && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs text-slate-600">No included services yet. Add a service to start defining package design options and features.</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                {compositionRowsByOrder.map(({ row, index }) => {
                                    const itemMeta = catalogLookup.find((catalog) => catalog.id === row.catalogItemId);
                                    const workspace = packageServiceWorkspaces[row.catalogItemId];
                                    return (
                                        <div key={`package-service-${index}-${row.catalogItemId}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                                                <div className="md:col-span-8">
                                                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Included Service</label>
                                                    <select
                                                        value={row.catalogItemId}
                                                        onChange={(e) => updateCompositionRow(index, { catalogItemId: e.target.value })}
                                                        className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                                    >
                                                        {serviceCompositionOptions.map((opt) => (
                                                            <option key={opt.id} value={opt.id}>
                                                                {opt.sku} - {opt.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="md:col-span-3">
                                                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Role</label>
                                                    <select
                                                        value={row.role}
                                                        onChange={(e) => updateCompositionRow(index, { role: e.target.value as CompositionRow['role'] })}
                                                        className="mt-1 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                                    >
                                                        <option value="REQUIRED">Required</option>
                                                        <option value="OPTIONAL">Optional</option>
                                                        <option value="AUTO_INCLUDED">Auto Included</option>
                                                    </select>
                                                </div>
                                                <div className="md:col-span-1 flex items-end justify-end">
                                                    <Button size="sm" variant="ghost" onClick={() => removeCompositionRow(index)} className="h-8 w-8 p-0 text-rose-500">
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <label className="text-xs text-slate-700 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={row.isSelectable}
                                                        onChange={(e) => updateCompositionRow(index, { isSelectable: e.target.checked })}
                                                    />
                                                    Selectable in guided phase
                                                </label>
                                                <p className="text-[11px] text-slate-500">
                                                    {itemMeta ? `${itemMeta.name} (${itemMeta.type})` : row.catalogItemId}
                                                </p>
                                            </div>

                                            {workspace?.error && <p className="text-xs text-rose-600">{workspace.error}</p>}

                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Design Options</h3>
                                                    {workspace && workspace.designOptions.length > 0 ? workspace.designOptions.map((option) => {
                                                        const selection = getPackageDesignSelection(row.catalogItemId, option.designOptionId) || {
                                                            catalogItemId: row.catalogItemId,
                                                            designOptionId: option.designOptionId,
                                                            mode: 'NONE' as PackageDesignOptionMode,
                                                            valueIds: [],
                                                        };

                                                        return (
                                                            <div key={`pkg-opt-${row.catalogItemId}-${option.designOptionId}`} className="rounded-md border border-slate-200 bg-slate-50 p-2 space-y-2">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                                                                    <p className="text-[11px] text-slate-500 font-mono">{option.key}</p>
                                                                </div>
                                                                <select
                                                                    value={selection.mode}
                                                                    onChange={(e) => updatePackageDesignSelection(row.catalogItemId, option.designOptionId, { mode: e.target.value as PackageDesignOptionMode, valueIds: [] })}
                                                                    className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                                                >
                                                                    <option value="NONE">Not Defined</option>
                                                                    <option value="FIXED">Fixed in Package</option>
                                                                    <option value="CONFIGURABLE">Configurable in Guided Flow</option>
                                                                </select>

                                                                {selection.mode === 'FIXED' && (
                                                                    <select
                                                                        value={selection.valueIds[0] || ''}
                                                                        onChange={(e) => updatePackageDesignSelection(row.catalogItemId, option.designOptionId, { valueIds: e.target.value ? [e.target.value] : [] })}
                                                                        className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                                                    >
                                                                        <option value="">Select fixed value</option>
                                                                        {option.valueChoices.map((choice) => (
                                                                            <option key={choice.id} value={choice.id}>
                                                                                {choice.label} ({choice.value})
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                )}

                                                                {selection.mode === 'CONFIGURABLE' && (
                                                                    <div className="rounded-md border border-slate-200 bg-white p-2 grid grid-cols-1 gap-1">
                                                                        {option.valueChoices.map((choice) => (
                                                                            <label key={choice.id} className="text-xs text-slate-700 flex items-center gap-2">
                                                                                <input
                                                                                    type="checkbox"
                                                                                    checked={selection.valueIds.includes(choice.id)}
                                                                                    onChange={(e) => {
                                                                                        const next = e.target.checked
                                                                                            ? [...selection.valueIds, choice.id]
                                                                                            : selection.valueIds.filter((id) => id !== choice.id);
                                                                                        updatePackageDesignSelection(row.catalogItemId, option.designOptionId, { valueIds: next });
                                                                                    }}
                                                                                />
                                                                                {choice.label} ({choice.value})
                                                                            </label>
                                                                        ))}
                                                                        {option.valueChoices.length === 0 && <p className="text-[11px] text-slate-500">No selectable values for this option.</p>}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }) : (
                                                        <p className="text-xs text-slate-500">No design options available from this service.</p>
                                                    )}
                                                </div>

                                                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Features</h3>
                                                    {workspace && workspace.supportedFeatures.length > 0 ? workspace.supportedFeatures.map((feature) => {
                                                        const status = featureAssignments.find((row) => row.termId === feature.id)?.status || '';
                                                        return (
                                                            <div
                                                                key={`pkg-feature-${row.catalogItemId}-${feature.id}`}
                                                                className="rounded-md border border-slate-200 bg-slate-50 p-2 flex flex-col gap-2"
                                                            >
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-slate-900">{feature.label}</p>
                                                                    {feature.value && <p className="text-[11px] text-slate-500 font-mono">{feature.value}</p>}
                                                                </div>
                                                                <div className="w-full">
                                                                    <select
                                                                        value={status}
                                                                        onChange={(e) => updateFeatureStatus(feature.id, e.target.value as FeatureStatus | '')}
                                                                        className="h-8 w-full min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                                                    >
                                                                        <option value="">Not Included</option>
                                                                        <option value="REQUIRED">Required</option>
                                                                        <option value="STANDARD">Standard</option>
                                                                        <option value="OPTIONAL">Optional</option>
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        );
                                                    }) : (
                                                        <p className="text-xs text-slate-500">No supported features available from this service.</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {advancedStatus && (
                                <p className={`text-xs ${advancedStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {advancedStatus.message}
                                </p>
                            )}
                        </section>
                    )}

                    {/* Design Options */}
                    {(item.type === 'MANAGED_SERVICE' || item.type === 'SERVICE_OPTION' || item.type === 'CONNECTIVITY') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold text-slate-900">Design Options</h2>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={addDesignOptionRow}
                                    className="gap-2"
                                    disabled={designOptionDefinitions.length === 0}
                                >
                                    <Plus size={12} /> Add Design Option
                                </Button>
                            </div>
                            {designOptionDefinitions.length === 0 && (
                                <p className="text-xs text-amber-600">Create design option definitions in Taxonomy before assigning item design options.</p>
                            )}
                            <div className="space-y-3">
                                {itemDesignOptionRows.map((row, index) => {
                                    const values = getDefinitionValues(row.designOptionId);
                                    return (
                                        <div key={`design-option-main-${index}`} className="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50">
                                            <select
                                                value={row.designOptionId}
                                                onChange={(e) => updateDesignOptionRow(index, { designOptionId: e.target.value, allowedValueIds: [], defaultValueId: null })}
                                                className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                                            >
                                                {designOptionDefinitions.map((opt) => (
                                                    <option key={opt.id} value={opt.id}>
                                                    {opt.label} ({opt.key})
                                                </option>
                                            ))}
                                            </select>
                                            <div className="rounded-lg border border-slate-200 bg-white p-2">
                                                <p className="text-[10px] font-semibold text-slate-500 mb-1">Allowed Values</p>
                                                <div className="grid grid-cols-2 gap-1">
                                                    {values.map((value) => (
                                                        <label key={value.id} className="text-xs text-slate-700 flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={row.allowedValueIds.includes(value.id)}
                                                                onChange={(e) => {
                                                                    const next = e.target.checked
                                                                        ? [...row.allowedValueIds, value.id]
                                                                        : row.allowedValueIds.filter((id) => id !== value.id);
                                                                    updateDesignOptionRow(index, { allowedValueIds: Array.from(new Set(next)) });
                                                                }}
                                                            />
                                                            {value.label} ({value.value})
                                                        </label>
                                                    ))}
                                                    {values.length === 0 && <p className="text-[11px] text-slate-500">No values configured for this design option.</p>}
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <Button size="sm" variant="ghost" onClick={() => removeDesignOptionRow(index)} className="h-7 w-7 p-0 text-rose-500">
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {itemDesignOptionRows.length === 0 && <p className="text-xs text-slate-500">No design option assignments yet.</p>}
                            </div>
                            <Button onClick={saveItemDesignOptions} disabled={advancedSaving} className="w-full gap-2">
                                {advancedSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Design Options
                            </Button>
                            {advancedStatus && (
                                <p className={`text-xs ${advancedStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {advancedStatus.message}
                                </p>
                            )}
                        </section>
                    )}

                    {/* Features */}
                    {isPanelVisible('FEATURES') && (item.type === 'MANAGED_SERVICE' || item.type === 'SERVICE_OPTION' || item.type === 'CONNECTIVITY') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className="font-bold text-slate-900">Supported Features</h2>
                                <Button onClick={saveFeatureAssignments} disabled={featureSaving} className="gap-2">
                                    {featureSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save Features
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                Select which features this service/connectivity supports. Design Packages can only classify supported features from included services.
                            </p>
                            <Input
                                value={featureSearch}
                                onChange={(e) => setFeatureSearch(e.target.value)}
                                placeholder="Search features..."
                                className="h-8 text-xs bg-white"
                            />
                            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-2">
                                {filteredSupportFeatureTerms.map((term) => (
                                    <label key={`support-${term.id}`} className="flex items-start gap-3 rounded-md border border-slate-200 bg-white p-2">
                                        <input
                                            type="checkbox"
                                            checked={supportSelectedSet.has(term.id)}
                                            onChange={(e) => toggleSupportedFeature(term.id, e.target.checked)}
                                            className="mt-0.5"
                                        />
                                        <span className="min-w-0">
                                            <span className="block text-sm font-semibold text-slate-900">{term.label}</span>
                                            {term.value && <span className="block text-[11px] text-slate-500 font-mono">{term.value}</span>}
                                        </span>
                                    </label>
                                ))}
                                {filteredSupportFeatureTerms.length === 0 && (
                                    <p className="text-xs text-slate-500 px-2 py-3">No features found.</p>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-500">
                                Selected: {supportedFeatureTermIds.length}
                            </p>

                            {featureTerms.length === 0 && (
                                <p className="text-xs text-slate-500">No feature terms found. Add FEATURE terms in Taxonomy first.</p>
                            )}
                            {featureStatus && (
                                <p className={`text-xs ${featureStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {featureStatus.message}
                                </p>
                            )}
                        </section>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Item Type & Metadata */}
                    <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item Classification</label>
                            <select 
                                value={item.type}
                                onChange={(e) => setItem({...item, type: e.target.value})}
                                className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 font-medium text-slate-900"
                            >
                                {classificationOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                                {classificationOptions.length === 0 && (
                                    <>
                                        {CATALOG_ITEM_TYPES.map((type) => (
                                            <option key={type} value={type}>
                                                {type.replaceAll('_', ' ')}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                        </div>
                    </section>

                    {/* Pricing */}
                    {isPanelVisible('PRICING') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <h2 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Technical Cost Profile</h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost (NRC)</label>
                                    <Input 
                                        type="number"
                                        value={item.pricing[0]?.costNrc || 0}
                                        onChange={(e) => setItem({
                                            ...item,
                                            pricing: [{...(item.pricing[0] || {}), costNrc: parseFloat(e.target.value) || 0}]
                                        } as any)}
                                        className="h-8 bg-slate-50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost (MRC)</label>
                                    <Input 
                                        type="number"
                                        value={item.pricing[0]?.costMrc || 0}
                                        onChange={(e) => setItem({
                                            ...item,
                                            pricing: [{...(item.pricing[0] || {}), costMrc: parseFloat(e.target.value) || 0}]
                                        } as any)}
                                        className="h-8 bg-slate-50"
                                    />
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Service Options */}
                    {isPanelVisible('SERVICE_OPTIONS') && item.type !== 'PACKAGE' && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Included Services</h2>
                            </div>
                            
                            {/* Search for new dependency */}
                            <div className="relative">
                                <div className="flex gap-2 mb-3">
                                    <Input 
                                        value={searchQuery}
                                        onChange={(e) => searchItems(e.target.value)}
                                        placeholder="Search..."
                                        className="text-xs h-8 bg-slate-50"
                                    />
                                </div>
                                
                                {searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 divide-y divide-slate-100">
                                        {searchResults.map(res => (
                                            <button 
                                                key={res.id}
                                                onClick={() => addDependency(res, 'INCLUDES')}
                                                className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center justify-between group transition-colors rounded-lg"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-mono text-slate-400">{res.sku}</p>
                                                    <p className="text-xs font-bold text-slate-700 truncate">{res.name}</p>
                                                </div>
                                                <Plus size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                                
                                {isSearching && <div className="absolute right-3 top-2"><Loader2 size={12} className="animate-spin text-blue-500" /></div>}
                            </div>

                            <div className="space-y-2">
                                {item.childDependencies
                                    .map((d, i) => {
                                        if (d.type !== 'INCLUDES') return null;
                                        return (
                                            <div key={d.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50 border-dashed">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-mono text-slate-400">{d.childItem.sku}</p>
                                                    <p className="text-xs font-bold text-slate-700 truncate">{d.childItem.name}</p>
                                                </div>
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-500"
                                                    onClick={() => removeDependency(i)}
                                                >
                                                    <Trash2 size={12} />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                {item.childDependencies.filter(d => d.type === 'INCLUDES').length === 0 && (
                                    <p className="text-xs text-slate-400 italic py-2 text-center text-balance">
                                        No services linked.
                                    </p>
                                )}
                            </div>
                        </section>
                    )}

                    {/* Collateral */}
                    {isPanelVisible('ATTACHMENTS') && (
                        <section className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="font-bold text-slate-900">Collateral</h2>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={addCollateral}>
                                    <Plus size={16} />
                                </Button>
                            </div>
                            <div className="space-y-3">
                                {item.collaterals.map((c, i) => (
                                    <div key={c.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                value={c.title} 
                                                onChange={(e) => updateCollateral(i, 'title', e.target.value)}
                                                placeholder="Title (e.g. Datasheet)"
                                                className="text-xs h-7 bg-white"
                                            />
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="text-slate-400 hover:text-rose-500 h-7 w-7 p-0"
                                                onClick={() => removeCollateral(i)}
                                            >
                                                <Trash2 size={12} />
                                            </Button>
                                        </div>
                                        <Input 
                                            value={c.documentUrl} 
                                            onChange={(e) => updateCollateral(i, 'documentUrl', e.target.value)}
                                            placeholder="URL (Drive, SharePoint, etc.)"
                                            className="text-[10px] h-6 bg-white"
                                        />
                                        <select 
                                            value={c.type}
                                            onChange={(e) => updateCollateral(i, 'type', e.target.value)}
                                            className="w-full text-[10px] h-6 rounded-md border border-slate-200 bg-white px-2"
                                        >
                                            <option value="PDF">PDF</option>
                                            <option value="DOC">DOC</option>
                                            <option value="SLIDES">SLIDES</option>
                                            <option value="VIDEO">VIDEO</option>
                                            <option value="LINK">LINK</option>
                                        </select>
                                    </div>
                                ))}
                                {item.collaterals.length === 0 && (
                                    <p className="text-xs text-slate-400 italic py-2 text-center">No documents linked.</p>
                                )}
                            </div>
                        </section>
                    )}

                </div>
            </div>
        </div>
    );
}
