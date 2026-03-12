import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { evaluatePackageSelections } from "@/lib/package-policy-engine";

async function verifyOwnership(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return "not_found";
    if (project.userId !== userId) return "forbidden";
    return "ok";
}

// GET /api/projects/[id]/sites/[siteId]/selections
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; siteId: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, siteId } = await params;
    const ownership = await verifyOwnership(projectId, session.userId);
    if (ownership === "not_found") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (ownership === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const selections = await prisma.siteSelection.findMany({
            where: { siteId },
            include: {
                catalogItem: {
                    include: {
                        pricing: true,
                        attributes: { include: { term: true } },
                    },
                },
            },
        });

        return NextResponse.json(selections);
    } catch {
        return NextResponse.json({ error: "Failed to fetch selections" }, { status: 500 });
    }
}

// POST /api/projects/[id]/sites/[siteId]/selections
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; siteId: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, siteId } = await params;
    const ownership = await verifyOwnership(projectId, session.userId);
    if (ownership === "not_found") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (ownership === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { catalogItemId, quantity, configValues, role, designOptionValues } = await request.json();

        if (!catalogItemId) {
            return NextResponse.json({ error: "'catalogItemId' is required" }, { status: 400 });
        }

        const existingSelections = await prisma.siteSelection.findMany({
            where: { siteId },
            select: {
                catalogItemId: true,
                quantity: true,
                configValues: true,
            },
        });

        const selectionMap = new Map<string, { quantity: number; configValues: Record<string, unknown>; designOptionValues?: Record<string, string | string[]> }>();
        for (const existing of existingSelections) {
            selectionMap.set(existing.catalogItemId, {
                quantity: existing.quantity,
                configValues: (existing.configValues as Record<string, unknown>) ?? {},
            });
        }

        selectionMap.set(catalogItemId, {
            quantity: quantity ?? 1,
            configValues: configValues ?? {},
            designOptionValues: designOptionValues ?? {},
        });

        const selectedCatalogItems = await prisma.catalogItem.findMany({
            where: { id: { in: Array.from(selectionMap.keys()) } },
            select: { id: true, type: true },
        });

        const packageIds = selectedCatalogItems.filter((item) => item.type === "PACKAGE").map((item) => item.id);

        let effectiveSelections = Array.from(selectionMap.entries()).map(([itemId, value]) => ({
            catalogItemId: itemId,
            quantity: value.quantity,
            configValues: value.configValues,
            designOptionValues: value.designOptionValues ?? {},
        }));

        const mergedForcedConfig: Record<string, Record<string, string | string[]>> = {};

        for (const packageId of packageIds) {
            const policyResult = await evaluatePackageSelections({
                packageId,
                scope: "SITE",
                selections: effectiveSelections,
            });

            if (policyResult.violations.some((v) => v.blocking)) {
                return NextResponse.json(
                    {
                        error: "Package policy validation failed",
                        packageId,
                        violations: policyResult.violations,
                        forcedConfig: policyResult.forcedConfig,
                    },
                    { status: 422 }
                );
            }

            effectiveSelections = policyResult.effectiveSelections.map((selection) => ({
                catalogItemId: selection.catalogItemId,
                quantity: selection.quantity,
                configValues: selection.configValues,
                designOptionValues: selection.designOptionValues,
            }));

            for (const [itemId, forced] of Object.entries(policyResult.forcedConfig)) {
                mergedForcedConfig[itemId] = { ...(mergedForcedConfig[itemId] ?? {}), ...forced };
            }
        }

        const savedSelections = await prisma.$transaction(async (tx) => {
            const rows = [];
            for (const selection of effectiveSelections) {
                const mergedConfig = { ...(selection.configValues ?? {}), ...(mergedForcedConfig[selection.catalogItemId] ?? {}) };
                const row = await tx.siteSelection.upsert({
                    where: { siteId_catalogItemId: { siteId, catalogItemId: selection.catalogItemId } },
                    update: {
                        quantity: selection.quantity ?? 1,
                        configValues: mergedConfig,
                        role: selection.catalogItemId === catalogItemId ? role : undefined,
                    },
                    create: {
                        siteId,
                        catalogItemId: selection.catalogItemId,
                        quantity: selection.quantity ?? 1,
                        configValues: mergedConfig,
                        role: selection.catalogItemId === catalogItemId ? role : undefined,
                    },
                    include: {
                        catalogItem: { include: { pricing: true } },
                    },
                });
                rows.push(row);
            }
            return rows;
        });

        return NextResponse.json(
            {
                selection: savedSelections.find((row) => row.catalogItemId === catalogItemId),
                effectiveSelections: savedSelections,
                forcedConfig: mergedForcedConfig,
            },
            { status: 201 }
        );
    } catch {
        return NextResponse.json({ error: "Failed to add selection" }, { status: 500 });
    }
}

// DELETE /api/projects/[id]/sites/[siteId]/selections?catalogItemId=xxx
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; siteId: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId, siteId } = await params;
    const ownership = await verifyOwnership(projectId, session.userId);
    if (ownership === "not_found") return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (ownership === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const catalogItemId = searchParams.get('catalogItemId');

    if (!catalogItemId) {
        return NextResponse.json({ error: "'catalogItemId' query param is required" }, { status: 400 });
    }

    try {
        await prisma.siteSelection.delete({
            where: { siteId_catalogItemId: { siteId, catalogItemId } },
        });

        return new NextResponse(null, { status: 204 });
    } catch {
        return NextResponse.json({ error: "Failed to remove selection" }, { status: 500 });
    }
}
