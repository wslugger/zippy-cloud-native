import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/projects/[id]/sites
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;
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
    const { id: projectId } = await params;
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
