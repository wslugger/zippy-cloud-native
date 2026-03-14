'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, ChevronLeft, ChevronRight, Loader2, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GuidedFlowWizardProps {
  projectId: string;
  onComplete: () => void;
}

type WizardStep = 1 | 2 | 3;

type CatalogItemType = 'PACKAGE' | 'MANAGED_SERVICE' | 'SERVICE_OPTION' | 'CONNECTIVITY' | 'HARDWARE';

type DependencyType = 'REQUIRES' | 'INCLUDES' | 'MANDATORY_ATTACHMENT' | 'OPTIONAL_ATTACHMENT' | 'INCOMPATIBLE' | 'RECOMMENDS';

type PackageRole = 'REQUIRED' | 'OPTIONAL' | 'AUTO_INCLUDED';

interface FeatureAttribute {
  taxonomyTermId: string;
  term: {
    category: string;
    label: string;
    value: string;
  };
}

interface DesignOptionValue {
  id: string;
  value: string;
  label: string;
}

interface ItemDesignOptionAssignment {
  id: string;
  isRequired: boolean;
  allowMulti: boolean;
  designOption: {
    id: string;
    key: string;
    label: string;
    values: DesignOptionValue[];
  };
  allowedValues: Array<{ designOptionValue: DesignOptionValue }>;
  defaultValue: DesignOptionValue | null;
}

interface BuilderItem {
  id: string;
  sku: string;
  name: string;
  type: CatalogItemType;
  shortDescription: string | null;
  detailedDescription: string | null;
  configSchema?: unknown;
  attributes: FeatureAttribute[];
  childDependencies: ItemDependency[];
  designOptions: ItemDesignOptionAssignment[];
}

interface ItemDependency {
  type: DependencyType;
  childId: string;
  childItem: BuilderItem;
}

interface PackageCompositionRow {
  role: PackageRole;
  catalogItemId: string;
  catalogItem: BuilderItem;
}

interface TopLevelItem extends BuilderItem {
  packageCompositions: PackageCompositionRow[];
}

interface ProjectSelectionRow {
  catalogItemId: string;
  quantity: number;
  configValues: unknown;
  designOptionValues: unknown;
}

interface BuilderPayload {
  projectId: string;
  projectSelections: ProjectSelectionRow[];
  topLevelItems: TopLevelItem[];
}

interface SelectionDraft {
  catalogItemId: string;
  quantity: number;
  configValues: Record<string, unknown>;
  designOptionValues: Record<string, string[]>;
}

interface ServiceConfigItem {
  item: BuilderItem;
  packageId: string | null;
}

const CONFIGURABLE_TYPES = new Set<CatalogItemType>(['MANAGED_SERVICE', 'SERVICE_OPTION', 'CONNECTIVITY']);

const MANDATORY_DEPENDENCY_TYPES = new Set<DependencyType>(['REQUIRES', 'INCLUDES', 'MANDATORY_ATTACHMENT']);

const OPTIONAL_DEPENDENCY_TYPES = new Set<DependencyType>(['OPTIONAL_ATTACHMENT']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeConfigValues(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeDesignOptionValues(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};

  const output: Record<string, string[]> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === 'string') {
      output[key] = [rawValue];
      continue;
    }

    if (Array.isArray(rawValue)) {
      const strings = rawValue.filter((entry): entry is string => typeof entry === 'string');
      if (strings.length > 0) {
        output[key] = Array.from(new Set(strings));
      }
    }
  }

  return output;
}

function collectItemIndex(items: TopLevelItem[]): Map<string, BuilderItem> {
  const index = new Map<string, BuilderItem>();

  const visit = (item: BuilderItem) => {
    if (!index.has(item.id)) {
      index.set(item.id, item);
    }

    for (const dep of item.childDependencies ?? []) {
      if (!index.has(dep.childItem.id)) {
        visit(dep.childItem);
      }
    }
  };

  for (const topLevel of items) {
    visit(topLevel);
    for (const row of topLevel.packageCompositions ?? []) {
      visit(row.catalogItem);
    }
  }

  return index;
}

function getItemFeatures(item: BuilderItem): Array<{ termId: string; label: string }> {
  return (item.attributes ?? [])
    .filter((attribute) => attribute.term.category === 'FEATURE')
    .map((attribute) => ({
      termId: attribute.taxonomyTermId,
      label: attribute.term.label || attribute.term.value,
    }))
    .filter((feature) => feature.label.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function parsePackageFeatureAssignments(item: TopLevelItem): Record<string, 'REQUIRED' | 'STANDARD' | 'OPTIONAL'> {
  const config = isRecord(item.configSchema) ? item.configSchema : {};
  const rawAssignments = config.packageFeatureAssignments;
  if (!isRecord(rawAssignments)) return {};

  const result: Record<string, 'REQUIRED' | 'STANDARD' | 'OPTIONAL'> = {};
  for (const [termId, value] of Object.entries(rawAssignments)) {
    if (value === 'REQUIRED' || value === 'STANDARD' || value === 'OPTIONAL') {
      result[termId] = value;
    }
  }

  return result;
}

async function parseJsonResponse<T>(response: Response): Promise<T | null> {
  const raw = await response.text();
  if (!raw.trim()) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function GuidedFlowWizard({ projectId, onComplete }: GuidedFlowWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [topLevelItems, setTopLevelItems] = useState<TopLevelItem[]>([]);
  const [lockedTopLevelIds, setLockedTopLevelIds] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, SelectionDraft>>({});

  const loadBuilder = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/design-builder`);
      const payload = await parseJsonResponse<BuilderPayload & { error?: string }>(response);

      if (!response.ok || !payload || !('projectId' in payload)) {
        throw new Error(payload?.error || 'Failed to load design builder');
      }

      setTopLevelItems(payload.topLevelItems);

      const initialSelections: Record<string, SelectionDraft> = {};
      for (const row of payload.projectSelections) {
        initialSelections[row.catalogItemId] = {
          catalogItemId: row.catalogItemId,
          quantity: row.quantity || 1,
          configValues: normalizeConfigValues(row.configValues),
          designOptionValues: normalizeDesignOptionValues(row.designOptionValues),
        };
      }

      const preselectedTopLevelIds = payload.topLevelItems
        .filter((item) => Boolean(initialSelections[item.id]))
        .map((item) => item.id);

      setLockedTopLevelIds(preselectedTopLevelIds);
      if (preselectedTopLevelIds.length > 0) {
        setStep(2);
      } else {
        setStep(1);
      }

      setSelections(initialSelections);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load design builder');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadBuilder();
  }, [loadBuilder]);

  const itemIndex = useMemo(() => collectItemIndex(topLevelItems), [topLevelItems]);

  const selectedTopLevelItems = useMemo(
    () => topLevelItems.filter((item) => Boolean(selections[item.id])),
    [topLevelItems, selections]
  );

  const scopeIsLockedToProjectSelection = lockedTopLevelIds.length > 0;

  const visibleTopLevelItems = useMemo(
    () =>
      scopeIsLockedToProjectSelection
        ? topLevelItems.filter((item) => lockedTopLevelIds.includes(item.id))
        : topLevelItems,
    [topLevelItems, lockedTopLevelIds, scopeIsLockedToProjectSelection]
  );

  const selectedPackages = useMemo(
    () => selectedTopLevelItems.filter((item) => item.type === 'PACKAGE'),
    [selectedTopLevelItems]
  );

  const topLevelSelectionCount = selectedTopLevelItems.length;

  const packageMemberRows = useMemo(() => {
    return selectedPackages.map((pkg) => {
      const members = pkg.packageCompositions
        .filter((row) => CONFIGURABLE_TYPES.has(row.catalogItem.type))
        .map((row) => ({
          packageId: pkg.id,
          packageName: pkg.name,
          role: row.role,
          item: row.catalogItem,
          selected: row.role !== 'OPTIONAL' || Boolean(selections[row.catalogItemId]),
          locked: row.role !== 'OPTIONAL',
        }));

      const featureUniverse = new Map<string, string>();
      for (const row of pkg.packageCompositions) {
        for (const feature of getItemFeatures(row.catalogItem)) {
          featureUniverse.set(feature.termId, feature.label);
        }
      }

      return {
        packageId: pkg.id,
        packageName: pkg.name,
        packageFeatures: featureUniverse,
        packageFeatureAssignments: parsePackageFeatureAssignments(pkg),
        members,
      };
    });
  }, [selectedPackages, selections]);

  const serviceConfigItems = useMemo(() => {
    const rows: ServiceConfigItem[] = [];
    const seen = new Set<string>();

    const add = (item: BuilderItem, packageId: string | null) => {
      if (!CONFIGURABLE_TYPES.has(item.type)) return;
      if (seen.has(item.id)) return;
      seen.add(item.id);
      rows.push({ item, packageId });
    };

    for (const item of selectedTopLevelItems) {
      if (item.type !== 'PACKAGE') {
        add(item, null);
      }
    }

    for (const pkg of packageMemberRows) {
      for (const member of pkg.members) {
        if (member.selected) {
          add(member.item, pkg.packageId);
        }
      }
    }

    for (const itemId of Object.keys(selections)) {
      const item = itemIndex.get(itemId);
      if (item) {
        add(item, null);
      }
    }

    return rows;
  }, [selectedTopLevelItems, packageMemberRows, selections, itemIndex]);

  const saveSelections = useCallback(async () => {
    setSaving(true);
    setError(null);
    setStatus(null);

    try {
      const payload = {
        selections: Object.values(selections).map((selection) => ({
          catalogItemId: selection.catalogItemId,
          quantity: selection.quantity,
          configValues: selection.configValues,
          designOptionValues: selection.designOptionValues,
        })),
      };

      const response = await fetch(`/api/projects/${projectId}/design-builder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await parseJsonResponse<{ error?: string }>(response);
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save design selections');
      }

      setStatus('Design selections saved.');
      onComplete();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save design selections');
    } finally {
      setSaving(false);
    }
  }, [projectId, selections, onComplete]);

  const toggleTopLevelItem = (item: TopLevelItem) => {
    setSelections((previous) => {
      const next = { ...previous };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = {
          catalogItemId: item.id,
          quantity: 1,
          configValues: {},
          designOptionValues: {},
        };
      }
      return next;
    });
  };

  const toggleOptionalPackageMember = (itemId: string, selected: boolean) => {
    setSelections((previous) => {
      const next = { ...previous };
      if (selected) {
        next[itemId] = next[itemId] ?? {
          catalogItemId: itemId,
          quantity: 1,
          configValues: {},
          designOptionValues: {},
        };
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const toggleOptionalDependency = (itemId: string, selected: boolean) => {
    setSelections((previous) => {
      const next = { ...previous };
      if (selected) {
        next[itemId] = next[itemId] ?? {
          catalogItemId: itemId,
          quantity: 1,
          configValues: {},
          designOptionValues: {},
        };
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const setOptionValue = (itemId: string, optionKey: string, values: string[]) => {
    setSelections((previous) => {
      const existing = previous[itemId] ?? {
        catalogItemId: itemId,
        quantity: 1,
        configValues: {},
        designOptionValues: {},
      };

      const nextOptionValues = { ...existing.designOptionValues };
      if (values.length === 0) {
        delete nextOptionValues[optionKey];
      } else {
        nextOptionValues[optionKey] = Array.from(new Set(values));
      }

      return {
        ...previous,
        [itemId]: {
          ...existing,
          designOptionValues: nextOptionValues,
        },
      };
    });
  };

  const canContinueFromStep1 = topLevelSelectionCount > 0;
  const canContinueFromStep2 = serviceConfigItems.length > 0;
  const minStep: WizardStep = scopeIsLockedToProjectSelection ? 2 : 1;

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 flex items-center justify-center gap-2 text-slate-600">
        <Loader2 size={18} className="animate-spin" /> Loading design builder...
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {[1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  step === index
                    ? 'bg-zippy-green text-white ring-4 ring-zippy-green/10'
                    : step > index
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                )}
              >
                {step > index ? <Check size={18} /> : index}
              </div>
              {index < 3 && (
                <div className={cn('h-1 w-12 md:w-24 rounded-full', step > index ? 'bg-emerald-500' : 'bg-slate-200')} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-8 min-h-[520px] overflow-y-auto max-h-[72vh] space-y-6">
        {step === 1 && (
          <>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Design Scope Selection</h2>
              <p className="text-slate-500 text-lg mt-2">
                {scopeIsLockedToProjectSelection
                  ? 'Using the package/service already selected in this project.'
                  : 'Select project-level packages and services. This flow does not use attachments.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleTopLevelItems.map((item) => {
                const selected = Boolean(selections[item.id]);
                const requiredCount = item.packageCompositions.filter((row) => row.role !== 'OPTIONAL').length;
                const optionalCount = item.packageCompositions.filter((row) => row.role === 'OPTIONAL').length;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!scopeIsLockedToProjectSelection) {
                        toggleTopLevelItem(item);
                      }
                    }}
                    className={cn(
                      'text-left p-5 rounded-2xl border-2 transition-all',
                      selected ? 'border-zippy-green bg-zippy-green-light/20' : 'border-slate-200 hover:border-slate-300 bg-white',
                      scopeIsLockedToProjectSelection ? 'cursor-default' : ''
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{item.sku}</p>
                        <p className="text-sm text-slate-600 mt-2">{item.shortDescription || 'No short description.'}</p>
                      </div>
                      <span className={cn('text-[10px] font-semibold px-2 py-1 rounded', selected ? 'bg-zippy-green text-white' : 'bg-slate-200 text-slate-700')}>
                        {selected ? 'Selected' : item.type}
                      </span>
                    </div>
                    {item.type === 'PACKAGE' && (
                      <p className="text-xs text-slate-500 mt-3">
                        {requiredCount} required / {optionalCount} optional members
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Service Configuration</h2>
              <p className="text-slate-500 text-lg mt-2">Configure selected services, optional package members, and design options.</p>
            </div>

            <div className="space-y-4">
              {packageMemberRows.map((pkg) => (
                <div key={pkg.packageId} className="rounded-2xl border border-slate-300 p-4 space-y-3 bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{pkg.packageName} Package Members</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {pkg.members.map((member) => (
                      <label key={`${pkg.packageId}-${member.item.id}`} className="flex items-start gap-2 rounded border border-slate-200 bg-white p-2">
                        <input
                          type="checkbox"
                          checked={member.selected}
                          disabled={member.locked}
                          onChange={(event) => toggleOptionalPackageMember(member.item.id, event.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          <span className="text-sm font-semibold text-slate-900 block">{member.item.name}</span>
                          <span className="text-[11px] text-slate-500">{member.role === 'OPTIONAL' ? 'Optional' : 'Required by package'}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {serviceConfigItems.map(({ item, packageId }) => {
                const selection = selections[item.id];

                const dependencyRows = (item.childDependencies ?? [])
                  .filter((dep) => dep.childItem.type === 'SERVICE_OPTION' || dep.childItem.type === 'CONNECTIVITY')
                  .filter((dep) => OPTIONAL_DEPENDENCY_TYPES.has(dep.type) || MANDATORY_DEPENDENCY_TYPES.has(dep.type))
                  .map((dep) => ({
                    dep,
                    mandatory: MANDATORY_DEPENDENCY_TYPES.has(dep.type),
                    selected: MANDATORY_DEPENDENCY_TYPES.has(dep.type) || Boolean(selections[dep.childId]),
                  }));

                return (
                  <div key={item.id} className="rounded-2xl border border-slate-300 bg-white p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900">{item.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{item.sku} · {item.type}</p>
                        <p className="text-sm text-slate-600 mt-1">{item.shortDescription || 'No short description.'}</p>
                      </div>
                      {packageId && (
                        <span className="text-[10px] font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                          From Package
                        </span>
                      )}
                    </div>

                    {dependencyRows.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Add-on Services</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {dependencyRows.map(({ dep, mandatory, selected }) => (
                            <label key={`${item.id}-${dep.childId}`} className="flex items-start gap-2 rounded border border-slate-200 bg-slate-50 p-2">
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={mandatory}
                                onChange={(event) => toggleOptionalDependency(dep.childId, event.target.checked)}
                                className="mt-1"
                              />
                              <span>
                                <span className="text-sm font-semibold text-slate-900 block">{dep.childItem.name}</span>
                                <span className="text-[11px] text-slate-500">
                                  {mandatory ? 'Included by catalog dependency' : 'Optional add-on'}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 mb-2">Design Options</p>
                      {(item.designOptions ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500">No design options assigned to this service.</p>
                      ) : (
                        <div className="space-y-3">
                          {(item.designOptions ?? []).map((assignment) => {
                            const availableValues = assignment.allowedValues.length > 0
                              ? assignment.allowedValues.map((row) => row.designOptionValue)
                              : assignment.designOption.values;

                            const selectedValues = selection?.designOptionValues[assignment.designOption.key]
                              ?? (assignment.defaultValue ? [assignment.defaultValue.value] : []);

                            if (assignment.allowMulti) {
                              return (
                                <div key={`${item.id}-${assignment.designOption.id}`} className="rounded border border-slate-200 p-3">
                                  <p className="text-sm font-semibold text-slate-900">{assignment.designOption.label}</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mt-2">
                                    {availableValues.map((value) => {
                                      const checked = selectedValues.includes(value.value);
                                      return (
                                        <label key={value.id} className="flex items-center gap-2 text-sm text-slate-700">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(event) => {
                                              const nextValues = event.target.checked
                                                ? [...selectedValues, value.value]
                                                : selectedValues.filter((entry) => entry !== value.value);
                                              setOptionValue(item.id, assignment.designOption.key, nextValues);
                                            }}
                                          />
                                          {value.label}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={`${item.id}-${assignment.designOption.id}`} className="rounded border border-slate-200 p-3">
                                <label className="text-sm font-semibold text-slate-900 block mb-1">{assignment.designOption.label}</label>
                                <select
                                  value={selectedValues[0] ?? ''}
                                  onChange={(event) => setOptionValue(item.id, assignment.designOption.key, event.target.value ? [event.target.value] : [])}
                                  className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                >
                                  <option value="">Select...</option>
                                  {availableValues.map((value) => (
                                    <option key={value.id} value={value.value}>{value.label}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}

              {packageMemberRows.length > 0 && (
                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Package Features</p>
                  {packageMemberRows.map((pkg) => {
                    const serviceGroups = pkg.members
                      .filter((member) => member.selected)
                      .map((member) => {
                        const byStatus: Record<'REQUIRED' | 'STANDARD' | 'OPTIONAL', string[]> = {
                          REQUIRED: [],
                          STANDARD: [],
                          OPTIONAL: [],
                        };

                        for (const feature of getItemFeatures(member.item)) {
                          const status = pkg.packageFeatureAssignments[feature.termId] ?? 'STANDARD';
                          byStatus[status].push(feature.label);
                        }

                        byStatus.REQUIRED.sort((a, b) => a.localeCompare(b));
                        byStatus.STANDARD.sort((a, b) => a.localeCompare(b));
                        byStatus.OPTIONAL.sort((a, b) => a.localeCompare(b));

                        return {
                          serviceId: member.item.id,
                          serviceName: member.item.name,
                          byStatus,
                        };
                      });

                    return (
                      <div key={`${pkg.packageId}-features`} className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{pkg.packageName}</p>
                        {serviceGroups.length === 0 ? (
                          <p className="text-sm text-slate-500">No package feature statuses defined.</p>
                        ) : (
                          <div className="space-y-2">
                            {serviceGroups.map((group) => (
                              <div key={`${pkg.packageId}-${group.serviceId}`} className="rounded border border-slate-200 bg-white p-3 space-y-2">
                                <p className="text-xs font-semibold text-slate-900">{group.serviceName}</p>
                                <div className="flex flex-wrap gap-2">
                                  {group.byStatus.REQUIRED.map((label) => (
                                    <span key={`${group.serviceId}-required-${label}`} className="text-xs px-2 py-1 rounded border border-rose-200 bg-rose-50 text-rose-700">
                                      REQUIRED: {label}
                                    </span>
                                  ))}
                                  {group.byStatus.STANDARD.map((label) => (
                                    <span key={`${group.serviceId}-standard-${label}`} className="text-xs px-2 py-1 rounded border border-slate-300 bg-slate-50 text-slate-700">
                                      STANDARD: {label}
                                    </span>
                                  ))}
                                  {group.byStatus.OPTIONAL.map((label) => (
                                    <span key={`${group.serviceId}-optional-${label}`} className="text-xs px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700">
                                      OPTIONAL: {label}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="text-3xl font-bold text-slate-900">Review and Commit</h2>
              <p className="text-slate-500 text-lg mt-2">Save the design selections, then proceed to the Design Document editor for final summary and conclusions.</p>
            </div>

            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-900">Selection Summary</p>
              <p className="text-sm text-slate-700">Top-level selections: {selectedTopLevelItems.length}</p>
              <p className="text-sm text-slate-700">Configurable services in scope: {serviceConfigItems.length}</p>
              <p className="text-sm text-slate-700">Total explicit selected items: {Object.keys(selections).length}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedTopLevelItems.map((item) => (
                  <span key={item.id} className="text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-700">
                    {item.name}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="px-8 py-6 bg-slate-50/80 border-t border-slate-100 flex flex-col gap-3">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            {error}
          </div>
        )}
        {status && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
            {status}
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep((previous) => Math.max(minStep, previous - 1) as WizardStep)}
            disabled={step === minStep || saving}
            className="gap-2 h-11 px-5"
          >
            <ChevronLeft size={16} /> Back
          </Button>

          <Button
            onClick={() => {
              if (step === 1) {
                setStep(2);
                return;
              }
              if (step === 2) {
                setStep(3);
                return;
              }
              void saveSelections();
            }}
            disabled={
              saving ||
              (step === 1 && !canContinueFromStep1) ||
              (step === 2 && !canContinueFromStep2)
            }
            className="gap-2 h-11 px-6"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Settings2 size={16} />}
            {step === 3 ? 'Save Design' : 'Continue'}
            {step !== 3 && <ChevronRight size={16} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
