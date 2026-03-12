import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { parseRequirementSignals } from "@/lib/requirement-signals";
import { Prisma } from "@prisma/client";

interface MatchCandidate {
  id: string;
  sku: string;
  name: string;
  shortDescription: string | null;
  detailedDescription: string | null;
  features: string[];
  constraints: string[];
  assumptions: string[];
  requiredIncluded: string[];
  optionalRecommended: string[];
  collaterals?: Array<{ id: string; title: string; documentUrl: string; type: string }>;
}

interface MatchResult {
  id: string;
  reason: string;
  score: number;
  matchedCharacteristics: string[];
}

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
  packageCompositions: Array<{ role: string; catalogItem: { name: string } }>;
  packagePolicies: Array<{
    operator: string;
    designOption?: { key?: string };
    values?: Array<{ designOptionValue?: { value?: string } }>;
  }>;
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
                id: true,
                sku: true,
                name: true,
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

function normalizeGeminiJson(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function fallbackMatch(candidates: MatchCandidate[], requirements: string): MatchResult[] {
  return candidates
    .map((candidate) => {
      const { matchedCharacteristics, score } = characteristicCoverage(candidate, requirements);

      return {
        id: candidate.id,
        reason: matchedCharacteristics.length > 0
          ? "Matched against key service characteristics from your requirements."
          : "General package fit based on available service composition.",
        score,
        matchedCharacteristics,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
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

    const packageCandidates = await loadPackageCandidates();

    const feasiblePackages = packageCandidates.filter((pkg) => isFeasibleBySignals(pkg.packagePolicies, signals));

    const candidates: MatchCandidate[] = feasiblePackages.map((pkg) => ({
      id: pkg.id,
      sku: pkg.sku,
      name: pkg.name,
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
      collaterals: pkg.collaterals ?? [],
    }));

    const promptTemplate =
      (await getConfigValue("PROMPT_PACKAGE_MATCH")) ??
      "You are a solution architect assistant. Recommend the best matching design package candidates based on customer requirements. Return JSON only.";
    const model = (await getConfigValue("GEMINI_MODEL")) ?? "gemini-1.5-flash";

    const candidateSummary = candidates
      .map(
        (candidate) =>
          `- id:${candidate.id} | sku:${candidate.sku} | name:${candidate.name} | short_desc:${candidate.shortDescription ?? "N/A"} | long_desc:${candidate.detailedDescription ?? "N/A"} | features:${candidate.features.join(", ") || "none"} | constraints:${candidate.constraints.join(", ") || "none"} | assumptions:${candidate.assumptions.join(", ") || "none"} | required:${candidate.requiredIncluded.join(", ") || "none"} | optional:${candidate.optionalRecommended.join(", ") || "none"}`
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

CUSTOMER REQUIREMENTS:
${combinedRequirements}

CANDIDATES:
${candidateSummary}

Return JSON only as an array of up to 5 objects with keys:
- id
- reason
- score (0-1 certainty)
- matchedCharacteristics (array with values from: name, short_description, long_description, features, constraints, assumptions).`;

    const apiKey = process.env.GEMINI_API_KEY;
    let matches: MatchResult[] = [];

    if (apiKey && candidates.length > 0) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
            }),
          }
        );

        if (geminiRes.ok) {
          const payload = await geminiRes.json();
          const rawText: string = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
          try {
            const parsed = JSON.parse(normalizeGeminiJson(rawText));
            if (Array.isArray(parsed)) {
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
            } else {
              matches = fallbackMatch(candidates, combinedRequirements);
            }
          } catch {
            matches = fallbackMatch(candidates, combinedRequirements);
          }
        } else {
          matches = fallbackMatch(candidates, combinedRequirements);
        }
      } catch {
        matches = fallbackMatch(candidates, combinedRequirements);
      }
    } else {
      matches = fallbackMatch(candidates, combinedRequirements);
    }

    const trimmed = matches
      .map((match) => {
        const candidate = candidates.find((c) => c.id === match.id);
        if (!candidate) return null;
        const normalizedScore = Math.max(0, Math.min(1, Number(match.score ?? 0)));
        const matchedCharacteristics = match.matchedCharacteristics.length > 0
          ? match.matchedCharacteristics
          : characteristicCoverage(candidate, combinedRequirements).matchedCharacteristics;
        const certaintyPercent = Math.round(normalizedScore * 100);
        const reason = match.reason.includes("Matched characteristics:")
          ? match.reason
          : `${match.reason} Matched characteristics: ${matchedCharacteristics.join(", ") || "general_fit"}.`;
        return {
          ...candidate,
          reason,
          score: normalizedScore,
          certaintyPercent,
          matchedCharacteristics,
        };
      })
      .filter((row): row is MatchCandidate & { reason: string; score: number; certaintyPercent: number; matchedCharacteristics: string[] } => Boolean(row))
      .slice(0, 5);

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
              sourceModel: model,
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
        score: row.score,
        sourceModel: model,
        state: "PENDING",
        requiredIncluded: row.requiredIncluded,
        optionalRecommended: row.optionalRecommended,
        certaintyPercent: row.certaintyPercent,
        matchedCharacteristics: row.matchedCharacteristics,
        catalogItem: {
          id: row.id,
          sku: row.sku,
          name: row.name,
          type: "PACKAGE",
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
