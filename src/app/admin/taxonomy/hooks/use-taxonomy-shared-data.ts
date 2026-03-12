'use client';

import { useCallback, useEffect, useState } from 'react';
import { isAssignableServiceType } from '@/lib/catalog-item-types';
import type {
    CatalogItemsResponse,
    ServiceCatalogItem,
    SharedTaxonomyState,
    TaxonomyTerm,
} from '../types';

export function useTaxonomySharedData(): SharedTaxonomyState {
    const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
    const [services, setServices] = useState<ServiceCatalogItem[]>([]);
    const [selectedServiceId, setSelectedServiceId] = useState('');

    const [termsLoading, setTermsLoading] = useState(true);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [termsError, setTermsError] = useState<string | null>(null);
    const [servicesError, setServicesError] = useState<string | null>(null);

    const reloadTerms = useCallback(async () => {
        setTermsLoading(true);
        setTermsError(null);
        try {
            const res = await fetch('/api/admin/taxonomy');
            if (!res.ok) throw new Error('Failed to fetch taxonomy terms');
            const data = (await res.json()) as TaxonomyTerm[];
            setTerms(data);
        } catch (error) {
            console.error(error);
            setTermsError(error instanceof Error ? error.message : 'Failed to load taxonomy data');
        } finally {
            setTermsLoading(false);
        }
    }, []);

    const reloadServices = useCallback(async () => {
        setServicesLoading(true);
        setServicesError(null);
        try {
            const res = await fetch('/api/admin/catalog?limit=200');
            const payload = (await res.json().catch(() => ({}))) as Partial<CatalogItemsResponse> & { error?: string };
            if (!res.ok) {
                throw new Error(payload.error || 'Failed to load catalog items');
            }

            const serviceList = (payload.items ?? []).filter((item) => isAssignableServiceType(item.type));
            setServices(serviceList);
            setSelectedServiceId((previous) =>
                serviceList.some((service) => service.id === previous)
                    ? previous
                    : (serviceList[0]?.id ?? '')
            );
        } catch (error) {
            console.error(error);
            setServices([]);
            setSelectedServiceId('');
            setServicesError(error instanceof Error ? error.message : 'Failed to load catalog items');
        } finally {
            setServicesLoading(false);
        }
    }, []);

    useEffect(() => {
        void reloadTerms();
        void reloadServices();
    }, [reloadTerms, reloadServices]);

    return {
        terms,
        services,
        selectedServiceId,
        setSelectedServiceId,
        termsLoading,
        servicesLoading,
        termsError,
        servicesError,
        clearTermsError: () => setTermsError(null),
        clearServicesError: () => setServicesError(null),
        reloadTerms,
        reloadServices,
    };
}
