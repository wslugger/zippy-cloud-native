import { describe, expect, it } from "vitest";
import { isProjectStatusTransitionAllowed } from "@/lib/services/project.service";

describe("isProjectStatusTransitionAllowed", () => {
  it("allows valid transitions", () => {
    expect(isProjectStatusTransitionAllowed("DRAFT", "IN_REVIEW")).toBe(true);
    expect(isProjectStatusTransitionAllowed("IN_REVIEW", "APPROVED")).toBe(true);
    expect(isProjectStatusTransitionAllowed("APPROVED", "ORDERED")).toBe(true);
  });

  it("blocks invalid transitions", () => {
    expect(isProjectStatusTransitionAllowed("DRAFT", "ORDERED")).toBe(false);
    expect(isProjectStatusTransitionAllowed("ORDERED", "DRAFT")).toBe(false);
    expect(isProjectStatusTransitionAllowed("ARCHIVED", "DRAFT")).toBe(false);
  });
});
