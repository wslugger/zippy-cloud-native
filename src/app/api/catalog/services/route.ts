import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { DependencyType } from "@prisma/client";

// GET /api/catalog/services
// Returns all MANAGED_SERVICE items with attachable dependencies.
export async function GET() {
    try {
        const services = await prisma.catalogItem.findMany({
            where: { type: "MANAGED_SERVICE" },
            include: {
                attributes: { include: { term: true } },
                pricing: true,
                childDependencies: {
                    where: {
                        type: {
                            in: [
                                DependencyType.MANDATORY_ATTACHMENT,
                                DependencyType.OPTIONAL_ATTACHMENT,
                                DependencyType.INCLUDES,
                            ],
                        },
                    },
                    include: {
                        childItem: {
                            include: {
                                pricing: true,
                                childDependencies: {
                                    where: { type: DependencyType.INCOMPATIBLE },
                                },
                                parentDependencies: {
                                    where: { type: DependencyType.INCOMPATIBLE },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { name: "asc" },
        });

        const result = services.map((service) => ({
            ...service,
            description: service.shortDescription,
            attachments: service.childDependencies
                .map((dependency) => {
                    const attachment = dependency.childItem;
                    if (!attachment) return null;

                    return {
                        ...attachment,
                        dependencyType: dependency.type,
                        incompatibleWith: [
                            ...attachment.childDependencies.map((dep) => dep.childId),
                            ...attachment.parentDependencies.map((dep) => dep.parentId),
                        ],
                    };
                })
                .filter(Boolean),
        }));

        return NextResponse.json(result);
    } catch {
        return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
    }
}
