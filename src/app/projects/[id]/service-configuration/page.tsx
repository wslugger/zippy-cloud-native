'use client';

import { useState, useEffect, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ProjectFlowStepper } from '@/components/projects/ProjectFlowStepper';
import { ArrowLeft, Loader2, Compass, Settings2 } from 'lucide-react';
import { GuidedFlowWizard } from '@/components/sa-flow/GuidedFlowWizard';

interface Project {
  id: string;
  name: string;
  customerName: string | null;
  items: Array<{ id: string }>;
}

function normalizeProjectResponse(payload: unknown): Project | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Partial<Project>;
  if (!raw.id || !raw.name) return null;

  return {
    id: raw.id,
    name: raw.name,
    customerName: raw.customerName ?? null,
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

interface DesignBuilderPayload {
  projectSelections?: Array<{
    catalogItemId: string;
    quantity?: number;
    configValues?: Record<string, unknown>;
    designOptionValues?: Record<string, string | string[]>;
  }>;
}

export default function ServiceConfigurationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(true);
  const [savingStep, setSavingStep] = useState(false);

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
      setLoading(false);
    } catch {
      setProject(null);
      setLoadError('Failed to load project data');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchProject();
  }, [fetchProject]);

  async function saveStep2CheckpointAndContinue() {
    setSavingStep(true);
    try {
      const res = await fetch(`/api/projects/${id}/design-builder`);
      const payload = (await res.json().catch(() => ({}))) as DesignBuilderPayload;
      const currentSelections = Array.isArray(payload.projectSelections) ? payload.projectSelections : [];

      await fetch(`/api/projects/${id}/design-builder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections: currentSelections }),
      }).catch(() => undefined);

      router.push(`/projects/${id}/bom-builder`);
    } finally {
      setSavingStep(false);
    }
  }

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

  const hasSelections = project.items.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/projects/${id}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2 transition-colors">
            <ArrowLeft size={12} /> Back to Step 1
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
          {project.customerName && <p className="text-slate-600">{project.customerName}</p>}
        </div>
      </div>

      <ProjectFlowStepper
        currentStep={2}
        steps={[
          { index: 1, label: 'Requirements + Selection', href: `/projects/${id}`, enabled: true },
          { index: 2, label: 'Service Configuration', href: `/projects/${id}/service-configuration`, enabled: true },
          { index: 3, label: 'BOM Builder', href: `/projects/${id}/bom-builder`, enabled: true },
          { index: 4, label: 'High Level Design', href: `/projects/${id}/high-level-design`, enabled: true },
        ]}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold text-slate-900">Step 2: Service Configuration</h2>
          <Button
            onClick={() => setShowWizard((prev) => !prev)}
            className="gap-2"
            disabled={!hasSelections}
          >
            <Compass size={16} />
            {showWizard ? 'Close Configurator' : 'Open Configurator'}
          </Button>
        </div>
        <p className="text-sm text-slate-600">
          Configure the selected services and package members. Save inside the configurator, then continue.
        </p>
      </div>

      {!hasSelections ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <p className="font-semibold">No services/packages selected yet.</p>
          <p className="text-sm mt-1">Go back to Step 1 and add at least one package or managed service.</p>
          <Link href={`/projects/${id}`}>
            <Button variant="outline" className="mt-4">Back to Step 1</Button>
          </Link>
        </div>
      ) : showWizard ? (
        <GuidedFlowWizard
          projectId={id}
          onComplete={() => {
            setShowWizard(false);
            void fetchProject();
          }}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-sm text-slate-700">
            Open the configurator to modify design options. Your selections are already persisted and you can navigate back anytime.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Link href={`/projects/${id}`}>
          <Button variant="outline">Back to Step 1</Button>
        </Link>
        <Button
          onClick={saveStep2CheckpointAndContinue}
          disabled={!hasSelections || showWizard || savingStep}
          className="gap-2"
        >
          {savingStep ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />}
          Save Step 2 & Continue
        </Button>
      </div>
    </div>
  );
}
