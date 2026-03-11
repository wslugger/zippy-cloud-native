'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, ArrowRight, Settings2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Step2ServiceOptionsProps {
    parentItem: any;
    onSelect: (item: any) => void;
    selectedId?: string;
}

export function Step2ServiceOptions({ parentItem, onSelect, selectedId }: Step2ServiceOptionsProps) {
    // We already have parentItem from props, which should include childDependencies from the API
    const options = parentItem.childDependencies?.filter((d: any) => 
        d.childItem.type === 'SERVICE_OPTION' || d.type === 'IS_A'
    ).map((d: any) => d.childItem) || [];

    if (options.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-dashed border-slate-100 rounded-3xl">
                <Settings2 className="opacity-10" size={48} />
                <p className="text-sm text-slate-500 text-center max-w-xs">
                    No specific options found for this core service. 
                    You can proceed to the next step.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((item: any) => (
                <button
                    key={item.id}
                    onClick={() => onSelect(item)}
                    className={`text-left p-6 border-2 rounded-2xl transition-all group ${
                        selectedId === item.id 
                            ? 'border-blue-500 bg-blue-50/10' 
                            : 'border-slate-100 hover:border-slate-300 bg-white'
                    }`}
                >
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl border ${
                            selectedId === item.id 
                                ? 'bg-blue-600 border-blue-500 text-white' 
                                : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:text-blue-500 transition-colors'
                        }`}>
                            {item.type === 'MANAGED_SERVICE' ? <Shield size={24} /> : <Settings2 size={24} />}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                {item.name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {item.shortDescription || 'Specific technology or vendor option.'}
                            </p>
                        </div>
                    </div>
                </button>
            ))}
        </div>
    );
}
