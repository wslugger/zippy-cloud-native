import {
  CatalogItemDesignOption,
  DesignOptionDefinition,
  DesignOptionValue,
  PackagePolicyOperator,
  PackagePolicyScope,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface SelectionInput {
  catalogItemId: string;
  quantity?: number;
  configValues?: Record<string, unknown>;
  designOptionValues?: Record<string, string | string[]>;
}

export interface EvaluatedSelection {
  catalogItemId: string;
  quantity: number;
  configValues: Record<string, unknown>;
  designOptionValues: Record<string, string[]>;
  autoAdded: boolean;
}

export interface PackagePolicyViolation {
  code:
    | "MISSING_REQUIRED_ITEM"
    | "INVALID_OPTION_VALUE"
    | "MISSING_REQUIRED_OPTION"
    | "FORCED_VALUE_MISMATCH"
    | "FORBIDDEN_VALUE_SELECTED"
    | "ALLOW_ONLY_VIOLATION"
    | "REQUIRE_ONE_OF_VIOLATION"
    | "QUANTITY_OUT_OF_BOUNDS"
    | "NON_SELECTABLE_ITEM";
  message: string;
  packageId: string;
  itemId?: string;
  designOptionKey?: string;
  blocking: boolean;
}

export interface PackageEvaluationResult {
  effectiveSelections: EvaluatedSelection[];
  forcedConfig: Record<string, Record<string, string | string[]>>;
  violations: PackagePolicyViolation[];
}

export interface PolicyConflict {
  code:
    | "CONFLICTING_FORCE"
    | "FORCE_FORBID_CONFLICT"
    | "FORCE_ALLOW_ONLY_CONFLICT"
    | "FORCE_REQUIRE_ONE_OF_CONFLICT"
    | "ALLOW_ONLY_REQUIRE_ONE_OF_CONFLICT";
  message: string;
  packageId: string;
  targetCatalogItemId: string;
  designOptionId: string;
}

export interface PolicyCandidate {
  id?: string;
  packageId: string;
  targetCatalogItemId: string;
  designOptionId: string;
  operator: PackagePolicyOperator;
  active: boolean;
  values: string[];
}

type ItemOptionWithValues = CatalogItemDesignOption & {
  designOption: DesignOptionDefinition;
  allowedValues: Array<{
    designOptionValue: DesignOptionValue;
  }>;
  defaultValue: DesignOptionValue | null;
};

function normalizeValueInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function ensureSelectionMap(selections: SelectionInput[]): Map<string, EvaluatedSelection> {
  const map = new Map<string, EvaluatedSelection>();
  for (const sel of selections) {
    const quantity = Math.max(1, sel.quantity ?? 1);
    map.set(sel.catalogItemId, {
      catalogItemId: sel.catalogItemId,
      quantity,
      configValues: sel.configValues ?? {},
      designOptionValues: Object.fromEntries(
        Object.entries(sel.designOptionValues ?? {}).map(([key, v]) => [key, dedupe(normalizeValueInput(v))])
      ),
      autoAdded: false,
    });
  }
  return map;
}

function optionValueSet(values: string[]): Set<string> {
  return new Set(values);
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (b.has(value)) return true;
  }
  return false;
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

export function validatePolicyConflicts(policies: PolicyCandidate[]): PolicyConflict[] {
  const conflicts: PolicyConflict[] = [];
  const active = policies.filter((p) => p.active);
  const grouped = new Map<string, PolicyCandidate[]>();

  for (const policy of active) {
    const key = `${policy.packageId}:${policy.targetCatalogItemId}:${policy.designOptionId}`;
    const list = grouped.get(key) ?? [];
    list.push(policy);
    grouped.set(key, list);
  }

  for (const [groupKey, groupPolicies] of grouped.entries()) {
    const [packageId, targetCatalogItemId, designOptionId] = groupKey.split(":");

    const forcePolicies = groupPolicies.filter((p) => p.operator === "FORCE");
    if (forcePolicies.length > 1) {
      const first = optionValueSet(forcePolicies[0].values);
      for (const policy of forcePolicies.slice(1)) {
        if (!isSubset(optionValueSet(policy.values), first) || !isSubset(first, optionValueSet(policy.values))) {
          conflicts.push({
            code: "CONFLICTING_FORCE",
            message: "Conflicting FORCE policies found for the same package/item/design option.",
            packageId,
            targetCatalogItemId,
            designOptionId,
          });
          break;
        }
      }
    }

    const forceSet = forcePolicies.length > 0 ? optionValueSet(forcePolicies[0].values) : null;
    const forbidPolicies = groupPolicies.filter((p) => p.operator === "FORBID");
    const allowOnlyPolicies = groupPolicies.filter((p) => p.operator === "ALLOW_ONLY");
    const requirePolicies = groupPolicies.filter((p) => p.operator === "REQUIRE_ONE_OF");

    if (forceSet) {
      for (const policy of forbidPolicies) {
        if (intersects(forceSet, optionValueSet(policy.values))) {
          conflicts.push({
            code: "FORCE_FORBID_CONFLICT",
            message: "FORCE policy conflicts with FORBID policy for the same option values.",
            packageId,
            targetCatalogItemId,
            designOptionId,
          });
        }
      }

      for (const policy of allowOnlyPolicies) {
        if (!isSubset(forceSet, optionValueSet(policy.values))) {
          conflicts.push({
            code: "FORCE_ALLOW_ONLY_CONFLICT",
            message: "FORCE policy contains values not allowed by ALLOW_ONLY.",
            packageId,
            targetCatalogItemId,
            designOptionId,
          });
        }
      }

      for (const policy of requirePolicies) {
        if (!intersects(forceSet, optionValueSet(policy.values))) {
          conflicts.push({
            code: "FORCE_REQUIRE_ONE_OF_CONFLICT",
            message: "FORCE policy does not satisfy REQUIRE_ONE_OF for this option.",
            packageId,
            targetCatalogItemId,
            designOptionId,
          });
        }
      }
    }

    if (allowOnlyPolicies.length > 0 && requirePolicies.length > 0) {
      const allowSet = optionValueSet(allowOnlyPolicies[0].values);
      for (const policy of requirePolicies) {
        if (!intersects(allowSet, optionValueSet(policy.values))) {
          conflicts.push({
            code: "ALLOW_ONLY_REQUIRE_ONE_OF_CONFLICT",
            message: "ALLOW_ONLY and REQUIRE_ONE_OF have no overlapping values.",
            packageId,
            targetCatalogItemId,
            designOptionId,
          });
        }
      }
    }
  }

  return conflicts;
}

export async function evaluatePackageSelections(input: {
  packageId: string;
  scope: PackagePolicyScope;
  selections: SelectionInput[];
}): Promise<PackageEvaluationResult> {
  const { packageId, scope, selections } = input;
  const violations: PackagePolicyViolation[] = [];
  const forcedConfig: Record<string, Record<string, string | string[]>> = {};
  const selectionMap = ensureSelectionMap(selections);

  const [composition, policies] = await Promise.all([
    prisma.packageCompositionItem.findMany({
      where: { packageId },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.packageDesignOptionPolicy.findMany({
      where: {
        packageId,
        active: true,
        scope: scope === "SITE" ? { in: ["PROJECT", "SITE"] } : "PROJECT",
      },
      include: {
        designOption: true,
        values: {
          include: {
            designOptionValue: true,
          },
        },
      },
    }),
  ]);

  for (const item of composition) {
    const existing = selectionMap.get(item.catalogItemId);
    if (!existing && (item.role === "REQUIRED" || item.role === "AUTO_INCLUDED")) {
      selectionMap.set(item.catalogItemId, {
        catalogItemId: item.catalogItemId,
        quantity: item.defaultQty,
        configValues: {},
        designOptionValues: {},
        autoAdded: true,
      });
      continue;
    }

    if (!existing) continue;

    if (existing.quantity < item.minQty || (item.maxQty !== null && existing.quantity > item.maxQty)) {
      violations.push({
        code: "QUANTITY_OUT_OF_BOUNDS",
        message: `Quantity for item ${item.catalogItemId} must be between ${item.minQty} and ${item.maxQty ?? "unbounded"}.`,
        packageId,
        itemId: item.catalogItemId,
        blocking: true,
      });
    }

    if (!item.isSelectable && !existing.autoAdded && item.role !== "REQUIRED" && item.role !== "AUTO_INCLUDED") {
      violations.push({
        code: "NON_SELECTABLE_ITEM",
        message: `Item ${item.catalogItemId} is not selectable in this package.`,
        packageId,
        itemId: item.catalogItemId,
        blocking: true,
      });
    }
  }

  for (const item of composition) {
    if (item.role === "REQUIRED" && !selectionMap.has(item.catalogItemId)) {
      violations.push({
        code: "MISSING_REQUIRED_ITEM",
        message: `Required package item ${item.catalogItemId} is missing.`,
        packageId,
        itemId: item.catalogItemId,
        blocking: true,
      });
    }
  }

  const selectedItemIds = Array.from(selectionMap.keys());

  const itemOptions = await prisma.catalogItemDesignOption.findMany({
    where: { catalogItemId: { in: selectedItemIds } },
    include: {
      designOption: true,
      defaultValue: true,
      allowedValues: {
        include: {
          designOptionValue: true,
        },
      },
    },
  });

  const itemOptionMap = new Map<string, Map<string, ItemOptionWithValues>>();
  for (const option of itemOptions as ItemOptionWithValues[]) {
    const existing = itemOptionMap.get(option.catalogItemId) ?? new Map<string, ItemOptionWithValues>();
    existing.set(option.designOption.key, option);
    itemOptionMap.set(option.catalogItemId, existing);
  }

  for (const selected of selectionMap.values()) {
    const optionDefs = itemOptionMap.get(selected.catalogItemId);
    if (!optionDefs) continue;

    for (const [optionKey, optionDef] of optionDefs.entries()) {
      const explicitFromDesign = selected.designOptionValues[optionKey] ?? [];
      const explicitFromConfig = normalizeValueInput(selected.configValues[optionKey]);
      const chosenValues = dedupe([...explicitFromDesign, ...explicitFromConfig]);

      const defaultValues = optionDef.defaultValue ? [optionDef.defaultValue.value] : [];
      const effectiveValues = chosenValues.length > 0 ? chosenValues : defaultValues;

      const allowed = new Set(optionDef.allowedValues.map((v) => v.designOptionValue.value));
      if (effectiveValues.length > 0 && !isSubset(new Set(effectiveValues), allowed)) {
        violations.push({
          code: "INVALID_OPTION_VALUE",
          message: `Invalid value selected for ${optionKey} on item ${selected.catalogItemId}.`,
          packageId,
          itemId: selected.catalogItemId,
          designOptionKey: optionKey,
          blocking: true,
        });
      }

      if (effectiveValues.length > 1 && !optionDef.allowMulti) {
        violations.push({
          code: "INVALID_OPTION_VALUE",
          message: `Design option ${optionKey} does not allow multiple values.`,
          packageId,
          itemId: selected.catalogItemId,
          designOptionKey: optionKey,
          blocking: true,
        });
      }

      if (effectiveValues.length === 0 && optionDef.isRequired) {
        violations.push({
          code: "MISSING_REQUIRED_OPTION",
          message: `Design option ${optionKey} is required for item ${selected.catalogItemId}.`,
          packageId,
          itemId: selected.catalogItemId,
          designOptionKey: optionKey,
          blocking: true,
        });
      }

      if (effectiveValues.length > 0) {
        selected.designOptionValues[optionKey] = effectiveValues;
      }
    }
  }

  for (const policy of policies) {
    const target = selectionMap.get(policy.targetCatalogItemId);
    if (!target) continue;

    const optionKey = policy.designOption.key;
    const policyValues = policy.values.map((v) => v.designOptionValue.value);
    const selectedValues =
      target.designOptionValues[optionKey] ?? normalizeValueInput(target.configValues[optionKey]);

    if (policy.operator === "FORCE") {
      if (selectedValues.length === 0 && policyValues.length > 0) {
        target.designOptionValues[optionKey] = [policyValues[0]];
        target.configValues[optionKey] = policyValues[0];
        forcedConfig[target.catalogItemId] = forcedConfig[target.catalogItemId] ?? {};
        forcedConfig[target.catalogItemId][optionKey] = policyValues[0];
      } else if (!isSubset(new Set(selectedValues), new Set(policyValues))) {
        violations.push({
          code: "FORCED_VALUE_MISMATCH",
          message: `Design option ${optionKey} must match package forced value(s).`,
          packageId,
          itemId: target.catalogItemId,
          designOptionKey: optionKey,
          blocking: true,
        });
      }
      continue;
    }

    if (policy.operator === "FORBID") {
      if (intersects(new Set(selectedValues), new Set(policyValues))) {
        violations.push({
          code: "FORBIDDEN_VALUE_SELECTED",
          message: `Design option ${optionKey} includes forbidden value(s).`,
          packageId,
          itemId: target.catalogItemId,
          designOptionKey: optionKey,
          blocking: true,
        });
      }
      continue;
    }

    if (policy.operator === "ALLOW_ONLY") {
      if (!isSubset(new Set(selectedValues), new Set(policyValues))) {
        violations.push({
          code: "ALLOW_ONLY_VIOLATION",
          message: `Design option ${optionKey} contains value(s) outside package allow-list.`,
          packageId,
          itemId: target.catalogItemId,
          designOptionKey: optionKey,
          blocking: true,
        });
      }
      continue;
    }

    if (policy.operator === "REQUIRE_ONE_OF") {
      if (selectedValues.length === 0 || !intersects(new Set(selectedValues), new Set(policyValues))) {
        violations.push({
          code: "REQUIRE_ONE_OF_VIOLATION",
          message: `Design option ${optionKey} must include at least one required package value.`,
          packageId,
          itemId: target.catalogItemId,
          designOptionKey: optionKey,
          blocking: true,
        });
      }
    }
  }

  return {
    effectiveSelections: Array.from(selectionMap.values()),
    forcedConfig,
    violations,
  };
}

export async function assertPackageType(packageId: string): Promise<void> {
  const item = await prisma.catalogItem.findUnique({ where: { id: packageId }, select: { type: true } });
  if (!item || item.type !== "PACKAGE") {
    throw new Error("Catalog item is not a package");
  }
}
