import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    await assertProjectOwnership(projectId, session.userId);

    const recommendations = await prisma.projectRecommendation.findMany({
      where: { projectId },
      include: {
        catalogItem: {
          include: {
            collaterals: true,
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({
      recommendations: recommendations.map((rec) => ({
        ...rec,
        catalogItem: {
          ...rec.catalogItem,
          collaterals: rec.catalogItem.collaterals.map((c) => ({
            ...c,
            url: c.documentUrl,
          })),
        },
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch recommendations";
    if (message === "PROJECT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 });
  }
}
