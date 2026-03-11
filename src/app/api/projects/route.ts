import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/projects
export async function GET() {
    try {
        const projects = await prisma.project.findMany({
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
        });

        return NextResponse.json(projects);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }
}

// POST /api/projects
export async function POST(request: NextRequest) {
    try {
        const { name, customerName, termMonths } = await request.json();

        if (!name) {
            return NextResponse.json({ error: "'name' is required" }, { status: 400 });
        }

        const project = await prisma.project.create({
            data: { name, customerName, termMonths: termMonths ?? 36 },
        });

        return NextResponse.json(project, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }
}
