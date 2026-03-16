
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { normalizeCatalogItemType } from "@/lib/catalog-item-types";
import { normalizeEquipmentPurpose, normalizeEquipmentPurposeArray, normalizeMakeModelKey } from "@/lib/equipment-catalog";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const item = await prisma.catalogItem.findUnique({
            where: { id },
            include: {
                constraints: true,
                assumptions: true,
                collaterals: true,
                attributes: { include: { term: true } },
                equipmentProfile: {
                    include: {
                        wanSpec: true,
                        lanSpec: true,
                        wlanSpec: true,
                    },
                },
                pricing: {
                    orderBy: { effectiveDate: 'desc' },
                    take: 1
                },
                childDependencies: {
                    include: {
                        childItem: true
                    }
                },
                parentDependencies: {
                    include: {
                        parentItem: true
                    }
                }
            }
        });

        if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
        
        return NextResponse.json(item);
    } catch (error) {
        console.error("GET CATALOG ITEM ERROR:", error);
        return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        
        const item = await prisma.$transaction(async (tx) => {
            const existingItem = await tx.catalogItem.findUnique({
                where: { id },
                select: { type: true },
            });
            if (!existingItem) {
                throw new Error("Catalog item not found");
            }

            const resolvedType = normalizeCatalogItemType(body.type) ?? normalizeCatalogItemType(existingItem.type) ?? 'MANAGED_SERVICE';
            const primaryPurpose = normalizeEquipmentPurpose(body.primaryPurpose);
            const secondaryPurposes = normalizeEquipmentPurposeArray(body.secondaryPurposes).filter((purpose) => purpose !== primaryPurpose);

            // Update base fields
            const updated = await (tx.catalogItem as any).update({
                where: { id },
                data: {
                    name: body.name,
                    sku: body.sku,
                    type: resolvedType,
                    primaryPurpose: primaryPurpose ?? undefined,
                    secondaryPurposes,
                    shortDescription: body.shortDescription,
                    detailedDescription: body.detailedDescription,
                    configSchema: body.configSchema === undefined ? undefined : body.configSchema,
                }
            });

            // Update Constraints
            if (body.constraints) {
                await (tx.itemConstraint as any).deleteMany({ where: { itemId: id } });
                if (Array.isArray(body.constraints) && body.constraints.length > 0) {
                    await (tx.itemConstraint as any).createMany({
                        data: body.constraints.map((c: any) => ({
                            itemId: id,
                            description: c.description
                        }))
                    });
                }
            }

            // Update Assumptions
            if (body.assumptions) {
                await (tx.itemAssumption as any).deleteMany({ where: { itemId: id } });
                if (Array.isArray(body.assumptions) && body.assumptions.length > 0) {
                    await (tx.itemAssumption as any).createMany({
                        data: body.assumptions.map((a: any) => ({
                            itemId: id,
                            description: a.description
                        }))
                    });
                }
            }

            // Update Collateral
            if (body.collaterals) {
                await (tx.itemCollateral as any).deleteMany({ where: { itemId: id } });
                if (Array.isArray(body.collaterals) && body.collaterals.length > 0) {
                    await (tx.itemCollateral as any).createMany({
                        data: body.collaterals.map((c: any) => ({
                            itemId: id,
                            title: c.title || c.name,
                            documentUrl: c.documentUrl || c.url,
                            type: c.type
                        }))
                    });
                }
            }

            // Update Dependencies
            if (body.childDependencies) {
                await (tx.itemDependency as any).deleteMany({ where: { parentId: id } });
                if (Array.isArray(body.childDependencies) && body.childDependencies.length > 0) {
                    await (tx.itemDependency as any).createMany({
                        data: body.childDependencies.filter((d: any) => d.childId).map((d: any) => ({
                            parentId: id,
                            childId: d.childId,
                            type: d.type || 'REQUIRED',
                            quantityMultiplier: d.quantityMultiplier || 1
                        }))
                    });
                }
            }

            // Update Attributes
            if (body.attributes) {
                await (tx.itemAttribute as any).deleteMany({ where: { itemId: id } });
                if (Array.isArray(body.attributes) && body.attributes.length > 0) {
                    await (tx.itemAttribute as any).createMany({
                        data: body.attributes.filter((a: any) => a.taxonomyTermId).map((a: any) => ({
                            itemId: id,
                            taxonomyTermId: a.taxonomyTermId
                        }))
                    });
                }
            }

            if (body.equipmentProfile && typeof body.equipmentProfile === 'object') {
                const profile = body.equipmentProfile;
                const make = typeof profile.make === 'string' ? profile.make.trim() : '';
                const model = typeof profile.model === 'string' ? profile.model.trim() : '';
                if (make && model) {
                    await (tx.equipmentProfile as any).upsert({
                        where: { catalogItemId: id },
                        update: {
                            make,
                            model,
                            pricingSku: typeof profile.pricingSku === 'string' ? profile.pricingSku : null,
                            family: typeof profile.family === 'string' ? profile.family : null,
                            vendorDatasheetUrl: typeof profile.vendorDatasheetUrl === 'string' ? profile.vendorDatasheetUrl : null,
                            reviewStatus: profile.reviewStatus === 'REJECTED'
                                ? 'REJECTED'
                                : profile.reviewStatus === 'DRAFT'
                                    ? 'DRAFT'
                                    : 'PUBLISHED',
                            normalizedMakeModel: normalizeMakeModelKey(make, model),
                        },
                        create: {
                            catalogItemId: id,
                            make,
                            model,
                            pricingSku: typeof profile.pricingSku === 'string' ? profile.pricingSku : null,
                            family: typeof profile.family === 'string' ? profile.family : null,
                            vendorDatasheetUrl: typeof profile.vendorDatasheetUrl === 'string' ? profile.vendorDatasheetUrl : null,
                            reviewStatus: profile.reviewStatus === 'REJECTED'
                                ? 'REJECTED'
                                : profile.reviewStatus === 'DRAFT'
                                    ? 'DRAFT'
                                    : 'PUBLISHED',
                            normalizedMakeModel: normalizeMakeModelKey(make, model),
                        },
                    });

                    if (profile.wanSpec) {
                        await (tx.equipmentWanSpec as any).upsert({
                            where: { catalogItemId: id },
                            update: {
                                throughputMbps: profile.wanSpec.throughputMbps ?? null,
                                vpnTunnels: profile.wanSpec.vpnTunnels ?? null,
                                cellularSupport: Boolean(profile.wanSpec.cellularSupport),
                                formFactor: profile.wanSpec.formFactor ?? null,
                                interfaces: Array.isArray(profile.wanSpec.interfaces) ? profile.wanSpec.interfaces : [],
                            },
                            create: {
                                catalogItemId: id,
                                throughputMbps: profile.wanSpec.throughputMbps ?? null,
                                vpnTunnels: profile.wanSpec.vpnTunnels ?? null,
                                cellularSupport: Boolean(profile.wanSpec.cellularSupport),
                                formFactor: profile.wanSpec.formFactor ?? null,
                                interfaces: Array.isArray(profile.wanSpec.interfaces) ? profile.wanSpec.interfaces : [],
                            },
                        });
                    }

                    if (profile.lanSpec) {
                        await (tx.equipmentLanSpec as any).upsert({
                            where: { catalogItemId: id },
                            update: {
                                portCount: profile.lanSpec.portCount ?? null,
                                portSpeed: profile.lanSpec.portSpeed ?? null,
                                poeBudgetWatts: profile.lanSpec.poeBudgetWatts ?? null,
                                stackable: Boolean(profile.lanSpec.stackable),
                                uplinkPorts: Array.isArray(profile.lanSpec.uplinkPorts) ? profile.lanSpec.uplinkPorts : [],
                            },
                            create: {
                                catalogItemId: id,
                                portCount: profile.lanSpec.portCount ?? null,
                                portSpeed: profile.lanSpec.portSpeed ?? null,
                                poeBudgetWatts: profile.lanSpec.poeBudgetWatts ?? null,
                                stackable: Boolean(profile.lanSpec.stackable),
                                uplinkPorts: Array.isArray(profile.lanSpec.uplinkPorts) ? profile.lanSpec.uplinkPorts : [],
                            },
                        });
                    }

                    if (profile.wlanSpec) {
                        await (tx.equipmentWlanSpec as any).upsert({
                            where: { catalogItemId: id },
                            update: {
                                wifiStandard: profile.wlanSpec.wifiStandard ?? null,
                                maxClients: profile.wlanSpec.maxClients ?? null,
                                indoorOutdoor: profile.wlanSpec.indoorOutdoor ?? null,
                                radios: Array.isArray(profile.wlanSpec.radios) ? profile.wlanSpec.radios : [],
                            },
                            create: {
                                catalogItemId: id,
                                wifiStandard: profile.wlanSpec.wifiStandard ?? null,
                                maxClients: profile.wlanSpec.maxClients ?? null,
                                indoorOutdoor: profile.wlanSpec.indoorOutdoor ?? null,
                                radios: Array.isArray(profile.wlanSpec.radios) ? profile.wlanSpec.radios : [],
                            },
                        });
                    }
                }
            }

            // Update Pricing
            if (body.pricing) {
                const pricingArray = Array.isArray(body.pricing) ? body.pricing : [body.pricing];
                if (pricingArray.length > 0) {
                    const p = pricingArray[0];
                    const effectiveDate = p.effectiveDate ? new Date(p.effectiveDate) : new Date("2000-01-01");
                    
                    await (tx.pricing as any).upsert({
                        where: { 
                            itemId_effectiveDate: { 
                                itemId: id, 
                                effectiveDate 
                            } 
                        },
                        update: {
                            costMrc: p.costMrc || 0,
                            costNrc: p.costNrc || 0,
                            priceMrc: p.priceMrc || p.costMrc || 0,
                            priceNrc: p.priceNrc || p.costNrc || 0,
                            currency: p.currency || 'USD',
                            pricingModel: p.pricingModel || 'FLAT'
                        },
                        create: {
                            itemId: id,
                            effectiveDate,
                            costMrc: p.costMrc || 0,
                            costNrc: p.costNrc || 0,
                            priceMrc: p.priceMrc || p.costMrc || 0,
                            priceNrc: p.priceNrc || p.costNrc || 0,
                            currency: p.currency || 'USD',
                            pricingModel: p.pricingModel || 'FLAT'
                        }
                    });
                }
            }

            return updated;
        });

        return NextResponse.json(item);
    } catch (error: any) {
        console.error("PATCH CATALOG ERROR:", error);
        require('fs').appendFileSync('/tmp/zippy_error.log', new Date().toISOString() + ' PATCH: ' + error.message + '\n' + error.stack + '\n');
        return NextResponse.json({ error: "Failed to update item", details: error.message }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.catalogItem.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        console.error("DELETE CATALOG ERROR:", error);
        if (error.code === 'P2025') {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
    }
}
