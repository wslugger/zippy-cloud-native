import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { parseRequirementSignals } from "@/lib/requirement-signals";
import {
  adjustScoreForCoverage,
  computeCoverage,
  computeIntentBonus,
  toBoundedConfidence,
} from "@/lib/recommendation-coverage";
import { ItemType, Prisma } from "@prisma/client";

interface MatchCandidate {
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

interface MatchResult {
  id: string;
  reason: string;
  score: number;
  matchedCharacteristics: string[];
}

type RankedRecommendation = MatchCandidate & {
  reason: string;
  shortReason: string;
  score: number;
  certaintyPercent: number;
  matchedCharacteristics: string[];
};

function isMissingTableOrColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2021" || error.code === "P2022";
}

type PackageCandidateRow = {
  id: string;
  sku: string;
  name: string;
  shortDescription: string | null;
  detailedDescription: string | null;
  attributes?: Array<{ term?: { label?: string | null; value?: string | null } }>;
  constraints?: Array<{ description: string }>;
  assumptions?: Array<{ description: string }>;
  packageCompositions: Array<{
    role: string;
    catalogItem: {
      name: string;
      shortDescription: string | null;
      detailedDescription: string | null;
      attributes?: Array<{ term?: { label?: string | null; value?: string | null } }>;
    };
  }>;
  packagePolicies: Array<{
    operator: string;
    designOption?: { key?: string; label?: string | null };
    values?: Array<{ designOptionValue?: { value?: string; label?: string | null } }>;
  }>;
  collaterals?: Array<{ id: string; title: string; documentUrl: string; type: string }>;
};

type ManagedServiceCandidateRow = {
  id: string;
  sku: string;
  name: string;
  shortDescription: string | null;
  detailedDescription: string | null;
  attributes?: Array<{ term?: { label?: string | null; value?: string | null } }>;
  constraints?: Array<{ description: string }>;
  assumptions?: Array<{ description: string }>;
  collaterals?: Array<{ id: string; title: string; documentUrl: string; type: string }>;
};

const MATCH_CHARACTERISTICS = [
  "name",
  "short_description",
  "long_description",
  "features",
  "constraints",
  "assumptions",
] as const;

type MatchCharacteristic = (typeof MATCH_CHARACTERISTICS)[number];

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => token.length > 2);
}

function normalizeMatchedCharacteristics(value: unknown): MatchCharacteristic[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(MATCH_CHARACTERISTICS);
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toLowerCase().trim())
    .filter((item): item is MatchCharacteristic => valid.has(item));
}

function characteristicCoverage(candidate: MatchCandidate, requirements: string): { matchedCharacteristics: MatchCharacteristic[]; score: number } {
  const reqTokens = new Set(tokenize(requirements));
  const characteristics: Array<{ key: MatchCharacteristic; text: string; weight: number }> = [
    { key: "name", text: candidate.name, weight: 1.4 },
    { key: "short_description", text: candidate.shortDescription ?? "", weight: 1.2 },
    { key: "long_description", text: candidate.detailedDescription ?? "", weight: 1.1 },
    { key: "features", text: candidate.features.join(" "), weight: 1.0 },
    { key: "constraints", text: candidate.constraints.join(" "), weight: 0.9 },
    { key: "assumptions", text: candidate.assumptions.join(" "), weight: 0.8 },
  ];

  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedCharacteristics: MatchCharacteristic[] = [];

  for (const characteristic of characteristics) {
    const tokens = tokenize(characteristic.text);
    if (tokens.length === 0) continue;
    totalWeight += characteristic.weight;
    const hit = tokens.some((token) => reqTokens.has(token));
    if (hit) {
      matchedWeight += characteristic.weight;
      matchedCharacteristics.push(characteristic.key);
    }
  }

  const score = totalWeight > 0 ? Math.max(0.05, Math.min(0.99, matchedWeight / totalWeight)) : 0.1;
  return { matchedCharacteristics, score };
}

async function loadPackageCandidates(): Promise<PackageCandidateRow[]> {
  try {
    return await prisma.catalogItem.findMany({
      where: { type: "PACKAGE" },
      include: {
        packageCompositions: {
          include: {
            catalogItem: {
              select: {
                name: true,
                shortDescription: true,
                detailedDescription: true,
                attributes: {
                  include: {
                    term: {
                      select: {
                        label: true,
                        value: true,
                      },
                    },
                  },
                },
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
        collaterals: true,
        attributes: {
          include: {
            term: {
              select: {
                label: true,
                value: true,
              },
            },
          },
        },
        constraints: {
          select: { description: true },
        },
        assumptions: {
          select: { description: true },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Full package candidate query failed:", error);
  }

  try {
    const minimal = await prisma.catalogItem.findMany({
      where: { type: "PACKAGE" },
      select: {
        id: true,
        sku: true,
        name: true,
        shortDescription: true,
        detailedDescription: true,
      },
      orderBy: { name: "asc" },
    });
    return minimal.map((pkg) => ({
      ...pkg,
      attributes: [],
      constraints: [],
      assumptions: [],
      packageCompositions: [],
      packagePolicies: [],
      collaterals: [],
    }));
  } catch (error) {
    console.error("Minimal package candidate query failed:", error);
  }

  // Final compatibility fallback with raw SQL against legacy schema.
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string; sku: string; name: string }>>(
      `SELECT "id", "sku", "name" FROM "CatalogItem" WHERE "type" = 'PACKAGE' ORDER BY "name" ASC`
    );
    return rows.map((pkg) => ({
      ...pkg,
      shortDescription: null,
      detailedDescription: null,
      attributes: [],
      constraints: [],
      assumptions: [],
      packageCompositions: [],
      packagePolicies: [],
      collaterals: [],
    }));
  } catch (error) {
    console.error("Raw SQL package candidate query failed:", error);
    return [];
  }
}

async function loadManagedServiceCandidates(): Promise<ManagedServiceCandidateRow[]> {
  try {
    return await prisma.catalogItem.findMany({
      where: { type: ItemType.MANAGED_SERVICE },
      include: {
        collaterals: true,
        attributes: {
          include: {
            term: {
              select: {
                label: true,
                value: true,
              },
            },
          },
        },
        constraints: {
          select: { description: true },
        },
        assumptions: {
          select: { description: true },
        },
      },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    console.error("Managed service candidate query failed:", error);
    return [];
  }
}

function normalizeGeminiJson(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function toShortReason(reason: string): string {
  const normalized = reason.replace(/\s+/g, " ").trim();
  const withoutMatchedTail = normalized.split("Matched characteristics:")[0]?.trim() ?? normalized;
  const sentence = withoutMatchedTail.split(/(?<=[.!?])\s+/)[0] ?? withoutMatchedTail;
  return sentence.slice(0, 180);
}

function buildCandidateCoverageText(candidate: MatchCandidate): string {
  const packageUsesCompositionCoverage =
    candidate.type === ItemType.PACKAGE &&
    (candidate.requiredIncluded.length > 0 || candidate.optionalRecommended.length > 0);

  return [
    candidate.name,
    packageUsesCompositionCoverage ? "" : candidate.shortDescription ?? "",
    packageUsesCompositionCoverage ? "" : candidate.detailedDescription ?? "",
    packageUsesCompositionCoverage ? "" : candidate.features.join(" "),
    candidate.constraints.join(" "),
    candidate.assumptions.join(" "),
    candidate.requiredIncluded.join(" "),
    candidate.requiredIncludedDetails.join(" "),
    candidate.designOptionRules.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCandidateOptionalCoverageText(candidate: MatchCandidate): string {
  return [
    candidate.optionalRecommended.join(" "),
    candidate.optionalIncludedDetails.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildCandidateIntentText(candidate: MatchCandidate): string {
  return [
    candidate.name,
    candidate.shortDescription ?? "",
    candidate.detailedDescription ?? "",
    candidate.features.join(" "),
    candidate.requiredIncluded.join(" "),
    candidate.optionalRecommended.join(" "),
    candidate.requiredIncludedDetails.join(" "),
    candidate.optionalIncludedDetails.join(" "),
    candidate.designOptionRules.join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

function applySignalPenalty(score: number, candidate: MatchCandidate): number {
  if (candidate.type === ItemType.PACKAGE && !candidate.signalFeasible) {
    return Math.max(0.01, score * 0.75);
  }
  return score;
}

function applyBundlePreference(
  score: number,
  candidate: MatchCandidate,
  coverage: ReturnType<typeof computeCoverage>
): number {
  let adjusted = score;
  if (coverage.required.length >= 2) {
    if (candidate.type === ItemType.PACKAGE) {
      adjusted += 0.18;
      if (coverage.optionalMatched.length > 0 && coverage.coreMatched.length < coverage.required.length) {
        adjusted += 0.08;
      }
      if (coverage.coreMatched.length === coverage.required.length) {
        adjusted += 0.1;
      }
    } else {
      adjusted *= 0.65;
      if (coverage.matched.length < coverage.required.length) {
        adjusted *= 0.8;
      }
    }
  }
  return Math.max(0, Math.min(0.99, adjusted));
}

function selectMixedRecommendations(rows: RankedRecommendation[], maxResults = 5): RankedRecommendation[] {
  const selected: RankedRecommendation[] = [];
  const seen = new Set<string>();
  const add = (row: RankedRecommendation) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    selected.push(row);
  };

  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const packages = sorted.filter((row) => row.type === ItemType.PACKAGE);
  const services = sorted.filter((row) => row.type === ItemType.MANAGED_SERVICE);

  packages.slice(0, 2).forEach(add);
  services.slice(0, 3).forEach(add);
  sorted.forEach(add);

  return selected.slice(0, maxResults);
}

function fallbackMatch(candidates: MatchCandidate[], requirements: string): MatchResult[] {
  return candidates
    .map((candidate) => {
      const { matchedCharacteristics, score } = characteristicCoverage(candidate, requirements);
      const coverage = computeCoverage(requirements, {
        core: buildCandidateCoverageText(candidate),
        optional: buildCandidateOptionalCoverageText(candidate),
      });
      const adjustedScore = applySignalPenalty(
        adjustScoreForCoverage(score, coverage, { isPackage: candidate.type === ItemType.PACKAGE }),
        candidate
      );
      const withBundlePreference = applyBundlePreference(adjustedScore, candidate, coverage);
      const finalScore = toBoundedConfidence(
        withBundlePreference + computeIntentBonus(requirements, buildCandidateIntentText(candidate))
      );
      const reason = coverage.required.length > 0
        ? `${coverage.sentence} Matched against key service characteristics from your requirements.`
        : matchedCharacteristics.length > 0
          ? "Matched against key service characteristics from your requirements."
          : "General fit based on available service composition.";

      return {
        id: candidate.id,
        reason,
        score: finalScore,
        matchedCharacteristics,
      };
    })
    .sort((a, b) => b.score - a.score);
}

async function getConfigValue(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key }, select: { value: true } });
    return row?.value ?? null;
  } catch (error) {
    if (!isMissingTableOrColumnError(error)) {
      console.error("getConfigValue failed:", error);
    }
    return null;
  }
}

function isFeasibleBySignals(
  policies: Array<{
    operator: string;
    designOption?: { key?: string };
    values?: Array<{ designOptionValue?: { value?: string } }>;
  }>,
  signals: ReturnType<typeof parseRequirementSignals>
): boolean {
  const signalMap: Record<string, string | undefined> = {
    topology: signals.topology,
    internetBreakout: signals.internetBreakout,
  };

  for (const policy of policies) {
    const optionKey = policy.designOption?.key;
    if (!optionKey) continue;
    const signal = signalMap[optionKey];
    if (!signal) continue;

    const values = new Set((policy.values ?? []).map((v) => v.designOptionValue?.value).filter(Boolean) as string[]);

    if (policy.operator === "FORCE" && !values.has(signal)) return false;
    if (policy.operator === "FORBID" && values.has(signal)) return false;
    if (policy.operator === "ALLOW_ONLY" && !values.has(signal)) return false;
    if (policy.operator === "REQUIRE_ONE_OF" && !values.has(signal)) return false;
  }

  return true;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    let manualRequirements = "";
    try {
      const body = (await request.json()) as { rawRequirements?: string } | null;
      manualRequirements = body?.rawRequirements?.trim() ?? "";
    } catch {
      manualRequirements = "";
    }

    let project: { id: string; rawRequirements?: string | null };
    try {
      project = await assertProjectOwnership(projectId, session.userId);
    } catch (error) {
      const isOwnershipError = error instanceof Error && error.message === "PROJECT_NOT_FOUND_OR_FORBIDDEN";
      const isSchemaError = isMissingTableOrColumnError(error);
      if (!isOwnershipError && !isSchemaError) throw error;

      // Legacy compatibility: if userId-based ownership or column is unavailable, load by id.
      let fallback: { id: string; rawRequirements: string | null } | null = null;
      try {
        fallback = await prisma.project.findFirst({
          where: {
            id: projectId,
            OR: [{ userId: session.userId }, { userId: null }],
          },
          select: { id: true, rawRequirements: true },
        });
      } catch (innerError) {
        if (!isMissingTableOrColumnError(innerError)) throw innerError;
        try {
          fallback = await prisma.project.findFirst({
            where: { id: projectId },
            select: { id: true, rawRequirements: true },
          });
        } catch (secondInnerError) {
          if (!isMissingTableOrColumnError(secondInnerError)) throw secondInnerError;
          const minimalFallback = await prisma.project.findFirst({
            where: { id: projectId },
            select: { id: true },
          });
          fallback = minimalFallback ? { id: minimalFallback.id, rawRequirements: null } : null;
        }
      }

      if (!fallback) return NextResponse.json({ error: "Project not found" }, { status: 404 });
      project = fallback;
    }

    let docs: Array<{ extractedText: string | null }> = [];
    try {
      docs = await prisma.projectRequirementDocument.findMany({
        where: { projectId, status: { in: ["UPLOADED", "PARSED"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { extractedText: true },
      });
    } catch (error) {
      if (!isMissingTableOrColumnError(error)) throw error;
      docs = [];
    }

    const combinedRequirements = [
      manualRequirements,
      project.rawRequirements ?? "",
      ...docs.map((doc) => doc.extractedText ?? ""),
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    if (!combinedRequirements) {
      return NextResponse.json({ error: "No project requirements found. Add manual text or upload documents first." }, { status: 400 });
    }

    const signals = parseRequirementSignals(combinedRequirements);

    const [packageCandidates, managedServiceCandidates] = await Promise.all([
      loadPackageCandidates(),
      loadManagedServiceCandidates(),
    ]);

    const packageMatches: MatchCandidate[] = packageCandidates.map((pkg) => {
      const signalFeasible = isFeasibleBySignals(pkg.packagePolicies, signals);
      const requiredIncludedDetails = pkg.packageCompositions
        .filter((row) => row.role === "REQUIRED" || row.role === "AUTO_INCLUDED")
        .map((row) => {
          const memberFeatures = (row.catalogItem.attributes ?? [])
            .map((attribute) => attribute.term?.label ?? attribute.term?.value ?? "")
            .filter(Boolean);
          return [
            row.catalogItem.name,
            row.catalogItem.shortDescription ?? "",
            row.catalogItem.detailedDescription ?? "",
            memberFeatures.join(", "),
          ]
            .filter(Boolean)
            .join(" | ");
        });

      const optionalIncludedDetails = pkg.packageCompositions
        .filter((row) => row.role === "OPTIONAL")
        .map((row) => {
          const memberFeatures = (row.catalogItem.attributes ?? [])
            .map((attribute) => attribute.term?.label ?? attribute.term?.value ?? "")
            .filter(Boolean);
          return [
            row.catalogItem.name,
            row.catalogItem.shortDescription ?? "",
            row.catalogItem.detailedDescription ?? "",
            memberFeatures.join(", "),
          ]
            .filter(Boolean)
            .join(" | ");
        });

      const designOptionRules = pkg.packagePolicies.map((policy) => {
        const option = policy.designOption?.label ?? policy.designOption?.key ?? "unknown_option";
        const values = (policy.values ?? [])
          .map((value) => value.designOptionValue?.label ?? value.designOptionValue?.value ?? "")
          .filter(Boolean);
        return `${option} ${policy.operator} ${values.join(", ") || "any"}`;
      });

      if (!signalFeasible) {
        designOptionRules.push("Signal compatibility: one or more topology/breakout rules may conflict with requirements.");
      }

      return {
        id: pkg.id,
        sku: pkg.sku,
        name: pkg.name,
        type: ItemType.PACKAGE,
        shortDescription: pkg.shortDescription,
        detailedDescription: pkg.detailedDescription,
        features: (pkg.attributes ?? [])
          .map((attribute) => attribute.term?.label ?? attribute.term?.value ?? "")
          .filter(Boolean),
        constraints: (pkg.constraints ?? []).map((constraint) => constraint.description).filter(Boolean),
        assumptions: (pkg.assumptions ?? []).map((assumption) => assumption.description).filter(Boolean),
        requiredIncluded: pkg.packageCompositions
          .filter((row) => row.role === "REQUIRED" || row.role === "AUTO_INCLUDED")
          .map((row) => row.catalogItem.name),
        optionalRecommended: pkg.packageCompositions
          .filter((row) => row.role === "OPTIONAL")
          .map((row) => row.catalogItem.name),
        requiredIncludedDetails,
        optionalIncludedDetails,
        designOptionRules,
        signalFeasible,
        collaterals: pkg.collaterals ?? [],
      };
    });

    const serviceMatches: MatchCandidate[] = managedServiceCandidates.map((svc) => ({
      id: svc.id,
      sku: svc.sku,
      name: svc.name,
      type: ItemType.MANAGED_SERVICE,
      shortDescription: svc.shortDescription,
      detailedDescription: svc.detailedDescription,
      features: (svc.attributes ?? [])
        .map((attribute) => attribute.term?.label ?? attribute.term?.value ?? "")
        .filter(Boolean),
      constraints: (svc.constraints ?? []).map((constraint) => constraint.description).filter(Boolean),
      assumptions: (svc.assumptions ?? []).map((assumption) => assumption.description).filter(Boolean),
      requiredIncluded: [],
      optionalRecommended: [],
      requiredIncludedDetails: [],
      optionalIncludedDetails: [],
      designOptionRules: [],
      signalFeasible: true,
      collaterals: svc.collaterals ?? [],
    }));

    const candidates: MatchCandidate[] = [...packageMatches, ...serviceMatches];

    const promptTemplate =
      (await getConfigValue("PROMPT_PACKAGE_MATCH")) ??
      "You are a solution architect assistant. Recommend the best matching design package candidates based on customer requirements. Return JSON only.";
    const primaryModel = (await getConfigValue("GEMINI_MODEL")) ?? "gemini-3.1-flash-lite-preview";
    const fallbackModel = "gemini-2.5-flash";
    const modelCandidates = Array.from(new Set([primaryModel, fallbackModel]));
    let modelUsed = primaryModel;

    const candidateSummary = candidates
      .map(
        (candidate) =>
          `- id:${candidate.id} | type:${candidate.type} | sku:${candidate.sku} | name:${candidate.name} | short_desc:${candidate.shortDescription ?? "N/A"} | long_desc:${candidate.detailedDescription ?? "N/A"} | features:${candidate.features.join(", ") || "none"} | constraints:${candidate.constraints.join(", ") || "none"} | assumptions:${candidate.assumptions.join(", ") || "none"} | required:${candidate.requiredIncluded.join(", ") || "none"} | optional:${candidate.optionalRecommended.join(", ") || "none"} | required_component_details:${candidate.requiredIncludedDetails.join(" || ") || "none"} | optional_component_details:${candidate.optionalIncludedDetails.join(" || ") || "none"} | design_option_rules:${candidate.designOptionRules.join(" || ") || "none"}`
      )
      .join("\n");

    const prompt = `${promptTemplate}

Evaluate each candidate against these characteristics:
- name
- short_description
- long_description
- features
- constraints
- assumptions

Decision policy:
- Analyze detailed description, features, constraints, and assumptions for every candidate.
- Analyze package member service details/features and design option rules before scoring.
- Prefer a PACKAGE over individual services when coverage is equal or better and risk is lower.
- Include strong PACKAGE recommendations and lower-scored partial individual services when requirements span multiple domains.
- Do not choose a package if constraints/assumptions create a material mismatch.

CUSTOMER REQUIREMENTS:
${combinedRequirements}

CANDIDATES:
${candidateSummary}

Return JSON only as an array of up to 8 objects with keys:
- id
- reason (concise, max 18 words)
- score (0-1 certainty)
- matchedCharacteristics (array with values from: name, short_description, long_description, features, constraints, assumptions).`;

    const apiKey = process.env.GEMINI_API_KEY;
    let matches: MatchResult[] = [];

    if (apiKey && candidates.length > 0) {
      for (const modelName of modelCandidates) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 512,
                  thinkingConfig: { thinkingBudget: 0 },
                },
              }),
            }
          );

          if (!geminiRes.ok) {
            console.error(`Gemini API error (${modelName})`, await geminiRes.text());
            continue;
          }

          const payload = await geminiRes.json();
          const rawText: string = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
          const parsed = JSON.parse(normalizeGeminiJson(rawText));
          if (!Array.isArray(parsed)) {
            continue;
          }

          matches = parsed
            .map((entry): MatchResult | null => {
              if (!entry || typeof entry !== "object") return null;
              const candidate = entry as {
                id?: unknown;
                reason?: unknown;
                score?: unknown;
                matchedCharacteristics?: unknown;
              };
              if (typeof candidate.id !== "string") return null;
              return {
                id: candidate.id,
                reason: typeof candidate.reason === "string" ? candidate.reason : "Matched by AI against service characteristics.",
                score: Number.isFinite(Number(candidate.score)) ? Number(candidate.score) : 0.5,
                matchedCharacteristics: normalizeMatchedCharacteristics(candidate.matchedCharacteristics),
              };
            })
            .filter((entry): entry is MatchResult => Boolean(entry));

          modelUsed = modelName;
          if (matches.length > 0) {
            break;
          }
        } catch (error) {
          console.error(`Gemini request/parse failed (${modelName})`, error);
        }
      }

      if (matches.length === 0) {
        matches = fallbackMatch(candidates, combinedRequirements);
      }
    } else {
      matches = fallbackMatch(candidates, combinedRequirements);
    }

    const toRankedRecommendation = (match: MatchResult): RankedRecommendation | null => {
      const candidate = candidates.find((c) => c.id === match.id);
      if (!candidate) return null;
      const normalizedScore = Math.max(0, Math.min(1, Number(match.score ?? 0)));
      const coverage = computeCoverage(combinedRequirements, {
        core: buildCandidateCoverageText(candidate),
        optional: buildCandidateOptionalCoverageText(candidate),
      });
      const heuristic = characteristicCoverage(candidate, combinedRequirements);
      const adjustedCoverageScore = adjustScoreForCoverage(normalizedScore, coverage, {
        isPackage: candidate.type === ItemType.PACKAGE,
      });
      const intentBonus = computeIntentBonus(
        combinedRequirements,
        buildCandidateIntentText(candidate)
      );
      const heuristicAdjusted = applySignalPenalty(
        adjustScoreForCoverage(heuristic.score, coverage, { isPackage: candidate.type === ItemType.PACKAGE }),
        candidate
      );
      const blendedScore = Math.max(0, Math.min(0.99, adjustedCoverageScore * 0.35 + heuristicAdjusted * 0.65));
      const withBundlePreference = applyBundlePreference(applySignalPenalty(blendedScore, candidate), candidate, coverage);
      const adjustedScore = toBoundedConfidence(withBundlePreference + intentBonus);
      const matchedCharacteristics = match.matchedCharacteristics.length > 0
        ? match.matchedCharacteristics
        : heuristic.matchedCharacteristics;
      const certaintyPercent = Math.round(adjustedScore * 100);
      const reasonWithCoverage = match.reason.startsWith(coverage.sentence)
        ? match.reason
        : `${coverage.sentence} ${match.reason}`.trim();
      const shortReason = coverage.required.length > 0 ? coverage.sentence : toShortReason(match.reason);
      const reason = reasonWithCoverage.includes("Matched characteristics:")
        ? reasonWithCoverage
        : `${reasonWithCoverage} Matched characteristics: ${matchedCharacteristics.join(", ") || "general_fit"}.`;
      return {
        ...candidate,
        reason,
        shortReason,
        score: adjustedScore,
        certaintyPercent,
        matchedCharacteristics,
      };
    };

    const aiRanked = matches
      .map((match) => toRankedRecommendation(match))
      .filter((row): row is RankedRecommendation => Boolean(row));

    const aiIds = new Set(aiRanked.map((row) => row.id));
    const supplementalRanked = fallbackMatch(candidates, combinedRequirements)
      .filter((match) => !aiIds.has(match.id))
      .map((match) => toRankedRecommendation(match))
      .filter((row): row is RankedRecommendation => Boolean(row));

    const mergedById = new Map<string, RankedRecommendation>();
    for (const row of [...aiRanked, ...supplementalRanked]) {
      const existing = mergedById.get(row.id);
      if (!existing || row.score > existing.score) {
        mergedById.set(row.id, row);
      }
    }

    const trimmed = selectMixedRecommendations(Array.from(mergedById.values()), 5);

    try {
      const recommendations = await prisma.$transaction(async (tx) => {
        await tx.projectRecommendation.deleteMany({ where: { projectId } });

        if (trimmed.length > 0) {
          await tx.projectRecommendation.createMany({
            data: trimmed.map((row) => ({
              projectId,
              catalogItemId: row.id,
              reason: row.reason,
              score: row.score,
              sourceModel: modelUsed,
              state: "PENDING",
              requiredIncluded: row.requiredIncluded,
              optionalRecommended: row.optionalRecommended,
            })),
          });
        }

        return tx.projectRecommendation.findMany({
          where: { projectId },
          include: {
            catalogItem: {
              include: {
                collaterals: true,
              },
            },
          },
          orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        });
      });

      const lookup = new Map(trimmed.map((row) => [row.id, row]));
      return NextResponse.json({
        recommendations: recommendations.map((recommendation) => {
          const match = lookup.get(recommendation.catalogItemId);
          return {
            ...recommendation,
            certaintyPercent: match?.certaintyPercent ?? Math.round(Number(recommendation.score ?? 0) * 100),
            matchedCharacteristics: match?.matchedCharacteristics ?? [],
            shortReason: match?.shortReason ?? toShortReason(recommendation.reason),
          };
        }),
        signals,
      });
    } catch (error) {
      if (!isMissingTableOrColumnError(error)) {
        console.error("Recommendation persistence failed, returning ephemeral recommendations:", error);
      }

      // Compatibility fallback when recommendation persistence tables are missing.
      const recommendations = trimmed.map((row) => ({
        id: `ephemeral-${row.id}`,
        projectId,
        catalogItemId: row.id,
        reason: row.reason,
        shortReason: row.shortReason,
        score: row.score,
        sourceModel: modelUsed,
        state: "PENDING",
        requiredIncluded: row.requiredIncluded,
        optionalRecommended: row.optionalRecommended,
        certaintyPercent: row.certaintyPercent,
        matchedCharacteristics: row.matchedCharacteristics,
        catalogItem: {
          id: row.id,
          sku: row.sku,
          name: row.name,
          type: row.type,
          shortDescription: row.shortDescription,
          collaterals: row.collaterals ?? [],
        },
      }));
      return NextResponse.json({ recommendations, signals, persisted: false });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to match project requirements";
    if (message === "PROJECT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}
