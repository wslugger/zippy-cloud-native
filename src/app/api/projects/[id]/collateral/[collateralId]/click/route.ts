import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { getProjectWorkflowStage, recordProjectEvent } from "@/lib/project-analytics";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; collateralId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId, collateralId } = await params;

  try {
    await assertProjectOwnership(projectId, session.userId);

    const item = await prisma.projectItem.findFirst({
      where: {
        projectId,
        catalogItem: {
          collaterals: {
            some: { id: collateralId },
          },
        },
      },
      select: {
        catalogItemId: true,
        catalogItem: {
          select: {
            name: true,
            collaterals: {
              where: { id: collateralId },
              select: {
                id: true,
                title: true,
                type: true,
                documentUrl: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    const collateral = item?.catalogItem.collaterals[0];
    if (!item || !collateral) {
      return NextResponse.json({ error: "Collateral not found for this project" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const workflowStage = await getProjectWorkflowStage(tx, projectId);
      await recordProjectEvent(tx, {
        projectId,
        userId: session.userId,
        eventType: "COLLATERAL_CLICKED",
        workflowStage,
        catalogItemId: item.catalogItemId,
        collateralId: collateral.id,
        metadata: {
          title: collateral.title,
          type: collateral.type,
          itemName: item.catalogItem.name,
        },
      });
    });

    return NextResponse.redirect(collateral.documentUrl, { status: 302 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process collateral click";
    if (message === "PROJECT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to process collateral click" }, { status: 500 });
  }
}
