import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { advanceProjectWorkflowStage, getProjectWorkflowStage, recordProjectEvent } from "@/lib/project-analytics";

function isMissingTableOrColumnError(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    return error.code === "P2021" || error.code === "P2022";
}

type ProjectBaseRow = {
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

async function loadProjectBase(projectId: string, sessionUserId: string): Promise<ProjectBaseRow | null> {
    let originalError: unknown = null;
    try {
        const project = await prisma.project.findFirst({
            where: { id: projectId, userId: sessionUserId },
        });
        return project as ProjectBaseRow | null;
    } catch (error) {
        originalError = error;
    }

    try {
        const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND lower(table_name) = 'project'
        `;

        const hasUserId = columns.some((column) => column.column_name === "userId");
        const hasRawRequirements = columns.some((column) => column.column_name === "rawRequirements");
        const hasManualNotes = columns.some((column) => column.column_name === "manualNotes");
        const hasWorkflowStage = columns.some((column) => column.column_name === "workflowStage");

        const selectClause = [
            `"id"`,
            `"name"`,
            `"customerName"`,
            `"status"`,
            hasWorkflowStage ? `"workflowStage"` : `NULL::text AS "workflowStage"`,
            `"termMonths"`,
            `"createdAt"`,
            `"updatedAt"`,
            hasRawRequirements ? `"rawRequirements"` : `NULL::text AS "rawRequirements"`,
            hasManualNotes ? `"manualNotes"` : `NULL::text AS "manualNotes"`,
            hasUserId ? `"userId"` : `NULL::text AS "userId"`,
        ].join(", ");

        const sql = hasUserId
            ? `SELECT ${selectClause} FROM "Project" WHERE "id" = $1 AND ("userId" = $2 OR "userId" IS NULL) LIMIT 1`
            : `SELECT ${selectClause} FROM "Project" WHERE "id" = $1 LIMIT 1`;

        const rows = hasUserId
            ? await prisma.$queryRawUnsafe<ProjectBaseRow[]>(sql, projectId, sessionUserId)
            : await prisma.$queryRawUnsafe<ProjectBaseRow[]>(sql, projectId);

        return rows[0] ?? null;
    } catch (fallbackError) {
        if (isMissingTableOrColumnError(fallbackError) || isMissingTableOrColumnError(originalError)) {
            return null;
        }
        throw (fallbackError ?? originalError);
    }
}

// GET /api/projects/[id]
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const project = await loadProjectBase(id, session.userId);

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        let items: unknown[] = [];
        try {
            items = await prisma.projectItem.findMany({
                where: { projectId: id },
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
                items = await prisma.projectItem.findMany({
                    where: { projectId: id },
                    include: {
                        catalogItem: {
                            include: { collaterals: true },
                        },
                    },
                    orderBy: { createdAt: "asc" },
                });
            } catch (innerError) {
                console.error("GET /api/projects/[id] items fallback query failed:", innerError);
                items = [];
            }
        }

        let sites: unknown[] = [];
        try {
            sites = await prisma.solutionSite.findMany({
                where: { projectId: id },
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
            sites = [];
        }

        let requirementDocs: unknown[] = [];
        try {
            requirementDocs = await prisma.projectRequirementDocument.findMany({
                where: { projectId: id },
                orderBy: { createdAt: "desc" },
                take: 20,
            });
        } catch (error) {
            console.error("GET /api/projects/[id] requirementDocs query failed:", error);
            requirementDocs = [];
        }

        let recommendations: unknown[] = [];
        try {
            recommendations = await prisma.projectRecommendation.findMany({
                where: { projectId: id },
                include: {
                    catalogItem: {
                        include: { collaterals: true },
                    },
                },
                orderBy: [{ score: "desc" }, { createdAt: "asc" }],
            });
        } catch (error) {
            console.error("GET /api/projects/[id] recommendations query failed:", error);
            recommendations = [];
        }

        return NextResponse.json({
            ...project,
            items,
            sites,
            requirementDocs,
            recommendations,
        });
    } catch (error) {
        console.error("GET /api/projects/[id] failed:", error);
        const message = error instanceof Error ? error.message : "Failed to fetch project";
        const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
        return NextResponse.json({ error: "Failed to fetch project", message, code }, { status: 500 });
    }
}

// PUT /api/projects/[id]
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { name, customerName, status, termMonths, rawRequirements, manualNotes } = await request.json();

        if (status) {
            const current = await prisma.project.findUnique({
                where: { id, userId: session.userId },
                select: { status: true },
            });

            if (!current) {
                return NextResponse.json({ error: "Project not found" }, { status: 404 });
            }

            const VALID_TRANSITIONS: Record<string, string[]> = {
                DRAFT:     ['IN_REVIEW', 'ARCHIVED'],
                IN_REVIEW: ['DRAFT', 'APPROVED', 'ARCHIVED'],
                APPROVED:  ['IN_REVIEW', 'ORDERED', 'ARCHIVED'],
                ORDERED:   ['ARCHIVED'],
                ARCHIVED:  [],
            };

            const allowed = VALID_TRANSITIONS[current.status] ?? [];
            if (!allowed.includes(status)) {
                return NextResponse.json(
                    { error: `Cannot transition from ${current.status} to ${status}` },
                    { status: 422 }
                );
            }
        }

        const hasManualNotes = typeof manualNotes === "string" || manualNotes === null;
        const normalizedManualNotes = hasManualNotes
            ? typeof manualNotes === "string"
                ? manualNotes.trim().length > 0
                    ? manualNotes.trim()
                    : null
                : null
            : undefined;

        const project = await prisma.$transaction(async (tx) => {
            const updated = await tx.project.update({
                where: { id, userId: session.userId },
                data: { name, customerName, status, termMonths, rawRequirements, manualNotes: normalizedManualNotes },
            });

            if (hasManualNotes) {
                const workflowStage = normalizedManualNotes
                    ? await advanceProjectWorkflowStage(tx, id, "REQUIREMENTS_CAPTURED")
                    : await getProjectWorkflowStage(tx, id);

                await recordProjectEvent(tx, {
                    projectId: id,
                    userId: session.userId,
                    eventType: "NOTES_ENTERED",
                    workflowStage,
                    metadata: {
                        hasNotes: Boolean(normalizedManualNotes),
                        noteLength: normalizedManualNotes?.length ?? 0,
                    },
                });
            }

            return updated;
        });

        return NextResponse.json(project);
    } catch {
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }
}

// DELETE /api/projects/[id]
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await prisma.project.delete({ where: { id, userId: session.userId } });
        return new NextResponse(null, { status: 204 });
    } catch {
        return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }
}
