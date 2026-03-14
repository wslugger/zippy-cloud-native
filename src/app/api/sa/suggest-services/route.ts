import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  loadCandidates,
  buildCandidateSummary,
  buildPrompt,
  invokeGemini,
  fallbackTokenMatch,
  rankResults,
  selectTopRecommendations,
  getSystemConfigValue,
} from "@/lib/recommendation-engine";

// 10 requests per user per minute for the AI endpoint
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

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
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const { rawRequirements } = await request.json();

    if (!rawRequirements) {
      return NextResponse.json({ error: "Requirements are needed." }, { status: 400 });
    }

    const candidates = await loadCandidates();

    const apiKey = process.env.GEMINI_API_KEY;
    const primaryModel = (await getSystemConfigValue("GEMINI_MODEL")) ?? "gemini-3.1-flash-lite-preview";
    const fallbackModel = "gemini-2.5-flash";
    const modelCandidates = Array.from(new Set([primaryModel, fallbackModel]));
    const promptTemplate =
      (await getSystemConfigValue("PROMPT_SA_SUGGEST")) ??
      "You are a solution architect assistant. Match customer requirements to the best catalog offerings.";

    if (!apiKey) {
      console.warn("GEMINI_API_KEY not set — falling back to token-match suggestions");
      const fallbackResults = fallbackTokenMatch(candidates, rawRequirements);
      const ranked = rankResults(fallbackResults, candidates);
      const suggestions = selectTopRecommendations(ranked, 3).map(toSuggestion);
      return NextResponse.json({ suggestions });
    }

    const candidateSummary = buildCandidateSummary(candidates);
    const prompt = buildPrompt(promptTemplate, rawRequirements, candidateSummary);
    const geminiResult = await invokeGemini(prompt, modelCandidates, apiKey);

    if (!geminiResult) {
      const fallbackResults = fallbackTokenMatch(candidates, rawRequirements);
      const ranked = rankResults(fallbackResults, candidates);
      const suggestions = selectTopRecommendations(ranked, 3).map(toSuggestion);
      return NextResponse.json({ suggestions });
    }

    const ranked = rankResults(geminiResult.results, candidates);
    const suggestions = selectTopRecommendations(ranked, 3).map(toSuggestion);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error in AI suggest-services:", error);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}

function toSuggestion(row: ReturnType<typeof rankResults>[number]) {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    type: row.type,
    description: row.shortDescription,
    shortDescription: row.shortDescription,
    detailedDescription: row.detailedDescription,
    features: row.features,
    constraints: row.constraints,
    assumptions: row.assumptions,
    requiredIncluded: row.requiredIncluded,
    optionalRecommended: row.optionalRecommended,
    reason: row.reason,
    shortReason: row.shortReason,
    certaintyPercent: row.certaintyPercent,
    matchScore: Math.max(1, Math.round(row.score * 10)),
    matchedCharacteristics: row.matchedCharacteristics,
    coverageAreas: row.coverageAreas,
    riskFactors: row.riskFactors,
  };
}
