import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const packages = await prisma.catalogItem.findMany({
      where: { type: "PACKAGE" },
      include: {
        packageCompositions: {
          include: {
            catalogItem: {
              include: {
                pricing: {
                  orderBy: { effectiveDate: "desc" },
                  take: 1,
                },
                childDependencies: {
                  include: {
                    childItem: {
                      include: {
                        pricing: {
                          orderBy: { effectiveDate: "desc" },
                          take: 1,
                        },
                        childDependencies: {
                          include: {
                            childItem: {
                              include: {
                                pricing: {
                                  orderBy: { effectiveDate: "desc" },
                                  take: 1,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        },
        packagePolicies: {
          where: { active: true },
          include: {
            targetCatalogItem: { select: { id: true, sku: true, name: true, type: true } },
            designOption: true,
            values: { include: { designOptionValue: true } },
          },
          orderBy: [{ targetCatalogItemId: "asc" }, { designOptionId: "asc" }],
        },
        collaterals: true,
        pricing: {
          orderBy: { effectiveDate: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      packages.map((pkg) => ({
        ...pkg,
        collaterals: pkg.collaterals.map((c) => ({ ...c, url: c.documentUrl })),
      }))
    );
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch packages" }, { status: 500 });
  }
}
