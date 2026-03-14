'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, FileText, Loader2, Printer, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DesignDocumentSections, type DesignDocumentSectionsModel } from '@/components/design-document/DesignDocumentSections';

interface DesignDocumentPayload extends DesignDocumentSectionsModel {
  projectId: string;
  projectName: string;
  customerName: string | null;
  title: string;
  executiveSummary: string;
  conclusions: string;
  generatedAt: string;
  document: {
    id: string;
    version: number;
    status: string;
    updatedAt: string;
    generatorModel: string | null;
  };
}

export default function ProjectDesignDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<DesignDocumentPayload | null>(null);

  const [title, setTitle] = useState('Design Document');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [conclusions, setConclusions] = useState('');

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/design-document`);
      const payload = (await response.json()) as DesignDocumentPayload | { error?: string };
      if (!response.ok || !('projectId' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to load design document');
      }

      setDocumentData(payload);
      setTitle(payload.title);
      setExecutiveSummary(payload.executiveSummary);
      setConclusions(payload.conclusions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load design document');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  async function saveDocument() {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/design-document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, executiveSummary, conclusions }),
      });
      const payload = (await response.json()) as DesignDocumentPayload | { error?: string };
      if (!response.ok || !('projectId' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to save design document');
      }

      setDocumentData(payload);
      setStatus('Design document saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save design document');
    } finally {
      setSaving(false);
    }
  }

  async function generateAiSections(targets: Array<'executiveSummary' | 'conclusions'>) {
    setGenerating(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/design-document/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      });

      const payload = (await response.json()) as (DesignDocumentPayload & {
        generation?: { modelUsed?: string; targets?: string[] };
      }) | { error?: string };

      if (!response.ok || !('projectId' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to generate content');
      }

      setDocumentData(payload);
      setTitle(payload.title);
      setExecutiveSummary(payload.executiveSummary);
      setConclusions(payload.conclusions);
      const modelInfo = payload.generation?.modelUsed;
      setStatus(modelInfo ? `Generated with ${modelInfo}.` : 'Generated AI content.');
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Failed to generate content');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={28} />
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="space-y-4">
        <Link href={`/projects/${projectId}`} className="text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft size={14} className="inline mr-1" /> Back to Project
        </Link>
        <p className="text-sm text-red-600">{error || 'Design document is unavailable.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/projects/${projectId}`} className="text-xs text-slate-500 hover:text-slate-800">
            <ArrowLeft size={12} className="inline mr-1" /> {documentData.projectName}
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Design Document</h1>
          <p className="text-xs text-slate-500">
            Version {documentData.document.version} · Updated {new Date(documentData.document.updatedAt).toLocaleString()}
            {documentData.document.generatorModel ? ` · Last AI model: ${documentData.document.generatorModel}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/projects/${projectId}/design-document/print`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="gap-2">
              <Printer size={14} /> Print View
            </Button>
          </Link>
          <a href={`/api/projects/${projectId}/design-document/pdf`}>
            <Button variant="outline" className="gap-2">
              <Download size={14} /> Export PDF
            </Button>
          </a>
          <Button onClick={() => generateAiSections(['executiveSummary', 'conclusions'])} disabled={generating} variant="outline" className="gap-2">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Regenerate AI Sections
          </Button>
          <Button onClick={saveDocument} disabled={saving} className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {status && <p className="text-sm text-emerald-600">{status}</p>}

      <section className="rounded-2xl border border-slate-300 bg-white p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Document Title</p>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Executive Summary</p>
            <Button variant="ghost" size="sm" onClick={() => generateAiSections(['executiveSummary'])} disabled={generating} className="h-7 text-xs gap-1">
              {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Regenerate
            </Button>
          </div>
          <textarea
            value={executiveSummary}
            onChange={(event) => setExecutiveSummary(event.target.value)}
            rows={7}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">Conclusions</p>
            <Button variant="ghost" size="sm" onClick={() => generateAiSections(['conclusions'])} disabled={generating} className="h-7 text-xs gap-1">
              {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Regenerate
            </Button>
          </div>
          <textarea
            value={conclusions}
            onChange={(event) => setConclusions(event.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-900">Catalog-Derived Design Content</h2>
        </div>
        <DesignDocumentSections sections={documentData.sections} appendix={documentData.appendix} />
      </section>
    </div>
  );
}
