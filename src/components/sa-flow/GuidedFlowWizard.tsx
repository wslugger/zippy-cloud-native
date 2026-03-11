'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronRight, ChevronLeft, CheckCircle2, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Step1BaseSelection } from './Step1BaseSelection';
import { Step2ServiceOptions } from './Step2ServiceOptions';
import { Step3DesignOptions } from './Step3DesignOptions';
import { Step4Attachments } from './Step4Attachments';

interface GuidedFlowWizardProps {
    projectId: string;
    onComplete: () => void;
}

export type WizardStep = 1 | 2 | 3 | 4;

export function GuidedFlowWizard({ projectId, onComplete }: GuidedFlowWizardProps) {
    const [step, setStep] = useState<WizardStep>(1);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Selection state
    const [selectedBase, setSelectedBase] = useState<any>(null);
    const [selectedOption, setSelectedOption] = useState<any>(null);
    const [selectedDesignOptions, setSelectedDesignOptions] = useState<string[]>([]); // Term IDs
    const [selectedAttachments, setSelectedAttachments] = useState<any[]>([]);

    // Navigation
    const nextStep = () => setStep((s) => (s + 1) as WizardStep);
    const prevStep = () => setStep((s) => (s - 1) as WizardStep);

    // Optimistic ROM Calculation
    const romTotals = useMemo(() => {
        let mrc = 0;
        let nrc = 0;

        const items = [
            selectedBase,
            selectedOption,
            ...selectedAttachments
        ].filter(Boolean);

        // Required items from dependencies
        const requiredDeps = [
            ...(selectedBase?.childDependencies || []),
            ...(selectedOption?.childDependencies || [])
        ].filter(d => d.type === 'REQUIRES');
        
        requiredDeps.forEach(d => items.push(d.childItem));

        items.forEach(item => {
            const pricing = item.pricing?.[0];
            if (pricing) {
                mrc += pricing.costMrc || 0;
                nrc += pricing.costNrc || 0;
            }
        });

        return { mrc, nrc };
    }, [selectedBase, selectedOption, selectedAttachments]);

    const handleToggleDesignOption = (termId: string) => {
        setSelectedDesignOptions(prev => 
            prev.includes(termId) ? prev.filter(id => id !== termId) : [...prev, termId]
        );
    };

    const handleToggleAttachment = (item: any) => {
        setSelectedAttachments(prev => 
            prev.some(a => a.id === item.id) 
                ? prev.filter(a => a.id !== item.id) 
                : [...prev, item]
        );
    };

    const handleComplete = async () => {
        setIsSaving(true);
        try {
            const itemsToSave = [
                { catalogItemId: selectedBase.id, quantity: 1 },
                { catalogItemId: selectedOption.id, quantity: 1 },
                ...selectedAttachments.map(a => ({ catalogItemId: a.id, quantity: 1 }))
            ];

            // Required dependencies
             const requiredDeps = [
                ...(selectedBase?.childDependencies || []),
                ...(selectedOption?.childDependencies || [])
            ].filter(d => d.type === 'REQUIRES');

            requiredDeps.forEach(d => {
                if (!itemsToSave.some(it => it.catalogItemId === d.childId)) {
                    itemsToSave.push({ catalogItemId: d.childId, quantity: 1 });
                }
            });

            // Combine selected attachments with auto-included required dependencies
            const allAtachmentIds = [
                ...selectedAttachments.map(a => a.id),
                ...requiredDeps.map(d => d.childId)
            ].filter((id, index, self) => self.indexOf(id) === index); // Unique

            // Atomic commit using the new design API
            const res = await fetch(`/api/projects/${projectId}/design`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseId: selectedBase.id,
                    optionId: selectedOption?.id,
                    attachmentIds: allAtachmentIds,
                    designOptionIds: selectedDesignOptions
                }),
            });

            if (!res.ok) throw new Error('Failed to commit design');

            onComplete();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            {/* Header / Stepper */}
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between max-w-2xl mx-auto">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all relative",
                                step === i ? "bg-blue-600 text-white ring-4 ring-blue-500/10 shadow-lg scale-110" : 
                                step > i ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
                            )}>
                                {step > i ? <Check size={20} /> : i}
                                {step === i && (
                                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm text-blue-600 border border-blue-100">
                                        <Sparkles size={10} className="animate-pulse" />
                                    </div>
                                )}
                            </div>
                            {i < 4 && <div className={cn("h-1 w-12 md:w-20 rounded-full", step > i ? "bg-emerald-500" : "bg-slate-200")} />}
                        </div>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="p-8 min-h-[500px] overflow-y-auto max-h-[70vh]">
                {step === 1 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-slate-900">Project Strategy</h2>
                            <p className="text-slate-500 text-lg">Select the primary service architecture or design package for this site.</p>
                        </div>
                        <Step1BaseSelection 
                            selectedId={selectedBase?.id} 
                            onSelect={(item) => {
                                setSelectedBase(item);
                                setSelectedOption(null); // Reset downstream
                                setSelectedAttachments([]);
                                nextStep();
                            }} 
                        />
                    </div>
                )}
                
                {step === 2 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-slate-900">Technology Selection</h2>
                            <p className="text-slate-500 text-lg">Choose the vendor or specific service variant for <span className="text-blue-600 font-bold">{selectedBase?.name}</span>.</p>
                        </div>
                        <Step2ServiceOptions 
                            parentItem={selectedBase}
                            selectedId={selectedOption?.id}
                            onSelect={(item) => {
                                setSelectedOption(item);
                                setSelectedAttachments([]);
                                nextStep();
                            }}
                        />
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-slate-900">Design Configuration</h2>
                            <p className="text-slate-500 text-lg">Tune technical features and capabilities for your <span className="text-blue-600 font-bold">{selectedOption?.name}</span> selection.</p>
                        </div>
                        <Step3DesignOptions 
                            selectedOption={selectedOption}
                            selectedDesignOptions={selectedDesignOptions}
                            onToggle={handleToggleDesignOption}
                        />
                    </div>
                )}

                {step === 4 && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-slate-900">Attachments & Review</h2>
                            <p className="text-slate-500 text-lg">Review required service attachments and managed overlays.</p>
                        </div>
                        <Step4Attachments 
                            selectedBase={selectedBase}
                            selectedOption={selectedOption}
                            selectedDesignOptions={selectedDesignOptions}
                            selectedAttachments={selectedAttachments.map(a => a.id)}
                            onToggleAttachment={handleToggleAttachment}
                        />
                    </div>
                )}
            </div>

            {/* Footer / Actions */}
            <div className="px-8 py-6 bg-slate-50/80 backdrop-blur-sm border-t border-slate-100 flex items-center justify-between">
                <Button 
                    variant="ghost" 
                    onClick={prevStep} 
                    disabled={step === 1 || isSaving}
                    className="gap-2 h-12 px-6 rounded-xl hover:bg-slate-200 transition-colors"
                >
                    <ChevronLeft size={18} /> Back
                </Button>
                
                <div className="flex items-center gap-6">
                    {/* ROM Pricing Summary */}
                    <div className="text-right flex flex-col justify-center">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Estimated ROM Totals</p>
                        <div className="flex items-baseline gap-3">
                             <div className="flex flex-col">
                                <span className="text-xs text-slate-400 font-medium">MRC</span>
                                <span className="text-xl font-bold text-slate-900">${romTotals.mrc.toLocaleString()}</span>
                            </div>
                            <div className="w-px h-6 bg-slate-200 mx-1" />
                            <div className="flex flex-col">
                                <span className="text-xs text-slate-400 font-medium">NRC</span>
                                <span className="text-xl font-bold text-slate-900">${romTotals.nrc.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <Button 
                        onClick={step === 4 ? handleComplete : nextStep} 
                        disabled={isSaving || (step === 1 && !selectedBase) || (step === 2 && !selectedOption)}
                        className={cn(
                            "gap-2 h-12 px-8 rounded-xl shadow-md transition-all font-bold",
                            step === 4 ? "bg-emerald-600 hover:bg-emerald-500" : "bg-blue-600 hover:bg-blue-500"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <>
                                {step === 4 ? 'Commit Design' : 'Continue'}
                                {step !== 4 && <ChevronRight size={18} />}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
