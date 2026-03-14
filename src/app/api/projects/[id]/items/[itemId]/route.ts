import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordProjectEvent, getProjectWorkflowStage } from "@/lib/project-analytics";

// DELETE /api/projects/[id]/items/[itemId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id, userId: session.userId },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const item = await prisma.projectItem.findUnique({
      where: { id: itemId },
      select: { id: true, projectId: true, catalogItemId: true },
    });

    if (!item || item.projectId !== id) {
      return NextResponse.json({ error: "Project item not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.projectItem.delete({
        where: { id: itemId },
      });

      const workflowStage = await getProjectWorkflowStage(tx, id);
      await recordProjectEvent(tx, {
        projectId: id,
        userId: session.userId,
        eventType: "SERVICE_REMOVED",
        workflowStage,
        catalogItemId: item.catalogItemId,
      });
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error removing project item:", error);
    return NextResponse.json({ error: "Failed to remove project item" }, { status: 500 });
  }
}
