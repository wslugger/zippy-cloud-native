import { describe, expect, it } from "vitest";
import { EquipmentPurpose } from "@prisma/client";
import {
  normalizeEquipmentPurpose,
  normalizeEquipmentPurposeArray,
  normalizeMakeModelKey,
  validateEquipmentPublishable,
} from "@/lib/equipment-catalog";

describe("equipment-catalog helpers", () => {
  it("normalizes purposes", () => {
    expect(normalizeEquipmentPurpose("wan")).toBe(EquipmentPurpose.WAN);
    expect(normalizeEquipmentPurpose("LAN")).toBe(EquipmentPurpose.LAN);
    expect(normalizeEquipmentPurpose("unknown")).toBeNull();

    expect(normalizeEquipmentPurposeArray(["wan", "LAN", "LAN", "bad"]))
      .toEqual([EquipmentPurpose.WAN, EquipmentPurpose.LAN]);
  });

  it("builds stable make/model keys", () => {
    expect(normalizeMakeModelKey(" Cisco ", " MX68 ")).toBe("cisco::mx68");
  });

  it("validates publish gate", () => {
    const errors = validateEquipmentPublishable({
      make: "Cisco",
      model: "MX68",
      pricingSku: null,
      family: null,
      primaryPurpose: EquipmentPurpose.WAN,
      secondaryPurposes: [],
      vendorDatasheetUrl: "https://example.com/mx68.pdf",
      wanSpec: {
        throughputMbps: 600,
        vpnTunnels: null,
        cellularSupport: false,
        formFactor: null,
        interfaces: [],
      },
      lanSpec: null,
      wlanSpec: null,
      sku: "HW-MX68",
    });

    expect(errors).toEqual([]);
  });
});
