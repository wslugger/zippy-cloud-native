import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    packageCompositionItem: {
      findMany: vi.fn(),
    },
    packageDesignOptionPolicy: {
      findMany: vi.fn(),
    },
    catalogItemDesignOption: {
      findMany: vi.fn(),
    },
    catalogItem: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  evaluatePackageSelections,
  validatePolicyConflicts,
} from "@/lib/package-policy-engine";

const mockComposition = prisma.packageCompositionItem.findMany as ReturnType<typeof vi.fn>;
const mockPolicies = prisma.packageDesignOptionPolicy.findMany as ReturnType<typeof vi.fn>;
const mockItemOptions = prisma.catalogItemDesignOption.findMany as ReturnType<typeof vi.fn>;

describe("validatePolicyConflicts", () => {
  it("allows same design option reuse across packages", () => {
    const conflicts = validatePolicyConflicts([
      {
        packageId: "pkg-a",
        targetCatalogItemId: "svc-1",
        designOptionId: "opt-topology",
        operator: "FORCE",
        active: true,
        values: ["full_mesh"],
      },
      {
        packageId: "pkg-b",
        targetCatalogItemId: "svc-1",
        designOptionId: "opt-topology",
        operator: "FORCE",
        active: true,
        values: ["hub_spoke"],
      },
    ] as any);

    expect(conflicts).toHaveLength(0);
  });

  it("rejects FORCE/FORBID conflict in same package", () => {
    const conflicts = validatePolicyConflicts([
      {
        packageId: "pkg-a",
        targetCatalogItemId: "svc-1",
        designOptionId: "opt-topology",
        operator: "FORCE",
        active: true,
        values: ["full_mesh"],
      },
      {
        packageId: "pkg-a",
        targetCatalogItemId: "svc-1",
        designOptionId: "opt-topology",
        operator: "FORBID",
        active: true,
        values: ["full_mesh"],
      },
    ] as any);

    expect(conflicts.some((c) => c.code === "FORCE_FORBID_CONFLICT")).toBe(true);
  });
});

describe("evaluatePackageSelections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-adds required package composition items", async () => {
    mockComposition.mockResolvedValue([
      {
        packageId: "pkg-1",
        catalogItemId: "svc-required",
        role: "REQUIRED",
        minQty: 1,
        maxQty: null,
        defaultQty: 1,
        isSelectable: false,
      },
    ]);
    mockPolicies.mockResolvedValue([]);
    mockItemOptions.mockResolvedValue([]);

    const result = await evaluatePackageSelections({
      packageId: "pkg-1",
      scope: "PROJECT",
      selections: [{ catalogItemId: "pkg-1", quantity: 1 }],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.effectiveSelections.some((s) => s.catalogItemId === "svc-required")).toBe(true);
  });

  it("applies FORCE policy and emits forcedConfig", async () => {
    mockComposition.mockResolvedValue([]);
    mockPolicies.mockResolvedValue([
      {
        packageId: "pkg-1",
        targetCatalogItemId: "svc-1",
        designOption: { key: "topology" },
        operator: "FORCE",
        values: [{ designOptionValue: { value: "full_mesh" } }],
      },
    ]);
    mockItemOptions.mockResolvedValue([]);

    const result = await evaluatePackageSelections({
      packageId: "pkg-1",
      scope: "PROJECT",
      selections: [{ catalogItemId: "svc-1", quantity: 1, configValues: {} }],
    });

    expect(result.violations).toHaveLength(0);
    expect(result.forcedConfig["svc-1"].topology).toBe("full_mesh");
  });

  it("returns violation for FORBID policy", async () => {
    mockComposition.mockResolvedValue([]);
    mockPolicies.mockResolvedValue([
      {
        packageId: "pkg-1",
        targetCatalogItemId: "svc-1",
        designOption: { key: "topology" },
        operator: "FORBID",
        values: [{ designOptionValue: { value: "hub_spoke" } }],
      },
    ]);
    mockItemOptions.mockResolvedValue([]);

    const result = await evaluatePackageSelections({
      packageId: "pkg-1",
      scope: "PROJECT",
      selections: [{ catalogItemId: "svc-1", quantity: 1, configValues: { topology: "hub_spoke" } }],
    });

    expect(result.violations.some((v) => v.code === "FORBIDDEN_VALUE_SELECTED")).toBe(true);
  });
});
