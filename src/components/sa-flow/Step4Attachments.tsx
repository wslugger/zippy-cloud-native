'use client';

import { ShieldCheck, Paperclip, Check, Plus, Box, Zap, Settings2 } from 'lucide-react';
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
    configValues: Record<string, any>;
    selectedServiceOptions: any[];
    selectedTransports: any[];
    selectedAttachments: string[]; // IDs of explicitly selected attachments
    onToggleAttachment: (item: any) => void;
}

export function Step4Attachments({ 
    selectedBase, 
    selectedOption, 
    configValues,
    selectedServiceOptions,
    selectedTransports,
    selectedAttachments,
    onToggleAttachment
}: Step4AttachmentsProps) {
    
    // Auto-included items (INCLUDES/REQUIRES)
    const autoIncluded = [
        ...(selectedBase?.childDependencies || []),
        ...(selectedOption?.childDependencies || [])
    ].filter((d: any) => d.type === 'INCLUDES' || d.type === 'REQUIRES')
     .map((d: any) => d.childItem);

    // Optional managed attachments (NOT already selected as service options or transports)
    const optionalAttachments = [
        ...(selectedBase?.childDependencies || []),
        ...(selectedOption?.childDependencies || [])
    ].filter((d: any) => 
        d.type === 'OPTIONAL_ATTACHMENT' && 
        d.childItem.type !== 'SERVICE_OPTION' && 
        d.childItem.type !== 'CONNECTIVITY'
    ).map((d: any) => d.childItem);

    return (
        <div className="space-y-10 pb-10">
            {/* Design Confirmation Banner */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                <div className="bg-white p-2.5 rounded-xl shadow-sm border border-emerald-100 text-emerald-600">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h3 className="font-bold text-emerald-900 text-lg">Solution Configuration Verified</h3>
                    <p className="text-sm text-emerald-700 mt-1">
                        Architecture for <span className="font-bold">{selectedBase?.name}</span> using <span className="font-bold">{selectedOption?.name}</span> logic has been successfully validated.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Col: Summary of Selections */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 space-y-6">
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                            <Settings2 size={16} className="text-slate-400" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Design Summary</h3>
                        </div>

                        <div className="space-y-4">
                            {selectedServiceOptions.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Support Tier</p>
                                    <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Zap size={14} className="text-purple-500" />
                                        {selectedServiceOptions[0].name}
                                    </p>
                                </div>
                            )}

                            {selectedTransports.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Connectivity</p>
                                    <div className="flex flex-wrap gap-1.2">
                                        {selectedTransports.map(t => (
                                            <span key={t.id} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                                                {t.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {Object.keys(configValues).length > 0 && (
                                <div className="space-y-1 pt-2 border-t border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Configurations</p>
                                    <div className="space-y-1">
                                        {Object.entries(configValues).map(([key, val]) => (
                                            <div key={key} className="flex justify-between text-[11px]">
                                                <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                <span className="font-bold text-slate-700">{val.toString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Col: Items and Attachments */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Auto-Included Hardware */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Box size={14} /> Included Hardware & Infrastructure
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                            {autoIncluded.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No hardware included for this service tier.</p>
                            ) : (
                                autoIncluded.map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-blue-200 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                                <Box size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-tight flex items-center gap-1.5">
                                                    <Check size={10} className="text-emerald-500" /> Managed Device
                                                </p>
                                            </div>
                                        </div>
                                        <div className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-[10px] font-bold text-slate-500">
                                            Auto-Included
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Optional Managed Overlays */}
                    {optionalAttachments.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                <Paperclip size={14} /> Optional Managed Overlays & Security
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {optionalAttachments.map((item: any) => {
                                    const isSelected = selectedAttachments.includes(item.id);
                                    return (
                                        <TooltipProvider key={item.id}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className={`p-4 rounded-2xl border-2 transition-all relative ${
                                                        isSelected ? 'border-blue-500 bg-blue-50/10' : 'border-slate-100 bg-white hover:border-slate-200'
                                                    }`}>
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-start gap-4">
                                                                <div className={`p-2 rounded-lg border transition-all ${
                                                                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400'
                                                                }`}>
                                                                    <Paperclip size={18} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                                                                    <p className="text-[10px] text-slate-500 mt-0.5 uppercase font-bold tracking-tight">Optional Add-on</p>
                                                                </div>
                                                            </div>
                                                            <Button 
                                                                size="sm" 
                                                                variant={isSelected ? "default" : "outline"}
                                                                onClick={() => onToggleAttachment(item)}
                                                                className={`h-8 w-8 p-0 rounded-full ${isSelected ? 'bg-blue-600' : 'hover:bg-blue-50 text-blue-600'}`}
                                                            >
                                                                {isSelected ? <Check size={14} /> : <Plus size={14} />}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p className="text-xs">{item.shortDescription || 'Add advanced capability to this service.'}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
