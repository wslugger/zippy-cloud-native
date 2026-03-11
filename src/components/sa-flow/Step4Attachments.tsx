'use client';

import { useState, useEffect } from 'react';
import { Loader2, ShieldCheck, AlertCircle, Info, Paperclip, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Step4AttachmentsProps {
    selectedBase: any;
    selectedOption: any;
    selectedDesignOptions: string[];
    onToggleAttachment: (item: any) => void;
    selectedAttachments: string[]; // IDs
}

export function Step4Attachments({ 
    selectedBase, 
    selectedOption, 
    selectedDesignOptions,
    onToggleAttachment,
    selectedAttachments
}: Step4AttachmentsProps) {
    
    // Combine dependencies from base and selected option
    const baseDeps = selectedBase?.childDependencies || [];
    const optionDeps = selectedOption?.childDependencies || [];
    const allDeps = [...baseDeps, ...optionDeps];

    const attachments = allDeps.filter((d: any) => 
        d.type === 'MANDATORY_ATTACHMENT' || 
        d.type === 'OPTIONAL_ATTACHMENT' || 
        d.type === 'REQUIRES' || 
        d.childItem.type === 'MANAGED_SERVICE'
    );

    // Simplistic dependency validation logic
    const checkCompatibility = (dep: any) => {
        // Example: If an attachment requires a specific design option
        // In a real app, this would be fueled by a 'Rules' engine or DB constraints
        const constraints = dep.childItem.constraints || [];
        
        // Placeholder check: if description mentions a keyword
        const incompatible = constraints.find((c: any) => 
            c.description.toLowerCase().includes('requires') && 
            !selectedDesignOptions.some(dId => c.description.toLowerCase().includes(dId.toLowerCase()))
        );

        if (incompatible) {
            return {
                valid: false,
                reason: incompatible.description
            };
        }
        return { valid: true };
    };

    return (
        <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-start gap-4">
                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-emerald-100 text-emerald-600">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-emerald-900">Valid Solution Architecture</h3>
                    <p className="text-sm text-emerald-700 mt-1">
                        Your base selection of <span className="font-bold">{selectedBase?.name}</span> with <span className="font-bold">{selectedOption?.name}</span> is compatible.
                    </p>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Managed Attachments & Dependencies
                </h3>
                
                {attachments.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No additional attachments required.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {attachments.map((dep: any) => {
                            const validation = checkCompatibility(dep);
                            const isSelected = selectedAttachments.includes(dep.childItem.id) || dep.type === 'REQUIRES';
                            const isRequired = dep.type === 'REQUIRES';

                            return (
                                <TooltipProvider key={dep.id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className={`p-5 rounded-2xl border-2 transition-all relative ${
                                                !validation.valid ? 'opacity-50 grayscale cursor-not-allowed bg-slate-50 border-slate-100' :
                                                isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-slate-100 bg-white'
                                            }`}>
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-start gap-4">
                                                        <div className={`p-2.5 rounded-lg border ${
                                                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                                                        }`}>
                                                            <Paperclip size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-sm text-slate-900">{dep.childItem.name}</h4>
                                                            <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-bold tracking-tight">
                                                                {dep.type === 'REQUIRES' ? 'Auto-Included' : 'Optional Attachment'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {validation.valid && (
                                                        <Button 
                                                            size="sm" 
                                                            variant={isSelected ? "default" : "outline"}
                                                            disabled={isRequired}
                                                            onClick={() => onToggleAttachment(dep.childItem)}
                                                            className="h-8 rounded-full"
                                                        >
                                                            {isSelected ? <Check size={14} className="mr-1" /> : <Plus size={14} className="mr-1" />}
                                                            {isSelected ? 'Selected' : 'Add'}
                                                        </Button>
                                                    )}
                                                </div>
                                                
                                                {!validation.valid && (
                                                    <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                                        <AlertCircle size={12} />
                                                        {validation.reason}
                                                    </div>
                                                )}
                                            </div>
                                        </TooltipTrigger>
                                        {!validation.valid && (
                                            <TooltipContent>
                                                <p>{validation.reason}</p>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Collateral Section */}
            {(selectedBase?.collaterals?.length > 0 || selectedOption?.collaterals?.length > 0) && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                        Solution Collateral & Documentation
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[...(selectedBase?.collaterals || []), ...(selectedOption?.collaterals || [])].map((file: any, idx: number) => (
                            <a 
                                key={idx}
                                href={file.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-sm transition-all group"
                            >
                                <div className="p-2 rounded-lg bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <Paperclip size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-900 truncate">{file.title}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{file.type}</p>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
