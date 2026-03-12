import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; recId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, recId } = await params;

  try {
    await assertProjectOwnership(projectId, session.userId);

    const recommendation = await prisma.projectRecommendation.findUnique({
      where: { id: recId },
      include: {
        catalogItem: {
          include: {
            packageCompositions: {
              include: { catalogItem: true },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    });

    if (!recommendation || recommendation.projectId !== projectId) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 404 });
    }

    const selectedIds = new Set<string>([recommendation.catalogItemId]);

    if (recommendation.catalogItem.type === "PACKAGE") {
      recommendation.catalogItem.packageCompositions
        .filter((row) => row.role === "REQUIRED" || row.role === "AUTO_INCLUDED")
        .forEach((row) => selectedIds.add(row.catalogItemId));
    }

    const effectiveSelections = await prisma.$transaction(async (tx) => {
      for (const catalogItemId of selectedIds) {
        await tx.projectItem.upsert({
          where: {
            projectId_catalogItemId: {
              projectId,
              catalogItemId,
            },
          },
          update: { quantity: 1 },
          create: {
            projectId,
            catalogItemId,
            quantity: 1,
          },
        });
      }

      await tx.projectRecommendation.update({
        where: { id: recId },
        data: { state: "ADOPTED" },
      });

      return tx.projectItem.findMany({
        where: { projectId, catalogItemId: { in: Array.from(selectedIds) } },
        include: {
          catalogItem: {
            include: {
              collaterals: true,
            },
          },
        },
      });
    });

    const collaterals = effectiveSelections.flatMap((item) =>
      item.catalogItem.collaterals.map((c) => ({
        id: c.id,
        itemId: item.catalogItemId,
        itemName: item.catalogItem.name,
        title: c.title,
        type: c.type,
        documentUrl: c.documentUrl,
      }))
    );

    return NextResponse.json({
      adoptedRecommendationId: recId,
      effectiveSelections,
      collaterals,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to adopt recommendation";
    if (message === "PROJECT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to adopt recommendation" }, { status: 500 });
  }
}
