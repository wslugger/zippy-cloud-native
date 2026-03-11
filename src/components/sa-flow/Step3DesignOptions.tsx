'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, ArrowRight, Settings2, Shield, Gem, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Step3DesignOptionsProps {
    selectedOption: any;
    selectedDesignOptions: string[]; // Term IDs
    onToggle: (termId: string) => void;
}

export function Step3DesignOptions({ selectedOption, selectedDesignOptions, onToggle }: Step3DesignOptionsProps) {
    // Group attributes by category
    const attributes = selectedOption?.attributes || [];
    const categories = Array.from(new Set(attributes.map((a: any) => a.term.category))) as string[];

    if (attributes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-dashed border-slate-100 rounded-3xl">
                <Sliders className="opacity-10" size={48} />
                <p className="text-sm text-slate-500 text-center max-w-xs">
                    No technical design options found for this selection.
                    You can proceed to the final step.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {categories.map((category) => (
                <div key={category} className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        {category.replace('_', ' ')}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {attributes
                            .filter((a: any) => a.term.category === category)
                            .map((a: any) => {
                                const isSelected = selectedDesignOptions.includes(a.term.id);
                                return (
                                    <button
                                        key={a.term.id}
                                        onClick={() => onToggle(a.term.id)}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50/20 text-blue-700 shadow-sm'
                                                : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                                        }`}>
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                        </div>
                                        <span className="text-sm font-medium">{a.term.label}</span>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            ))}
        </div>
    );
}
