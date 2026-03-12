import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

async function verifyOwnership(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return "not_found";
    if (project.userId !== userId) return "forbidden";
    return "ok";
}

// GET /api/projects/[id]/sites/[siteId]
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
        const site = await prisma.solutionSite.findUnique({
            where: { id: siteId },
            include: {
                primaryService: true,
                siteSelections: {
                    include: {
                        catalogItem: {
                            include: {
                                pricing: true,
                                attributes: { include: { term: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!site) {
            return NextResponse.json({ error: "Site not found" }, { status: 404 });
        }

        return NextResponse.json(site);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch site" }, { status: 500 });
    }
}

// PUT /api/projects/[id]/sites/[siteId]
export async function PUT(
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
        const { name, address, primaryServiceId } = await request.json();

        const site = await prisma.solutionSite.update({
            where: { id: siteId },
            data: { name, address, primaryServiceId },
        });

        return NextResponse.json(site);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update site" }, { status: 500 });
    }
}

// DELETE /api/projects/[id]/sites/[siteId]
export async function DELETE(
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
        await prisma.solutionSite.delete({ where: { id: siteId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete site" }, { status: 500 });
    }
}
