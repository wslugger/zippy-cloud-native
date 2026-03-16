import { prisma } from "@/lib/prisma";
import { ItemType } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const MATCH_CHARACTERISTICS = [
  "name",
  "short_description",
  "long_description",
  "features",
  "constraints",
  "assumptions",
] as const;

export type MatchCharacteristic = (typeof MATCH_CHARACTERISTICS)[number];

export interface RecommendationCandidate {
  id: string;
  sku: string;
  name: string;
  type: ItemType;
  shortDescription: string | null;
  detailedDescription: string | null;
  features: string[];
  constraints: string[];
  assumptions: string[];
  requiredIncluded: string[];
  optionalRecommended: string[];
  requiredIncludedDetails: string[];
  optionalIncludedDetails: string[];
  designOptionRules: string[];
  signalFeasible: boolean;
  collaterals?: Array<{ id: string; title: string; documentUrl: string; type: string }>;
}

export interface GeminiMatchResult {
  id: string;
  score: number;
  reason: string;
  shortReason: string;
  coverageAreas: string[];
  matchedCharacteristics: MatchCharacteristic[];
  vendorAlignment: "full" | "partial" | "none";
  riskFactors: string[];
}

export interface RankedRecommendation extends RecommendationCandidate {
  reason: string;
  shortReason: string;
  score: number;
  certaintyPercent: number;
  matchedCharacteristics: MatchCharacteristic[];
  coverageAreas: string[];
  riskFactors: string[];
}

export const PROMPT_REQUIREMENTS_MATCH_KEY = "PROMPT_REQUIREMENTS_MATCH";
export const PROMPT_REQUIREMENTS_MATCH_RULES_KEY = "PROMPT_REQUIREMENTS_MATCH_RULES";

export const DEFAULT_REQUIREMENTS_MATCH_PROMPT =
  "You are a solution architect assistant. Analyze package and managed-service candidates across name, short description, detailed description, features, constraints, assumptions, and included components. Prefer packages when they provide broader, lower-risk requirement coverage than individual services.";

export const DEFAULT_REQUIREMENTS_MATCH_RULES = [
  "SCORING RULES:",
  "1. Base your score (0-1) on how well the candidate's description, features, constraints, assumptions, and included components match the customer requirements.",
  "2. PACKAGE PREFERENCE: When a design package and individual standalone services both cover the same requirements equally well, score the package higher. Only recommend standalone services when they are specifically requested in the requirements OR when no package adequately covers the requirements.",
  "3. VENDOR PREFERENCE: If the customer states a vendor preference (e.g., \"prefer Meraki\", \"prefer Cisco Catalyst\"), boost candidates aligned with that vendor and reduce candidates for a competing vendor. If no preference is stated, treat vendors neutrally.",
  "4. COVERAGE: For each candidate, identify which technology domains it covers (e.g., SD-WAN, LAN, WLAN, Security, UCaaS, Cloud). Candidates covering more of the customer's required domains should score higher.",
  "5. RISK ASSESSMENT: If a candidate's constraints or assumptions conflict with the stated requirements, reduce the score and note the risk.",
  "6. DESIGN OPTIONS: Analyze package design option rules (FORCE/FORBID/ALLOW_ONLY/REQUIRE_ONE_OF) for compatibility with requirements. If rules conflict with requirements, reduce the score.",
  "",
  "Evaluate EVERY candidate against these rules. Return up to 8 results sorted by score descending.",
].join("\n");

// ---------------------------------------------------------------------------
// Candidate Loading
// ---------------------------------------------------------------------------

export async function loadCandidates(): Promise<RecommendationCandidate[]> {
  const items = await prisma.catalogItem.findMany({
    where: { type: { in: [ItemType.PACKAGE, ItemType.MANAGED_SERVICE] } },
    include: {
      attributes: { include: { term: { select: { label: true, value: true } } } },
      constraints: { select: { description: true } },
      assumptions: { select: { description: true } },
      collaterals: true,
      packageCompositions: {
        include: {
          catalogItem: {
            select: {
              name: true,
              shortDescription: true,
              detailedDescription: true,
              attributes: { include: { term: { select: { label: true, value: true } } } },
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
      packagePolicies: {
        where: { active: true },
        include: {
          designOption: true,
          values: { include: { designOptionValue: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return items.map((item) => {
    const requiredIncludedDetails = item.packageCompositions
      .filter((row) => row.role === "REQUIRED" || row.role === "AUTO_INCLUDED")
      .map((row) => {
        const memberFeatures = row.catalogItem.attributes
          .map((attr) => attr.term.label || attr.term.value)
          .filter(Boolean) as string[];
        return [
          row.catalogItem.name,
          row.catalogItem.shortDescription ?? "",
          row.catalogItem.detailedDescription ?? "",
          memberFeatures.join(", "),
        ]
          .filter(Boolean)
          .join(" | ");
      });

    const optionalIncludedDetails = item.packageCompositions
      .filter((row) => row.role === "OPTIONAL")
      .map((row) => {
        const memberFeatures = row.catalogItem.attributes
          .map((attr) => attr.term.label || attr.term.value)
          .filter(Boolean) as string[];
        return [
          row.catalogItem.name,
          row.catalogItem.shortDescription ?? "",
          row.catalogItem.detailedDescription ?? "",
          memberFeatures.join(", "),
        ]
          .filter(Boolean)
          .join(" | ");
      });

    const designOptionRules = item.packagePolicies.map((policy) => {
      const option = policy.designOption?.label ?? policy.designOption?.key ?? "unknown_option";
      const values = policy.values
        .map((v) => v.designOptionValue?.label ?? v.designOptionValue?.value ?? "")
        .filter(Boolean);
      return `${option} ${policy.operator} ${values.join(", ") || "any"}`;
    });

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      type: item.type,
      shortDescription: item.shortDescription,
      detailedDescription: item.detailedDescription,
      features: item.attributes.map((attr) => attr.term.label || attr.term.value).filter(Boolean) as string[],
      constraints: item.constraints.map((c) => c.description),
      assumptions: item.assumptions.map((a) => a.description),
      requiredIncluded: item.packageCompositions
        .filter((row) => row.role === "REQUIRED" || row.role === "AUTO_INCLUDED")
        .map((row) => row.catalogItem.name),
      optionalRecommended: item.packageCompositions
        .filter((row) => row.role === "OPTIONAL")
        .map((row) => row.catalogItem.name),
      requiredIncludedDetails,
      optionalIncludedDetails,
      designOptionRules,
      signalFeasible: true,
      collaterals: item.collaterals ?? [],
    };
  });
}

// ---------------------------------------------------------------------------
// Candidate Summary (for Gemini prompt context)
// ---------------------------------------------------------------------------

export function buildCandidateSummary(candidates: RecommendationCandidate[]): string {
  return candidates
    .map(
      (c) =>
        `- id:${c.id} | type:${c.type} | sku:${c.sku} | name:${c.name} | short_desc:${c.shortDescription ?? "N/A"} | long_desc:${c.detailedDescription ?? "N/A"} | features:${c.features.join(", ") || "none"} | constraints:${c.constraints.join(", ") || "none"} | assumptions:${c.assumptions.join(", ") || "none"} | required:${c.requiredIncluded.join(", ") || "none"} | optional:${c.optionalRecommended.join(", ") || "none"} | required_component_details:${c.requiredIncludedDetails.join(" || ") || "none"} | optional_component_details:${c.optionalIncludedDetails.join(" || ") || "none"} | design_option_rules:${c.designOptionRules.join(" || ") || "none"}`
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

export function buildPrompt(
  promptTemplate: string,
  requirements: string,
  candidateSummary: string,
  rulesText: string = DEFAULT_REQUIREMENTS_MATCH_RULES
): string {
  return `${promptTemplate}

${rulesText}

CUSTOMER REQUIREMENTS:
${requirements}

AVAILABLE CATALOG ITEMS:
${candidateSummary}

Return ONLY a JSON array. Each object MUST have these keys:
- "id": the exact catalog item id from above
- "score": number from 0 to 1
- "reason": 2-3 sentence explanation of why this item matches (or partially matches)
- "shortReason": single sentence summary (max 25 words)
- "coverageAreas": array of technology domains this candidate covers from the requirements (e.g., ["SD-WAN", "Security"])
- "matchedCharacteristics": array using only values from: name, short_description, long_description, features, constraints, assumptions
- "vendorAlignment": "full", "partial", or "none" based on customer vendor preference
- "riskFactors": array of strings describing any constraint/assumption conflicts (empty array if none)

Only include items that genuinely match some requirements. If fewer than 8 are relevant, return fewer.
Respond ONLY with the JSON array, no markdown fences or extra text.`;
}

// ---------------------------------------------------------------------------
// Gemini Invocation
// ---------------------------------------------------------------------------

export async function invokeGemini(
  prompt: string,
  modelCandidates: string[],
  apiKey: string
): Promise<{ results: GeminiMatchResult[]; modelUsed: string } | null> {
  for (const modelName of modelCandidates) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2048,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );

      if (!res.ok) {
        console.error(`Gemini API error (${modelName}):`, await res.text());
        continue;
      }

      const data = await res.json();
      const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
      const parsed = JSON.parse(normalizeGeminiJson(rawText));

      if (!Array.isArray(parsed)) continue;

      const results = normalizeGeminiResponse(parsed);
      if (results.length > 0) {
        return { results, modelUsed: modelName };
      }
    } catch (error) {
      console.error(`Gemini request/parse failed (${modelName}):`, error);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Response Normalization
// ---------------------------------------------------------------------------

export function normalizeGeminiJson(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

export function normalizeGeminiResponse(parsed: unknown[]): GeminiMatchResult[] {
  return parsed
    .map((entry): GeminiMatchResult | null => {
      if (!entry || typeof entry !== "object") return null;
      const obj = entry as Record<string, unknown>;
      if (typeof obj.id !== "string") return null;

      return {
        id: obj.id,
        score: Number.isFinite(Number(obj.score)) ? Number(obj.score) : 0.5,
        reason: typeof obj.reason === "string" ? obj.reason : "Matched by AI against service characteristics.",
        shortReason: typeof obj.shortReason === "string" ? obj.shortReason : "",
        coverageAreas: Array.isArray(obj.coverageAreas)
          ? obj.coverageAreas.filter((v): v is string => typeof v === "string")
          : [],
        matchedCharacteristics: normalizeMatchedCharacteristics(obj.matchedCharacteristics),
        vendorAlignment: (["full", "partial", "none"] as const).includes(obj.vendorAlignment as "full" | "partial" | "none")
          ? (obj.vendorAlignment as "full" | "partial" | "none")
          : "none",
        riskFactors: Array.isArray(obj.riskFactors)
          ? obj.riskFactors.filter((v): v is string => typeof v === "string")
          : [],
      };
    })
    .filter((entry): entry is GeminiMatchResult => Boolean(entry));
}

export function normalizeMatchedCharacteristics(value: unknown): MatchCharacteristic[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(MATCH_CHARACTERISTICS);
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toLowerCase().trim())
    .filter((item): item is MatchCharacteristic => valid.has(item));
}

// ---------------------------------------------------------------------------
// Fallback Token Matching (when Gemini is unavailable)
// ---------------------------------------------------------------------------

function tokenize(input: string): string[] {
  return input.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
}

export function fallbackTokenMatch(
  candidates: RecommendationCandidate[],
  requirements: string
): GeminiMatchResult[] {
  const reqTokens = new Set(tokenize(requirements));

  return candidates
    .map((candidate) => {
      const characteristics: Array<{ key: MatchCharacteristic; text: string; weight: number }> = [
        { key: "name", text: candidate.name, weight: 1.4 },
        { key: "short_description", text: candidate.shortDescription ?? "", weight: 1.2 },
        { key: "long_description", text: candidate.detailedDescription ?? "", weight: 1.1 },
        {
          key: "features",
          text: [
            ...candidate.features,
            ...candidate.requiredIncludedDetails,
            ...candidate.optionalIncludedDetails,
            ...candidate.designOptionRules,
          ].join(" "),
          weight: 1.0,
        },
        { key: "constraints", text: candidate.constraints.join(" "), weight: 0.9 },
        { key: "assumptions", text: candidate.assumptions.join(" "), weight: 0.8 },
      ];

      let totalWeight = 0;
      let matchedWeight = 0;
      const matchedChars: MatchCharacteristic[] = [];

      for (const row of characteristics) {
        const rowTokens = tokenize(row.text);
        if (rowTokens.length === 0) continue;
        totalWeight += row.weight;
        if (rowTokens.some((t) => reqTokens.has(t))) {
          matchedWeight += row.weight;
          matchedChars.push(row.key);
        }
      }

      let score = totalWeight > 0 ? Math.max(0.05, Math.min(0.99, matchedWeight / totalWeight)) : 0.1;

      // Only hardcoded rule: prefer packages over standalone services
      if (candidate.type === ItemType.PACKAGE) {
        score = Math.min(0.99, score + 0.05);
      }

      return {
        id: candidate.id,
        score,
        reason: matchedChars.length > 0
          ? `Matched against service characteristics: ${matchedChars.join(", ")}.`
          : "General fit based on available service composition.",
        shortReason: matchedChars.length > 0
          ? `Matched on ${matchedChars.join(", ")}.`
          : "General fit.",
        coverageAreas: [] as string[],
        matchedCharacteristics: matchedChars,
        vendorAlignment: "none" as const,
        riskFactors: [] as string[],
      };
    })
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Score Normalization
// ---------------------------------------------------------------------------

export function toBoundedConfidence(rawScore: number): number {
  const nonNegative = Math.max(0, rawScore);
  const bounded = 1 - Math.exp(-nonNegative * 2.2);
  return Math.max(0, Math.min(0.99, bounded));
}

// ---------------------------------------------------------------------------
// Ranking (lightweight post-processing)
// ---------------------------------------------------------------------------

export function rankResults(
  results: GeminiMatchResult[],
  candidates: RecommendationCandidate[]
): RankedRecommendation[] {
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  return results
    .map((result): RankedRecommendation | null => {
      const candidate = candidateMap.get(result.id);
      if (!candidate) return null;

      // Clamp raw score to [0, 1]
      let score = Math.max(0, Math.min(1, result.score));

      // Apply signal feasibility penalty (structural check, not scoring bias)
      if (candidate.type === ItemType.PACKAGE && !candidate.signalFeasible) {
        score = Math.max(0.01, score * 0.8);
      }

      // Normalize to bounded confidence scale
      const finalScore = toBoundedConfidence(score);
      const certaintyPercent = Math.max(1, Math.round(finalScore * 100));

      const shortReason = result.shortReason || toShortReason(result.reason);

      return {
        ...candidate,
        reason: result.reason,
        shortReason,
        score: finalScore,
        certaintyPercent,
        matchedCharacteristics: result.matchedCharacteristics,
        coverageAreas: result.coverageAreas,
        riskFactors: result.riskFactors,
      };
    })
    .filter((row): row is RankedRecommendation => Boolean(row))
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Top Selection (ensure diversity: packages + services)
// ---------------------------------------------------------------------------

export function selectTopRecommendations(
  ranked: RankedRecommendation[],
  maxResults = 5
): RankedRecommendation[] {
  const selected: RankedRecommendation[] = [];
  const seen = new Set<string>();
  const add = (row: RankedRecommendation) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    selected.push(row);
  };

  const sorted = [...ranked].sort((a, b) => b.score - a.score);
  const packages = sorted.filter((r) => r.type === ItemType.PACKAGE);
  const services = sorted.filter((r) => r.type === ItemType.MANAGED_SERVICE);

  // Ensure mix: up to 2 packages, then up to 3 services, then fill remaining
  packages.slice(0, 2).forEach(add);
  services.slice(0, 3).forEach(add);
  sorted.forEach(add);

  return selected.slice(0, maxResults);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function toShortReason(reason: string): string {
  const normalized = reason.replace(/\s+/g, " ").trim();
  const withoutMatchedTail = normalized.split("Matched characteristics:")[0]?.trim() ?? normalized;
  const sentence = withoutMatchedTail.split(/(?<=[.!?])\s+/)[0] ?? withoutMatchedTail;
  return sentence.slice(0, 180);
}

export async function getSystemConfigValue(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key }, select: { value: true } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function getFirstSystemConfigValue(keys: string[]): Promise<string | null> {
  for (const key of keys) {
    const value = await getSystemConfigValue(key);
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}
