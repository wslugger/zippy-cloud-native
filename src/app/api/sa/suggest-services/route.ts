import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

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

        // Fetch candidates: PACKAGE and SERVICE_FAMILY
        const candidates = await prisma.catalogItem.findMany({
            where: {
                type: { in: ['PACKAGE', 'SERVICE_FAMILY'] as any }
            },
            select: {
                id: true,
                sku: true,
                name: true,
                shortDescription: true,
                type: true
            }
        });

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            console.warn("GEMINI_API_KEY not set — falling back to name-match suggestions");
            return fallbackSuggestions(candidates, rawRequirements);
        }

        const catalogSummary = candidates.map(c =>
            `- id: ${c.id} | sku: ${c.sku} | name: ${c.name} | desc: ${c.shortDescription ?? 'N/A'}`
        ).join('\n');

        const prompt = `You are a solution architect assistant. Based on the customer requirements below, recommend up to 3 services from the catalog.

CUSTOMER REQUIREMENTS:
${rawRequirements}

AVAILABLE CATALOG ITEMS:
${catalogSummary}

Respond with a JSON array of up to 3 objects. Each object must have:
- "id": the catalog item id (exactly as listed above)
- "reason": a 1-2 sentence explanation of why this item matches the requirements

Only include items that genuinely match. If fewer than 3 are relevant, return fewer.
Respond ONLY with the JSON array, no markdown or extra text.`;

        const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
            console.error("Gemini API error:", await geminiRes.text());
            return fallbackSuggestions(candidates, rawRequirements);
        }

        const geminiData = await geminiRes.json();
        const rawText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

        let parsed: { id: string; reason: string }[] = [];
        try {
            parsed = JSON.parse(rawText.trim());
        } catch {
            console.error("Failed to parse Gemini response:", rawText);
            return fallbackSuggestions(candidates, rawRequirements);
        }

        const suggestions = parsed
            .map(suggestion => {
                const item = candidates.find(c => c.id === suggestion.id);
                if (!item) return null;
                return {
                    ...item,
                    description: item.shortDescription,
                    matchScore: 10,
                    reason: suggestion.reason,
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
    candidates: { id: string; sku: string; name: string; shortDescription: string | null; type: string }[],
    rawRequirements: string
) {
    const reqLower = rawRequirements.toLowerCase();
    const suggestions = candidates
        .map(item => {
            const nameLower = item.name.toLowerCase();
            let matchScore = 0;
            let reason = "";

            if (reqLower.includes(nameLower) || reqLower.includes(item.sku.toLowerCase())) {
                matchScore = 10;
                reason = `Directly matches your request for ${item.name}.`;
            } else if (nameLower.split(' ').some(word => word.length > 3 && reqLower.includes(word))) {
                matchScore = 5;
                reason = `Partially matches keywords in your requirements.`;
            }

            return { ...item, description: item.shortDescription, matchScore, reason };
        })
        .filter(item => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 3);

    return NextResponse.json({ suggestions });
}
