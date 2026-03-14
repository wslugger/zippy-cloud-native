'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Save,
    MessageSquare,
    History,
    AlertCircle,
    CheckCircle2,
    Loader2,
    FlaskConical,
    Upload
} from 'lucide-react';

interface PromptConfig {
    id: string;
    key: string;
    value: string;
    description: string | null;
    updatedAt: string;
}

interface PromptTestResult {
    model: string;
    latencyMs: number;
    finishReason: string | null;
    usageMetadata: unknown;
    output: string;
    inputSummary: {
        inputTextChars: number;
        uploadedFileName: string | null;
        extractedChars: number;
    };
}

const DEFAULT_MODEL_OPTIONS = [
    'gemini-3.1-flash-lite-preview',
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
];

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<PromptConfig[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<PromptConfig | null>(null);
    const [modelOptions, setModelOptions] = useState<string[]>(DEFAULT_MODEL_OPTIONS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [testModel, setTestModel] = useState(DEFAULT_MODEL_OPTIONS[0]);
    const [testPrompt, setTestPrompt] = useState('');
    const [testInputText, setTestInputText] = useState('');
    const [testFile, setTestFile] = useState<File | null>(null);
    const [testing, setTesting] = useState(false);
    const [testError, setTestError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<PromptTestResult | null>(null);

    const fetchPrompts = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/prompts');
            const data = await res.json();
            setPrompts(data);
            setSelectedPrompt((prev) => prev ?? (data.length > 0 ? data[0] : null));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchModelOptions = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/prompts/models');
            const data = await res.json();
            if (Array.isArray(data.models) && data.models.length > 0) {
                setModelOptions(Array.from(new Set(data.models)));
            }
        } catch (err) {
            console.error(err);
        }
    }, []);

    useEffect(() => {
        void fetchPrompts();
        void fetchModelOptions();
    }, [fetchPrompts, fetchModelOptions]);

    useEffect(() => {
        if (selectedPrompt) {
            setTestPrompt(selectedPrompt.value);
        }
    }, [selectedPrompt]);

    const handleSave = async () => {
        if (!selectedPrompt) return;
        setSaving(true);
        setMessage(null);
        try {
            const res = await fetch('/api/admin/prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(selectedPrompt)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Prompt logic updated successfully.' });
                void fetchPrompts();
            } else {
                throw new Error();
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to save prompt logic.' });
        } finally {
            setSaving(false);
        }
    };

    const runPromptTest = async () => {
        if (!testModel.trim()) {
            setTestError('Choose a model for the test run.');
            return;
        }
        if (!testPrompt.trim()) {
            setTestError('Prompt text is required for test execution.');
            return;
        }
        if (!testInputText.trim() && !testFile) {
            setTestError('Provide input text or upload a file for test execution.');
            return;
        }

        setTesting(true);
        setTestError(null);
        setTestResult(null);

        try {
            const formData = new FormData();
            formData.append('model', testModel);
            formData.append('prompt', testPrompt);
            formData.append('inputText', testInputText);
            if (testFile) formData.append('file', testFile);

            const res = await fetch('/api/admin/prompts/test', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.error || 'Prompt test failed');
            }
            setTestResult(data as PromptTestResult);
        } catch (err: unknown) {
            setTestError(err instanceof Error ? err.message : 'Prompt test failed');
        } finally {
            setTesting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-zippy-green" size={32} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">AI Prompt Logic</h2>
                    <p className="text-slate-600">Configure the system prompts that drive Zippy&apos;s AI intelligence.</p>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                <div className="w-80 flex flex-col gap-2 overflow-y-auto">
                    {prompts.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedPrompt(p)}
                            className={`p-4 text-left rounded-xl transition-all border ${selectedPrompt?.id === p.id
                                ? 'bg-blue-600/10 border-blue-600/50 text-slate-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-200'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <MessageSquare size={14} className={selectedPrompt?.id === p.id ? 'text-blue-400' : ''} />
                                <span className="font-bold text-xs tracking-wider">{p.key}</span>
                            </div>
                            <p className="text-xs line-clamp-2 leading-relaxed opacity-70">
                                {p.description || 'No description provided.'}
                            </p>
                        </button>
                    ))}
                </div>

                <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl">
                    {selectedPrompt ? (
                        <>
                            <div className="p-4 border-b border-slate-200 bg-white/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="px-3 py-1 bg-slate-100 rounded text-[10px] font-mono text-blue-400 border border-slate-300">
                                        {selectedPrompt.key}
                                    </div>
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <History size={12} />
                                        Last updated: {new Date(selectedPrompt.updatedAt).toLocaleString()}
                                    </span>
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="gap-2 h-8 px-4"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                                    Save Changes
                                </Button>
                            </div>

                            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
                                {selectedPrompt.key === 'GEMINI_MODEL' ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                            Primary Gemini Model
                                        </label>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-zippy-green/50 transition-all"
                                            value={selectedPrompt.value}
                                            onChange={(e) => setSelectedPrompt({ ...selectedPrompt, value: e.target.value })}
                                        >
                                            {Array.from(new Set([selectedPrompt.value, ...modelOptions])).map((model) => (
                                                <option key={model} value={model}>{model}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500">
                                            Runtime fallback is automatically set to <span className="font-mono">gemini-2.5-flash</span> if the primary model fails.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                            System Message Content
                                        </label>
                                        <textarea
                                            className="w-full h-80 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm font-mono leading-relaxed text-slate-700 focus:outline-none focus:ring-1 focus:ring-zippy-green/50 transition-all resize-none shadow-inner"
                                            value={selectedPrompt.value}
                                            onChange={(e) => setSelectedPrompt({ ...selectedPrompt, value: e.target.value })}
                                            placeholder="Enter system prompt instructions here..."
                                        />
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                        Description / Purpose
                                    </label>
                                    <Input
                                        value={selectedPrompt.description || ''}
                                        onChange={(e) => setSelectedPrompt({ ...selectedPrompt, description: e.target.value })}
                                        placeholder="Briefly describe what this prompt controls..."
                                        className="bg-slate-50"
                                    />
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                            <FlaskConical size={16} className="text-zippy-green" />
                                            Prompt Test Bench
                                        </h3>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setTestPrompt(selectedPrompt.value)}
                                        >
                                            Use Current Editor Text
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                            Test Model
                                        </label>
                                        <select
                                            className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm font-mono text-slate-700 focus:outline-none focus:ring-1 focus:ring-zippy-green/50 transition-all"
                                            value={testModel}
                                            onChange={(e) => setTestModel(e.target.value)}
                                        >
                                            {modelOptions.map((model) => (
                                                <option key={model} value={model}>{model}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                            Test Prompt Text
                                        </label>
                                        <textarea
                                            className="w-full h-36 bg-white border border-slate-200 rounded-lg p-3 text-xs font-mono leading-relaxed text-slate-700 focus:outline-none focus:ring-1 focus:ring-zippy-green/50 transition-all resize-y"
                                            value={testPrompt}
                                            onChange={(e) => setTestPrompt(e.target.value)}
                                            placeholder="Edit prompt text for this test run..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                            Test Input Text
                                        </label>
                                        <textarea
                                            className="w-full h-24 bg-white border border-slate-200 rounded-lg p-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-zippy-green/50 transition-all resize-y"
                                            value={testInputText}
                                            onChange={(e) => setTestInputText(e.target.value)}
                                            placeholder="Paste customer requirements or scenario text..."
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                            Optional Test Document
                                        </label>
                                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer">
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => setTestFile(e.target.files?.[0] ?? null)}
                                            />
                                            <Upload size={14} />
                                            {testFile ? testFile.name : 'Upload Document'}
                                        </label>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            onClick={runPromptTest}
                                            disabled={testing}
                                            className="gap-2"
                                        >
                                            {testing ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
                                            Run Prompt Test
                                        </Button>
                                        {testError && <p className="text-xs text-red-600">{testError}</p>}
                                    </div>

                                    {testResult && (
                                        <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                            <div className="text-[11px] text-slate-500 font-mono">
                                                model={testResult.model} | finish={testResult.finishReason ?? 'unknown'} | latencyMs={testResult.latencyMs}
                                            </div>
                                            <pre className="whitespace-pre-wrap text-xs text-slate-700 max-h-64 overflow-auto">
                                                {testResult.output || '(No output text returned)'}
                                            </pre>
                                        </div>
                                    )}
                                </div>

                                {message && (
                                    <div className={`mt-auto p-3 rounded-lg flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        }`}>
                                        {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                        {message.text}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-4">
                            <MessageSquare size={48} className="opacity-20" />
                            <p>Select a system prompt from the left to start editing.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
