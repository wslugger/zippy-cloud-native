import { prisma } from "@/lib/prisma";

export type ProjectBaseRow = {
  id: string;
  name: string;
  customerName: string | null;
  status: string;
  workflowStage: string | null;
  termMonths: number;
  createdAt: Date;
  updatedAt: Date;
  rawRequirements: string | null;
  manualNotes: string | null;
  userId: string | null;
};

export type ProjectDetailBundle = {
  project: ProjectBaseRow;
  items: unknown[];
  sites: unknown[];
  requirementDocs: unknown[];
  recommendations: unknown[];
};

const VALID_PROJECT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["IN_REVIEW", "ARCHIVED"],
  IN_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["IN_REVIEW", "ORDERED", "ARCHIVED"],
  ORDERED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function isProjectStatusTransitionAllowed(currentStatus: string, nextStatus: string): boolean {
  const allowed = VALID_PROJECT_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(nextStatus);
}

export async function getProjectStatusForUser(projectId: string, userId: string): Promise<string | null> {
  const current = await prisma.project.findUnique({
    where: { id: projectId, userId },
    select: { status: true },
  });
  return current?.status ?? null;
}

async function loadProjectBase(projectId: string, sessionUserId: string): Promise<ProjectBaseRow | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: sessionUserId },
  });
  return project as ProjectBaseRow | null;
}

async function loadProjectItems(projectId: string): Promise<unknown[]> {
  try {
    return await prisma.projectItem.findMany({
      where: { projectId },
      include: {
        catalogItem: {
          include: {
            collaterals: true,
            packageCompositions: {
              include: {
                catalogItem: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                    type: true,
                  },
                },
              },
              orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
        designOptions: {
          include: { term: true },
        },
      } as const,
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("GET /api/projects/[id] items query failed:", error);
    try {
      return await prisma.projectItem.findMany({
        where: { projectId },
        include: {
          catalogItem: {
            include: { collaterals: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });
    } catch (innerError) {
      console.error("GET /api/projects/[id] items fallback query failed:", innerError);
      return [];
    }
  }
}

async function loadProjectSites(projectId: string): Promise<unknown[]> {
  try {
    return await prisma.solutionSite.findMany({
      where: { projectId },
      include: {
        primaryService: true,
        siteSelections: {
          include: {
            catalogItem: {
              include: {
                pricing: true,
                attributes: { include: { term: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  } catch (error) {
    console.error("GET /api/projects/[id] sites query failed:", error);
    return [];
  }
}

async function loadProjectRequirementDocs(projectId: string): Promise<unknown[]> {
  try {
    return await prisma.projectRequirementDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  } catch (error) {
    console.error("GET /api/projects/[id] requirementDocs query failed:", error);
    return [];
  }
}

async function loadProjectRecommendations(projectId: string): Promise<unknown[]> {
  try {
    return await prisma.projectRecommendation.findMany({
      where: { projectId },
      include: {
        catalogItem: {
          include: { collaterals: true },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    });
  } catch (error) {
    console.error("GET /api/projects/[id] recommendations query failed:", error);
    return [];
  }
}

export async function getProjectDetailBundle(
  projectId: string,
  userId: string,
): Promise<ProjectDetailBundle | null> {
  const project = await loadProjectBase(projectId, userId);
  if (!project) return null;

  const [items, sites, requirementDocs, recommendations] = await Promise.all([
    loadProjectItems(projectId),
    loadProjectSites(projectId),
    loadProjectRequirementDocs(projectId),
    loadProjectRecommendations(projectId),
  ]);

  return {
    project,
    items,
    sites,
    requirementDocs,
    recommendations,
  };
}
