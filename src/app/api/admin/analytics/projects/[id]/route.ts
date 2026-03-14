import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        customerName: true,
        status: true,
        workflowStage: true,
        termMonths: true,
        rawRequirements: true,
        manualNotes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        requirementDocs: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            status: true,
            createdAt: true,
            extractedText: true,
          },
        },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            catalogItemId: true,
            quantity: true,
            createdAt: true,
            catalogItem: {
              select: {
                id: true,
                sku: true,
                name: true,
                type: true,
                collaterals: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    documentUrl: true,
                  },
                },
              },
            },
          },
        },
        recommendations: {
          orderBy: [{ score: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            catalogItemId: true,
            state: true,
            score: true,
            reason: true,
            sourceModel: true,
            createdAt: true,
            catalogItem: {
              select: {
                id: true,
                sku: true,
                name: true,
                type: true,
              },
            },
          },
        },
        recommendationRuns: {
          orderBy: { createdAt: "desc" },
          take: 25,
          select: {
            id: true,
            sourceModel: true,
            recommendationCount: true,
            createdAt: true,
            user: {
              select: { id: true, email: true, name: true },
            },
            items: {
              orderBy: { rank: "asc" },
              select: {
                id: true,
                rank: true,
                catalogItemId: true,
                score: true,
                certaintyPercent: true,
                reason: true,
                shortReason: true,
                matchedCharacteristics: true,
                coverageAreas: true,
                riskFactors: true,
                catalogItem: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
        events: {
          orderBy: { createdAt: "desc" },
          take: 300,
          select: {
            id: true,
            eventType: true,
            workflowStage: true,
            catalogItemId: true,
            collateralId: true,
            metadata: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
            catalogItem: {
              select: {
                id: true,
                sku: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch project analytics detail";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
