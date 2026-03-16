import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import {
    DEFAULT_REQUIREMENTS_MATCH_PROMPT,
    DEFAULT_REQUIREMENTS_MATCH_RULES,
    PROMPT_REQUIREMENTS_MATCH_KEY,
    PROMPT_REQUIREMENTS_MATCH_RULES_KEY,
} from "@/lib/recommendation-engine";

const ACTIVE_PROMPTS: Array<{ key: string; value: string; description: string }> = [
    {
        key: PROMPT_REQUIREMENTS_MATCH_KEY,
        value: DEFAULT_REQUIREMENTS_MATCH_PROMPT,
        description: "Canonical prompt for requirements analysis and service/package matching endpoints.",
    },
    {
        key: PROMPT_REQUIREMENTS_MATCH_RULES_KEY,
        value: DEFAULT_REQUIREMENTS_MATCH_RULES,
        description: "Scoring and ranking rules appended to requirements matching prompts.",
    },
    {
        key: "GEMINI_MODEL",
        value: "gemini-3.1-flash-lite-preview",
        description: "Primary Gemini model id for AI endpoints.",
    },
    {
        key: "PROMPT_DESIGN_EXEC_SUMMARY",
        value: "Write the executive summary for this telecom/network design document in paragraph form. Reference the project name and customer by name. Enumerate selected packages and their key service composition. Highlight significant design option selections and architecture intent in business terms. Tone: clear, concise, business-oriented, and implementation-aware. Length: 150-220 words. Do not invent facts that are not in context.",
        description: "Prompt for design document executive summary generation.",
    },
    {
        key: "PROMPT_DESIGN_CONCLUSIONS",
        value: "Write the conclusions section for this telecom/network design document in paragraph form. Assess design completeness based on feature coverage. Explicitly note any feature gaps where status is NOT_AVAILABLE. State readiness for BOM/commercial validation and recommend clear next steps. Tone: direct and actionable. Length: 100-160 words. Do not invent facts that are not in context.",
        description: "Prompt for design document conclusions generation.",
    },
];

const ACTIVE_PROMPT_KEYS = new Set(ACTIVE_PROMPTS.map((prompt) => prompt.key));
const DEPRECATED_PROMPT_KEYS = new Set([
    "PROMPT_PACKAGE_MATCH",
    "PROMPT_SA_SUGGEST",
    "PROMPT_BOM_GEN",
    "PROMPT_TRIAGE",
]);

async function ensureDefaultPrompts() {
    const [canonicalPrompt, legacyPackageMatch, legacySuggest] = await Promise.all([
        prisma.systemConfig.findUnique({
            where: { key: PROMPT_REQUIREMENTS_MATCH_KEY },
            select: { value: true },
        }),
        prisma.systemConfig.findUnique({
            where: { key: "PROMPT_PACKAGE_MATCH" },
            select: { value: true },
        }),
        prisma.systemConfig.findUnique({
            where: { key: "PROMPT_SA_SUGGEST" },
            select: { value: true },
        }),
    ]);

    if (!canonicalPrompt?.value) {
        const bootstrapValue =
            legacyPackageMatch?.value || legacySuggest?.value || DEFAULT_REQUIREMENTS_MATCH_PROMPT;
        await prisma.systemConfig.upsert({
            where: { key: PROMPT_REQUIREMENTS_MATCH_KEY },
            update: {},
            create: {
                key: PROMPT_REQUIREMENTS_MATCH_KEY,
                value: bootstrapValue,
                description: "Canonical prompt for requirements analysis and service/package matching endpoints.",
            },
        });
    }

    await Promise.all(
        ACTIVE_PROMPTS.filter((prompt) => prompt.key !== PROMPT_REQUIREMENTS_MATCH_KEY).map((prompt) =>
            prisma.systemConfig.upsert({
                where: { key: prompt.key },
                update: {},
                create: prompt,
            })
        )
    );

    // Promote legacy default to the new primary model, while preserving explicit custom choices.
    await prisma.systemConfig.updateMany({
        where: {
            key: "GEMINI_MODEL",
            value: {
                in: ["gemini-1.5-flash", "gemini-3-flash-preview"],
            },
        },
        data: { value: "gemini-3.1-flash-lite-preview", description: "Primary Gemini model id for AI matching endpoints." },
    });
}

export async function GET() {
    try {
        await ensureDefaultPrompts();
        const configs = await prisma.systemConfig.findMany({
            where: {
                key: { in: Array.from(ACTIVE_PROMPT_KEYS) },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return NextResponse.json(configs);
    } catch (error) {
        console.error("GET PROMPTS ERROR:", error);
        return NextResponse.json({ error: "Failed to fetch AI prompts" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { key, value, description } = body;

        if (!key || !value) {
            return NextResponse.json({ error: "'key' and 'value' are required" }, { status: 400 });
        }
        if (DEPRECATED_PROMPT_KEYS.has(key)) {
            return NextResponse.json(
                { error: `Prompt key '${key}' is deprecated and cannot be edited.` },
                { status: 400 }
            );
        }
        if (!ACTIVE_PROMPT_KEYS.has(key)) {
            return NextResponse.json(
                { error: `Prompt key '${key}' is not an active AI Prompt Logic key.` },
                { status: 400 }
            );
        }

        const config = await prisma.systemConfig.upsert({
            where: { key },
            update: { value, description },
            create: { key, value, description },
        });

        return NextResponse.json(config);
    } catch (error) {
        console.error("POST PROMPT ERROR:", error);
        return NextResponse.json({ error: "Failed to save AI prompt" }, { status: 500 });
    }
}
