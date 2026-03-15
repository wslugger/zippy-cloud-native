export interface PackageDependencyAllowlistEntry {
  managedTierIds: string[];
  connectivityIds: string[];
}

export type PackageDependencyAllowlist = Record<string, PackageDependencyAllowlistEntry>;

export type CoreServiceRole = "SDWAN" | "LAN" | "WLAN" | "CONNECTIVITY" | "OTHER";

const MANAGED_TIER_SKUS = new Set(["SVC-TOTAL-CARE", "SVC-HW-PLUS", "SVC-WATCH-ALERT"]);
const MANAGED_TIER_NAMES = new Set(["total care", "hardware plus", "watch & alert", "watch and alert"]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isManagedTierOptionByIdentity(input: {
  type?: string | null;
  sku?: string | null;
  name?: string | null;
}): boolean {
  if ((input.type ?? "").toUpperCase() !== "SERVICE_OPTION") return false;
  const normalizedName = normalizeText(input.name);
  return MANAGED_TIER_SKUS.has(input.sku ?? "") || MANAGED_TIER_NAMES.has(normalizedName);
}

export function classifyCoreServiceRoleByIdentity(input: {
  type?: string | null;
  name?: string | null;
}): CoreServiceRole {
  const normalizedType = (input.type ?? "").toUpperCase();
  if (normalizedType === "CONNECTIVITY") return "CONNECTIVITY";
  if (normalizedType !== "MANAGED_SERVICE") return "OTHER";
  const normalizedName = normalizeText(input.name);
  if (/\bsd[\s-]?wan\b/i.test(normalizedName)) return "SDWAN";
  if (/\bwlan\b/i.test(normalizedName) || /\bwi[\s-]?fi\b/i.test(normalizedName)) return "WLAN";
  if (/\blan\b/i.test(normalizedName)) return "LAN";
  return "OTHER";
}

export function parsePackageDependencyAllowlist(configSchema: unknown): PackageDependencyAllowlist {
  if (!isRecord(configSchema)) return {};
  const raw = configSchema.packageDependencyAllowlist;
  if (!isRecord(raw)) return {};

  const output: PackageDependencyAllowlist = {};
  for (const [catalogItemId, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue;
    output[catalogItemId] = {
      managedTierIds: normalizeStringArray(value.managedTierIds),
      connectivityIds: normalizeStringArray(value.connectivityIds),
    };
  }
  return output;
}

