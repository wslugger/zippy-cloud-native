import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || undefined;

    try {
        const items = await prisma.catalogItem.findMany({
            where: {
                AND: [
                    search ? {
                        OR: [
                            { name: { contains: search, mode: 'insensitive' } },
                            { sku: { contains: search, mode: 'insensitive' } },
                        ]
                    } : {},
                    type ? { type: type as any } : {}
                ]
            },
            include: {
                attributes: {
                    include: { term: true }
                },
                pricing: true,
            },
            orderBy: { name: 'asc' },
        });
        return NextResponse.json(items);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch catalog items" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sku, name, description, type } = body;

        const item = await prisma.catalogItem.create({
            data: { sku, name, description, type },
        });

        return NextResponse.json(item);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create catalog item" }, { status: 500 });
    }
}
