import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { normalizeCatalogItemType } from "@/lib/catalog-item-types";
import { NextResponse } from "next/server";
import { normalizeEquipmentPurpose } from "@/lib/equipment-catalog";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const rawType = searchParams.get('type');
    const type = normalizeCatalogItemType(rawType) ?? undefined;
    const rawPrimaryPurpose = searchParams.get('primaryPurpose');
    const primaryPurpose = normalizeEquipmentPurpose(rawPrimaryPurpose) ?? undefined;
    const rawSortBy = searchParams.get('sortBy') || 'name';
    const rawSortDir = searchParams.get('sortDir') || 'asc';
    const sortDir = rawSortDir.toLowerCase() === 'desc' ? 'desc' : 'asc';
    const sortBy = ['name', 'updatedAt'].includes(rawSortBy) ? rawSortBy : 'name';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const skip = (page - 1) * limit;

    if (rawType && !type) {
        return NextResponse.json({ items: [], total: 0, page, limit });
    }

    if (rawPrimaryPurpose && !primaryPurpose) {
        return NextResponse.json({ items: [], total: 0, page, limit });
    }

    const where: Prisma.CatalogItemWhereInput = {
        AND: [
            search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { sku: { contains: search, mode: 'insensitive' as const } },
                    { equipmentProfile: { make: { contains: search, mode: 'insensitive' as const } } },
                    { equipmentProfile: { model: { contains: search, mode: 'insensitive' as const } } },
                ]
            } : {},
            type ? { type } : {},
            primaryPurpose ? { primaryPurpose } : {},
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
                    primaryPurpose: true,
                    secondaryPurposes: true,
                    createdAt: true,
                    updatedAt: true,
                    equipmentProfile: {
                        select: {
                            make: true,
                            model: true,
                            reviewStatus: true,
                            vendorDatasheetUrl: true,
                        },
                    },
                },
                orderBy: { [sortBy]: sortDir },
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
        const primaryPurpose = normalizeEquipmentPurpose(body.primaryPurpose);
        const secondaryPurposes = Array.isArray(body.secondaryPurposes)
            ? body.secondaryPurposes.map((value: unknown) => normalizeEquipmentPurpose(value)).filter((value: unknown): value is NonNullable<typeof primaryPurpose> => Boolean(value))
            : [];
        const equipmentProfileInput = body.equipmentProfile;
        const canCreateEquipmentProfile = Boolean(
            equipmentProfileInput &&
            typeof equipmentProfileInput === 'object' &&
            typeof equipmentProfileInput.make === 'string' &&
            equipmentProfileInput.make.trim() &&
            typeof equipmentProfileInput.model === 'string' &&
            equipmentProfileInput.model.trim()
        );

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
                    primaryPurpose: primaryPurpose ?? undefined,
                    secondaryPurposes,
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
                    equipmentProfile: canCreateEquipmentProfile ? {
                        create: {
                            make: typeof equipmentProfileInput.make === 'string' ? equipmentProfileInput.make : '',
                            model: typeof equipmentProfileInput.model === 'string' ? equipmentProfileInput.model : '',
                            pricingSku: typeof equipmentProfileInput.pricingSku === 'string' ? equipmentProfileInput.pricingSku : null,
                            family: typeof equipmentProfileInput.family === 'string' ? equipmentProfileInput.family : null,
                            vendorDatasheetUrl: typeof equipmentProfileInput.vendorDatasheetUrl === 'string' ? equipmentProfileInput.vendorDatasheetUrl : null,
                            normalizedMakeModel: `${String(equipmentProfileInput.make ?? '').trim().toLowerCase()}::${String(equipmentProfileInput.model ?? '').trim().toLowerCase()}`,
                            reviewStatus: equipmentProfileInput.reviewStatus === 'REJECTED'
                                ? 'REJECTED'
                                : equipmentProfileInput.reviewStatus === 'DRAFT'
                                    ? 'DRAFT'
                                    : 'PUBLISHED',
                            wanSpec: equipmentProfileInput.wanSpec ? {
                                create: {
                                    throughputMbps: equipmentProfileInput.wanSpec.throughputMbps ?? null,
                                    vpnTunnels: equipmentProfileInput.wanSpec.vpnTunnels ?? null,
                                    cellularSupport: Boolean(equipmentProfileInput.wanSpec.cellularSupport),
                                    formFactor: equipmentProfileInput.wanSpec.formFactor ?? null,
                                    interfaces: Array.isArray(equipmentProfileInput.wanSpec.interfaces) ? equipmentProfileInput.wanSpec.interfaces : [],
                                }
                            } : undefined,
                            lanSpec: equipmentProfileInput.lanSpec ? {
                                create: {
                                    portCount: equipmentProfileInput.lanSpec.portCount ?? null,
                                    portSpeed: equipmentProfileInput.lanSpec.portSpeed ?? null,
                                    poeBudgetWatts: equipmentProfileInput.lanSpec.poeBudgetWatts ?? null,
                                    stackable: Boolean(equipmentProfileInput.lanSpec.stackable),
                                    uplinkPorts: Array.isArray(equipmentProfileInput.lanSpec.uplinkPorts) ? equipmentProfileInput.lanSpec.uplinkPorts : [],
                                }
                            } : undefined,
                            wlanSpec: equipmentProfileInput.wlanSpec ? {
                                create: {
                                    wifiStandard: equipmentProfileInput.wlanSpec.wifiStandard ?? null,
                                    maxClients: equipmentProfileInput.wlanSpec.maxClients ?? null,
                                    indoorOutdoor: equipmentProfileInput.wlanSpec.indoorOutdoor ?? null,
                                    radios: Array.isArray(equipmentProfileInput.wlanSpec.radios) ? equipmentProfileInput.wlanSpec.radios : [],
                                }
                            } : undefined,
                        }
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
