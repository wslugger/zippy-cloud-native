import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  buildDesignDocumentModel,
  updateDraftDesignDocument,
  type DesignDocumentModel,
} from "@/lib/design-document";
import { getSystemConfigValue, normalizeGeminiJson } from "@/lib/recommendation-engine";

type GenerationTarget = "executiveSummary" | "conclusions";

const DEFAULT_EXECUTIVE_PROMPT = [
  "Write an executive summary for a technical design document.",
  "Tone: clear, concise, business-oriented, and implementation-aware.",
  "Include: architecture intent, key selected service/package choices, major design option decisions, and what this means for delivery.",
  "Do not invent facts that are not in context.",
].join(" ");

const DEFAULT_CONCLUSIONS_PROMPT = [
  "Write the conclusions section for a technical design document.",
  "Tone: direct and actionable.",
  "Include: readiness status, main implementation considerations, and next-step focus for BOM/commercialization.",
  "Do not invent facts that are not in context.",
].join(" ");

function summarizeModel(model: DesignDocumentModel): string {
  const sectionLines = model.sections.map((section) => {
    if (section.kind === "PACKAGE") {
      const services = section.services
        .map((service) => {
          const selectedDesignOptions = service.designOptions
            .filter((option) => option.selectedValues.length > 0)
            .map((option) => `${option.label}: ${option.selectedValues.map((value) => value.label).join(", ")}`)
            .join(" | ");

          const selectedServiceOptions = service.serviceOptions
            .filter((serviceOption) => serviceOption.selected)
            .map((serviceOption) => serviceOption.name)
            .join(", ");

          const featureStatus = service.features
            .map((feature) => `${feature.label}=${feature.status}`)
            .join(", ");

          return `service=${service.name}; selected=${service.selected}; design_options=${selectedDesignOptions || "none"}; service_options=${selectedServiceOptions || "none"}; features=${featureStatus || "none"}`;
        })
        .join(" || ");

      const packageFeatures = section.features
        .map((feature) => `${feature.label}=${feature.status}`)
        .join(", ");

      return `PACKAGE ${section.name}: features=${packageFeatures || "none"}; services=${services || "none"}`;
    }

    const selectedDesignOptions = section.designOptions
      .filter((option) => option.selectedValues.length > 0)
      .map((option) => `${option.label}: ${option.selectedValues.map((value) => value.label).join(", ")}`)
      .join(" | ");

    const selectedServiceOptions = section.serviceOptions
      .filter((serviceOption) => serviceOption.selected)
      .map((serviceOption) => serviceOption.name)
      .join(", ");

    const featureStatus = section.features
      .map((feature) => `${feature.label}=${feature.status}`)
      .join(", ");

    return `SERVICE ${section.name}: design_options=${selectedDesignOptions || "none"}; service_options=${selectedServiceOptions || "none"}; features=${featureStatus || "none"}`;
  });

  return [
    `project=${model.projectName}`,
    model.customerName ? `customer=${model.customerName}` : "customer=none",
    `sections=${model.sections.length}`,
    ...sectionLines,
  ].join("\n");
}

async function invokeGeminiDocumentDraft(params: {
  prompt: string;
  modelCandidates: string[];
  apiKey: string;
}): Promise<{ executiveSummary: string; conclusions: string; modelUsed: string } | null> {
  for (const modelName of params.modelCandidates) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${params.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: params.prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1200,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      const parsed = JSON.parse(normalizeGeminiJson(rawText)) as {
        executiveSummary?: unknown;
        conclusions?: unknown;
      };

      if (typeof parsed.executiveSummary !== "string" || typeof parsed.conclusions !== "string") {
        continue;
      }

      const executiveSummary = parsed.executiveSummary.trim();
      const conclusions = parsed.conclusions.trim();
      if (!executiveSummary || !conclusions) {
        continue;
      }

      return { executiveSummary, conclusions, modelUsed: modelName };
    } catch {
      continue;
    }
  }

  return null;
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
  const existing = await buildDesignDocumentModel({ projectId, userId: session.userId });
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    targets?: GenerationTarget[];
  };

  const targets = Array.isArray(body.targets)
    ? body.targets.filter((target): target is GenerationTarget => target === "executiveSummary" || target === "conclusions")
    : (["executiveSummary", "conclusions"] as GenerationTarget[]);

  if (targets.length === 0) {
    return NextResponse.json({ error: "No generation targets provided" }, { status: 400 });
  }

  const context = summarizeModel(existing);
  const execPrompt =
    (await getSystemConfigValue("PROMPT_DESIGN_EXEC_SUMMARY")) ?? DEFAULT_EXECUTIVE_PROMPT;
  const conclusionsPrompt =
    (await getSystemConfigValue("PROMPT_DESIGN_CONCLUSIONS")) ?? DEFAULT_CONCLUSIONS_PROMPT;

  const compoundPrompt = [
    "You are generating two sections for a telecom/network design document.",
    "Return JSON only with keys: executiveSummary, conclusions.",
    `Executive summary instruction: ${execPrompt}`,
    `Conclusions instruction: ${conclusionsPrompt}`,
    "Context:",
    context,
    "Output requirements:",
    "- executiveSummary: 120-220 words.",
    "- conclusions: 80-160 words.",
    "- Keep wording grounded in context only.",
  ].join("\n\n");

  const apiKey = process.env.GEMINI_API_KEY;
  const primaryModel = (await getSystemConfigValue("GEMINI_MODEL")) ?? "gemini-3.1-flash-lite-preview";
  const fallbackModel = "gemini-2.5-flash";
  const modelCandidates = Array.from(new Set([primaryModel, fallbackModel]));

  let generatedExecutiveSummary = existing.executiveSummary;
  let generatedConclusions = existing.conclusions;
  let modelUsed: string | null = null;

  if (apiKey) {
    const generated = await invokeGeminiDocumentDraft({
      prompt: compoundPrompt,
      modelCandidates,
      apiKey,
    });

    if (generated) {
      modelUsed = generated.modelUsed;
      if (targets.includes("executiveSummary")) {
        generatedExecutiveSummary = generated.executiveSummary;
      }
      if (targets.includes("conclusions")) {
        generatedConclusions = generated.conclusions;
      }
    }
  }

  if (!modelUsed) {
    if (targets.includes("executiveSummary")) {
      generatedExecutiveSummary = `This design document summarizes the selected project architecture for ${existing.projectName}. It reflects package and service choices currently configured in the catalog-driven design flow, including service options, design option selections, and fixed feature coverage states. The selected design is presented as an implementation baseline with technical detail mapped directly to catalog definitions.`;
    }

    if (targets.includes("conclusions")) {
      generatedConclusions = `The design is positioned for downstream BOM development using fixed feature states and explicit design-option selections. Implementation teams should proceed with commercial validation and deployment planning against the catalog-aligned service set captured in this document.`;
    }
  }

  await updateDraftDesignDocument({
    projectId,
    executiveSummary: generatedExecutiveSummary,
    conclusions: generatedConclusions,
    generatorModel: modelUsed,
    generationMeta: {
      targets,
      generatedAt: new Date().toISOString(),
      usedFallback: modelUsed === null,
    },
  });

  const updated = await buildDesignDocumentModel({ projectId, userId: session.userId });
  if (!updated) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...updated,
    generation: {
      modelUsed: modelUsed ?? "fallback-template",
      targets,
    },
  });
}
