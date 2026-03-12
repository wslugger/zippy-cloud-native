import { prisma } from "@/lib/prisma";

export async function getOwnedProjectOrNull(projectId: string, userId: string) {
  return prisma.project.findUnique({
    where: { id: projectId, userId },
  });
}

export async function assertProjectOwnership(projectId: string, userId: string) {
  const project = await getOwnedProjectOrNull(projectId, userId);
  if (!project) {
    throw new Error("PROJECT_NOT_FOUND_OR_FORBIDDEN");
  }
  return project;
}
