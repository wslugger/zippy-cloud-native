'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ProjectFlowStepper } from '@/components/projects/ProjectFlowStepper';
import { ArrowLeft, Loader2, ScrollText } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  customerName: string | null;
}

function normalizeProjectResponse(payload: unknown): Project | null {
  if (!payload || typeof payload !== 'object') return null;
  const raw = payload as Partial<Project>;
  if (!raw.id || !raw.name) return null;
  return {
    id: raw.id,
    name: raw.name,
    customerName: raw.customerName ?? null,
  };
}

export default function HighLevelDesignPlaceholderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/projects/${id}`)
      .then((res) => res.json().catch(() => ({})))
      .then((payload) => {
        if (!active) return;
        setProject(normalizeProjectResponse(payload));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setProject(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-sm text-slate-600">Project not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/projects/${id}/bom-builder`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 mb-2 transition-colors">
          <ArrowLeft size={12} /> Back to Step 3
        </Link>
        <h1 className="text-3xl font-bold text-slate-900">{project.name}</h1>
        {project.customerName && <p className="text-slate-600">{project.customerName}</p>}
      </div>

      <ProjectFlowStepper
        currentStep={4}
        steps={[
          { index: 1, label: 'Requirements + Selection', href: `/projects/${id}`, enabled: true },
          { index: 2, label: 'Service Configuration', href: `/projects/${id}/service-configuration`, enabled: true },
          { index: 3, label: 'BOM Builder', href: `/projects/${id}/bom-builder`, enabled: true },
          { index: 4, label: 'High Level Design', href: `/projects/${id}/high-level-design`, enabled: true },
        ]}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <ScrollText size={24} className="mx-auto text-blue-500 mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Step 4: High Level Design</h2>
        <p className="text-sm text-slate-600 mt-2">Placeholder only. Implementation intentionally deferred.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/projects/${id}/bom-builder`}>
          <Button variant="outline">Back to Step 3</Button>
        </Link>
        <Link href={`/projects/${id}/design-document`}>
          <Button className="bg-blue-600 hover:bg-blue-500 text-white">Open Design Document</Button>
        </Link>
      </div>
    </div>
  );
}
