'use client';

import { Shield, Globe, Sliders, Check, Info, AlertCircle } from 'lucide-react';
import { ConfigFormRenderer } from './ConfigFormRenderer';

interface Step3DesignOptionsProps {
    selectedOption: any;
    configValues: Record<string, any>;
    onConfigChange: (values: Record<string, any>) => void;
    selectedServiceOptions: any[];
    onToggleServiceOption: (item: any) => void;
    selectedTransports: any[];
    onToggleTransport: (item: any) => void;
}

export function Step3DesignOptions({ 
    selectedOption, 
    configValues, 
    onConfigChange,
    selectedServiceOptions,
    onToggleServiceOption,
    selectedTransports,
    onToggleTransport 
}: Step3DesignOptionsProps) {
    
    // Dependencies from selectedOption
    const dependencies = selectedOption?.childDependencies || [];
    
    // Support Tiers are OPTIONAL_ATTACHMENT of type SERVICE_OPTION
    const serviceOptions = dependencies
        .filter((d: any) => d.type === 'OPTIONAL_ATTACHMENT' && d.childItem.type === 'SERVICE_OPTION')
        .map((d: any) => d.childItem);

    // Transports are OPTIONAL_ATTACHMENT of type CONNECTIVITY
    const transports = dependencies
        .filter((d: any) => d.type === 'OPTIONAL_ATTACHMENT' && d.childItem.type === 'CONNECTIVITY')
        .map((d: any) => d.childItem);

    const isServiceOptionSelected = (id: string) => selectedServiceOptions.some(o => o.id === id);
    const isTransportSelected = (id: string) => selectedTransports.some(t => t.id === id);

    return (
        <div className="space-y-12 pb-10">
            {/* Section 1: Technical Design */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                        <Sliders size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Technical Configuration</h3>
                        <p className="text-sm text-slate-500">Tune the low-level technical parameters for this service stack.</p>
                    </div>
                </div>

                {selectedOption?.configSchema ? (
                    <ConfigFormRenderer 
                        schema={selectedOption.configSchema} 
                        values={configValues} 
                        onChange={onConfigChange} 
                    />
                ) : (
                    <div className="p-8 border-2 border-dashed border-slate-100 rounded-3xl text-center">
                        <p className="text-sm text-slate-400">No dynamic configuration available for this vendor stack.</p>
                    </div>
                )}
            </div>

            {/* Section 2: Service Options (Support Tiers) */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Support & Service Level</h3>
                        <p className="text-sm text-slate-500">Select the managed service tier and response time guarantee.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {serviceOptions.map((item: any) => {
                        const selected = isServiceOptionSelected(item.id);
                        const pricing = item.pricing?.[0];
                        
                        return (
                            <button
                                key={item.id}
                                onClick={() => onToggleServiceOption(item)}
                                className={`flex flex-col p-5 rounded-2xl border-2 transition-all text-left group relative ${
                                    selected 
                                        ? 'border-purple-500 bg-purple-50/20 shadow-sm' 
                                        : 'border-slate-100 bg-white hover:border-slate-200'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-xl border transition-colors ${
                                        selected ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-purple-50 group-hover:text-purple-400'
                                    }`}>
                                        <Check size={16} className={selected ? 'opacity-100' : 'opacity-0'} />
                                    </div>
                                    {pricing && (
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Adds</span>
                                            <p className="text-sm font-black text-slate-900">+${pricing.priceMrc}/mo</p>
                                        </div>
                                    )}
                                </div>
                                <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
                                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                    {item.shortDescription || 'Enhanced managed support and monitoring.'}
                                </p>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Section 3: Connectivity Selection */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Globe size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Transport & Connectivity</h3>
                        <p className="text-sm text-slate-500">Select one or more connection types for this site. <span className="text-red-500 font-bold">*Required</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {transports.map((item: any) => {
                        const selected = isTransportSelected(item.id);
                        const pricing = item.pricing?.[0];

                        return (
                            <button
                                key={item.id}
                                onClick={() => onToggleTransport(item)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                                    selected 
                                        ? 'border-emerald-500 bg-emerald-50/30 text-emerald-900 shadow-sm' 
                                        : 'border-slate-100 bg-white hover:border-slate-200 text-slate-600'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                                }`}>
                                    {selected && <Check size={12} className="text-white" />}
                                </div>
                                <div className="min-w-0">
                                    <span className="text-sm font-bold block truncate">{item.name}</span>
                                    {pricing && (
                                        <span className="text-[10px] font-bold text-slate-400 tracking-tighter self-end">${pricing.priceMrc}/mo</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
                
                {selectedTransports.length === 0 && (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100 animate-pulse">
                        <AlertCircle size={14} />
                        Please select at least one transport method to proceed.
                    </div>
                )}
            </div>
        </div>
    );
}
