import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ASSIGNABLE_SERVICE_TYPE_SET } from "@/lib/catalog-item-types";

const PACKAGE_ITEM_TYPE = "PACKAGE";
const FEATURE_STATUSES = new Set(["REQUIRED", "STANDARD", "OPTIONAL"] as const);
type FeatureStatus = "REQUIRED" | "STANDARD" | "OPTIONAL";
type FeatureMode = "SUPPORT" | "PACKAGE_STATUS" | "READ_ONLY";

function isJsonObject(value: Prisma.JsonValue | null | undefined): value is Prisma.JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripConfigKeys(config: Prisma.JsonObject, keys: string[]): Prisma.JsonObject {
  const next: Prisma.JsonObject = { ...config };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function normalizeAssignments(raw: Prisma.JsonObject): Array<{ termId: string; status: FeatureStatus }> {
  return Object.entries(raw)
    .filter(
      ([termId, status]) =>
        Boolean(termId) && typeof status === "string" && FEATURE_STATUSES.has(status as FeatureStatus)
    )
    .map(([termId, status]) => ({ termId, status: status as FeatureStatus }));
}

async function getCatalogItemType(catalogItemId: string): Promise<string | null> {
  const item = await prisma.catalogItem.findUnique({
    where: { id: catalogItemId },
    select: { type: true },
  });
  return item?.type ?? null;
}

async function getAvailablePackageFeatureTermIds(packageId: string): Promise<string[]> {
  const compositionRows = await prisma.packageCompositionItem.findMany({
    where: { packageId },
    select: { catalogItemId: true },
  });
  const memberIds = compositionRows.map((row) => row.catalogItemId);
  if (memberIds.length === 0) return [];

  const attributes = await prisma.itemAttribute.findMany({
    where: {
      itemId: { in: memberIds },
      term: { category: "FEATURE" },
    },
    select: { taxonomyTermId: true },
    distinct: ["taxonomyTermId"],
  });

  return attributes.map((attribute) => attribute.taxonomyTermId);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: catalogItemId } = await params;

  try {
    const itemType = await getCatalogItemType(catalogItemId);
    if (!itemType) {
      return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });
    }

    const item = await prisma.catalogItem.findUnique({
      where: { id: catalogItemId },
      include: {
        attributes: {
          include: { term: true },
        },
      },
    });
    if (!item) {
      return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });
    }

    const assignedFeatureTermIds = item.attributes
      .filter((attribute) => attribute.term.category === "FEATURE")
      .map((attribute) => attribute.taxonomyTermId);
    const config = isJsonObject(item.configSchema) ? item.configSchema : {};

    if (itemType === PACKAGE_ITEM_TYPE) {
      const availableFeatureTermIds = await getAvailablePackageFeatureTermIds(catalogItemId);
      const featureTerms = await prisma.taxonomyTerm.findMany({
        where: {
          category: "FEATURE",
          id: { in: availableFeatureTermIds.length > 0 ? availableFeatureTermIds : ["__none__"] },
        },
        orderBy: [{ label: "asc" }],
      });
      const availableIds = new Set(featureTerms.map((term) => term.id));

      const rawAssignments = isJsonObject(config.packageFeatureAssignments as Prisma.JsonValue)
        ? (config.packageFeatureAssignments as Prisma.JsonObject)
        : {};
      const assignments = normalizeAssignments(rawAssignments).filter((row) => availableIds.has(row.termId));

      return NextResponse.json({
        catalogItemId,
        catalogItemType: itemType,
        mode: "PACKAGE_STATUS" as FeatureMode,
        editable: true,
        featureTerms,
        availableFeatureTermIds: featureTerms.map((term) => term.id),
        assignments,
      });
    }

    if (ASSIGNABLE_SERVICE_TYPE_SET.has(itemType)) {
      const featureTerms = await prisma.taxonomyTerm.findMany({
        where: { category: "FEATURE" },
        orderBy: [{ label: "asc" }],
      });

      return NextResponse.json({
        catalogItemId,
        catalogItemType: itemType,
        mode: "SUPPORT" as FeatureMode,
        editable: true,
        featureTerms,
        supportedFeatureTermIds: assignedFeatureTermIds,
        assignments: [],
      });
    }

    return NextResponse.json({
      catalogItemId,
      catalogItemType: itemType,
      mode: "READ_ONLY" as FeatureMode,
      editable: false,
      featureTerms: [],
      supportedFeatureTermIds: [],
      assignments: [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load features";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: catalogItemId } = await params;

  try {
    const itemType = await getCatalogItemType(catalogItemId);
    if (!itemType) {
      return NextResponse.json({ error: "Catalog item not found" }, { status: 404 });
    }
    const body = (await request.json()) as {
      featureTermIds?: string[];
      assignments?: Array<{ termId: string; status: FeatureStatus }>;
    };

    if (itemType === PACKAGE_ITEM_TYPE) {
      const normalizedAssignments = (body.assignments ?? [])
        .filter((row) => row?.termId && row?.status)
        .map((row) => ({ termId: row.termId, status: row.status }));

      const invalidStatus = normalizedAssignments.find((row) => !FEATURE_STATUSES.has(row.status));
      if (invalidStatus) {
        return NextResponse.json({ error: `Invalid feature status '${invalidStatus.status}'` }, { status: 400 });
      }

      const featureTermIds = Array.from(new Set(normalizedAssignments.map((row) => row.termId)));
      const availableFeatureTermIds = await getAvailablePackageFeatureTermIds(catalogItemId);
      const availableSet = new Set(availableFeatureTermIds);
      const invalidAssignments = featureTermIds.filter((termId) => !availableSet.has(termId));
      if (invalidAssignments.length > 0) {
        return NextResponse.json(
          { error: "One or more feature terms are not available for this package composition", invalidTermIds: invalidAssignments },
          { status: 400 }
        );
      }

      const matchingTerms = await prisma.taxonomyTerm.findMany({
        where: {
          id: { in: featureTermIds.length > 0 ? featureTermIds : ["__none__"] },
          category: "FEATURE",
        },
        select: { id: true },
      });
      if (matchingTerms.length !== featureTermIds.length) {
        return NextResponse.json({ error: "One or more selected feature terms are invalid" }, { status: 400 });
      }

      await prisma.$transaction(async (tx) => {
        // Package feature statuses live in package config, not as package feature attributes.
        await tx.itemAttribute.deleteMany({
          where: {
            itemId: catalogItemId,
            term: { category: "FEATURE" },
          },
        });

        const existingItem = await tx.catalogItem.findUnique({
          where: { id: catalogItemId },
          select: { configSchema: true },
        });
        const existingConfig = isJsonObject(existingItem?.configSchema) ? existingItem.configSchema : {};
        const packageFeatureAssignments = normalizedAssignments.reduce<Record<string, FeatureStatus>>((acc, row) => {
          acc[row.termId] = row.status;
          return acc;
        }, {});

        await tx.catalogItem.update({
          where: { id: catalogItemId },
          data: {
            configSchema: {
              ...stripConfigKeys(existingConfig, ["serviceFeatureAssignments"]),
              packageFeatureAssignments,
            },
          },
        });
      });

      return NextResponse.json({
        mode: "PACKAGE_STATUS" as FeatureMode,
        featureTermIds,
        availableFeatureTermIds,
        assignments: normalizedAssignments,
      });
    }

    if (!ASSIGNABLE_SERVICE_TYPE_SET.has(itemType)) {
      return NextResponse.json(
        { error: "Feature support can only be managed for PACKAGE, MANAGED_SERVICE, SERVICE_OPTION, or CONNECTIVITY items" },
        { status: 400 }
      );
    }

    const selectedTermIds = (body.featureTermIds ?? []).filter(Boolean);
    const fallbackFromAssignments = (body.assignments ?? []).map((row) => row.termId).filter(Boolean);
    const featureTermIds = Array.from(new Set(selectedTermIds.length > 0 ? selectedTermIds : fallbackFromAssignments));

    const matchingTerms = await prisma.taxonomyTerm.findMany({
      where: {
        id: { in: featureTermIds.length > 0 ? featureTermIds : ["__none__"] },
        category: "FEATURE",
      },
      select: { id: true },
    });
    if (matchingTerms.length !== featureTermIds.length) {
      return NextResponse.json({ error: "One or more selected feature terms are invalid" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.itemAttribute.deleteMany({
        where: {
          itemId: catalogItemId,
          term: { category: "FEATURE" },
        },
      });

      if (featureTermIds.length > 0) {
        await tx.itemAttribute.createMany({
          data: featureTermIds.map((taxonomyTermId) => ({
            itemId: catalogItemId,
            taxonomyTermId,
          })),
          skipDuplicates: true,
        });
      }

      const existingItem = await tx.catalogItem.findUnique({
        where: { id: catalogItemId },
        select: { configSchema: true },
      });
      const existingConfig = isJsonObject(existingItem?.configSchema) ? existingItem.configSchema : {};

      await tx.catalogItem.update({
        where: { id: catalogItemId },
        data: {
          configSchema: stripConfigKeys(existingConfig, ["serviceFeatureAssignments", "packageFeatureAssignments"]),
        },
      });
    });

    return NextResponse.json({
      mode: "SUPPORT" as FeatureMode,
      featureTermIds,
      assignments: [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update features";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
