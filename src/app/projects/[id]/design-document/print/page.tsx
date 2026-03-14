'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DesignDocumentSections, type DesignDocumentSectionsModel } from '@/components/design-document/DesignDocumentSections';

interface PrintDocumentPayload extends DesignDocumentSectionsModel {
  projectId: string;
  projectName: string;
  customerName: string | null;
  title: string;
  executiveSummary: string;
  conclusions: string;
}

export default function ProjectDesignDocumentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<PrintDocumentPayload | null>(null);

  const loadDocument = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/design-document`);
      const payload = (await response.json()) as PrintDocumentPayload | { error?: string };
      if (!response.ok || !('projectId' in payload)) {
        throw new Error(('error' in payload && payload.error) || 'Failed to load design document');
      }
      setDocumentData(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load design document');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadDocument();
  }, [loadDocument]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-zippy-green" size={28} />
      </div>
    );
  }

  if (!documentData) {
    return <p className="text-sm text-red-600">{error || 'Design document unavailable.'}</p>;
  }

  return (
    <div className="space-y-6 pb-8 print:pb-0 print:space-y-4">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between">
        <Link href={`/projects/${projectId}/design-document`} className="text-xs text-slate-500 hover:text-slate-800">
          <ArrowLeft size={12} className="inline mr-1" /> Back to editor
        </Link>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer size={14} /> Print / Save PDF
        </Button>
      </div>

      <section className="rounded-2xl border border-slate-300 bg-white p-5 space-y-4 print:border-0 print:rounded-none print:p-0">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">{documentData.title}</h1>
          <p className="text-xs text-slate-500 mt-1">
            Project: {documentData.projectName}
            {documentData.customerName ? ` · Customer: ${documentData.customerName}` : ''}
          </p>
        </header>

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 print:border print:bg-white">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Executive Summary</h2>
          <p className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{documentData.executiveSummary}</p>
        </article>

        <DesignDocumentSections sections={documentData.sections} appendix={documentData.appendix} />

        <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 print:border print:bg-white">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Conclusions</h2>
          <p className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{documentData.conclusions}</p>
        </article>
      </section>
    </div>
  );
}
