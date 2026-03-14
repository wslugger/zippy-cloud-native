import { NextResponse } from "next/server";
import {
  ProjectStatus,
  ProjectWorkflowStage,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const VALID_STAGES = new Set(Object.values(ProjectWorkflowStage));
const VALID_STATUSES = new Set(Object.values(ProjectStatus));

function toPositiveInt(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") ?? "").trim();
    const page = toPositiveInt(searchParams.get("page"), 1, 1000000);
    const limit = toPositiveInt(searchParams.get("limit"), 25, 100);
    const skip = (page - 1) * limit;

    const stageParam = searchParams.get("stage");
    const statusParam = searchParams.get("status");

    const stage =
      stageParam && VALID_STAGES.has(stageParam as ProjectWorkflowStage)
        ? (stageParam as ProjectWorkflowStage)
        : undefined;
    const status =
      statusParam && VALID_STATUSES.has(statusParam as ProjectStatus)
        ? (statusParam as ProjectStatus)
        : undefined;

    const notesFilter = searchParams.get("notes");
    const docsFilter = searchParams.get("docs");

    const where: Prisma.ProjectWhereInput = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { customerName: { contains: search, mode: "insensitive" } },
                { user: { is: { email: { contains: search, mode: "insensitive" } } } },
                { user: { is: { name: { contains: search, mode: "insensitive" } } } },
              ],
            }
          : {},
        stage ? { workflowStage: stage } : {},
        status ? { status } : {},
        docsFilter === "yes" ? { requirementDocs: { some: {} } } : {},
        docsFilter === "no" ? { requirementDocs: { none: {} } } : {},
        notesFilter === "yes"
          ? { NOT: { OR: [{ manualNotes: null }, { manualNotes: "" }] } }
          : {},
        notesFilter === "no" ? { OR: [{ manualNotes: null }, { manualNotes: "" }] } : {},
      ],
    };

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          customerName: true,
          status: true,
          workflowStage: true,
          createdAt: true,
          updatedAt: true,
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          _count: {
            select: {
              requirementDocs: true,
              recommendations: true,
              recommendationRuns: true,
              items: true,
              events: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return NextResponse.json({
      projects,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load analytics projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
