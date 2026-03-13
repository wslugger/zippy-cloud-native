import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { normalizeCatalogItemType } from "@/lib/catalog-item-types";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const rawType = searchParams.get('type');
    const type = normalizeCatalogItemType(rawType) ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    if (rawType && !type) {
        return NextResponse.json({ items: [], total: 0, page, limit });
    }

    const where = {
        AND: [
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { sku: { contains: search, mode: 'insensitive' as const } },
                ]
            } : {},
            type ? { type } : {}
        ]
    };

    try {
        // Keep the list endpoint resilient and fast: callers only need summary fields.
        const [items, total] = await Promise.all([
            prisma.catalogItem.findMany({
                where,
                select: {
                    id: true,
                    sku: true,
                    name: true,
                    shortDescription: true,
                    detailedDescription: true,
                    type: true,
                    createdAt: true,
                    updatedAt: true,
                },
                orderBy: { name: 'asc' },
                take: limit,
                skip,
            }),
            prisma.catalogItem.count({ where }),
        ]);
        return NextResponse.json({ items, total, page, limit });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to fetch catalog items";
        const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
        const prismaMeta = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined;

        console.error("GET CATALOG ERROR:", {
            message,
            code: prismaCode,
            meta: prismaMeta,
        });

        if (prismaCode === "P1001" || prismaCode === "P1002") {
            return NextResponse.json(
                { error: "Catalog database is unreachable. Check DATABASE_URL/network and retry.", code: prismaCode },
                { status: 503 }
            );
        }

        if (prismaCode === "P2021" || prismaCode === "P2022") {
            return NextResponse.json(
                { error: "Catalog schema is out of date. Run Prisma migrations/db push and retry.", code: prismaCode },
                { status: 500 }
            );
        }

        return NextResponse.json({ error: message, code: prismaCode }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sku, name, shortDescription, detailedDescription, type, configSchema, constraints, assumptions, collaterals } = body;

        if (!sku || !name || !type) {
            return NextResponse.json({ error: "'sku', 'name', and 'type' are required" }, { status: 400 });
        }

        const item = await prisma.$transaction(async (tx) => {
            return (tx.catalogItem as any).create({
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
                },
            });
        });

        return NextResponse.json(item, { status: 201 });
    } catch (error: any) {
        console.error("POST CATALOG ERROR:", error);
        require('fs').appendFileSync('/tmp/zippy_error.log', new Date().toISOString() + ' POST: ' + error.message + '\n' + error.stack + '\n');
        
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "An item with this SKU already exists" }, { status: 409 });
        }
        
        return NextResponse.json({ error: "Failed to create catalog item", details: error.message }, { status: 500 });
    }
}
