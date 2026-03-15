import { DependencyType, ItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  classifyCoreServiceRoleByIdentity,
  isManagedTierOptionByIdentity,
} from "@/lib/package-dependency-allowlist";

export type ServiceCoverageViolationCode =
  | "MISSING_MANAGED_TIER"
  | "MULTIPLE_MANAGED_TIERS"
  | "MISSING_CONNECTIVITY_FOR_SDWAN"
  | "STANDALONE_MANAGED_TIER";

export interface ServiceCoverageViolation {
  code: ServiceCoverageViolationCode;
  message: string;
  itemId?: string;
  parentId?: string;
  blocking: true;
}

interface CoverageDependency {
  childId: string;
  type: DependencyType;
}

interface CoverageItem {
  id: string;
  name: string;
  sku: string;
  type: ItemType;
  childDependencies: CoverageDependency[];
}

type ServiceRole = "SDWAN" | "LAN" | "WLAN" | "CONNECTIVITY" | "MANAGED_TIER" | "OTHER";

const STRUCTURAL_DEPENDENCY_TYPES = new Set<DependencyType>([
  DependencyType.OPTIONAL_ATTACHMENT,
  DependencyType.MANDATORY_ATTACHMENT,
  DependencyType.REQUIRES,
  DependencyType.INCLUDES,
]);

function classifyRole(item: Pick<CoverageItem, "type" | "name" | "sku">): ServiceRole {
  if (isManagedTierOptionByIdentity(item)) {
    return "MANAGED_TIER";
  }

  return classifyCoreServiceRoleByIdentity(item);
}

function selectedChildrenByRole(
  parent: CoverageItem,
  selectedIds: Set<string>,
  roleByItemId: Map<string, ServiceRole>
): Map<ServiceRole, string[]> {
  const children = new Map<ServiceRole, string[]>();

  for (const dep of parent.childDependencies) {
    if (!STRUCTURAL_DEPENDENCY_TYPES.has(dep.type)) continue;
    if (!selectedIds.has(dep.childId)) continue;

    const role = roleByItemId.get(dep.childId) ?? "OTHER";
    const rows = children.get(role) ?? [];
    rows.push(dep.childId);
    children.set(role, rows);
  }

  return children;
}

export function evaluateServiceCoverage(items: CoverageItem[]): ServiceCoverageViolation[] {
  const violations: ServiceCoverageViolation[] = [];
  const selectedIds = new Set(items.map((item) => item.id));
  const roleByItemId = new Map(items.map((item) => [item.id, classifyRole(item)]));

  const parentRoles = new Set<ServiceRole>(["SDWAN", "LAN", "WLAN", "CONNECTIVITY"]);

  for (const item of items) {
    const role = roleByItemId.get(item.id) ?? "OTHER";
    if (role !== "SDWAN" && role !== "LAN" && role !== "WLAN") continue;

    const childMap = selectedChildrenByRole(item, selectedIds, roleByItemId);
    const selectedTiers = childMap.get("MANAGED_TIER") ?? [];

    if (selectedTiers.length === 0) {
      violations.push({
        code: "MISSING_MANAGED_TIER",
        message: `${item.name} requires one managed service tier.`,
        itemId: item.id,
        parentId: item.id,
        blocking: true,
      });
    } else if (selectedTiers.length > 1) {
      violations.push({
        code: "MULTIPLE_MANAGED_TIERS",
        message: `${item.name} supports only one managed service tier selection.`,
        itemId: item.id,
        parentId: item.id,
        blocking: true,
      });
    }

    if (role === "SDWAN") {
      const selectedConnectivity = childMap.get("CONNECTIVITY") ?? [];
      if (selectedConnectivity.length === 0) {
        violations.push({
          code: "MISSING_CONNECTIVITY_FOR_SDWAN",
          message: `${item.name} requires at least one connectivity service.`,
          itemId: item.id,
          parentId: item.id,
          blocking: true,
        });
      }
    }
  }

  for (const item of items) {
    const role = roleByItemId.get(item.id) ?? "OTHER";
    if (role !== "MANAGED_TIER") continue;

    const hasSelectedParent = items.some((candidateParent) => {
      const parentRole = roleByItemId.get(candidateParent.id) ?? "OTHER";
      if (!parentRoles.has(parentRole)) return false;
      return candidateParent.childDependencies.some(
        (dep) =>
          dep.childId === item.id &&
          STRUCTURAL_DEPENDENCY_TYPES.has(dep.type) &&
          selectedIds.has(candidateParent.id)
      );
    });

    if (!hasSelectedParent) {
      violations.push({
        code: "STANDALONE_MANAGED_TIER",
        message: `${item.name} cannot be sold standalone. Select a parent service.`,
        itemId: item.id,
        blocking: true,
      });
    }
  }

  // Keep violations stable and deduplicated if the dependency graph contains duplicates.
  const deduped = new Map<string, ServiceCoverageViolation>();
  for (const violation of violations) {
    const key = `${violation.code}:${violation.itemId ?? ""}:${violation.parentId ?? ""}`;
    if (!deduped.has(key)) {
      deduped.set(key, violation);
    }
  }

  return Array.from(deduped.values());
}

export async function validateServiceCoverageForSelection(selectedItemIds: string[]): Promise<ServiceCoverageViolation[]> {
  if (selectedItemIds.length === 0) return [];

  const items = await prisma.catalogItem.findMany({
    where: { id: { in: selectedItemIds } },
    select: {
      id: true,
      name: true,
      sku: true,
      type: true,
      childDependencies: {
        where: {
          childId: { in: selectedItemIds },
          type: { in: Array.from(STRUCTURAL_DEPENDENCY_TYPES) },
        },
        select: {
          childId: true,
          type: true,
        },
      },
    },
  });

  return evaluateServiceCoverage(items);
}
