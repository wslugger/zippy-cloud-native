import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { calculateBOM } from "@/lib/bom-engine";
import { getSession } from "@/lib/auth";

// POST /api/projects/[id]/calculate
// Calculates BOM for all sites in a project
export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const project = await prisma.project.findUnique({
            where: { id, userId: session.userId },
            include: {
                sites: {
                    include: {
                        siteSelections: true,
                    },
                },
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const siteResults = await Promise.all(
            project.sites.map(async (site) => {
                const itemIds = site.siteSelections.map(s => s.catalogItemId);

                if (itemIds.length === 0) {
                    return {
                        siteId: site.id,
                        siteName: site.name,
                        bom: {
                            lineItems: [],
                            totals: { totalNrc: 0, totalMrc: 0, totalTcv: 0 },
                            termMonths: project.termMonths,
                            warnings: [],
                        },
                    };
                }

                // Build configValues map from selections
                const configValues: Record<string, Record<string, any>> = {};
                for (const sel of site.siteSelections) {
                    if (sel.configValues) {
                        configValues[sel.catalogItemId] = sel.configValues as Record<string, any>;
                    }
                }

                const bom = await calculateBOM(itemIds, {
                    termMonths: project.termMonths,
                    primaryServiceId: site.primaryServiceId ?? undefined,
                    configValues,
                });

                return {
                    siteId: site.id,
                    siteName: site.name,
                    bom,
                };
            })
        );

        // Aggregate totals across all sites
        const projectTotals = siteResults.reduce(
            (acc, site) => {
                acc.totalNrc += site.bom.totals.totalNrc;
                acc.totalMrc += site.bom.totals.totalMrc;
                return acc;
            },
            { totalNrc: 0, totalMrc: 0 }
        );

        const totalTcv = projectTotals.totalNrc + projectTotals.totalMrc * project.termMonths;

        return NextResponse.json({
            projectId: project.id,
            projectName: project.name,
            termMonths: project.termMonths,
            sites: siteResults,
            totals: { ...projectTotals, totalTcv },
        });
    } catch (error) {
        console.error("Project BOM error:", error);
        return NextResponse.json({ error: "Failed to calculate project BOM" }, { status: 500 });
    }
}
