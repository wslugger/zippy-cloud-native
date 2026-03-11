import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/projects/[id]
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const project = await prisma.project.findUnique({
            where: { id, userId: session.userId },
            include: {
                items: {
                    include: {
                        catalogItem: true,
                        designOptions: {
                            include: { term: true }
                        }
                    } as any
                },
                sites: {
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
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        return NextResponse.json(project);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
    }
}

// PUT /api/projects/[id]
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { name, customerName, status, termMonths, rawRequirements } = await request.json();

        const project = await prisma.project.update({
            where: { id, userId: session.userId },
            data: { name, customerName, status, termMonths, rawRequirements },
        });

        return NextResponse.json(project);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
}

// DELETE /api/projects/[id]
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await prisma.project.delete({ where: { id, userId: session.userId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }
}
