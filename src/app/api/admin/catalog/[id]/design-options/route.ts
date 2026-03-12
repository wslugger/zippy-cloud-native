import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAssignableServiceType } from "@/lib/catalog-item-types";

type PrismaWithDesignAssignmentDelegates = typeof prisma & {
  catalogItemDesignOption?: {
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    deleteMany: (...args: unknown[]) => Promise<unknown>;
    create: (...args: unknown[]) => Promise<{ id: string }>;
  };
  catalogItemDesignOptionValue?: {
    deleteMany: (...args: unknown[]) => Promise<unknown>;
    createMany: (...args: unknown[]) => Promise<unknown>;
  };
  designOptionDefinition?: {
    findMany: (...args: unknown[]) => Promise<unknown[]>;
  };
};

function hasAssignmentDelegates() {
  const client = prisma as PrismaWithDesignAssignmentDelegates;
  return Boolean(client.catalogItemDesignOption && client.catalogItemDesignOptionValue && client.designOptionDefinition);
}

async function getCatalogItemType(catalogItemId: string): Promise<string | null> {
  const item = await prisma.catalogItem.findUnique({
    where: { id: catalogItemId },
    select: { type: true },
  });
  return item?.type ?? null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: catalogItemId } = await params;

  try {
    if (!hasAssignmentDelegates()) {
      const itemType = await getCatalogItemType(catalogItemId);
      if (!itemType) {
        return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });
      }

      return NextResponse.json({
        catalogItemId,
        catalogItemType: itemType,
        editable: isAssignableServiceType(itemType),
        options: [],
        definitions: [],
        warning: "Prisma client is outdated for design option assignment delegates; run 'npx prisma generate' and restart dev server.",
      });
    }

    const [itemType, itemOptions, definitions] = await Promise.all([
      getCatalogItemType(catalogItemId),
      prisma.catalogItemDesignOption.findMany({
        where: { catalogItemId },
        include: {
          designOption: {
            select: {
              id: true,
              key: true,
              label: true,
              valueType: true,
              isActive: true,
              values: {
                where: { isActive: true },
                orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
              },
            },
          },
          allowedValues: {
            include: {
              designOptionValue: true,
            },
          },
          defaultValue: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.designOptionDefinition.findMany({
        where: { isActive: true },
        select: {
          id: true,
          key: true,
          label: true,
          valueType: true,
          isActive: true,
          values: {
            where: { isActive: true },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
          },
        },
        orderBy: [{ label: "asc" }],
      }),
    ]);

    if (!itemType) {
      return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });
    }

    return NextResponse.json({
      catalogItemId,
      catalogItemType: itemType,
      editable: isAssignableServiceType(itemType),
      options: itemOptions,
      definitions,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load design options" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: catalogItemId } = await params;

  try {
    if (!hasAssignmentDelegates()) {
      return NextResponse.json(
        { error: "Design option assignment write APIs are unavailable because Prisma client is outdated. Run 'npx prisma generate' and restart dev server." },
        { status: 500 }
      );
    }

    const itemType = await getCatalogItemType(catalogItemId);
    if (!isAssignableServiceType(itemType)) {
      return NextResponse.json(
        { error: "Design options can only be assigned to MANAGED_SERVICE, SERVICE_OPTION, or CONNECTIVITY items" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      options?: Array<{
        designOptionId: string;
        isRequired?: boolean;
        allowMulti?: boolean;
        defaultValueId?: string | null;
        allowedValueIds?: string[];
      }>;
    };

    const options = (body.options ?? []).map((option) => ({
      designOptionId: option.designOptionId,
      isRequired: option.isRequired ?? false,
      allowMulti: option.allowMulti ?? false,
      defaultValueId: option.defaultValueId ?? null,
      allowedValueIds: Array.from(new Set((option.allowedValueIds ?? []).filter(Boolean))),
    }));

    const designOptionIds = new Set<string>();
    for (const option of options) {
      if (!option.designOptionId) {
        return NextResponse.json({ error: "Each assignment requires a designOptionId" }, { status: 400 });
      }
      if (designOptionIds.has(option.designOptionId)) {
        return NextResponse.json({ error: "Duplicate design option assignments are not allowed" }, { status: 400 });
      }
      designOptionIds.add(option.designOptionId);
    }

    const definitions = await prisma.designOptionDefinition.findMany({
      where: { id: { in: Array.from(designOptionIds) } },
      select: {
        id: true,
        key: true,
        label: true,
        values: {
          select: { id: true },
        },
      },
    });

    if (definitions.length !== designOptionIds.size) {
      return NextResponse.json({ error: "One or more selected design options are invalid" }, { status: 400 });
    }

    const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
    for (const option of options) {
      const definition = definitionsById.get(option.designOptionId);
      if (!definition) {
        return NextResponse.json({ error: "One or more selected design options are invalid" }, { status: 400 });
      }
      const allowedDefinitionValueIds = new Set(definition.values.map((value) => value.id));

      const invalidAllowedValue = option.allowedValueIds.find((valueId) => !allowedDefinitionValueIds.has(valueId));
      if (invalidAllowedValue) {
        return NextResponse.json(
          { error: `Value '${invalidAllowedValue}' is not valid for design option '${definition.label || definition.key}'` },
          { status: 400 }
        );
      }

      if (option.defaultValueId && !allowedDefinitionValueIds.has(option.defaultValueId)) {
        return NextResponse.json(
          { error: `Default value '${option.defaultValueId}' is not valid for design option '${definition.label || definition.key}'` },
          { status: 400 }
        );
      }

      if (option.defaultValueId && !option.allowedValueIds.includes(option.defaultValueId)) {
        return NextResponse.json(
          { error: `Default value must be included in allowed values for '${definition.label || definition.key}'` },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.catalogItemDesignOptionValue.deleteMany({
        where: { itemDesignOption: { catalogItemId } },
      });
      await tx.catalogItemDesignOption.deleteMany({ where: { catalogItemId } });

      for (const option of options) {
        const created = await tx.catalogItemDesignOption.create({
          data: {
            catalogItemId,
            designOptionId: option.designOptionId,
            isRequired: option.isRequired ?? false,
            allowMulti: option.allowMulti ?? false,
            defaultValueId: option.defaultValueId ?? null,
          },
        });

        const allowedValueIds = Array.from(new Set(option.allowedValueIds ?? []));
        if (allowedValueIds.length > 0) {
          await tx.catalogItemDesignOptionValue.createMany({
            data: allowedValueIds.map((designOptionValueId) => ({
              itemDesignOptionId: created.id,
              designOptionValueId,
            })),
          });
        }
      }

      return tx.catalogItemDesignOption.findMany({
        where: { catalogItemId },
        include: {
          designOption: {
            select: {
              id: true,
              key: true,
              label: true,
              valueType: true,
              isActive: true,
              values: {
                where: { isActive: true },
                orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
              },
            },
          },
          allowedValues: {
            include: {
              designOptionValue: true,
            },
          },
          defaultValue: true,
        },
        orderBy: { createdAt: "asc" },
      });
    });

    return NextResponse.json({ options: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update design options";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
