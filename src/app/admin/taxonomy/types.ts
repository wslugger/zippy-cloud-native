import type { Dispatch, SetStateAction } from 'react';

export type LifecycleStatus =
    | 'SUPPORTED'
    | 'IN_DEVELOPMENT'
    | 'APPROVAL_REQUIRED'
    | 'DEPRECATED'
    | 'END_OF_SALE'
    | 'END_OF_SUPPORT'
    | 'NOT_AVAILABLE';

export const FEATURE_AND_OPTION_LIFECYCLE_OPTIONS: LifecycleStatus[] = [
    'SUPPORTED',
    'IN_DEVELOPMENT',
    'APPROVAL_REQUIRED',
    'DEPRECATED',
    'NOT_AVAILABLE',
];

export const HARDWARE_LIFECYCLE_OPTIONS: LifecycleStatus[] = [
    'SUPPORTED',
    'IN_DEVELOPMENT',
    'APPROVAL_REQUIRED',
    'END_OF_SALE',
    'END_OF_SUPPORT',
    'NOT_AVAILABLE',
];

export interface TaxonomyTerm {
    id: string;
    category: string;
    label: string;
    value: string;
    lifecycleStatus: LifecycleStatus;
    description: string | null;
    constraints: string[];
    assumptions: string[];
}

export interface TaxonomyFormState {
    id?: string;
    category: string;
    label: string;
    value: string;
    lifecycleStatus: LifecycleStatus;
    description: string;
    constraintsText: string;
    assumptionsText: string;
}

export interface DesignOptionValue {
    id?: string;
    value: string;
    label: string;
    autoKey?: boolean;
    description?: string | null;
    constraints?: string[];
    assumptions?: string[];
    sortOrder?: number;
    isActive?: boolean;
}

export interface DesignOptionDefinition {
    id: string;
    key: string;
    label: string;
    lifecycleStatus: LifecycleStatus;
    valueType: 'STRING' | 'NUMBER' | 'BOOLEAN';
    isActive: boolean;
    values: DesignOptionValue[];
}

export interface DesignOptionFormState {
    key: string;
    label: string;
    lifecycleStatus: LifecycleStatus;
    values: DesignOptionValue[];
}

export interface ServiceCatalogItem {
    id: string;
    sku: string;
    name: string;
    type: string;
}

export interface ServiceDesignOptionRow {
    designOptionId: string;
    isRequired: boolean;
    allowMulti: boolean;
    defaultValueId: string | null;
    allowedValueIds: string[];
}

export interface DesignOptionsResponse {
    options: DesignOptionDefinition[];
}

export interface CatalogItemsResponse {
    items: ServiceCatalogItem[];
}

export interface ServiceDesignOptionsResponse {
    options: Array<{
        designOptionId: string;
        isRequired: boolean;
        allowMulti: boolean;
        defaultValueId: string | null;
        allowedValues: Array<{ designOptionValueId: string }>;
    }>;
}

export type WorkspaceTab = 'terms' | 'design-options' | 'features';
export type WorkspaceStatus = { type: 'success' | 'error'; message: string };

export const PANEL_CATEGORIES = [
    'CLASSIFICATION',
    'PANEL_PRICING',
    'PANEL_ATTACHMENTS',
    'PANEL_SERVICE_OPTIONS',
    'PANEL_FEATURES',
] as const;

export const ITEM_TYPES = [
    'HARDWARE',
    'MANAGED_SERVICE',
    'CONNECTIVITY',
    'PACKAGE',
    'SERVICE_OPTION',
] as const;

export const HIDDEN_TAXONOMY_TERM_CATEGORIES = new Set(['FEATURE', 'REGION', 'VENDOR']);

export const EMPTY_TAXONOMY_FORM: TaxonomyFormState = {
    category: 'CLASSIFICATION',
    label: '',
    value: '',
    lifecycleStatus: 'SUPPORTED',
    description: '',
    constraintsText: '',
    assumptionsText: '',
};

export const EMPTY_DESIGN_OPTION_FORM: DesignOptionFormState = {
    key: '',
    label: '',
    lifecycleStatus: 'SUPPORTED',
    values: [{ value: '', label: '', autoKey: true, description: '', constraints: [], assumptions: [], sortOrder: 0, isActive: true }],
};

export const EMPTY_FEATURE_FORM: TaxonomyFormState = {
    category: 'FEATURE',
    label: '',
    value: '',
    lifecycleStatus: 'SUPPORTED',
    description: '',
    constraintsText: '',
    assumptionsText: '',
};

export interface SharedTaxonomyState {
    terms: TaxonomyTerm[];
    services: ServiceCatalogItem[];
    selectedServiceId: string;
    setSelectedServiceId: Dispatch<SetStateAction<string>>;
    termsLoading: boolean;
    servicesLoading: boolean;
    termsError: string | null;
    servicesError: string | null;
    clearTermsError: () => void;
    clearServicesError: () => void;
    reloadTerms: () => Promise<void>;
    reloadServices: () => Promise<void>;
}

export interface TermsWorkspaceProps {
    isActive: boolean;
    terms: TaxonomyTerm[];
    termsLoading: boolean;
    termsError: string | null;
    clearTermsError: () => void;
    reloadTerms: () => Promise<void>;
}

export interface DesignOptionsWorkspaceProps {
    isActive: boolean;
}

export interface FeaturesWorkspaceProps {
    isActive: boolean;
    terms: TaxonomyTerm[];
    services: ServiceCatalogItem[];
    selectedServiceId: string;
    setSelectedServiceId: Dispatch<SetStateAction<string>>;
    termsLoading: boolean;
    termsError: string | null;
    servicesLoading: boolean;
    servicesError: string | null;
    reloadTerms: () => Promise<void>;
}
