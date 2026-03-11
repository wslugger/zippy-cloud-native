import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/projects/[id]/sites/[siteId]
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; siteId: string }> }
) {
    const { siteId } = await params;
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
    const { siteId } = await params;
    try {
        const { name, address, region, primaryServiceId } = await request.json();

        const site = await prisma.solutionSite.update({
            where: { id: siteId },
            data: { name, address, region, primaryServiceId },
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
    const { siteId } = await params;
    try {
        await prisma.solutionSite.delete({ where: { id: siteId } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to delete site" }, { status: 500 });
    }
}
