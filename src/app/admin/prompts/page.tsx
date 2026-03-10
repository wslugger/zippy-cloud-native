'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Save,
    MessageSquare,
    History,
    AlertCircle,
    CheckCircle2,
    Loader2
} from 'lucide-react';

interface PromptConfig {
    id: string;
    key: string;
    value: string;
    description: string | null;
    updatedAt: string;
}

export default function PromptsPage() {
    const [prompts, setPrompts] = useState<PromptConfig[]>([]);
    const [selectedPrompt, setSelectedPrompt] = useState<PromptConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchPrompts();
    }, []);

    async function fetchPrompts() {
        try {
            const res = await fetch('/api/admin/prompts');
            const data = await res.json();
            setPrompts(data);
            if (data.length > 0 && !selectedPrompt) {
                setSelectedPrompt(data[0]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

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
                fetchPrompts();
            } else {
                throw new Error();
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to save prompt logic.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-12rem)] flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">AI Prompt Logic</h2>
                    <p className="text-slate-400">Configure the system prompts that drive Zippy's AI intelligence.</p>
                </div>
            </div>

            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Sidebar List */}
                <div className="w-80 flex flex-col gap-2 overflow-y-auto">
                    {prompts.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedPrompt(p)}
                            className={`p-4 text-left rounded-xl transition-all border ${selectedPrompt?.id === p.id
                                    ? 'bg-blue-600/10 border-blue-600/50 text-white'
                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
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

                {/* Editor Area */}
                <div className="flex-1 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
                    {selectedPrompt ? (
                        <>
                            <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="px-3 py-1 bg-slate-800 rounded text-[10px] font-mono text-blue-400 border border-slate-700">
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

                            <div className="p-6 flex-1 flex flex-col gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                        System Message Content
                                    </label>
                                    <textarea
                                        className="w-full h-80 bg-slate-950 border border-slate-800 rounded-lg p-4 text-sm font-mono leading-relaxed text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all resize-none shadow-inner"
                                        value={selectedPrompt.value}
                                        onChange={(e) => setSelectedPrompt({ ...selectedPrompt, value: e.target.value })}
                                        placeholder="Enter system prompt instructions here..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                        Description / Purpose
                                    </label>
                                    <Input
                                        value={selectedPrompt.description || ''}
                                        onChange={(e) => setSelectedPrompt({ ...selectedPrompt, description: e.target.value })}
                                        placeholder="Briefly describe what this prompt controls..."
                                        className="bg-slate-950"
                                    />
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
