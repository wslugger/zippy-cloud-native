import { NextResponse } from "next/server";
import {
  ProjectStatus,
  ProjectWorkflowStage,
  ProjectEventType,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const EMPTY_OR_NULL_NOTES: Prisma.ProjectWhereInput = {
  OR: [{ manualNotes: null }, { manualNotes: "" }],
};

const HAS_NOTES: Prisma.ProjectWhereInput = {
  NOT: EMPTY_OR_NULL_NOTES,
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeDateRange(searchParams: URLSearchParams) {
  const startDate = parseDate(searchParams.get("start"));
  const endDateRaw = parseDate(searchParams.get("end"));
  let endDateExclusive: Date | null = null;
  if (endDateRaw) {
    endDateExclusive = new Date(endDateRaw);
    endDateExclusive.setDate(endDateExclusive.getDate() + 1);
  }

  const createdAt: Prisma.DateTimeFilter | undefined =
    startDate || endDateExclusive
      ? {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDateExclusive ? { lt: endDateExclusive } : {}),
        }
      : undefined;

  return { startDate, endDateExclusive, createdAt };
}

function uniqueUserCount(rows: Array<{ userId: string | null }>) {
  return new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))).size;
}

function resolveGroupedCount(row: { _count: { _all?: number; catalogItemId?: number; collateralId?: number } }): number {
  return row._count._all ?? row._count.catalogItemId ?? row._count.collateralId ?? 0;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { startDate, endDateExclusive, createdAt } = normalizeDateRange(searchParams);

    const projectWhereWithDate: Prisma.ProjectWhereInput = createdAt ? { createdAt } : {};
    const eventWhereWithDate: Prisma.ProjectEventWhereInput = createdAt ? { createdAt } : {};
    const runItemWhereWithDate: Prisma.ProjectRecommendationRunItemWhereInput = createdAt ? { createdAt } : {};
    const recommendationWhereWithDate: Prisma.ProjectRecommendationWhereInput = createdAt ? { createdAt } : {};

    const runItemDelegate = (
      prisma as unknown as {
        projectRecommendationRunItem?: {
          groupBy?: (args: {
            by: ["catalogItemId"];
            where: Prisma.ProjectRecommendationRunItemWhereInput;
            _count: { _all: true };
            orderBy: { _count: { catalogItemId: "desc" } };
            take: number;
          }) => Promise<Array<{ catalogItemId: string; _count: { _all: number } }>>;
        };
      }
    ).projectRecommendationRunItem;
    const eventDelegate = (prisma as unknown as { projectEvent?: typeof prisma.projectRecommendation }).projectEvent;

    const [totalProjects, stageGroups, statusGroups, docsOnly, notesOnly, bothInputs, neitherInput] =
      await Promise.all([
        prisma.project.count({ where: projectWhereWithDate }),
        prisma.project.groupBy({
          by: ["workflowStage"],
          where: projectWhereWithDate,
          _count: { _all: true },
        }),
        prisma.project.groupBy({
          by: ["status"],
          where: projectWhereWithDate,
          _count: { _all: true },
        }),
        prisma.project.count({
          where: {
            AND: [projectWhereWithDate, EMPTY_OR_NULL_NOTES, { requirementDocs: { some: {} } }],
          },
        }),
        prisma.project.count({
          where: {
            AND: [projectWhereWithDate, HAS_NOTES, { requirementDocs: { none: {} } }],
          },
        }),
        prisma.project.count({
          where: {
            AND: [projectWhereWithDate, HAS_NOTES, { requirementDocs: { some: {} } }],
          },
        }),
        prisma.project.count({
          where: {
            AND: [projectWhereWithDate, { requirementDocs: { none: {} } }, EMPTY_OR_NULL_NOTES],
          },
        }),
      ]);

    let usersReachedRecommendations = 0;
    let usersSelectedService = 0;
    let usersUploadedDocs = 0;
    let usersEnteredNotes = 0;
    let usersUsedBothDocsAndNotes = 0;

    const [
      baselineUsersReachedRows,
      baselineUsersSelectedRows,
      baselineUsersUploadedDocsRows,
      baselineUsersEnteredNotesRows,
      baselineUsersBothRows,
    ] = await Promise.all([
      prisma.project.findMany({
        where: {
          AND: [
            projectWhereWithDate,
            { userId: { not: null } },
            { workflowStage: { in: ["RECOMMENDATIONS_READY", "SERVICE_SELECTED"] } },
          ],
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.project.findMany({
        where: {
          AND: [projectWhereWithDate, { userId: { not: null } }, { workflowStage: "SERVICE_SELECTED" }],
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.project.findMany({
        where: {
          AND: [projectWhereWithDate, { userId: { not: null } }, { requirementDocs: { some: {} } }],
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.project.findMany({
        where: {
          AND: [projectWhereWithDate, { userId: { not: null } }, HAS_NOTES],
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.project.findMany({
        where: {
          AND: [projectWhereWithDate, { userId: { not: null } }, HAS_NOTES, { requirementDocs: { some: {} } }],
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);

    const baselineUsersReached = baselineUsersReachedRows.length;
    const baselineUsersSelected = baselineUsersSelectedRows.length;
    const baselineUsersUploadedDocs = baselineUsersUploadedDocsRows.length;
    const baselineUsersEnteredNotes = baselineUsersEnteredNotesRows.length;
    const baselineUsersBoth = baselineUsersBothRows.length;

    if (eventDelegate) {
      const [reachedRows, selectedRows, docsRows, notesRows] = await Promise.all([
        prisma.projectEvent.findMany({
          where: {
            ...eventWhereWithDate,
            userId: { not: null },
            eventType: "RECOMMENDATIONS_GENERATED",
          },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.projectEvent.findMany({
          where: {
            ...eventWhereWithDate,
            userId: { not: null },
            eventType: { in: ["RECOMMENDATION_ADOPTED", "SERVICE_MANUALLY_ADDED"] },
          },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.projectEvent.findMany({
          where: {
            ...eventWhereWithDate,
            userId: { not: null },
            eventType: "REQUIREMENT_DOC_UPLOADED",
          },
          select: { userId: true },
          distinct: ["userId"],
        }),
        prisma.projectEvent.findMany({
          where: {
            ...eventWhereWithDate,
            userId: { not: null },
            eventType: "NOTES_ENTERED",
          },
          select: { userId: true },
          distinct: ["userId"],
        }),
      ]);

      usersReachedRecommendations = Math.max(uniqueUserCount(reachedRows), baselineUsersReached);
      usersSelectedService = Math.max(uniqueUserCount(selectedRows), baselineUsersSelected);
      usersUploadedDocs = Math.max(uniqueUserCount(docsRows), baselineUsersUploadedDocs);
      usersEnteredNotes = Math.max(uniqueUserCount(notesRows), baselineUsersEnteredNotes);

      const docsSet = new Set(docsRows.map((row) => row.userId).filter((id): id is string => Boolean(id)));
      const notesSet = new Set(notesRows.map((row) => row.userId).filter((id): id is string => Boolean(id)));
      usersUsedBothDocsAndNotes = Math.max(Array.from(docsSet).filter((id) => notesSet.has(id)).length, baselineUsersBoth);
    } else {
      usersReachedRecommendations = baselineUsersReached;
      usersSelectedService = baselineUsersSelected;
      usersUploadedDocs = baselineUsersUploadedDocs;
      usersEnteredNotes = baselineUsersEnteredNotes;
      usersUsedBothDocsAndNotes = baselineUsersBoth;
    }

    let topRecommendedRaw: Array<{ catalogItemId: string; _count: { _all: number } }> = [];
    if (runItemDelegate?.groupBy) {
      topRecommendedRaw = await runItemDelegate.groupBy({
        by: ["catalogItemId"],
        where: runItemWhereWithDate,
        _count: { _all: true },
        orderBy: { _count: { catalogItemId: "desc" } },
        take: 10,
      });
      if (topRecommendedRaw.length === 0) {
        const groupedRecommendations = await prisma.projectRecommendation.groupBy({
          by: ["catalogItemId"],
          where: recommendationWhereWithDate,
          _count: { _all: true },
          orderBy: { _count: { catalogItemId: "desc" } },
          take: 10,
        });
        topRecommendedRaw = groupedRecommendations as Array<{ catalogItemId: string; _count: { _all: number } }>;
      }
    } else {
      const groupedRecommendations = await prisma.projectRecommendation.groupBy({
        by: ["catalogItemId"],
        where: recommendationWhereWithDate,
        _count: { _all: true },
        orderBy: { _count: { catalogItemId: "desc" } },
        take: 10,
      });
      topRecommendedRaw = groupedRecommendations as Array<{ catalogItemId: string; _count: { _all: number } }>;
    }

    let topPickedRaw: Array<{ catalogItemId: string | null; _count: { _all: number } }> = [];
    let topCollateralRaw: Array<{ collateralId: string | null; _count: { _all: number } }> = [];
    let totalCollateralClicks = 0;

    if (eventDelegate) {
      [topPickedRaw, topCollateralRaw, totalCollateralClicks] = await Promise.all([
        prisma.projectEvent.groupBy({
          by: ["catalogItemId"],
          where: {
            ...eventWhereWithDate,
            eventType: { in: ["RECOMMENDATION_ADOPTED", "SERVICE_MANUALLY_ADDED"] },
            catalogItemId: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { catalogItemId: "desc" } },
          take: 10,
        }),
        prisma.projectEvent.groupBy({
          by: ["collateralId"],
          where: {
            ...eventWhereWithDate,
            eventType: "COLLATERAL_CLICKED",
            collateralId: { not: null },
          },
          _count: { _all: true },
          orderBy: { _count: { collateralId: "desc" } },
          take: 10,
        }),
        prisma.projectEvent.count({
          where: {
            ...eventWhereWithDate,
            eventType: "COLLATERAL_CLICKED",
          },
        }),
      ]);
      if (topPickedRaw.length === 0) {
        const groupedAdopted = await prisma.projectRecommendation.groupBy({
          by: ["catalogItemId"],
          where: {
            ...recommendationWhereWithDate,
            state: "ADOPTED",
          },
          _count: { _all: true },
          orderBy: { _count: { catalogItemId: "desc" } },
          take: 10,
        });
        topPickedRaw = groupedAdopted as Array<{ catalogItemId: string | null; _count: { _all: number } }>;
      }
    } else {
      const groupedAdopted = await prisma.projectRecommendation.groupBy({
        by: ["catalogItemId"],
        where: {
          ...recommendationWhereWithDate,
          state: "ADOPTED",
        },
        _count: { _all: true },
        orderBy: { _count: { catalogItemId: "desc" } },
        take: 10,
      });
      topPickedRaw = groupedAdopted as Array<{ catalogItemId: string | null; _count: { _all: number } }>;
    }

    const stageCountMap = new Map(stageGroups.map((row) => [row.workflowStage, row._count._all]));
    const statusCountMap = new Map(statusGroups.map((row) => [row.status, row._count._all]));

    const allRecommendedItemIds = topRecommendedRaw.map((row) => row.catalogItemId);
    const allPickedItemIds = topPickedRaw
      .map((row) => row.catalogItemId)
      .filter((value): value is string => Boolean(value));
    const allItemIds = Array.from(new Set([...allRecommendedItemIds, ...allPickedItemIds]));

    const [catalogItems, collaterals] = await Promise.all([
      prisma.catalogItem.findMany({
        where: { id: { in: allItemIds } },
        select: { id: true, sku: true, name: true, type: true },
      }),
      prisma.itemCollateral.findMany({
        where: {
          id: {
            in: topCollateralRaw
              .map((row) => row.collateralId)
              .filter((value): value is string => Boolean(value)),
          },
        },
        include: {
          catalogItem: {
            select: { id: true, name: true, sku: true },
          },
        },
      }),
    ]);

    const catalogMap = new Map(catalogItems.map((item) => [item.id, item]));
    const collateralMap = new Map(collaterals.map((item) => [item.id, item]));

    return NextResponse.json({
      summary: {
        totalProjects,
        usersReachedRecommendations,
        usersSelectedService,
        usersUploadedDocs,
        usersEnteredNotes,
        usersUsedBothDocsAndNotes,
        totalCollateralClicks,
      },
      filters: {
        start: startDate ? startDate.toISOString() : null,
        endExclusive: endDateExclusive ? endDateExclusive.toISOString() : null,
      },
      projectsByStage: Object.values(ProjectWorkflowStage).map((stage) => ({
        stage,
        count: stageCountMap.get(stage) ?? 0,
      })),
      projectsByStatus: Object.values(ProjectStatus).map((status) => ({
        status,
        count: statusCountMap.get(status) ?? 0,
      })),
      requirementsInputMix: {
        docsOnly,
        notesOnly,
        both: bothInputs,
        neither: neitherInput,
      },
      topRecommended: topRecommendedRaw.map((row) => ({
        catalogItemId: row.catalogItemId,
        count: resolveGroupedCount(row),
        item: catalogMap.get(row.catalogItemId) ?? null,
      })),
      topPicked: topPickedRaw.map((row) => ({
        catalogItemId: row.catalogItemId,
        count: resolveGroupedCount(row),
        item: row.catalogItemId ? catalogMap.get(row.catalogItemId) ?? null : null,
      })),
      topCollateral: topCollateralRaw.map((row) => ({
        collateralId: row.collateralId,
        count: resolveGroupedCount(row),
        collateral: row.collateralId ? collateralMap.get(row.collateralId) ?? null : null,
      })),
      availableEventTypes: Object.values(ProjectEventType),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch analytics overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
