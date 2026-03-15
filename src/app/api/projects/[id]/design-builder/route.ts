import { NextRequest, NextResponse } from "next/server";
import { DependencyType, ItemType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { evaluatePackageSelections, type SelectionInput } from "@/lib/package-policy-engine";
import { validateServiceCoverageForSelection } from "@/lib/service-coverage-policy";
import {
  classifyCoreServiceRoleByIdentity,
  isManagedTierOptionByIdentity,
  parsePackageDependencyAllowlist,
} from "@/lib/package-dependency-allowlist";

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
        parentItem: {
          select: {
            type: true,
            name: true,
          },
        },
        childItem: {
          select: {
            type: true,
            name: true,
            sku: true,
          },
        },
        childId: true,
      },
    });

    for (const dep of deps) {
      const parentRole = classifyCoreServiceRoleByIdentity(dep.parentItem);
      const childIsManagedTier = isManagedTierOptionByIdentity(dep.childItem);
      const childIsConnectivity = dep.childItem.type === ItemType.CONNECTIVITY;

      // SDWAN/LAN/WLAN require user choice for tiers; SDWAN also requires connectivity choice.
      // Do not auto-add these children even when dependency rows are marked as mandatory.
      if (
        (parentRole === "SDWAN" || parentRole === "LAN" || parentRole === "WLAN") &&
        (childIsManagedTier || (parentRole === "SDWAN" && childIsConnectivity))
      ) {
        continue;
      }

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

interface PackageAllowlistViolation {
  code: "PACKAGE_OPTION_NOT_ALLOWED";
  message: string;
  packageId: string;
  itemId: string;
  parentId: string;
  blocking: true;
}

async function validatePackageDependencyAllowlists(input: {
  selectedItemIds: string[];
  selectedPackageIds: string[];
}): Promise<PackageAllowlistViolation[]> {
  const { selectedItemIds, selectedPackageIds } = input;
  if (selectedPackageIds.length === 0 || selectedItemIds.length === 0) return [];

  const selectedIds = new Set(selectedItemIds);
  const packages = await prisma.catalogItem.findMany({
    where: { id: { in: selectedPackageIds }, type: ItemType.PACKAGE },
    select: { id: true, configSchema: true },
  });

  const packageAllowlists = packages
    .map((pkg) => ({ packageId: pkg.id, allowlist: parsePackageDependencyAllowlist(pkg.configSchema) }))
    .filter((row) => Object.keys(row.allowlist).length > 0);
  if (packageAllowlists.length === 0) return [];

  const parentIds = Array.from(
    new Set(
      packageAllowlists.flatMap((row) => Object.keys(row.allowlist)).filter((parentId) => selectedIds.has(parentId))
    )
  );
  if (parentIds.length === 0) return [];

  const deps = await prisma.itemDependency.findMany({
    where: {
      parentId: { in: parentIds },
      childId: { in: selectedItemIds },
      type: {
        in: [
          DependencyType.OPTIONAL_ATTACHMENT,
          DependencyType.MANDATORY_ATTACHMENT,
          DependencyType.REQUIRES,
          DependencyType.INCLUDES,
        ],
      },
    },
    include: {
      childItem: {
        select: {
          id: true,
          name: true,
          sku: true,
          type: true,
        },
      },
    },
  });

  const violations: PackageAllowlistViolation[] = [];

  for (const { packageId, allowlist } of packageAllowlists) {
    for (const dep of deps) {
      const entry = allowlist[dep.parentId];
      if (!entry) continue;
      if (!selectedIds.has(dep.childId)) continue;

      const childIsManagedTier = isManagedTierOptionByIdentity(dep.childItem);
      const childIsConnectivity = dep.childItem.type === ItemType.CONNECTIVITY;
      if (!childIsManagedTier && !childIsConnectivity) continue;

      const allowedIds = childIsManagedTier ? entry.managedTierIds : entry.connectivityIds;
      if (!allowedIds.includes(dep.childId)) {
        violations.push({
          code: "PACKAGE_OPTION_NOT_ALLOWED",
          message: `${dep.childItem.name} is not allowed by package option scope.`,
          packageId,
          itemId: dep.childId,
          parentId: dep.parentId,
          blocking: true,
        });
      }
    }
  }

  const deduped = new Map<string, PackageAllowlistViolation>();
  for (const violation of violations) {
    const key = `${violation.packageId}:${violation.parentId}:${violation.itemId}`;
    if (!deduped.has(key)) deduped.set(key, violation);
  }

  return Array.from(deduped.values());
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

    const coverageViolations = await validateServiceCoverageForSelection(
      effectiveSelections.map((selection) => selection.catalogItemId)
    );
    if (coverageViolations.some((violation) => violation.blocking)) {
      return NextResponse.json(
        {
          error: "Service coverage validation failed",
          violations: coverageViolations,
        },
        { status: 422 }
      );
    }

    const selectedCatalogItems = await prisma.catalogItem.findMany({
      where: { id: { in: effectiveSelections.map((selection) => selection.catalogItemId) } },
      select: { id: true, type: true },
    });

    const selectedPackageIds = selectedCatalogItems
      .filter((item) => item.type === ItemType.PACKAGE)
      .map((item) => item.id);

    const packageAllowlistViolations = await validatePackageDependencyAllowlists({
      selectedItemIds: effectiveSelections.map((selection) => selection.catalogItemId),
      selectedPackageIds,
    });
    if (packageAllowlistViolations.some((violation) => violation.blocking)) {
      return NextResponse.json(
        {
          error: "Package option scope validation failed",
          violations: packageAllowlistViolations,
        },
        { status: 422 }
      );
    }

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
