import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { advanceProjectWorkflowStage, getProjectWorkflowStage, recordProjectEvent } from "@/lib/project-analytics";
import { parseRequirementSignals, isFeasibleBySignals } from "@/lib/requirement-signals";
import { ItemType, Prisma } from "@prisma/client";
import {
  loadCandidates,
  buildCandidateSummary,
  buildPrompt,
  invokeGemini,
  fallbackTokenMatch,
  rankResults,
  selectTopRecommendations,
  getSystemConfigValue,
  toShortReason,
  type RankedRecommendation,
} from "@/lib/recommendation-engine";

function isMissingTableOrColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2021" || error.code === "P2022";
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
    // --- Gather requirements ---
    let manualRequirements = "";
    try {
      const body = (await request.json()) as { rawRequirements?: string } | null;
      manualRequirements = body?.rawRequirements?.trim() ?? "";
    } catch {
      manualRequirements = "";
    }

    let project: { id: string; rawRequirements?: string | null; manualNotes?: string | null };
    try {
      project = await assertProjectOwnership(projectId, session.userId);
    } catch (error) {
      const isOwnershipError = error instanceof Error && error.message === "PROJECT_NOT_FOUND_OR_FORBIDDEN";
      const isSchemaError = isMissingTableOrColumnError(error);
      if (!isOwnershipError && !isSchemaError) throw error;

      let fallback: { id: string; rawRequirements: string | null; manualNotes: string | null } | null = null;
      try {
        fallback = await prisma.project.findFirst({
          where: { id: projectId, OR: [{ userId: session.userId }, { userId: null }] },
          select: { id: true, rawRequirements: true, manualNotes: true },
        });
      } catch (innerError) {
        if (!isMissingTableOrColumnError(innerError)) throw innerError;
        try {
          fallback = await prisma.project.findFirst({
            where: { id: projectId },
            select: { id: true, rawRequirements: true, manualNotes: true },
          });
        } catch (secondInnerError) {
          if (!isMissingTableOrColumnError(secondInnerError)) throw secondInnerError;
          const minimalFallback = await prisma.project.findFirst({
            where: { id: projectId },
            select: { id: true },
          });
          fallback = minimalFallback ? { id: minimalFallback.id, rawRequirements: null, manualNotes: null } : null;
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

    const combinedRequirements = manualRequirements
      ? manualRequirements
      : [project.manualNotes ?? "", project.rawRequirements ?? "", ...docs.map((doc) => doc.extractedText ?? "")]
          .filter(Boolean)
          .join("\n\n")
          .trim();

    if (!combinedRequirements) {
      return NextResponse.json(
        { error: "No project requirements found. Add manual text or upload documents first." },
        { status: 400 }
      );
    }

    // --- Load candidates and apply signal feasibility ---
    const signals = parseRequirementSignals(combinedRequirements);
    const allCandidates = await loadCandidates();

    // Mark signal feasibility on package candidates
    for (const candidate of allCandidates) {
      if (candidate.type === ItemType.PACKAGE) {
        // Re-check feasibility using the raw package policy data
        const item = await prisma.catalogItem.findUnique({
          where: { id: candidate.id },
          include: {
            packagePolicies: {
              where: { active: true },
              include: {
                designOption: true,
                values: { include: { designOptionValue: true } },
              },
            },
          },
        });
        if (item) {
          candidate.signalFeasible = isFeasibleBySignals(item.packagePolicies, signals);
          if (!candidate.signalFeasible) {
            candidate.designOptionRules.push(
              "Signal compatibility: one or more topology/breakout rules may conflict with requirements."
            );
          }
        }
      }
    }

    // --- Build prompt and invoke Gemini ---
    const promptTemplate =
      (await getSystemConfigValue("PROMPT_PACKAGE_MATCH")) ??
      "You are a solution architect assistant. Recommend the best matching catalog items based on customer requirements. Return JSON only.";
    const primaryModel = (await getSystemConfigValue("GEMINI_MODEL")) ?? "gemini-3.1-flash-lite-preview";
    const fallbackModel = "gemini-2.5-flash";
    const modelCandidates = Array.from(new Set([primaryModel, fallbackModel]));
    let modelUsed = primaryModel;

    const candidateSummary = buildCandidateSummary(allCandidates);
    const prompt = buildPrompt(promptTemplate, combinedRequirements, candidateSummary);

    const apiKey = process.env.GEMINI_API_KEY;
    let ranked: RankedRecommendation[];

    if (apiKey && allCandidates.length > 0) {
      const geminiResult = await invokeGemini(prompt, modelCandidates, apiKey);

      if (geminiResult) {
        modelUsed = geminiResult.modelUsed;
        ranked = rankResults(geminiResult.results, allCandidates);
      } else {
        const fallbackResults = fallbackTokenMatch(allCandidates, combinedRequirements);
        ranked = rankResults(fallbackResults, allCandidates);
      }
    } else {
      const fallbackResults = fallbackTokenMatch(allCandidates, combinedRequirements);
      ranked = rankResults(fallbackResults, allCandidates);
    }

    const trimmed = selectTopRecommendations(ranked, 5);

    // --- Persist recommendations ---
    try {
      const { recommendations, runId } = await prisma.$transaction(async (tx) => {
        const run = await tx.projectRecommendationRun.create({
          data: {
            projectId,
            userId: session.userId,
            sourceModel: modelUsed,
            recommendationCount: trimmed.length,
          },
        });

        if (trimmed.length > 0) {
          await tx.projectRecommendationRunItem.createMany({
            data: trimmed.map((row, index) => ({
              runId: run.id,
              catalogItemId: row.id,
              rank: index + 1,
              score: row.score,
              certaintyPercent: row.certaintyPercent,
              reason: row.reason,
              shortReason: row.shortReason,
              requiredIncluded: row.requiredIncluded,
              optionalRecommended: row.optionalRecommended,
              matchedCharacteristics: row.matchedCharacteristics,
              coverageAreas: row.coverageAreas,
              riskFactors: row.riskFactors,
            })),
          });
        }

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

        const recommendations = await tx.projectRecommendation.findMany({
          where: { projectId },
          include: { catalogItem: { include: { collaterals: true } } },
          orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        });

        if (trimmed.length > 0) {
          const workflowStage = await advanceProjectWorkflowStage(tx, projectId, "RECOMMENDATIONS_READY");
          await recordProjectEvent(tx, {
            projectId,
            userId: session.userId,
            eventType: "RECOMMENDATIONS_GENERATED",
            workflowStage: workflowStage ?? "RECOMMENDATIONS_READY",
            metadata: {
              runId: run.id,
              recommendationCount: trimmed.length,
              modelUsed,
            },
          });
        } else {
          const workflowStage = await getProjectWorkflowStage(tx, projectId);
          await recordProjectEvent(tx, {
            projectId,
            userId: session.userId,
            eventType: "RECOMMENDATIONS_GENERATED",
            workflowStage,
            metadata: {
              runId: run.id,
              recommendationCount: 0,
              modelUsed,
            },
          });
        }

        return { recommendations, runId: run.id };
      });

      const lookup = new Map(trimmed.map((row) => [row.id, row]));
      return NextResponse.json({
        recommendations: recommendations.map((rec) => {
          const match = lookup.get(rec.catalogItemId);
          return {
            ...rec,
            certaintyPercent: match?.certaintyPercent ?? Math.round(Number(rec.score ?? 0) * 100),
            matchedCharacteristics: match?.matchedCharacteristics ?? [],
            shortReason: match?.shortReason ?? toShortReason(rec.reason),
            coverageAreas: match?.coverageAreas ?? [],
            riskFactors: match?.riskFactors ?? [],
          };
        }),
        signals,
        runId,
      });
    } catch (error) {
      if (!isMissingTableOrColumnError(error)) {
        console.error("Recommendation persistence failed, returning ephemeral recommendations:", error);
      }

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
        coverageAreas: row.coverageAreas,
        riskFactors: row.riskFactors,
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
