import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    catalogItem: { findMany: vi.fn() },
    systemConfig: { findUnique: vi.fn() },
  },
}));

import {
  buildCandidateSummary,
  normalizeGeminiJson,
  normalizeGeminiResponse,
  normalizeMatchedCharacteristics,
  fallbackTokenMatch,
  toBoundedConfidence,
  rankResults,
  selectTopRecommendations,
  toShortReason,
  buildPrompt,
  getFirstSystemConfigValue,
  DEFAULT_REQUIREMENTS_MATCH_RULES,
  type RecommendationCandidate,
  type GeminiMatchResult,
} from "@/lib/recommendation-engine";
import { ItemType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function makeCandidate(overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return {
    id: "c1",
    sku: "SKU-001",
    name: "Test Service",
    type: ItemType.MANAGED_SERVICE,
    shortDescription: "A test service for SD-WAN",
    detailedDescription: "Provides enterprise SD-WAN connectivity with Meraki hardware.",
    features: ["SD-WAN", "Meraki"],
    constraints: ["Requires dual WAN links"],
    assumptions: ["Customer has existing internet service"],
    requiredIncluded: [],
    optionalRecommended: [],
    requiredIncludedDetails: [],
    optionalIncludedDetails: [],
    designOptionRules: [],
    signalFeasible: true,
    collaterals: [],
    ...overrides,
  };
}

function makePackageCandidate(overrides: Partial<RecommendationCandidate> = {}): RecommendationCandidate {
  return makeCandidate({
    id: "p1",
    sku: "PKG-001",
    name: "SD-WAN Design Package",
    type: ItemType.PACKAGE,
    shortDescription: "Complete SD-WAN solution package",
    detailedDescription: "Full SD-WAN deployment with hub-spoke topology support.",
    features: ["SD-WAN", "Hub-Spoke", "Meraki"],
    requiredIncluded: ["Managed SD-WAN", "Managed Router"],
    optionalRecommended: ["Managed LAN", "Managed WLAN"],
    requiredIncludedDetails: ["Managed SD-WAN | Enterprise SD-WAN service"],
    optionalIncludedDetails: ["Managed LAN | Campus switching"],
    ...overrides,
  });
}

function makeGeminiResult(overrides: Partial<GeminiMatchResult> = {}): GeminiMatchResult {
  return {
    id: "c1",
    score: 0.85,
    reason: "Strong SD-WAN feature match. Covers hub-spoke topology requirements well.",
    shortReason: "Excellent SD-WAN coverage with hub-spoke support.",
    coverageAreas: ["SD-WAN"],
    matchedCharacteristics: ["name", "features"],
    vendorAlignment: "full",
    riskFactors: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildCandidateSummary
// ---------------------------------------------------------------------------

describe("buildCandidateSummary", () => {
  it("produces pipe-delimited summary for a service candidate", () => {
    const candidate = makeCandidate();
    const summary = buildCandidateSummary([candidate]);

    expect(summary).toContain("id:c1");
    expect(summary).toContain("type:MANAGED_SERVICE");
    expect(summary).toContain("sku:SKU-001");
    expect(summary).toContain("name:Test Service");
    expect(summary).toContain("short_desc:A test service for SD-WAN");
    expect(summary).toContain("features:SD-WAN, Meraki");
    expect(summary).toContain("constraints:Requires dual WAN links");
    expect(summary).toContain("assumptions:Customer has existing internet service");
  });

  it("produces pipe-delimited summary for a package candidate", () => {
    const pkg = makePackageCandidate();
    const summary = buildCandidateSummary([pkg]);

    expect(summary).toContain("type:PACKAGE");
    expect(summary).toContain("required:Managed SD-WAN, Managed Router");
    expect(summary).toContain("optional:Managed LAN, Managed WLAN");
  });

  it("shows 'none' for empty arrays", () => {
    const candidate = makeCandidate({ features: [], constraints: [], assumptions: [] });
    const summary = buildCandidateSummary([candidate]);

    expect(summary).toContain("features:none");
    expect(summary).toContain("constraints:none");
    expect(summary).toContain("assumptions:none");
  });

  it("joins multiple candidates with newlines", () => {
    const c1 = makeCandidate({ id: "a" });
    const c2 = makeCandidate({ id: "b" });
    const summary = buildCandidateSummary([c1, c2]);
    const lines = summary.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("id:a");
    expect(lines[1]).toContain("id:b");
  });
});

// ---------------------------------------------------------------------------
// normalizeGeminiJson
// ---------------------------------------------------------------------------

describe("normalizeGeminiJson", () => {
  it("strips markdown fences", () => {
    const input = '```json\n[{"id":"a"}]\n```';
    expect(normalizeGeminiJson(input)).toBe('[{"id":"a"}]');
  });

  it("handles text without fences", () => {
    expect(normalizeGeminiJson('[{"id":"a"}]')).toBe('[{"id":"a"}]');
  });

  it("trims whitespace", () => {
    expect(normalizeGeminiJson("  []  ")).toBe("[]");
  });
});

// ---------------------------------------------------------------------------
// normalizeGeminiResponse
// ---------------------------------------------------------------------------

describe("normalizeGeminiResponse", () => {
  it("parses well-formed response", () => {
    const input = [
      {
        id: "c1",
        score: 0.85,
        reason: "Good match",
        shortReason: "Matches well",
        coverageAreas: ["SD-WAN"],
        matchedCharacteristics: ["name", "features"],
        vendorAlignment: "full",
        riskFactors: [],
      },
    ];

    const results = normalizeGeminiResponse(input);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("c1");
    expect(results[0].score).toBe(0.85);
    expect(results[0].vendorAlignment).toBe("full");
    expect(results[0].coverageAreas).toEqual(["SD-WAN"]);
  });

  it("filters out entries without string id", () => {
    const input = [{ id: 123, score: 0.5 }, { score: 0.5 }, null, { id: "valid", score: 0.8 }];
    const results = normalizeGeminiResponse(input);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("valid");
  });

  it("defaults missing fields", () => {
    const input = [{ id: "c1" }];
    const results = normalizeGeminiResponse(input);
    expect(results[0].score).toBe(0.5);
    expect(results[0].reason).toBe("Matched by AI against service characteristics.");
    expect(results[0].shortReason).toBe("");
    expect(results[0].coverageAreas).toEqual([]);
    expect(results[0].matchedCharacteristics).toEqual([]);
    expect(results[0].vendorAlignment).toBe("none");
    expect(results[0].riskFactors).toEqual([]);
  });

  it("clamps non-finite scores to 0.5", () => {
    const input = [{ id: "c1", score: "not-a-number" }];
    const results = normalizeGeminiResponse(input);
    expect(results[0].score).toBe(0.5);
  });

  it("filters non-string values from coverageAreas and riskFactors", () => {
    const input = [{ id: "c1", coverageAreas: ["SD-WAN", 42, null], riskFactors: [true, "real risk"] }];
    const results = normalizeGeminiResponse(input);
    expect(results[0].coverageAreas).toEqual(["SD-WAN"]);
    expect(results[0].riskFactors).toEqual(["real risk"]);
  });
});

// ---------------------------------------------------------------------------
// normalizeMatchedCharacteristics
// ---------------------------------------------------------------------------

describe("normalizeMatchedCharacteristics", () => {
  it("filters to valid characteristic names", () => {
    expect(normalizeMatchedCharacteristics(["name", "features", "invalid"])).toEqual(["name", "features"]);
  });

  it("lowercases and trims", () => {
    expect(normalizeMatchedCharacteristics(["  Name ", "FEATURES"])).toEqual(["name", "features"]);
  });

  it("returns empty for non-array", () => {
    expect(normalizeMatchedCharacteristics("name")).toEqual([]);
    expect(normalizeMatchedCharacteristics(null)).toEqual([]);
    expect(normalizeMatchedCharacteristics(undefined)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fallbackTokenMatch
// ---------------------------------------------------------------------------

describe("fallbackTokenMatch", () => {
  it("returns sorted results with scores", () => {
    const c1 = makeCandidate({ id: "a", name: "SD-WAN Service" });
    const c2 = makeCandidate({ id: "b", name: "Unrelated Thing", features: [], constraints: [], assumptions: [] });
    const results = fallbackTokenMatch([c1, c2], "Need SD-WAN for enterprise");

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("a");
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it("gives packages a +0.05 boost", () => {
    const service = makeCandidate({ id: "s1", name: "SD-WAN Service", type: ItemType.MANAGED_SERVICE });
    const pkg = makeCandidate({ id: "p1", name: "SD-WAN Service", type: ItemType.PACKAGE });

    const serviceResults = fallbackTokenMatch([service], "SD-WAN");
    const pkgResults = fallbackTokenMatch([pkg], "SD-WAN");

    expect(pkgResults[0].score).toBeGreaterThan(serviceResults[0].score);
    expect(pkgResults[0].score - serviceResults[0].score).toBeCloseTo(0.05, 1);
  });

  it("produces valid matchedCharacteristics", () => {
    const c = makeCandidate({ name: "SD-WAN Service", features: ["enterprise", "wan-optimization"] });
    const results = fallbackTokenMatch([c], "enterprise SD-WAN service");

    expect(results[0].matchedCharacteristics).toContain("name");
  });

  it("returns general fit reason when no tokens match", () => {
    const c = makeCandidate({ id: "x", name: "ABC", features: [], shortDescription: null, detailedDescription: null, constraints: [], assumptions: [] });
    const results = fallbackTokenMatch([c], "zzzzz");

    expect(results[0].reason).toContain("General fit");
  });
});

// ---------------------------------------------------------------------------
// toBoundedConfidence
// ---------------------------------------------------------------------------

describe("toBoundedConfidence", () => {
  it("returns 0 for 0 input", () => {
    expect(toBoundedConfidence(0)).toBe(0);
  });

  it("returns value in (0, 0.99] for positive input", () => {
    const result = toBoundedConfidence(0.5);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(0.99);
  });

  it("approaches 0.99 for large inputs", () => {
    expect(toBoundedConfidence(5)).toBeGreaterThan(0.98);
    expect(toBoundedConfidence(5)).toBeLessThanOrEqual(0.99);
  });

  it("clamps negative inputs to 0", () => {
    expect(toBoundedConfidence(-1)).toBe(0);
  });

  it("is monotonically increasing", () => {
    const a = toBoundedConfidence(0.2);
    const b = toBoundedConfidence(0.5);
    const c = toBoundedConfidence(0.8);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});

// ---------------------------------------------------------------------------
// rankResults
// ---------------------------------------------------------------------------

describe("rankResults", () => {
  it("maps Gemini results to RankedRecommendations", () => {
    const candidate = makeCandidate({ id: "c1" });
    const result = makeGeminiResult({ id: "c1", score: 0.8 });

    const ranked = rankResults([result], [candidate]);

    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe("c1");
    expect(ranked[0].certaintyPercent).toBeGreaterThan(0);
    expect(ranked[0].reason).toBe(result.reason);
    expect(ranked[0].matchedCharacteristics).toEqual(result.matchedCharacteristics);
  });

  it("skips results with no matching candidate", () => {
    const result = makeGeminiResult({ id: "nonexistent" });
    const ranked = rankResults([result], [makeCandidate({ id: "c1" })]);
    expect(ranked).toHaveLength(0);
  });

  it("applies signal feasibility penalty for infeasible packages", () => {
    const feasible = makePackageCandidate({ id: "p1", signalFeasible: true });
    const infeasible = makePackageCandidate({ id: "p2", signalFeasible: false });

    const resultFeasible = makeGeminiResult({ id: "p1", score: 0.9 });
    const resultInfeasible = makeGeminiResult({ id: "p2", score: 0.9 });

    const rankedFeasible = rankResults([resultFeasible], [feasible]);
    const rankedInfeasible = rankResults([resultInfeasible], [infeasible]);

    expect(rankedInfeasible[0].certaintyPercent).toBeLessThan(rankedFeasible[0].certaintyPercent);
  });

  it("does NOT apply hardcoded coverage/intent/bundle adjustments", () => {
    // Two identical candidates, one package one service, same Gemini score
    // The only difference in ranking should come from signal feasibility, not bundle preference
    const service = makeCandidate({ id: "s1", type: ItemType.MANAGED_SERVICE });
    const pkg = makePackageCandidate({ id: "p1" });

    const serviceResult = makeGeminiResult({ id: "s1", score: 0.7 });
    const pkgResult = makeGeminiResult({ id: "p1", score: 0.7 });

    const rankedService = rankResults([serviceResult], [service]);
    const rankedPkg = rankResults([pkgResult], [pkg]);

    // With no hardcoded bundle preference, same score should produce same certainty
    expect(rankedService[0].certaintyPercent).toBe(rankedPkg[0].certaintyPercent);
  });

  it("sorts by score descending", () => {
    const c1 = makeCandidate({ id: "a" });
    const c2 = makeCandidate({ id: "b" });
    const r1 = makeGeminiResult({ id: "a", score: 0.5 });
    const r2 = makeGeminiResult({ id: "b", score: 0.9 });

    const ranked = rankResults([r1, r2], [c1, c2]);
    expect(ranked[0].id).toBe("b");
    expect(ranked[1].id).toBe("a");
  });

  it("clamps scores to [0, 1] before normalization", () => {
    const candidate = makeCandidate({ id: "c1" });
    const overScore = makeGeminiResult({ id: "c1", score: 1.5 });
    const underScore = makeGeminiResult({ id: "c1", score: -0.3 });

    const rankedOver = rankResults([overScore], [candidate]);
    const rankedUnder = rankResults([underScore], [candidate]);

    expect(rankedOver[0].certaintyPercent).toBeLessThanOrEqual(99);
    expect(rankedUnder[0].certaintyPercent).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// selectTopRecommendations
// ---------------------------------------------------------------------------

describe("selectTopRecommendations", () => {
  function makeRanked(id: string, type: ItemType, score: number): ReturnType<typeof rankResults>[number] {
    return {
      ...makeCandidate({ id, type }),
      reason: "test",
      shortReason: "test",
      score,
      certaintyPercent: Math.round(score * 100),
      matchedCharacteristics: [],
      coverageAreas: [],
      riskFactors: [],
    };
  }

  it("returns at most maxResults items", () => {
    const items = Array.from({ length: 10 }, (_, i) => makeRanked(`c${i}`, ItemType.MANAGED_SERVICE, 0.5));
    expect(selectTopRecommendations(items, 3)).toHaveLength(3);
  });

  it("ensures diversity: includes both packages and services", () => {
    const p1 = makeRanked("p1", ItemType.PACKAGE, 0.9);
    const p2 = makeRanked("p2", ItemType.PACKAGE, 0.8);
    const s1 = makeRanked("s1", ItemType.MANAGED_SERVICE, 0.95);
    const s2 = makeRanked("s2", ItemType.MANAGED_SERVICE, 0.7);
    const s3 = makeRanked("s3", ItemType.MANAGED_SERVICE, 0.6);

    const selected = selectTopRecommendations([p1, p2, s1, s2, s3], 5);
    const types = selected.map((r) => r.type);

    expect(types.filter((t) => t === ItemType.PACKAGE).length).toBeGreaterThanOrEqual(1);
    expect(types.filter((t) => t === ItemType.MANAGED_SERVICE).length).toBeGreaterThanOrEqual(1);
  });

  it("does not duplicate items", () => {
    const p1 = makeRanked("p1", ItemType.PACKAGE, 0.9);
    const selected = selectTopRecommendations([p1, p1, p1], 5);
    expect(selected).toHaveLength(1);
  });

  it("defaults maxResults to 5", () => {
    const items = Array.from({ length: 10 }, (_, i) => makeRanked(`c${i}`, ItemType.MANAGED_SERVICE, 0.5));
    expect(selectTopRecommendations(items)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// toShortReason
// ---------------------------------------------------------------------------

describe("toShortReason", () => {
  it("extracts first sentence", () => {
    expect(toShortReason("First sentence. Second sentence.")).toBe("First sentence.");
  });

  it("strips 'Matched characteristics:' tail", () => {
    expect(toShortReason("Good fit. Matched characteristics: name, features.")).toBe("Good fit.");
  });

  it("truncates to 180 chars", () => {
    const long = "A".repeat(200) + ". Next.";
    expect(toShortReason(long).length).toBeLessThanOrEqual(180);
  });

  it("normalizes whitespace", () => {
    expect(toShortReason("  Multiple   spaces  here.  ")).toBe("Multiple spaces here.");
  });
});

// ---------------------------------------------------------------------------
// buildPrompt
// ---------------------------------------------------------------------------

describe("buildPrompt", () => {
  it("includes all required sections", () => {
    const prompt = buildPrompt("System prompt here.", "Need SD-WAN", "- id:c1 | ...");

    expect(prompt).toContain("System prompt here.");
    expect(prompt).toContain("SCORING RULES:");
    expect(prompt).toContain("PACKAGE PREFERENCE:");
    expect(prompt).toContain("VENDOR PREFERENCE:");
    expect(prompt).toContain("COVERAGE:");
    expect(prompt).toContain("RISK ASSESSMENT:");
    expect(prompt).toContain("CUSTOMER REQUIREMENTS:");
    expect(prompt).toContain("Need SD-WAN");
    expect(prompt).toContain("AVAILABLE CATALOG ITEMS:");
    expect(prompt).toContain("- id:c1 | ...");
    expect(prompt).toContain("coverageAreas");
    expect(prompt).toContain("vendorAlignment");
    expect(prompt).toContain("riskFactors");
  });

  it("instructs package preference over standalone services", () => {
    const prompt = buildPrompt("Test.", "reqs", "catalog");
    expect(prompt).toContain("score the package higher");
    expect(prompt).toContain("Only recommend standalone services when they are specifically requested");
  });

  it("uses custom rules text when provided", () => {
    const prompt = buildPrompt("System.", "reqs", "catalog", "CUSTOM RULES HERE");
    expect(prompt).toContain("CUSTOM RULES HERE");
    expect(prompt).not.toContain("SCORING RULES:");
  });

  it("uses default rules text when custom rules are omitted", () => {
    const prompt = buildPrompt("System.", "reqs", "catalog");
    expect(prompt).toContain(DEFAULT_REQUIREMENTS_MATCH_RULES);
  });
});

// ---------------------------------------------------------------------------
// getFirstSystemConfigValue
// ---------------------------------------------------------------------------

describe("getFirstSystemConfigValue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the first non-empty config value", async () => {
    vi.mocked(prisma.systemConfig.findUnique)
      .mockResolvedValueOnce({ value: "" })
      .mockResolvedValueOnce({ value: "   " })
      .mockResolvedValueOnce({ value: "winner" });

    const value = await getFirstSystemConfigValue(["A", "B", "C"]);
    expect(value).toBe("winner");
  });

  it("returns null when all keys are empty or missing", async () => {
    vi.mocked(prisma.systemConfig.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ value: "" });

    const value = await getFirstSystemConfigValue(["A", "B"]);
    expect(value).toBeNull();
  });
});
