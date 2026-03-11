import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

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
        const { baseId, optionId, attachmentIds, designOptionIds } = body;

        // Use a transaction for atomic commit
        const result = await prisma.$transaction(async (tx) => {
            // 1. Delete existing items from this design flow if we want to allow re-runs
            // Or just add them. For now, we'll just add. 
            // Better: use upsert or check existence.

            const itemsToCreate = [
                { catalogItemId: baseId, quantity: 1 },
                ...(optionId ? [{ catalogItemId: optionId, quantity: 1 }] : []),
                ...attachmentIds.map((id: string) => ({ catalogItemId: id, quantity: 1 }))
            ];

            const createdItems = [];

            for (const itemData of itemsToCreate) {
                const item = await tx.projectItem.upsert({
                    where: {
                        projectId_catalogItemId: {
                            projectId,
                            catalogItemId: itemData.catalogItemId
                        }
                    },
                    update: { quantity: itemData.quantity },
                    create: {
                        projectId,
                        catalogItemId: itemData.catalogItemId,
                        quantity: itemData.quantity
                    }
                });
                createdItems.push(item);
            }

            // 2. Link design options to the 'Option' item (or Base if no Option)
            const primaryItem = createdItems.find(it => it.catalogItemId === (optionId || baseId));
            
            if (primaryItem && designOptionIds && designOptionIds.length > 0) {
                // Clear existing
                await (tx as any).projectItemDesignOption.deleteMany({
                    where: { projectItemId: primaryItem.id }
                });

                // Add new
                await (tx as any).projectItemDesignOption.createMany({
                    data: designOptionIds.map((termId: string) => ({
                        projectItemId: primaryItem.id,
                        taxonomyTermId: termId
                    }))
                });
            }

            return createdItems;
        });

        return NextResponse.json({ success: true, items: result }, { status: 201 });
    } catch (error) {
        console.error("Error committing design:", error);
        return NextResponse.json({ error: "Failed to commit design" }, { status: 500 });
    }
}
