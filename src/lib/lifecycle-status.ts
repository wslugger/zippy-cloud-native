export const LIFECYCLE_STATUSES = [
  "SUPPORTED",
  "IN_DEVELOPMENT",
  "APPROVAL_REQUIRED",
  "DEPRECATED",
  "END_OF_SALE",
  "END_OF_SUPPORT",
  "NOT_AVAILABLE",
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const FEATURE_AND_OPTION_LIFECYCLE_STATUSES = [
  "SUPPORTED",
  "IN_DEVELOPMENT",
  "APPROVAL_REQUIRED",
  "DEPRECATED",
  "NOT_AVAILABLE",
] as const;

export const HARDWARE_LIFECYCLE_STATUSES = [
  "SUPPORTED",
  "IN_DEVELOPMENT",
  "APPROVAL_REQUIRED",
  "END_OF_SALE",
  "END_OF_SUPPORT",
  "NOT_AVAILABLE",
] as const;

const LIFECYCLE_SET = new Set<string>(LIFECYCLE_STATUSES);
const FEATURE_AND_OPTION_SET = new Set<string>(FEATURE_AND_OPTION_LIFECYCLE_STATUSES);
const HARDWARE_SET = new Set<string>(HARDWARE_LIFECYCLE_STATUSES);

export const SA_BLOCKED_STATUSES = new Set<LifecycleStatus>([
  "NOT_AVAILABLE",
  "DEPRECATED",
  "END_OF_SALE",
  "END_OF_SUPPORT",
]);

export const CUSTOMER_BLOCKED_STATUSES = new Set<LifecycleStatus>([
  "NOT_AVAILABLE",
  "DEPRECATED",
  "END_OF_SALE",
  "END_OF_SUPPORT",
  "IN_DEVELOPMENT",
  "APPROVAL_REQUIRED",
]);

export type LifecycleAggregate = "READY" | "REVIEW_REQUIRED" | "BLOCKED";

export function normalizeLifecycleStatus(value: unknown): LifecycleStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return LIFECYCLE_SET.has(normalized) ? (normalized as LifecycleStatus) : null;
}

export function isFeatureOrOptionLifecycleStatus(value: unknown): value is LifecycleStatus {
  const normalized = normalizeLifecycleStatus(value);
  return Boolean(normalized && FEATURE_AND_OPTION_SET.has(normalized));
}

export function isHardwareLifecycleStatus(value: unknown): value is LifecycleStatus {
  const normalized = normalizeLifecycleStatus(value);
  return Boolean(normalized && HARDWARE_SET.has(normalized));
}

export function isSaBlockedLifecycleStatus(status: LifecycleStatus): boolean {
  return SA_BLOCKED_STATUSES.has(status);
}

export function isCustomerBlockedLifecycleStatus(status: LifecycleStatus): boolean {
  return CUSTOMER_BLOCKED_STATUSES.has(status);
}

export function lifecycleStatusLabel(status: LifecycleStatus): string {
  switch (status) {
    case "SUPPORTED":
      return "Supported";
    case "IN_DEVELOPMENT":
      return "In Development";
    case "APPROVAL_REQUIRED":
      return "Approval Required";
    case "DEPRECATED":
      return "Deprecated";
    case "END_OF_SALE":
      return "End of Sale";
    case "END_OF_SUPPORT":
      return "End of Support";
    case "NOT_AVAILABLE":
      return "Not Available";
    default:
      return status;
  }
}

export function aggregateLifecycleStatuses(statuses: Array<LifecycleStatus | null | undefined>): LifecycleAggregate {
  const normalized = statuses.filter((status): status is LifecycleStatus => Boolean(status));
  if (normalized.some((status) => SA_BLOCKED_STATUSES.has(status))) {
    return "BLOCKED";
  }
  if (normalized.some((status) => status === "IN_DEVELOPMENT" || status === "APPROVAL_REQUIRED")) {
    return "REVIEW_REQUIRED";
  }
  return "READY";
}

