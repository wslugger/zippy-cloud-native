import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const project = await prisma.project.findUnique({
            where: { id, userId: session.userId }
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        const { catalogItemId, quantity } = await request.json();

        if (!catalogItemId) {
            return NextResponse.json({ error: "catalogItemId is required" }, { status: 400 });
        }

        const projectItem = await prisma.projectItem.create({
            data: {
                projectId: id,
                catalogItemId,
                quantity: quantity ?? 1
            },
            include: {
                catalogItem: true
            }
        });

        return NextResponse.json(projectItem, { status: 201 });
    } catch (error) {
        console.error("Error creating project item:", error);
        return NextResponse.json({ error: "Failed to add project item" }, { status: 500 });
    }
}
