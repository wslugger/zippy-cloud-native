import { NextRequest, NextResponse } from "next/server";
import { DependencyType, ItemType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { evaluatePackageSelections, type SelectionInput } from "@/lib/package-policy-engine";

interface SaveSelectionPayload {
  catalogItemId: string;
  quantity?: number;
  configValues?: Record<string, unknown>;
  designOptionValues?: Record<string, string | string[]>;
}

function isUnknownDesignOptionValuesFieldError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message || "";
  return message.includes("Unknown field `designOptionValues`");
}

function normalizeSelectionPayload(input: SaveSelectionPayload): SelectionInput {
  return {
    catalogItemId: input.catalogItemId,
    quantity: Math.max(1, input.quantity ?? 1),
    configValues: input.configValues ?? {},
    designOptionValues: input.designOptionValues ?? {},
  };
}

function toJsonOrNull(
  value: Record<string, unknown> | Record<string, string[]> | undefined
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!value || Object.keys(value).length === 0) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

async function verifyOwnership(projectId: string, userId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({ where: { id: projectId, userId }, select: { id: true } });
  return Boolean(project);
}

async function expandRequiredDependencies(initialSelections: SelectionInput[]): Promise<SelectionInput[]> {
  const selectionMap = new Map<string, SelectionInput>();
  for (const selection of initialSelections) {
    selectionMap.set(selection.catalogItemId, selection);
  }

  let changed = true;
  while (changed) {
    changed = false;
    const itemIds = Array.from(selectionMap.keys());
    if (itemIds.length === 0) break;

    const deps = await prisma.itemDependency.findMany({
      where: {
        parentId: { in: itemIds },
        type: {
          in: [DependencyType.INCLUDES, DependencyType.REQUIRES, DependencyType.MANDATORY_ATTACHMENT],
        },
      },
      select: {
        childId: true,
      },
    });

    for (const dep of deps) {
      if (!selectionMap.has(dep.childId)) {
        selectionMap.set(dep.childId, {
          catalogItemId: dep.childId,
          quantity: 1,
          configValues: {},
          designOptionValues: {},
        });
        changed = true;
      }
    }
  }

  return Array.from(selectionMap.values());
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;
    if (!(await verifyOwnership(projectId, session.userId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectItemsPromise = prisma.projectItem
      .findMany({
        where: { projectId },
        select: {
          id: true,
          catalogItemId: true,
          quantity: true,
          configValues: true,
          designOptionValues: true,
        },
        orderBy: { createdAt: "asc" },
      })
      .catch(async (error) => {
        if (!isUnknownDesignOptionValuesFieldError(error)) {
          throw error;
        }

        const fallbackRows = await prisma.projectItem.findMany({
          where: { projectId },
          select: {
            id: true,
            catalogItemId: true,
            quantity: true,
            configValues: true,
          },
          orderBy: { createdAt: "asc" },
        });

        return fallbackRows.map((row) => ({ ...row, designOptionValues: null }));
      });

    const [projectItems, topLevelItems] = await Promise.all([
      projectItemsPromise,
      prisma.catalogItem.findMany({
        where: { type: { in: [ItemType.PACKAGE, ItemType.MANAGED_SERVICE] } },
        include: {
          attributes: { include: { term: true } },
          childDependencies: {
            where: {
              type: {
                in: [
                  DependencyType.REQUIRES,
                  DependencyType.INCLUDES,
                  DependencyType.MANDATORY_ATTACHMENT,
                  DependencyType.OPTIONAL_ATTACHMENT,
                ],
              },
            },
            include: {
              childItem: {
                include: {
                  attributes: { include: { term: true } },
                  childDependencies: {
                    where: {
                      type: {
                        in: [
                          DependencyType.REQUIRES,
                          DependencyType.INCLUDES,
                          DependencyType.MANDATORY_ATTACHMENT,
                          DependencyType.OPTIONAL_ATTACHMENT,
                        ],
                      },
                    },
                    include: {
                      childItem: {
                        include: {
                          attributes: { include: { term: true } },
                        },
                      },
                    },
                  },
                  designOptions: {
                    include: {
                      designOption: {
                        include: {
                          values: {
                            where: { isActive: true },
                            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
                          },
                        },
                      },
                      allowedValues: { include: { designOptionValue: true } },
                      defaultValue: true,
                    },
                  },
                },
              },
            },
          },
          designOptions: {
            include: {
              designOption: {
                include: {
                  values: {
                    where: { isActive: true },
                    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
                  },
                },
              },
              allowedValues: { include: { designOptionValue: true } },
              defaultValue: true,
            },
          },
          packageCompositions: {
            include: {
              catalogItem: {
                include: {
                  attributes: { include: { term: true } },
                  childDependencies: {
                    where: {
                      type: {
                        in: [
                          DependencyType.REQUIRES,
                          DependencyType.INCLUDES,
                          DependencyType.MANDATORY_ATTACHMENT,
                          DependencyType.OPTIONAL_ATTACHMENT,
                        ],
                      },
                    },
                    include: {
                      childItem: {
                        include: {
                          attributes: { include: { term: true } },
                        },
                      },
                    },
                  },
                  designOptions: {
                    include: {
                      designOption: {
                        include: {
                          values: {
                            where: { isActive: true },
                            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
                          },
                        },
                      },
                      allowedValues: { include: { designOptionValue: true } },
                      defaultValue: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return NextResponse.json({
      projectId,
      projectSelections: projectItems,
      topLevelItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load design builder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await params;
    if (!(await verifyOwnership(projectId, session.userId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { selections?: SaveSelectionPayload[] };
    const rawSelections = Array.isArray(body.selections) ? body.selections : [];

    if (rawSelections.length === 0) {
      await prisma.projectItem.deleteMany({ where: { projectId } });
      return NextResponse.json({ success: true, effectiveSelections: [] });
    }

    const normalized = rawSelections
      .filter((selection) => typeof selection.catalogItemId === "string" && selection.catalogItemId.length > 0)
      .map(normalizeSelectionPayload);

    const uniqueSelectionMap = new Map<string, SelectionInput>();
    for (const selection of normalized) {
      uniqueSelectionMap.set(selection.catalogItemId, selection);
    }

    let effectiveSelections = await expandRequiredDependencies(Array.from(uniqueSelectionMap.values()));

    const selectedCatalogItems = await prisma.catalogItem.findMany({
      where: { id: { in: effectiveSelections.map((selection) => selection.catalogItemId) } },
      select: { id: true, type: true },
    });

    const selectedPackageIds = selectedCatalogItems
      .filter((item) => item.type === ItemType.PACKAGE)
      .map((item) => item.id);

    const mergedForcedConfig: Record<string, Record<string, string | string[]>> = {};

    for (const packageId of selectedPackageIds) {
      const policyResult = await evaluatePackageSelections({
        packageId,
        scope: "PROJECT",
        selections: effectiveSelections,
      });

      if (policyResult.violations.some((violation) => violation.blocking)) {
        return NextResponse.json(
          {
            error: "Package policy validation failed",
            packageId,
            violations: policyResult.violations,
            forcedConfig: policyResult.forcedConfig,
          },
          { status: 422 }
        );
      }

      effectiveSelections = policyResult.effectiveSelections.map((selection) => ({
        catalogItemId: selection.catalogItemId,
        quantity: selection.quantity,
        configValues: selection.configValues,
        designOptionValues: selection.designOptionValues,
      }));

      for (const [itemId, forced] of Object.entries(policyResult.forcedConfig)) {
        mergedForcedConfig[itemId] = { ...(mergedForcedConfig[itemId] ?? {}), ...forced };
      }
    }

    const saveWithDesignOptionValues = async () =>
      prisma.$transaction(async (tx) => {
        const rows = [];

        for (const selection of effectiveSelections) {
          const mergedConfig = {
            ...(selection.configValues ?? {}),
            ...(mergedForcedConfig[selection.catalogItemId] ?? {}),
          };

          const row = await tx.projectItem.upsert({
            where: {
              projectId_catalogItemId: {
                projectId,
                catalogItemId: selection.catalogItemId,
              },
            },
            update: {
              quantity: selection.quantity ?? 1,
              configValues: toJsonOrNull(mergedConfig),
              designOptionValues: toJsonOrNull(selection.designOptionValues ?? {}),
            },
            create: {
              projectId,
              catalogItemId: selection.catalogItemId,
              quantity: selection.quantity ?? 1,
              configValues: toJsonOrNull(mergedConfig),
              designOptionValues: toJsonOrNull(selection.designOptionValues ?? {}),
            },
          });

          rows.push(row);
        }

        const selectedIds = effectiveSelections.map((selection) => selection.catalogItemId);
        await tx.projectItem.deleteMany({
          where: {
            projectId,
            catalogItemId: { notIn: selectedIds },
          },
        });

        return rows;
      });

    const saveWithoutDesignOptionValues = async () =>
      prisma.$transaction(async (tx) => {
        const rows = [];

        for (const selection of effectiveSelections) {
          const mergedConfig = {
            ...(selection.configValues ?? {}),
            ...(mergedForcedConfig[selection.catalogItemId] ?? {}),
          };

          const row = await tx.projectItem.upsert({
            where: {
              projectId_catalogItemId: {
                projectId,
                catalogItemId: selection.catalogItemId,
              },
            },
            update: {
              quantity: selection.quantity ?? 1,
              configValues: toJsonOrNull(mergedConfig),
            },
            create: {
              projectId,
              catalogItemId: selection.catalogItemId,
              quantity: selection.quantity ?? 1,
              configValues: toJsonOrNull(mergedConfig),
            },
          });

          rows.push({ ...row, designOptionValues: null });
        }

        const selectedIds = effectiveSelections.map((selection) => selection.catalogItemId);
        await tx.projectItem.deleteMany({
          where: {
            projectId,
            catalogItemId: { notIn: selectedIds },
          },
        });

        return rows;
      });

    let savedRows;
    try {
      savedRows = await saveWithDesignOptionValues();
    } catch (error) {
      if (!isUnknownDesignOptionValuesFieldError(error)) {
        throw error;
      }
      savedRows = await saveWithoutDesignOptionValues();
    }

    return NextResponse.json({
      success: true,
      effectiveSelections: savedRows,
      forcedConfig: mergedForcedConfig,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save design builder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
