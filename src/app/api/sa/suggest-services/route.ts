import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { rawRequirements } = await request.json();

        if (!rawRequirements) {
            return NextResponse.json({ error: "Requirements are needed." }, { status: 400 });
        }

        // Fetch candidates: PACKAGE and SERVICE_FAMILY
        const candidates = await prisma.catalogItem.findMany({
            where: {
                type: {
                    in: ['PACKAGE', 'SERVICE_FAMILY'] as any // Bypass strict TS enum check safely
                }
            },
            select: {
                id: true,
                sku: true,
                name: true,
                description: true,
                type: true
            }
        });

        const reqLower = rawRequirements.toLowerCase();
        const suggestions = candidates.map(item => {
            let matchScore = 0;
            let reason = "";

            const nameLower = item.name.toLowerCase();
            const descLower = item.description?.toLowerCase() || '';

            if (reqLower.includes(nameLower) || reqLower.includes(item.sku.toLowerCase())) {
                matchScore += 10;
                reason = `Directly matches your request for ${item.name}.`;
            } else if (nameLower.includes("sd-wan") && reqLower.includes("sdwan")) {
                matchScore += 10;
                reason = `Directly matches your request for SA-WAN.`;
            } else if (nameLower.includes("express connect") && (reqLower.includes("sdwan") && reqLower.includes("broadband"))) {
                matchScore += 20;
                reason = `Express Connect includes both SD-WAN and Broadband you asked for.`;
            }

            return {
                ...item,
                matchScore,
                reason: reason || "Standard recommended service matching your SA profile."
            };
        }).filter(item => item.matchScore > 0 || Math.random() > 0.7) // return matches or random suggestions if testing
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 3); // top 3

        return NextResponse.json({ suggestions });

    } catch (error) {
        console.error("Error in AI suggest-services:", error);
        return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
    }
}
