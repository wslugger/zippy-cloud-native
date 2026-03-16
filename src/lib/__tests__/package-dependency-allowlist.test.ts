import { describe, expect, it } from "vitest";
import {
  classifyCoreServiceRoleByIdentity,
  isManagedTierOptionByIdentity,
  parsePackageDependencyAllowlist,
} from "@/lib/package-dependency-allowlist";

describe("package-dependency-allowlist helpers", () => {
  it("identifies managed tier options by known sku/name", () => {
    expect(
      isManagedTierOptionByIdentity({
        type: "SERVICE_OPTION",
        sku: "SVC-TOTAL-CARE",
        name: "Anything",
      })
    ).toBe(true);

    expect(
      isManagedTierOptionByIdentity({
        type: "SERVICE_OPTION",
        sku: "UNKNOWN",
        name: "Watch & Alert",
      })
    ).toBe(true);
  });

  it("classifies core service roles", () => {
    expect(classifyCoreServiceRoleByIdentity({ type: "MANAGED_SERVICE", name: "Meraki SDWAN" })).toBe("SDWAN");
    expect(classifyCoreServiceRoleByIdentity({ type: "MANAGED_SERVICE", name: "Meraki LAN" })).toBe("LAN");
    expect(classifyCoreServiceRoleByIdentity({ type: "MANAGED_SERVICE", name: "Meraki WLAN" })).toBe("WLAN");
    expect(classifyCoreServiceRoleByIdentity({ type: "CONNECTIVITY", name: "DIA" })).toBe("CONNECTIVITY");
    expect(classifyCoreServiceRoleByIdentity({ type: "MANAGED_SERVICE", name: "Unknown", primaryPurpose: "WAN" })).toBe("SDWAN");
    expect(classifyCoreServiceRoleByIdentity({ type: "MANAGED_SERVICE", name: "Unknown", secondaryPurposes: ["LAN"] })).toBe("LAN");
  });

  it("parses package dependency allowlist from config schema", () => {
    const parsed = parsePackageDependencyAllowlist({
      packageDependencyAllowlist: {
        "svc-sdwan": {
          managedTierIds: ["tier-1", "tier-2", "tier-2"],
          connectivityIds: ["conn-1"],
        },
      },
    });

    expect(parsed["svc-sdwan"]?.managedTierIds).toEqual(["tier-1", "tier-2"]);
    expect(parsed["svc-sdwan"]?.connectivityIds).toEqual(["conn-1"]);
  });
});
