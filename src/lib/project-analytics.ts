import { prisma } from "@/lib/prisma";
import { Prisma, ProjectEventType, ProjectWorkflowStage } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

const STAGE_ORDER: Record<ProjectWorkflowStage, number> = {
  PROJECT_CREATED: 0,
  REQUIREMENTS_CAPTURED: 1,
  RECOMMENDATIONS_READY: 2,
  SERVICE_SELECTED: 3,
};

export async function getProjectWorkflowStage(
  db: DbClient,
  projectId: string
): Promise<ProjectWorkflowStage | null> {
  const row = await db.project.findUnique({
    where: { id: projectId },
    select: { workflowStage: true },
  });
  return row?.workflowStage ?? null;
}

export async function advanceProjectWorkflowStage(
  db: DbClient,
  projectId: string,
  nextStage: ProjectWorkflowStage
): Promise<ProjectWorkflowStage | null> {
  const currentStage = await getProjectWorkflowStage(db, projectId);
  if (!currentStage) return null;

  if (STAGE_ORDER[nextStage] <= STAGE_ORDER[currentStage]) {
    return currentStage;
  }

  await db.project.update({
    where: { id: projectId },
    data: { workflowStage: nextStage },
  });

  return nextStage;
}

export async function recordProjectEvent(
  db: DbClient,
  input: {
    projectId: string;
    userId?: string | null;
    eventType: ProjectEventType;
    workflowStage?: ProjectWorkflowStage | null;
    catalogItemId?: string | null;
    collateralId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  return db.projectEvent.create({
    data: {
      projectId: input.projectId,
      userId: input.userId ?? null,
      eventType: input.eventType,
      workflowStage: input.workflowStage ?? null,
      catalogItemId: input.catalogItemId ?? null,
      collateralId: input.collateralId ?? null,
      metadata: input.metadata,
    },
  });
}
