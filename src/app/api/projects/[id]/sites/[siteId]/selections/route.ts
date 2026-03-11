import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/projects/[id]/sites/[siteId]/selections
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string; siteId: string }> }
) {
    const { siteId } = await params;
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
    const { siteId } = await params;
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
    const { siteId } = await params;
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
