import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { advanceProjectWorkflowStage, getProjectWorkflowStage, recordProjectEvent } from "@/lib/project-analytics";
import {
    getProjectDetailBundle,
    getProjectStatusForUser,
    isProjectStatusTransitionAllowed,
} from "@/lib/services/project.service";

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

        const bundle = await getProjectDetailBundle(id, session.userId);
        if (!bundle) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        return NextResponse.json({
            ...bundle.project,
            items: bundle.items,
            sites: bundle.sites,
            requirementDocs: bundle.requirementDocs,
            recommendations: bundle.recommendations,
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
            const currentStatus = await getProjectStatusForUser(id, session.userId);
            if (!currentStatus) {
                return NextResponse.json({ error: "Project not found" }, { status: 404 });
            }
            if (!isProjectStatusTransitionAllowed(currentStatus, status)) {
                return NextResponse.json(
                    { error: `Cannot transition from ${currentStatus} to ${status}` },
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
