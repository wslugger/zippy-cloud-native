import { NextRequest, NextResponse } from "next/server";
import { ItemType, PackageCompositionRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPackageType } from "@/lib/package-policy-engine";

const SERVICE_COMPOSITION_TYPES: ItemType[] = [
  ItemType.MANAGED_SERVICE,
  ItemType.SERVICE_OPTION,
  ItemType.CONNECTIVITY,
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;

  try {
    await assertPackageType(packageId);

    const composition = await prisma.packageCompositionItem.findMany({
      where: { packageId },
      include: {
        catalogItem: {
          select: {
            id: true,
            sku: true,
            name: true,
            type: true,
            shortDescription: true,
          },
        },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ items: composition });
  } catch {
    return NextResponse.json({ error: "Failed to fetch package composition" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: packageId } = await params;

  try {
    await assertPackageType(packageId);

    const body = (await request.json()) as {
      items?: Array<{
        catalogItemId: string;
        role: PackageCompositionRole;
        minQty?: number;
        maxQty?: number | null;
        defaultQty?: number;
        isSelectable?: boolean;
        displayOrder?: number;
      }>;
    };

    const items = body.items ?? [];
    const dedupeIds = new Set<string>();

    for (const item of items) {
      if (!item.catalogItemId) {
        return NextResponse.json({ error: "catalogItemId is required for all composition rows" }, { status: 400 });
      }
      if (dedupeIds.has(item.catalogItemId)) {
        return NextResponse.json(
          { error: `Duplicate service composition entry for catalogItemId '${item.catalogItemId}'` },
          { status: 400 }
        );
      }
      dedupeIds.add(item.catalogItemId);

      if (!Object.values(PackageCompositionRole).includes(item.role)) {
        return NextResponse.json({ error: `Invalid composition role '${item.role}'` }, { status: 400 });
      }
    }

    if (items.length > 0) {
      const catalogItems = await prisma.catalogItem.findMany({
        where: { id: { in: items.map((item) => item.catalogItemId) } },
        select: { id: true, type: true },
      });

      const byId = new Map(catalogItems.map((item) => [item.id, item.type]));
      const missing = items.filter((item) => !byId.has(item.catalogItemId)).map((item) => item.catalogItemId);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Unknown catalog item(s) in composition: ${missing.join(", ")}` },
          { status: 400 }
        );
      }

      const invalidTypeIds = items
        .filter((item) => {
          const type = byId.get(item.catalogItemId);
          return !type || !SERVICE_COMPOSITION_TYPES.includes(type);
        })
        .map((item) => item.catalogItemId);

      if (invalidTypeIds.length > 0) {
        return NextResponse.json(
          {
            error: "Service composition only supports managed services, service options, and connectivity items.",
            invalidCatalogItemIds: invalidTypeIds,
          },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.packageCompositionItem.deleteMany({ where: { packageId } });

      if (items.length > 0) {
        await tx.packageCompositionItem.createMany({
          data: items.map((item, index) => ({
            packageId,
            catalogItemId: item.catalogItemId,
            role: item.role,
            minQty: Math.max(1, item.minQty ?? 1),
            maxQty: item.maxQty ?? null,
            defaultQty: Math.max(1, item.defaultQty ?? 1),
            isSelectable: item.isSelectable ?? item.role !== "REQUIRED",
            displayOrder: item.displayOrder ?? index,
          })),
        });
      }

      return tx.packageCompositionItem.findMany({
        where: { packageId },
        include: {
          catalogItem: {
            select: {
              id: true,
              sku: true,
              name: true,
              type: true,
              shortDescription: true,
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      });
    });

    return NextResponse.json({ items: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update package composition";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
