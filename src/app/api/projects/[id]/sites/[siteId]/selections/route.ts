import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

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
    } catch (error) {
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
        const { catalogItemId, quantity, configValues, role } = await request.json();

        if (!catalogItemId) {
            return NextResponse.json({ error: "'catalogItemId' is required" }, { status: 400 });
        }

        const selection = await prisma.siteSelection.upsert({
            where: { siteId_catalogItemId: { siteId, catalogItemId } },
            update: { quantity: quantity ?? 1, configValues, role },
            create: { siteId, catalogItemId, quantity: quantity ?? 1, configValues, role },
            include: {
                catalogItem: { include: { pricing: true } },
            },
        });

        return NextResponse.json(selection, { status: 201 });
    } catch (error) {
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
    } catch (error) {
        return NextResponse.json({ error: "Failed to remove selection" }, { status: 500 });
    }
}
