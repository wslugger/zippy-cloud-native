import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { ItemType } from "@prisma/client";

// 10 requests per user per minute for the AI endpoint
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const CHARACTERISTICS = [
    "name",
    "short_description",
    "long_description",
    "features",
    "constraints",
    "assumptions",
] as const;

type MatchCharacteristic = (typeof CHARACTERISTICS)[number];

interface SuggestCandidate {
    id: string;
    sku: string;
    name: string;
    shortDescription: string | null;
    detailedDescription: string | null;
    type: string;
    features: string[];
    constraints: string[];
    assumptions: string[];
    requiredIncluded: string[];
    optionalRecommended: string[];
}

function tokens(input: string): string[] {
    return input.toLowerCase().split(/\W+/).filter((token) => token.length > 2);
}

function normalizeMatchedCharacteristics(value: unknown): MatchCharacteristic[] {
    if (!Array.isArray(value)) return [];
    const valid = new Set<string>(CHARACTERISTICS);
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.toLowerCase().trim())
        .filter((item): item is MatchCharacteristic => valid.has(item));
}

function evaluateCoverage(candidate: SuggestCandidate, requirements: string): { score: number; matchedCharacteristics: MatchCharacteristic[] } {
    const reqTokens = new Set(tokens(requirements));
    const rows: Array<{ key: MatchCharacteristic; text: string; weight: number }> = [
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

    for (const row of rows) {
        const rowTokens = tokens(row.text);
        if (rowTokens.length === 0) continue;
        totalWeight += row.weight;
        const hit = rowTokens.some((token) => reqTokens.has(token));
        if (hit) {
            matchedWeight += row.weight;
            matchedCharacteristics.push(row.key);
        }
    }

    let score = totalWeight > 0 ? Math.max(0.05, Math.min(0.99, matchedWeight / totalWeight)) : 0.1;
    if (candidate.type === ItemType.PACKAGE) {
        score = Math.min(0.99, score + 0.05);
    }
    return { score, matchedCharacteristics };
}

function toShortReason(reason: string): string {
    const normalized = reason.replace(/\s+/g, " ").trim();
    const withoutMatchedTail = normalized.split("Matched characteristics:")[0]?.trim() ?? normalized;
    const sentence = withoutMatchedTail.split(/(?<=[.!?])\s+/)[0] ?? withoutMatchedTail;
    return sentence.slice(0, 180);
}

async function getSystemConfigValue(key: string): Promise<string | null> {
    const row = await prisma.systemConfig.findUnique({
        where: { key },
        select: { value: true },
    });
    return row?.value ?? null;
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rl = rateLimit(`suggest:${session.userId}`, RATE_LIMIT, RATE_WINDOW_MS);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: "Too many requests. Please wait before trying again." },
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
                        'X-RateLimit-Remaining': '0',
                    },
                }
            );
        }

        const { rawRequirements } = await request.json();

        if (!rawRequirements) {
            return NextResponse.json({ error: "Requirements are needed." }, { status: 400 });
        }

        // Fetch candidates: PACKAGE, SERVICE_FAMILY, and MANAGED_SERVICE
        const candidatesRaw = await prisma.catalogItem.findMany({
            where: {
                type: { in: [ItemType.PACKAGE, ItemType.SERVICE_FAMILY, ItemType.MANAGED_SERVICE] }
            },
            include: {
                attributes: { include: { term: { select: { label: true, value: true } } } },
                constraints: { select: { description: true } },
                assumptions: { select: { description: true } },
                packageCompositions: {
                    include: {
                        catalogItem: {
                            select: { name: true },
                        },
                    },
                },
            }
        });
        const candidates: SuggestCandidate[] = candidatesRaw.map((item) => ({
            id: item.id,
            sku: item.sku,
            name: item.name,
            shortDescription: item.shortDescription,
            detailedDescription: item.detailedDescription,
            type: item.type,
            features: item.attributes.map((attr) => attr.term.label || attr.term.value).filter(Boolean) as string[],
            constraints: item.constraints.map((c) => c.description),
            assumptions: item.assumptions.map((a) => a.description),
            requiredIncluded: item.packageCompositions
                .filter((row) => row.role === "REQUIRED" || row.role === "AUTO_INCLUDED")
                .map((row) => row.catalogItem.name),
            optionalRecommended: item.packageCompositions
                .filter((row) => row.role === "OPTIONAL")
                .map((row) => row.catalogItem.name),
        }));

        const apiKey = process.env.GEMINI_API_KEY;
        const primaryModel = (await getSystemConfigValue("GEMINI_MODEL")) ?? "gemini-3.1-flash-lite-preview";
        const fallbackModel = "gemini-2.5-flash";
        const modelCandidates = Array.from(new Set([primaryModel, fallbackModel]));
        const promptTemplate =
            (await getSystemConfigValue("PROMPT_SA_SUGGEST")) ??
            "You are a solution architect assistant. Match customer requirements to the best catalog offerings.";

        if (!apiKey) {
            console.warn("GEMINI_API_KEY not set — falling back to name-match suggestions");
            return fallbackSuggestions(candidates, rawRequirements);
        }

        const catalogSummary = candidates.map(c =>
            `- id:${c.id} | type:${c.type} | sku:${c.sku} | name:${c.name} | short_desc:${c.shortDescription ?? 'N/A'} | long_desc:${c.detailedDescription ?? 'N/A'} | features:${c.features.join(', ') || 'none'} | constraints:${c.constraints.join(', ') || 'none'} | assumptions:${c.assumptions.join(', ') || 'none'} | required:${c.requiredIncluded.join(', ') || 'none'} | optional:${c.optionalRecommended.join(', ') || 'none'}`
        ).join('\n');

        const prompt = `${promptTemplate}

Evaluate candidates using all available aspects, with this priority:
1) Detailed description + short description + name relevance.
2) Feature coverage and capability fit.
3) Constraint and assumption compatibility/risk.
4) Prefer PACKAGE over individual services when fit is equal or better and it covers more requirements.
5) Choose an individual service only when package fit is weaker due gaps/constraints.

Based on the customer requirements below, recommend up to 3 catalog items.

CUSTOMER REQUIREMENTS:
${rawRequirements}

AVAILABLE CATALOG ITEMS:
${catalogSummary}

Respond with a JSON array of up to 3 objects. Each object must have:
- "id": the catalog item id (exactly as listed above)
- "reason": a concise explanation (max 18 words) of why this item matches
- "score": a number from 0 to 1 certainty
- "matchedCharacteristics": array using only: name, short_description, long_description, features, constraints, assumptions

Only include items that genuinely match. If fewer than 3 are relevant, return fewer.
Respond ONLY with the JSON array, no markdown or extra text.`;

        let parsed: { id: string; reason: string; score?: number; matchedCharacteristics?: unknown }[] = [];
        let parsedFromGemini = false;

        for (const modelName of modelCandidates) {
            try {
                const geminiRes = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
                        }),
                    }
                );

                if (!geminiRes.ok) {
                    console.error(`Gemini API error (${modelName}):`, await geminiRes.text());
                    continue;
                }

                const geminiData = await geminiRes.json();
                const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
                parsed = JSON.parse(rawText.replace(/```json/gi, "").replace(/```/g, "").trim());
                parsedFromGemini = true;
                break;
            } catch (error) {
                console.error(`Gemini request/parse failed for ${modelName}:`, error);
            }
        }

        if (!parsedFromGemini) {
            return fallbackSuggestions(candidates, rawRequirements);
        }

        const suggestions = parsed
            .map(suggestion => {
                const item = candidates.find(c => c.id === suggestion.id);
                if (!item) return null;
                return {
                    ...item,
                    description: item.shortDescription,
                    certaintyPercent: Math.max(1, Math.round((suggestion.score ?? 0.85) * 100)),
                    matchScore: Math.max(1, Math.round((suggestion.score ?? 0.85) * 10)),
                    matchedCharacteristics: normalizeMatchedCharacteristics(suggestion.matchedCharacteristics),
                    shortReason: toShortReason(suggestion.reason),
                    reason: suggestion.reason.includes("Matched characteristics:")
                        ? suggestion.reason
                        : `${suggestion.reason} Matched characteristics: ${normalizeMatchedCharacteristics(suggestion.matchedCharacteristics).join(", ") || "general_fit"}.`,
                };
            })
            .filter(Boolean)
            .slice(0, 3);

        return NextResponse.json({ suggestions });

    } catch (error) {
        console.error("Error in AI suggest-services:", error);
        return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
    }
}

function fallbackSuggestions(
    candidates: SuggestCandidate[],
    rawRequirements: string
) {
    const suggestions = candidates
        .map(item => {
            const coverage = evaluateCoverage(item, rawRequirements);
            const certaintyPercent = Math.max(1, Math.round(coverage.score * 100));
            const reason = coverage.matchedCharacteristics.length > 0
                ? `Matched service characteristics from your requirements. Matched characteristics: ${coverage.matchedCharacteristics.join(', ')}.`
                : `General fit based on available service characteristics.`;
            return {
                ...item,
                description: item.shortDescription,
                certaintyPercent,
                matchScore: Math.max(1, Math.round(coverage.score * 10)),
                matchedCharacteristics: coverage.matchedCharacteristics,
                shortReason: toShortReason(reason),
                reason,
            };
        })
        .sort((a, b) => b.certaintyPercent - a.certaintyPercent)
        .slice(0, 3);

    return NextResponse.json({ suggestions });
}
