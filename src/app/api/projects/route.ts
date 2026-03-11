import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/projects
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const projects = await prisma.project.findMany({
            where: {
                userId: session.userId,
            },
            include: {
                sites: {
                    include: {
                        siteSelections: {
                            include: {
                                catalogItem: {
                                    include: { pricing: true },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
        });

        return NextResponse.json(projects);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

// POST /api/projects
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { name, customerName, termMonths, rawRequirements } = await request.json();

        if (!name) {
            return NextResponse.json({ error: "'name' is required" }, { status: 400 });
        }

        const project = await prisma.project.create({
            data: { 
              name, 
              customerName, 
              termMonths: termMonths ?? 36,
              rawRequirements,
              userId: session.userId 
            },
        });

        return NextResponse.json(project, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }
}
