import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// GET /api/projects/[id]/sites
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (project.userId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const sites = await prisma.solutionSite.findMany({
            where: { projectId },
            include: {
                primaryService: true,
                siteSelections: {
                    include: {
                        catalogItem: { include: { pricing: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json(sites);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch sites" }, { status: 500 });
    }
}

// POST /api/projects/[id]/sites
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (project.userId !== session.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    try {
        const { name, address, region, primaryServiceId } = await request.json();

        if (!name) {
            return NextResponse.json({ error: "'name' is required" }, { status: 400 });
        }

        const site = await prisma.solutionSite.create({
            data: { projectId, name, address, region, primaryServiceId },
        });

        return NextResponse.json(site, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create site" }, { status: 500 });
    }
}
