export const CATALOG_ITEM_TYPES = [
    'HARDWARE',
    'MANAGED_SERVICE',
    'SERVICE_OPTION',
    'PACKAGE',
    'CONNECTIVITY',
] as const;

export type CatalogItemType = (typeof CATALOG_ITEM_TYPES)[number];

const CATALOG_ITEM_TYPE_SET = new Set<string>(CATALOG_ITEM_TYPES);
const CATALOG_ITEM_TYPE_ALIASES: Record<string, CatalogItemType> = {
    SERVICE_FAMILY: 'MANAGED_SERVICE',
};

export function normalizeCatalogItemType(type: string | null | undefined): CatalogItemType | null {
    if (typeof type !== 'string') return null;
    const normalized = type.trim().toUpperCase();
    if (!normalized) return null;
    const aliased = CATALOG_ITEM_TYPE_ALIASES[normalized] ?? normalized;
    return CATALOG_ITEM_TYPE_SET.has(aliased) ? (aliased as CatalogItemType) : null;
}

export const ASSIGNABLE_SERVICE_TYPES = ['MANAGED_SERVICE', 'SERVICE_OPTION', 'CONNECTIVITY'] as const;

export type AssignableServiceType = (typeof ASSIGNABLE_SERVICE_TYPES)[number];

export const ASSIGNABLE_SERVICE_TYPE_SET = new Set<string>(ASSIGNABLE_SERVICE_TYPES);

export function isAssignableServiceType(type: string | null | undefined): type is AssignableServiceType {
    return typeof type === 'string' && ASSIGNABLE_SERVICE_TYPE_SET.has(type);
}
