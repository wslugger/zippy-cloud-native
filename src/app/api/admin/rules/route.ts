import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const dependencies = await prisma.itemDependency.findMany({
            include: {
                parentItem: true,
                childItem: true,
            },
        });
        return NextResponse.json(dependencies);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { parentId, childId, type, quantityMultiplier } = body;

        const dependency = await prisma.itemDependency.create({
            data: {
                parentId,
                childId,
                type,
                quantityMultiplier: parseInt(quantityMultiplier) || 1,
            },
        });

        return NextResponse.json(dependency);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }
}
