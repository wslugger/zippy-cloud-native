'use client';

import { useState, useEffect, use, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectFlowStepper } from '@/components/projects/ProjectFlowStepper';
import { ArrowLeft, Loader2, FileText, Sparkles, CheckCircle2, FolderKanban, Trash2, X } from 'lucide-react';
import {
  aggregateLifecycleStatuses,
  lifecycleStatusLabel,
  normalizeLifecycleStatus,
  type LifecycleAggregate,
  type LifecycleStatus,
} from '@/lib/lifecycle-status';

interface ProjectItem {
  id: string;
  catalogItemId: string;
  quantity: number;
  catalogItem: {
    id: string;
    name: string;
    sku: string;
    type: string;
    shortDescription?: string | null;
    detailedDescription?: string | null;
  };
}

interface Project {
  id: string;
  name: string;
  customerName: string | null;
  rawRequirements: string | null;
  manualNotes: string | null;
  items: ProjectItem[];
  requirementDocs?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    status: string;
    extractedText: string | null;
    createdAt: string;
  }>;
  recommendations?: Array<{
    id: string;
    reason: string;
    shortReason?: string;
    score: string | number;
    certaintyPercent?: number;
    matchedCharacteristics?: string[];
    requiredIncluded: string[];
    optionalRecommended: string[];
    catalogItem: {
      id: string;
      sku: string;
      name: string;
      type: string;
      shortDescription: string | null;
    };
  }>;
}

type Recommendation = NonNullable<Project['recommendations']>[number];

interface Suggestion {
  id: string;
  sku: string;
  name: string;
  type: string;
  description: string | null;
  reason: string;
  shortReason?: string;
  certaintyPercent: number;
  matchedCharacteristics: string[];
  requiredIncluded: string[];
  optionalRecommended: string[];
  recommendationId?: string;
}

interface TopLevelCatalogItem {
  id: string;
  sku: string;
  name: string;
  type: 'PACKAGE' | 'MANAGED_SERVICE';
  shortDescription: string | null;
}

interface BuilderTerm {
  category: string;
  label: string;
  value: string;
  lifecycleStatus?: string | null;
}

interface BuilderItemAttribute {
  taxonomyTermId: string;
  term: BuilderTerm;
}

interface BuilderDesignOptionAssignment {
  designOption: {
    id: string;
    key: string;
    label: string;
    lifecycleStatus?: string | null;
  };
}

interface BuilderItemDependency {
  type: string;
  childItem: BuilderItem;
}

interface BuilderPackageComposition {
  role: string;
  catalogItem: BuilderItem;
}

interface BuilderItem {
  id: string;
  sku: string;
  name: string;
  type: string;
  shortDescription: string | null;
  lifecycleStatus?: string | null;
  attributes: BuilderItemAttribute[];
  designOptions: BuilderDesignOptionAssignment[];
  childDependencies: BuilderItemDependency[];
  packageCompositions: BuilderPackageComposition[];
}

interface LifecycleSummaryRow {
  id: string;
  name: string;
  status: LifecycleStatus;
}

interface ItemLifecycleSummary {
  aggregate: LifecycleAggregate;
  statuses: LifecycleStatus[];
  features: LifecycleSummaryRow[];
  designOptions: LifecycleSummaryRow[];
  serviceOptions: LifecycleSummaryRow[];
  hardware: LifecycleSummaryRow[];
  includedServices: LifecycleSummaryRow[];
}

function summaryStatusLabel(status: LifecycleStatus): string {
  switch (status) {
    case 'SUPPORTED':
      return 'Available';
    case 'NOT_AVAILABLE':
      return 'Not Supported';
    default:
      return lifecycleStatusLabel(status);
  }
}

function toCertaintyPercent(value: unknown): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric <= 1) return Math.round(Math.max(0, Math.min(1, numeric)) * 100);
  return Math.round(Math.max(0, Math.min(100, numeric)));
}

function parseMatchedCharacteristicsFromReason(reason: string): string[] {
  const marker = 'Matched characteristics:';
  const idx = reason.indexOf(marker);
  if (idx === -1) return [];
  const tail = reason.slice(idx + marker.length).trim();
  const normalized = tail.endsWith('.') ? tail.slice(0, -1) : tail;
  return normalized
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function mapRecommendation(rec: Recommendation): Suggestion {
  return {
    id: rec.catalogItem.id,
    sku: rec.catalogItem.sku,
    name: rec.catalogItem.name,
    type: rec.catalogItem.type,
    description: rec.catalogItem.shortDescription,
    reason: rec.reason,
    shortReason: rec.shortReason,
    certaintyPercent: typeof rec.certaintyPercent === 'number' ? rec.certaintyPercent : toCertaintyPercent(rec.score),
    matchedCharacteristics: rec.matchedCharacteristics ?? parseMatchedCharacteristicsFromReason(rec.reason),
    requiredIncluded: rec.requiredIncluded ?? [],
    optionalRecommended: rec.optionalRecommended ?? [],
    recommendationId: rec.id,
  };
}

function normalizeProjectResponse(payload: unknown): Project | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Partial<Project>;
  if (!raw.id || !raw.name) return null;

  return {
    id: raw.id,
    name: raw.name,
    customerName: raw.customerName ?? null,
    rawRequirements: raw.rawRequirements ?? null,
    manualNotes: raw.manualNotes ?? null,
    items: Array.isArray(raw.items) ? raw.items : [],
    requirementDocs: Array.isArray(raw.requirementDocs) ? raw.requirementDocs : [],
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
  };
}

interface DesignBuilderPayload {
  topLevelItems?: BuilderItem[];
}

function statusBadgeClass(status: LifecycleStatus): string {
  switch (status) {
    case 'SUPPORTED':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'IN_DEVELOPMENT':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'APPROVAL_REQUIRED':
      return 'bg-sky-100 text-sky-700 border-sky-200';
    case 'DEPRECATED':
    case 'END_OF_SALE':
    case 'END_OF_SUPPORT':
    case 'NOT_AVAILABLE':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function aggregateBadgeClass(aggregate: LifecycleAggregate): string {
  if (aggregate === 'READY') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (aggregate === 'REVIEW_REQUIRED') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

function aggregateLabel(aggregate: LifecycleAggregate): string {
  if (aggregate === 'READY') return 'Ready';
  if (aggregate === 'REVIEW_REQUIRED') return 'Review Required';
  return 'Blocked';
}

function summaryRowsByPriority(rows: LifecycleSummaryRow[]): LifecycleSummaryRow[] {
  const weight = (status: LifecycleStatus): number => {
    if (status === 'NOT_AVAILABLE' || status === 'DEPRECATED' || status === 'END_OF_SALE' || status === 'END_OF_SUPPORT') return 3;
    if (status === 'APPROVAL_REQUIRED') return 2;
    if (status === 'IN_DEVELOPMENT') return 1;
    return 0;
  };

  return [...rows].sort((a, b) => {
    const diff = weight(b.status) - weight(a.status);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name);
  });
}

function toLifecycleStatus(value: unknown): LifecycleStatus {
  return normalizeLifecycleStatus(value) ?? 'SUPPORTED';
}

function summarizeLifecycle(item: BuilderItem): ItemLifecycleSummary {
  const statuses: LifecycleStatus[] = [];
  const seenItems = new Set<string>();
  const seenFeatureRows = new Set<string>();
  const seenDesignRows = new Set<string>();
  const seenServiceOptionRows = new Set<string>();
  const seenHardwareRows = new Set<string>();
  const seenIncludedRows = new Set<string>();
  const features: LifecycleSummaryRow[] = [];
  const designOptions: LifecycleSummaryRow[] = [];
  const serviceOptions: LifecycleSummaryRow[] = [];
  const hardware: LifecycleSummaryRow[] = [];
  const includedServices: LifecycleSummaryRow[] = [];

  const addStatus = (statusLike: unknown) => {
    statuses.push(toLifecycleStatus(statusLike));
  };

  const visit = (node: BuilderItem) => {
    if (seenItems.has(node.id)) return;
    seenItems.add(node.id);
    addStatus(node.lifecycleStatus);

    if (node.type === 'HARDWARE' && !seenHardwareRows.has(node.id)) {
      seenHardwareRows.add(node.id);
      hardware.push({
        id: node.id,
        name: `${node.name} (${node.sku})`,
        status: toLifecycleStatus(node.lifecycleStatus),
      });
    }

    for (const attribute of node.attributes ?? []) {
      if (attribute.term?.category !== 'FEATURE') continue;
      const featureId = attribute.taxonomyTermId || `${node.id}-${attribute.term.value}`;
      if (seenFeatureRows.has(featureId)) continue;
      seenFeatureRows.add(featureId);
      const status = toLifecycleStatus(attribute.term?.lifecycleStatus);
      addStatus(status);
      features.push({
        id: featureId,
        name: attribute.term?.label || attribute.term?.value || featureId,
        status,
      });
    }

    for (const assignment of node.designOptions ?? []) {
      const designId = assignment.designOption?.id ?? `${node.id}-${assignment.designOption?.key}`;
      if (seenDesignRows.has(designId)) continue;
      seenDesignRows.add(designId);
      const status = toLifecycleStatus(assignment.designOption?.lifecycleStatus);
      addStatus(status);
      designOptions.push({
        id: designId,
        name: assignment.designOption?.label || assignment.designOption?.key || designId,
        status,
      });
    }

    for (const dep of node.childDependencies ?? []) {
      const child = dep.childItem;
      if (!child) continue;
      const isIncludedServiceOptionDependency =
        dep.type === 'INCLUDES' || dep.type === 'REQUIRES' || dep.type === 'MANDATORY_ATTACHMENT';
      if (
        isIncludedServiceOptionDependency &&
        (child.type === 'SERVICE_OPTION' || child.type === 'CONNECTIVITY') &&
        !seenServiceOptionRows.has(child.id)
      ) {
        seenServiceOptionRows.add(child.id);
        serviceOptions.push({
          id: child.id,
          name: `${child.name} (${child.sku})`,
          status: toLifecycleStatus(child.lifecycleStatus),
        });
      }
      if (child.type === 'HARDWARE' && !seenHardwareRows.has(child.id)) {
        seenHardwareRows.add(child.id);
        hardware.push({
          id: child.id,
          name: `${child.name} (${child.sku})`,
          status: toLifecycleStatus(child.lifecycleStatus),
        });
      }
      visit(child);
    }

    for (const composition of node.packageCompositions ?? []) {
      const member = composition.catalogItem;
      if (!member) continue;
      if (member.type !== 'HARDWARE' && !seenIncludedRows.has(member.id)) {
        seenIncludedRows.add(member.id);
        includedServices.push({
          id: member.id,
          name: `${member.name} (${member.sku})`,
          status: toLifecycleStatus(member.lifecycleStatus),
        });
      }
      visit(member);
    }
  };

  visit(item);
  return {
    aggregate: aggregateLifecycleStatuses(statuses),
    statuses,
    features,
    designOptions,
    serviceOptions,
    hardware,
    includedServices,
  };
}

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [requirements, setRequirements] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [catalogItems, setCatalogItems] = useState<TopLevelCatalogItem[]>([]);
  const [topLevelItems, setTopLevelItems] = useState<BuilderItem[]>([]);
  const [manualSearch, setManualSearch] = useState('');
  const [summaryItemId, setSummaryItemId] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await fetch(`/api/projects/${id}`);
      const payload = await res.json();
      const data = normalizeProjectResponse(payload);

      if (!res.ok || !data) {
        setProject(null);
        setLoadError('Failed to load project data');
        setLoading(false);
        return;
      }

      setProject(data);
      if (data.manualNotes) {
        setRequirements((prev) => prev || data.manualNotes || '');
      } else if (data.rawRequirements && (data.requirementDocs?.length ?? 0) === 0) {
        setRequirements((prev) => prev || data.rawRequirements || '');
      }
      setSuggestions(Array.isArray(data.recommendations) ? data.recommendations.map(mapRecommendation) : []);
      setLoading(false);
    } catch {
      setProject(null);
      setLoadError('Failed to load project data');
      setLoading(false);
    }
  }, [id]);

  const fetchCatalogItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/design-builder`);
      const payload = (await res.json().catch(() => ({}))) as DesignBuilderPayload;
      if (!res.ok) return;

      const topLevelRows = Array.isArray(payload.topLevelItems) ? payload.topLevelItems : [];
      const rows = topLevelRows
        .filter((item) => item.type === 'PACKAGE' || item.type === 'MANAGED_SERVICE')
        .map((item): TopLevelCatalogItem => ({
          id: item.id,
          sku: item.sku,
          name: item.name,
          type: item.type as TopLevelCatalogItem['type'],
          shortDescription: item.shortDescription,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setTopLevelItems(topLevelRows);
      setCatalogItems(rows);
    } catch {
      setTopLevelItems([]);
      setCatalogItems([]);
    }
  }, [id]);

  useEffect(() => {
    void Promise.all([fetchProject(), fetchCatalogItems()]);
  }, [fetchProject, fetchCatalogItems]);

  async function persistStep1Notes() {
    await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawRequirements: requirements.trim() || null,
        manualNotes: requirements.trim() || null,
      }),
    }).catch(() => undefined);
  }

  async function saveAndAnalyze() {
    const uploadedDocContext = (project?.requirementDocs ?? [])
      .map((doc) => `Uploaded document: ${doc.fileName} (${doc.mimeType || 'unknown'}).`)
      .join('\n');
    const uploadedDocText = (project?.requirementDocs ?? [])
      .map((doc) => doc.extractedText?.trim() ?? '')
      .filter((text) => text.length > 0)
      .join('\n\n');
    const combinedRequirements = [uploadedDocContext, uploadedDocText, requirements.trim()]
      .filter((text) => text.length > 0)
      .join('\n\n');

    if (!combinedRequirements) return;

    setAnalyzing(true);
    try {
      const res = await fetch(`/api/projects/${id}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawRequirements: combinedRequirements }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        setSuggestions((data.recommendations as Recommendation[]).map(mapRecommendation));
      } else {
        const fallbackRes = await fetch('/api/sa/suggest-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawRequirements: combinedRequirements }),
        });
        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackRes.ok && Array.isArray(fallbackData.suggestions)) {
          setSuggestions(
            fallbackData.suggestions.map((s: {
              id: string;
              sku: string;
              name: string;
              type: string;
              description?: string | null;
              shortDescription?: string | null;
              reason?: string;
              shortReason?: string;
              score?: number;
              certaintyPercent?: number;
              matchedCharacteristics?: string[];
            }) => ({
              id: s.id,
              sku: s.sku,
              name: s.name,
              type: s.type,
              description: s.description ?? s.shortDescription ?? null,
              reason: s.reason ?? 'Matched by AI requirement analysis.',
              shortReason: s.shortReason,
              certaintyPercent: typeof s.certaintyPercent === 'number'
                ? s.certaintyPercent
                : toCertaintyPercent(s.score),
              matchedCharacteristics: Array.isArray(s.matchedCharacteristics) ? s.matchedCharacteristics : [],
              requiredIncluded: [],
              optionalRecommended: [],
            }))
          );
        } else {
          setSuggestions([]);
        }
      }

      await persistStep1Notes();
      await fetchProject();
    } finally {
      setAnalyzing(false);
    }
  }

  async function uploadRequirementsFiles(files: File[]) {
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      const failedUploads: string[] = [];

      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/projects/${id}/requirements/upload`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failedUploads.push(`${file.name}: ${data.error || 'Upload failed'}`);
        }
      }

      if (failedUploads.length > 0) {
        setUploadError(failedUploads.join(' | '));
      }

      await fetchProject();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload requirements file');
    } finally {
      setUploading(false);
    }
  }

  async function addService(catalogItemId: string, recommendationId?: string) {
    setAddingItemId(catalogItemId);
    try {
      if (recommendationId) {
        await fetch(`/api/projects/${id}/recommendations/${recommendationId}/adopt`, {
          method: 'POST',
        });
      } else {
        await fetch(`/api/projects/${id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalogItemId, quantity: 1 }),
        });
      }
      await fetchProject();
    } finally {
      setAddingItemId(null);
    }
  }

  async function removeService(itemId: string) {
    setRemovingItemId(itemId);
    try {
      await fetch(`/api/projects/${id}/items/${itemId}`, {
        method: 'DELETE',
      });
      await fetchProject();
    } finally {
      setRemovingItemId(null);
    }
  }

  async function continueToStep2() {
    if (!project || selectedTopLevelProjectItems.length === 0) return;

    setSavingStep(true);
    try {
      await persistStep1Notes();
      router.push(`/projects/${id}/service-configuration`);
    } finally {
      setSavingStep(false);
    }
  }

  const filteredCatalogItems = useMemo(() => {
    const query = manualSearch.trim().toLowerCase();
    if (!query) return catalogItems;
    return catalogItems.filter((item) => {
      return item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query) || item.type.toLowerCase().includes(query);
    });
  }, [catalogItems, manualSearch]);

  const topLevelItemById = useMemo(() => {
    return new Map(topLevelItems.map((item) => [item.id, item]));
  }, [topLevelItems]);

  const selectedTopLevelProjectItems = useMemo(() => {
    const items = project?.items ?? [];
    return items.filter((item) => topLevelItemById.has(item.catalogItemId));
  }, [project?.items, topLevelItemById]);

  const lifecycleSummaryByTopLevelId = useMemo(() => {
    const entries = topLevelItems.map((item) => [item.id, summarizeLifecycle(item)] as const);
    return new Map(entries);
  }, [topLevelItems]);

  const activeSummaryItem = summaryItemId ? topLevelItemById.get(summaryItemId) ?? null : null;
  const activeSummary = summaryItemId ? lifecycleSummaryByTopLevelId.get(summaryItemId) ?? null : null;
  const hasApprovalRequired = Boolean(activeSummary?.statuses.some((status) => status === 'APPROVAL_REQUIRED'));

  useEffect(() => {
    if (!summaryItemId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSummaryItemId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [summaryItemId]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-zippy-green" size={32} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm text-slate-600">{loadError || 'Project not found'}</p>
        <Button variant="outline" onClick={() => { setLoading(true); void fetchProject(); }}>
          Retry
        </Button>
      </div>
    );
  }

  const uploadedDocCount = (project.requirementDocs ?? []).length;
  const canAnalyze = requirements.trim().length > 0 || uploadedDocCount > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/projects" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2 transition-colors">
            <ArrowLeft size={12} /> All Projects
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
          {project.customerName && <p className="text-slate-600">{project.customerName}</p>}
        </div>
      </div>

      <ProjectFlowStepper
        currentStep={1}
        steps={[
          { index: 1, label: 'Requirements + Selection', href: `/projects/${id}`, enabled: true },
          { index: 2, label: 'Service Configuration', href: `/projects/${id}/service-configuration`, enabled: true },
          { index: 3, label: 'BOM Builder', href: `/projects/${id}/bom-builder`, enabled: true },
          { index: 4, label: 'High Level Design', href: `/projects/${id}/high-level-design`, enabled: true },
        ]}
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white/50 border border-slate-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4 text-zippy-green">
              <FileText size={24} />
              <h2 className="text-xl font-bold text-slate-900">Step 1: Project Kickoff Requirements</h2>
            </div>
            <p className="text-slate-600 text-sm mb-6">
              Input requirements, run AI analysis, and then pick services/packages either from recommendations or manual selection.
            </p>

            <div className="mb-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Upload Requirement Documents</p>
                  <p className="text-[11px] text-slate-500">You can upload multiple TXT/JSON/PDF/DOC files.</p>
                </div>
                <label className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      void uploadRequirementsFiles(files);
                      e.currentTarget.value = '';
                    }}
                  />
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  {uploading ? 'Uploading...' : 'Upload Files'}
                </label>
              </div>
              {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
              {(project.requirementDocs ?? []).length > 0 && (
                <div className="mt-3 space-y-2">
                  {(project.requirementDocs ?? []).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        <span className="text-slate-800">{doc.fileName}</span>
                        <span className="text-slate-500">({doc.mimeType || 'unknown'})</span>
                      </div>
                      <span className="text-slate-500">{doc.extractedText?.trim() ? 'Ready for analysis' : 'Uploaded'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-1">
              <p className="text-xs font-semibold text-slate-700">SA Additional Notes (Optional)</p>
              <p className="text-[11px] text-slate-500">Use this for extra context that is not in uploaded files.</p>
            </div>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[220px] text-slate-700 placeholder:text-slate-600 focus:outline-none focus:border-zippy-green/50 focus:ring-1 focus:ring-zippy-green/50 transition-all font-mono text-sm resize-y"
              placeholder="Add clarifications, assumptions, constraints, or priorities for the SA-bot..."
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
            />

            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <Button
                onClick={saveAndAnalyze}
                disabled={!canAnalyze || analyzing}
                className="gap-2"
              >
                {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                Analyze Requirements
              </Button>
            </div>
          </div>

          <div className="bg-white/50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold flex items-center gap-2 text-zippy-green">
              <Sparkles size={18} /> AI Recommended Services / Packages
            </h3>
            {suggestions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                <p>No suggestions generated yet.</p>
                <p className="mt-2 text-xs text-slate-500">Run analysis above, or use manual selection below.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s) => {
                  const isAdded = project.items.some((it) => it.catalogItemId === s.id);
                  const busy = addingItemId === s.id;
                  const lifecycleSummary = lifecycleSummaryByTopLevelId.get(s.id);
                  const aggregate = lifecycleSummary?.aggregate ?? 'READY';
                  const blocked = aggregate === 'BLOCKED';
                  return (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 flex flex-wrap items-center gap-2">
                            {s.name}
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shrink-0">
                              {s.certaintyPercent}% certainty
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${aggregateBadgeClass(aggregate)}`}>
                              {aggregateLabel(aggregate)}
                            </span>
                          </h4>
                          <p className="text-xs font-mono text-slate-400 mt-0.5">{s.sku}</p>
                          <p className="text-sm text-slate-600 mt-2">{s.description}</p>
                          <p className="text-[11px] text-slate-500 mt-2">{s.shortReason ?? s.reason}</p>
                          {blocked && (
                            <p className="text-[11px] text-rose-600 mt-2">
                              Blocked due to lifecycle status in package/service details.
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSummaryItemId(s.id)}
                          >
                            View Summary
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="shrink-0"
                            onClick={() => addService(s.id, s.recommendationId)}
                            disabled={isAdded || busy || blocked}
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : isAdded ? 'Added' : 'Add'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white/50 border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-slate-900">Manual Service / Package Selection</h3>
            <input
              type="text"
              className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"
              placeholder="Search by name, SKU, or type..."
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCatalogItems.map((item) => {
                const isAdded = project.items.some((it) => it.catalogItemId === item.id);
                const busy = addingItemId === item.id;
                const lifecycleSummary = lifecycleSummaryByTopLevelId.get(item.id);
                const aggregate = lifecycleSummary?.aggregate ?? 'READY';
                const blocked = aggregate === 'BLOCKED';
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{item.name}</p>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">{item.sku}</p>
                        <p className="text-xs text-slate-600 mt-2">{item.shortDescription || 'No short description.'}</p>
                        <Badge variant="outline" className="mt-2 text-[10px] bg-white capitalize">
                          {item.type.replace('_', ' ')}
                        </Badge>
                        <span className={`ml-2 inline-flex text-[10px] font-semibold px-2 py-0.5 rounded border ${aggregateBadgeClass(aggregate)}`}>
                          {aggregateLabel(aggregate)}
                        </span>
                        {blocked && (
                          <p className="text-[11px] text-rose-600 mt-2">
                            Blocked due to lifecycle status in package/service details.
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSummaryItemId(item.id)}>
                          View Summary
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => addService(item.id)} disabled={isAdded || busy || blocked}>
                          {busy ? <Loader2 size={14} className="animate-spin" /> : isAdded ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredCatalogItems.length === 0 && (
              <p className="text-sm text-slate-500">No matching catalog items found.</p>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 space-y-4 bg-white/40 rounded-2xl p-6 border border-slate-200">
          <h3 className="font-bold flex items-center gap-2 text-slate-900">
            <FolderKanban size={18} /> Selected Services / Packages
          </h3>
          {selectedTopLevelProjectItems.length === 0 ? (
            <div className="text-center text-slate-600 py-10">
              <p>No services selected yet.</p>
              <p className="text-xs mt-1">Add at least one package/service to continue to Step 2.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedTopLevelProjectItems.map((item) => {
                const lifecycleSummary = lifecycleSummaryByTopLevelId.get(item.catalogItemId);
                const aggregate = lifecycleSummary?.aggregate ?? 'READY';
                return (
                <div key={item.id} className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-800">{item.catalogItem.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{item.catalogItem.sku}</p>
                      <p className="text-xs text-slate-600 mt-2">{item.catalogItem.shortDescription || 'No short description.'}</p>
                      <span className={`inline-flex mt-2 text-[10px] font-semibold px-2 py-0.5 rounded border ${aggregateBadgeClass(aggregate)}`}>
                        {aggregateLabel(aggregate)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSummaryItemId(item.catalogItemId)}
                        className="h-7 px-2 text-xs"
                      >
                        View Summary
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeService(item.id)}
                        disabled={removingItemId === item.id}
                        className="h-7 px-2 text-xs"
                      >
                        {removingItemId === item.id ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} /> Remove</>}
                      </Button>
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">Step 1 saves requirements + selected items.</span>
            <Button
              onClick={continueToStep2}
              disabled={selectedTopLevelProjectItems.length === 0 || savingStep}
              className=""
            >
              {savingStep ? <Loader2 size={14} className="animate-spin" /> : null}
              Save Step 1 & Continue
            </Button>
          </div>
        </div>
      </div>

      {summaryItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setSummaryItemId(null)}>
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white px-6 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lifecycle Summary</p>
                <h3 className="truncate text-xl font-bold text-slate-900">
                  {activeSummaryItem ? `${activeSummaryItem.name} (${activeSummaryItem.sku})` : 'Catalog Item'}
                </h3>
                {activeSummary ? (
                  <span className={`mt-2 inline-flex text-[11px] font-semibold px-2 py-0.5 rounded border ${aggregateBadgeClass(activeSummary.aggregate)}`}>
                    {aggregateLabel(activeSummary.aggregate)}
                  </span>
                ) : (
                  <span className="mt-2 inline-flex text-[11px] font-semibold px-2 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-200">
                    Ready
                  </span>
                )}
              </div>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setSummaryItemId(null)}>
                <X size={16} />
              </Button>
            </div>

            {!activeSummary ? (
              <div className="p-6">
                <p className="text-sm text-slate-600">No lifecycle details are available for this item yet.</p>
              </div>
            ) : (
              <div className="space-y-4 p-6">
                <p className="text-sm text-slate-600">
                  Review lifecycle status across included services, service options, design options, features, and hardware before adding to this project.
                </p>

                {hasApprovalRequired && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
                    <p className="text-sm font-semibold text-sky-800">Approval Required Present</p>
                    <p className="text-xs text-sky-700 mt-1">
                      Placeholder: this will route to the future custom-solution admin workflow and unlock only for this project after approval.
                    </p>
                    <Button size="sm" variant="outline" className="mt-3 text-xs" disabled>
                      Request Approval (Coming Soon)
                    </Button>
                  </div>
                )}

                {[
                  { key: 'included', title: 'Included Services', rows: activeSummary.includedServices },
                  { key: 'service-options', title: 'Service Options', rows: activeSummary.serviceOptions },
                  { key: 'design-options', title: 'Design Options', rows: activeSummary.designOptions },
                  { key: 'features', title: 'Features', rows: activeSummary.features },
                  { key: 'hardware', title: 'Hardware', rows: activeSummary.hardware },
                ].map((section) => {
                  if (section.rows.length === 0) return null;
                  return (
                    <section key={section.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900">{section.title}</h4>
                        <span className="text-[11px] text-slate-500">{section.rows.length} item(s)</span>
                      </div>
                      <div className="space-y-2">
                        {summaryRowsByPriority(section.rows).map((row) => (
                          <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                            <p className="text-sm text-slate-800">{row.name}</p>
                            <span className={`inline-flex shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded border ${statusBadgeClass(row.status)}`}>
                              {summaryStatusLabel(row.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}

                {activeSummary.features.length === 0 &&
                  activeSummary.designOptions.length === 0 &&
                  activeSummary.serviceOptions.length === 0 &&
                  activeSummary.hardware.length === 0 &&
                  activeSummary.includedServices.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-600">No related lifecycle-scoped entities were found for this item.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
