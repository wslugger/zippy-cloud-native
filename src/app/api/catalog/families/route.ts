import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { DependencyType } from "@prisma/client";

// GET /api/catalog/families
// Returns all SERVICE_FAMILY items with their IS_A children
export async function GET() {
    try {
        const families = await prisma.catalogItem.findMany({
            where: { type: 'SERVICE_FAMILY' },
            include: {
                attributes: { include: { term: true } },
                pricing: true,
                parentDependencies: {
                    where: { type: DependencyType.IS_A },
                    include: {
                        childItem: {
                            include: {
                                attributes: { include: { term: true } },
                                pricing: true,
                                parentDependencies: {
                                    where: {
                                        type: { 
                                            in: [
                                                DependencyType.MANDATORY_ATTACHMENT, 
                                                DependencyType.OPTIONAL_ATTACHMENT,
                                                DependencyType.INCLUDES
                                            ] 
                                        }
                                    },
                                    include: {
                                        childItem: {
                                            include: {
                                                pricing: true,
                                                // Fetch incompatible dependencies for the attachment
                                                parentDependencies: {
                                                    where: { type: DependencyType.INCOMPATIBLE }
                                                },
                                                childDependencies: {
                                                    where: { type: DependencyType.INCOMPATIBLE }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        const result = families.map(family => ({
            id: family.id,
            sku: family.sku,
            name: family.name,
            description: family.shortDescription,
            type: family.type,
            attributes: family.attributes,
            options: family.parentDependencies.map(dep => {
                const managedService = dep.childItem;
                if (!managedService) return null;

                return {
                    ...managedService,
                    description: managedService.shortDescription,
                    attachments: managedService.parentDependencies.map(attDep => {
                        const attachment = attDep.childItem;
                        if (!attachment) return null;

                        return {
                            ...attachment,
                            dependencyType: attDep.type,
                            incompatibleWith: [
                                ...attachment.parentDependencies.map(id => id.childId),
                                ...attachment.childDependencies.map(id => id.parentId)
                            ]
                        };
                    }).filter(Boolean)
                };
            }).filter(Boolean),
        }));

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch service families" }, { status: 500 });
    }
}
