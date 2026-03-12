'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ServiceCatalogItem } from '../types';

interface ServiceSelectorProps {
    services: ServiceCatalogItem[];
    selectedServiceId: string;
    setSelectedServiceId: Dispatch<SetStateAction<string>>;
    loading: boolean;
    error: string | null;
    showSelectionCaption?: boolean;
}

export function ServiceSelector({
    services,
    selectedServiceId,
    setSelectedServiceId,
    loading,
    error,
    showSelectionCaption = false,
}: ServiceSelectorProps) {
    const selectedService = services.find((service) => service.id === selectedServiceId) ?? null;

    return (
        <>
            <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600">Service</label>
                <select
                    value={selectedServiceId}
                    onChange={(event) => setSelectedServiceId(event.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
                >
                    {services.length === 0 && <option value="">No assignable services found</option>}
                    {services.map((service) => (
                        <option key={service.id} value={service.id}>
                            {service.name} ({service.sku}) - {service.type}
                        </option>
                    ))}
                </select>
                {loading && <p className="text-[11px] text-slate-500">Loading services...</p>}
                {error && <p className="text-[11px] text-rose-600">{error}</p>}
            </div>

            {showSelectionCaption && selectedService && (
                <p className="text-xs text-slate-600">
                    Editing assignment on <span className="font-semibold text-slate-900">{selectedService.name}</span> ({selectedService.sku})
                </p>
            )}
        </>
    );
}
