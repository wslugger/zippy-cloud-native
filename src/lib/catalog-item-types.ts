export const ASSIGNABLE_SERVICE_TYPES = ['MANAGED_SERVICE', 'SERVICE_OPTION', 'CONNECTIVITY'] as const;

export type AssignableServiceType = (typeof ASSIGNABLE_SERVICE_TYPES)[number];

export const ASSIGNABLE_SERVICE_TYPE_SET = new Set<string>(ASSIGNABLE_SERVICE_TYPES);

export function isAssignableServiceType(type: string | null | undefined): type is AssignableServiceType {
    return typeof type === 'string' && ASSIGNABLE_SERVICE_TYPE_SET.has(type);
}
