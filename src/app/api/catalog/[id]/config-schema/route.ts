import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/catalog/[id]/config-schema
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const item = await prisma.catalogItem.findUnique({
            where: { id },
            select: { id: true, sku: true, name: true, configSchema: true },
        });

        if (!item) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        return NextResponse.json(item);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch config schema" }, { status: 500 });
    }
}

// PUT /api/catalog/[id]/config-schema
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const { configSchema } = await request.json();

        const item = await prisma.catalogItem.update({
            where: { id },
            data: { configSchema },
            select: { id: true, sku: true, name: true, configSchema: true },
        });

        return NextResponse.json(item);
    } catch (error) {
        return NextResponse.json({ error: "Failed to update config schema" }, { status: 500 });
    }
}
