import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { evaluatePackageSelections } from "@/lib/package-policy-engine";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId, userId: session.userId }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const body = await request.json();
        const { baseId, optionId, attachmentIds = [], designOptionIds, configValues, designOptionValues } = body;

        if (!baseId) {
            return NextResponse.json({ error: "baseId is required" }, { status: 400 });
        }

        const initialSelections = [
            { catalogItemId: baseId, quantity: 1, configValues: optionId ? {} : (configValues ?? {}), designOptionValues: optionId ? {} : (designOptionValues ?? {}) },
            ...(optionId ? [{ catalogItemId: optionId, quantity: 1, configValues: configValues ?? {}, designOptionValues: designOptionValues ?? {} }] : []),
            ...attachmentIds.map((id: string) => ({ catalogItemId: id, quantity: 1, configValues: {}, designOptionValues: {} })),
        ];

        const selectedCatalogItems = await prisma.catalogItem.findMany({
            where: { id: { in: initialSelections.map((s) => s.catalogItemId) } },
            select: { id: true, type: true },
        });

        const selectedPackageIds = selectedCatalogItems.filter((item) => item.type === "PACKAGE").map((item) => item.id);

        let policyResult = null;
        if (selectedPackageIds.length > 0) {
            policyResult = await evaluatePackageSelections({
                packageId: selectedPackageIds[0],
                scope: "PROJECT",
                selections: initialSelections,
            });

            if (policyResult.violations.some((v) => v.blocking)) {
                return NextResponse.json(
                    {
                        error: "Package policy validation failed",
                        violations: policyResult.violations,
                        forcedConfig: policyResult.forcedConfig,
                    },
                    { status: 422 }
                );
            }
        }

        const effectiveSelections = policyResult?.effectiveSelections ?? initialSelections.map((selection) => ({
            ...selection,
            autoAdded: false,
            designOptionValues: selection.designOptionValues ?? {},
        }));

        // Use a transaction for atomic commit
        const result = await prisma.$transaction(async (tx) => {
            // 1. Identify items to create/update
            const itemsToCreate = effectiveSelections.map((selection) => ({
                catalogItemId: selection.catalogItemId,
                quantity: selection.quantity ?? 1,
                config: Object.keys(selection.configValues ?? {}).length > 0 ? selection.configValues : null,
            }));

            const createdItems = [];

            for (const itemData of itemsToCreate) {
                const item = await tx.projectItem.upsert({
                    where: {
                        projectId_catalogItemId: {
                            projectId,
                            catalogItemId: itemData.catalogItemId
                        }
                    },
                    update: { 
                        quantity: itemData.quantity,
                        configValues: itemData.config || undefined
                    },
                    create: {
                        projectId,
                        catalogItemId: itemData.catalogItemId,
                        quantity: itemData.quantity,
                        configValues: itemData.config
                    }
                });
                createdItems.push(item);
            }

            // 2. Clear old items that are no longer in the selection
            // This is important for re-running the flow
            const currentItemIds = itemsToCreate.map(it => it.catalogItemId);
            await tx.projectItem.deleteMany({
                where: {
                    projectId,
                    catalogItemId: { notIn: currentItemIds }
                }
            });

            // 3. Link legacy taxonomy design options if any
            const primaryItemId = optionId || baseId;
            const primaryProjectItem = createdItems.find(it => it.catalogItemId === primaryItemId);
            
            if (primaryProjectItem && designOptionIds && designOptionIds.length > 0) {
                // Clear existing
                await tx.projectItemDesignOption.deleteMany({
                    where: { projectItemId: primaryProjectItem.id }
                });

                // Add new
                await tx.projectItemDesignOption.createMany({
                    data: designOptionIds.map((termId: string) => ({
                        projectItemId: primaryProjectItem.id,
                        taxonomyTermId: termId
                    }))
                });
            }

            return { createdItems, currentItemIds };
        });

        return NextResponse.json(
            {
                success: true,
                items: result.createdItems,
                effectiveSelections: policyResult?.effectiveSelections ?? result.currentItemIds,
                forcedConfig: policyResult?.forcedConfig ?? {},
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error committing design:", error);
        return NextResponse.json({ error: "Failed to commit design" }, { status: 500 });
    }
}
