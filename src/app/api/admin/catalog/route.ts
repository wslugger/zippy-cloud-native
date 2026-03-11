import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    const where = {
        AND: [
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { sku: { contains: search, mode: 'insensitive' as const } },
                ]
            } : {},
            type ? { type: type as any } : {}
        ]
    };

    try {
        const [items, total] = await Promise.all([
            prisma.catalogItem.findMany({
                where,
                include: {
                    attributes: { include: { term: true } },
                    pricing: { orderBy: { effectiveDate: 'desc' }, take: 1 },
                    childDependencies: { include: { childItem: true } },
                    constraints: true,
                } as any,
                orderBy: { name: 'asc' },
                take: limit,
                skip,
            }),
            prisma.catalogItem.count({ where }),
        ]);
        return NextResponse.json({ items, total, page, limit });
    } catch (error) {
        console.error("GET CATALOG ERROR:", error);
        return NextResponse.json({ error: "Failed to fetch catalog items" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sku, name, shortDescription, detailedDescription, type, configSchema, constraints, assumptions, collaterals } = body;

        const item = await prisma.catalogItem.create({
            data: { 
                sku, 
                name, 
                shortDescription, 
                detailedDescription, 
                type, 
                configSchema,
                constraints: constraints ? {
                    create: constraints.map((c: any) => ({ description: c.description }))
                } : undefined,
                assumptions: assumptions ? {
                    create: assumptions.map((a: any) => ({ description: a.description }))
                } : undefined,
                collaterals: collaterals ? {
                    create: collaterals.map((c: any) => ({ 
                        title: c.title, 
                        documentUrl: c.documentUrl, 
                        type: c.type 
                     }))
                } : undefined,
                childDependencies: body.childDependencies ? {
                    create: body.childDependencies.map((d: any) => ({
                        childId: d.childId,
                        type: d.type,
                        quantityMultiplier: d.quantityMultiplier || 1
                    }))
                } : undefined,
                attributes: body.attributes ? {
                    create: body.attributes.map((a: any) => ({
                        taxonomyTermId: a.taxonomyTermId
                    }))
                } : undefined,
                pricing: body.pricing ? {
                    create: body.pricing.map((p: any) => ({
                        pricingModel: p.pricingModel || 'FLAT',
                        costMrc: p.costMrc || 0,
                        costNrc: p.costNrc || 0,
                        priceMrc: p.priceMrc || p.costMrc || 0,
                        priceNrc: p.priceNrc || p.costNrc || 0,
                    }))
                } : undefined
            } as any,
        });

        return NextResponse.json(item);
    } catch (error) {
        console.error("POST CATALOG ERROR:", error);
        return NextResponse.json({ error: "Failed to create catalog item" }, { status: 500 });
    }
}
