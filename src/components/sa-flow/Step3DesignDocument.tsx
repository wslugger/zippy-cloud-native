'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw, Save } from 'lucide-react';
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

interface Step3DesignDocumentProps {
  projectId: string;
  onDone: () => void;
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

export function Step3DesignDocument({ projectId, onDone }: Step3DesignDocumentProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<DesignDocumentPayload | null>(null);

  const [title, setTitle] = useState('Design Document');
  const [executiveSummary, setExecutiveSummary] = useState('');
  const [conclusions, setConclusions] = useState('');
  const attemptedAutoGenerateRef = useRef(false);

  const generateAiSections = useCallback(async (targets: Array<'executiveSummary' | 'conclusions'>) => {
    setGenerating(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/design-document/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      });

      const payload = await parseJsonResponse<
        DesignDocumentPayload & { generation?: { modelUsed?: string; targets?: string[] }; error?: string }
      >(response);

      if (!response.ok || !payload || !('projectId' in payload)) {
        throw new Error(payload?.error || 'Failed to generate content');
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
  }, [projectId]);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/design-document`);
      const payload = await parseJsonResponse<DesignDocumentPayload & { error?: string }>(response);

      if (!response.ok || !payload || !('projectId' in payload)) {
        throw new Error(payload?.error || 'Failed to load design document');
      }

      setDocumentData(payload);
      setTitle(payload.title);
      setExecutiveSummary(payload.executiveSummary);
      setConclusions(payload.conclusions);

      if (!attemptedAutoGenerateRef.current && payload.document.generatorModel === null) {
        attemptedAutoGenerateRef.current = true;
        void generateAiSections(['executiveSummary', 'conclusions']);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load design document');
    } finally {
      setLoading(false);
    }
  }, [projectId, generateAiSections]);

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

      const payload = await parseJsonResponse<DesignDocumentPayload & { error?: string }>(response);
      if (!response.ok || !payload || !('projectId' in payload)) {
        throw new Error(payload?.error || 'Failed to save design document');
      }

      setDocumentData(payload);
      setStatus('Design document saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save design document');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-white p-6 flex items-center justify-center gap-2 text-slate-600">
        <Loader2 size={18} className="animate-spin" />
        Loading design document...
      </div>
    );
  }

  if (!documentData) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error || 'Design document is unavailable.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Design Document</h2>
        <p className="text-slate-500 text-lg mt-2">
          Version {documentData.document.version} · Updated {new Date(documentData.document.updatedAt).toLocaleString()}
          {documentData.document.generatorModel ? ` · Last AI model: ${documentData.document.generatorModel}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => generateAiSections(['executiveSummary', 'conclusions'])}
          disabled={generating}
          variant="outline"
          className="gap-2"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Regenerate AI Sections
        </Button>
        <Button onClick={saveDocument} disabled={saving} className="gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save Document
        </Button>
        <a href={`/api/projects/${projectId}/design-document/pdf`}>
          <Button variant="outline" className="gap-2">
            <Download size={14} />
            Export PDF
          </Button>
        </a>
        <Button variant="outline" onClick={onDone}>
          Done
        </Button>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateAiSections(['executiveSummary'])}
              disabled={generating}
              className="h-7 text-xs gap-1"
            >
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateAiSections(['conclusions'])}
              disabled={generating}
              className="h-7 text-xs gap-1"
            >
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
          <h3 className="text-lg font-semibold text-slate-900">Catalog-Derived Design Content</h3>
        </div>
        <DesignDocumentSections sections={documentData.sections} appendix={documentData.appendix} />
      </section>
    </div>
  );
}
