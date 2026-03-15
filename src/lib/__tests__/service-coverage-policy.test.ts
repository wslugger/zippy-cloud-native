import { describe, expect, it } from "vitest";
import { DependencyType, ItemType } from "@prisma/client";
import { evaluateServiceCoverage } from "@/lib/service-coverage-policy";

interface TestItemInput {
  id: string;
  name: string;
  sku: string;
  type: ItemType;
  children?: Array<{ childId: string; type?: DependencyType }>;
}

function item(input: TestItemInput) {
  return {
    id: input.id,
    name: input.name,
    sku: input.sku,
    type: input.type,
    childDependencies: (input.children ?? []).map((child) => ({
      childId: child.childId,
      type: child.type ?? DependencyType.OPTIONAL_ATTACHMENT,
    })),
  };
}

describe("evaluateServiceCoverage", () => {
  it("passes standalone connectivity with no tier", () => {
    const result = evaluateServiceCoverage([
      item({
        id: "conn-1",
        name: "Dedicated Internet Access",
        sku: "CONN-DIA",
        type: ItemType.CONNECTIVITY,
      }),
    ]);

    expect(result).toHaveLength(0);
  });

  it("passes standalone connectivity with one tier", () => {
    const result = evaluateServiceCoverage([
      item({
        id: "conn-1",
        name: "Dedicated Internet Access",
        sku: "CONN-DIA",
        type: ItemType.CONNECTIVITY,
        children: [{ childId: "tier-total-care" }],
      }),
      item({
        id: "tier-total-care",
        name: "Total Care",
        sku: "SVC-TOTAL-CARE",
        type: ItemType.SERVICE_OPTION,
      }),
    ]);

    expect(result).toHaveLength(0);
  });

  it("fails SDWAN without tier and connectivity", () => {
    const result = evaluateServiceCoverage([
      item({
        id: "svc-sdwan",
        name: "Meraki SDWAN",
        sku: "SVC-MERAKI-SDWAN",
        type: ItemType.MANAGED_SERVICE,
      }),
    ]);

    expect(result.some((violation) => violation.code === "MISSING_MANAGED_TIER")).toBe(true);
    expect(result.some((violation) => violation.code === "MISSING_CONNECTIVITY_FOR_SDWAN")).toBe(true);
  });

  it("fails SDWAN with multiple managed tiers", () => {
    const result = evaluateServiceCoverage([
      item({
        id: "svc-sdwan",
        name: "Meraki SDWAN",
        sku: "SVC-MERAKI-SDWAN",
        type: ItemType.MANAGED_SERVICE,
        children: [{ childId: "tier-watch-alert" }, { childId: "tier-total-care" }, { childId: "conn-1" }],
      }),
      item({
        id: "tier-watch-alert",
        name: "Watch & Alert",
        sku: "SVC-WATCH-ALERT",
        type: ItemType.SERVICE_OPTION,
      }),
      item({
        id: "tier-total-care",
        name: "Total Care",
        sku: "SVC-TOTAL-CARE",
        type: ItemType.SERVICE_OPTION,
      }),
      item({
        id: "conn-1",
        name: "Dedicated Internet Access",
        sku: "CONN-DIA",
        type: ItemType.CONNECTIVITY,
      }),
    ]);

    expect(result.some((violation) => violation.code === "MULTIPLE_MANAGED_TIERS")).toBe(true);
  });

  it("passes SDWAN with one tier and one connectivity", () => {
    const result = evaluateServiceCoverage([
      item({
        id: "svc-sdwan",
        name: "Meraki SDWAN",
        sku: "SVC-MERAKI-SDWAN",
        type: ItemType.MANAGED_SERVICE,
        children: [{ childId: "tier-watch-alert" }, { childId: "conn-1" }],
      }),
      item({
        id: "tier-watch-alert",
        name: "Watch & Alert",
        sku: "SVC-WATCH-ALERT",
        type: ItemType.SERVICE_OPTION,
      }),
      item({
        id: "conn-1",
        name: "Dedicated Internet Access",
        sku: "CONN-DIA",
        type: ItemType.CONNECTIVITY,
      }),
    ]);

    expect(result).toHaveLength(0);
  });

  it("fails standalone managed tier", () => {
    const result = evaluateServiceCoverage([
      item({
        id: "tier-watch-alert",
        name: "Watch & Alert",
        sku: "SVC-WATCH-ALERT",
        type: ItemType.SERVICE_OPTION,
      }),
    ]);

    expect(result.some((violation) => violation.code === "STANDALONE_MANAGED_TIER")).toBe(true);
  });
});
