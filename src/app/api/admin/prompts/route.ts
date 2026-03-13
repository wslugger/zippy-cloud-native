import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const DEFAULT_PROMPTS: Array<{ key: string; value: string; description: string }> = [
    {
        key: "PROMPT_PACKAGE_MATCH",
        value: "You are a solution architect assistant. Analyze package candidates across name, short description, detailed description, features, constraints, assumptions, and included components. Prefer packages when they provide broader, lower-risk requirement coverage than individual services.",
        description: "Prompt for package matching endpoint.",
    },
    {
        key: "PROMPT_SA_SUGGEST",
        value: "You are a solution architect assistant. Evaluate catalog candidates using detailed description, features, constraints, assumptions, and requirement fit. Prefer package recommendations over individual services when package coverage and risk are equal or better.",
        description: "Prompt for service/package suggestion endpoint.",
    },
    {
        key: "GEMINI_MODEL",
        value: "gemini-3.1-flash-lite-preview",
        description: "Primary Gemini model id for AI matching endpoints.",
    },
    {
        key: "PROMPT_BOM_GEN",
        value: "You are a Network Solution Architect. Based on the site requirements, select the most appropriate SKUs from the catalog.",
        description: "Primary system prompt for BOM generation logic.",
    },
    {
        key: "PROMPT_TRIAGE",
        value: "Analyze the user input and determine which technical stack is required (SD-WAN, LAN, or WLAN).",
        description: "Prompt for initial project triage.",
    },
];

async function ensureDefaultPrompts() {
    await Promise.all(
        DEFAULT_PROMPTS.map((prompt) =>
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
                OR: [
                    { key: { startsWith: 'PROMPT_' } },
                    { key: 'GEMINI_MODEL' },
                ],
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
