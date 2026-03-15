import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
    isFeatureOrOptionLifecycleStatus,
    normalizeLifecycleStatus,
} from "@/lib/lifecycle-status";

// List all taxonomy terms (capped to prevent runaway queries)
export async function GET() {
    try {
        const terms = await prisma.taxonomyTerm.findMany({
            orderBy: { category: 'asc' },
            take: 1000,
        });
        return NextResponse.json(terms);
    } catch {
        return NextResponse.json({ error: "Failed to fetch taxonomy terms" }, { status: 500 });
    }
}

// Create or Update a taxonomy term
export async function POST(request: Request) {
    let body;
    try {
        body = await request.json();
        const { id, category, value, label, description, constraints, assumptions } = body;

        if (!category || !value || !label) {
            return NextResponse.json({ error: "'category', 'value', and 'label' are required" }, { status: 400 });
        }

        const normalizedCategory = String(category).trim().toUpperCase();
        const normalizedLifecycleStatus = normalizeLifecycleStatus(body.lifecycleStatus);
        const lifecycleStatus = normalizedCategory === "FEATURE"
            ? (normalizedLifecycleStatus ?? "SUPPORTED")
            : "SUPPORTED";

        if (normalizedCategory === "FEATURE" && !isFeatureOrOptionLifecycleStatus(lifecycleStatus)) {
            return NextResponse.json(
                { error: `Invalid lifecycle status '${body.lifecycleStatus}'.` },
                { status: 400 }
            );
        }

        const data = {
            category: normalizedCategory,
            value,
            label,
            lifecycleStatus,
            description: description ?? null,
            constraints: constraints ?? [],
            assumptions: assumptions ?? [],
        };

        let term;
        if (id) {
            term = await prisma.taxonomyTerm.update({
                where: { id },
                data,
            });
        } else {
            term = await prisma.taxonomyTerm.create({
                data,
            });
        }

        return NextResponse.json(term);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to save taxonomy term";
        const stack = error instanceof Error ? error.stack?.split('\n')[0] : undefined;
        const prismaCode = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
        const prismaMeta = error instanceof Prisma.PrismaClientKnownRequestError ? error.meta : undefined;

        // Log details to server console for debugging
        console.error("DEBUG: Taxonomy Save Error:", {
            message,
            code: prismaCode,
            meta: prismaMeta,
            stack // Just first line for cleaner logs
        });
        
        // Handle unique constraint violation specifically
        if (prismaCode === 'P2002') {
            const target = (prismaMeta as { target?: unknown } | undefined)?.target;
            const fields = Array.isArray(target) ? target : ['category', 'value'];
            return NextResponse.json({
                error: `Duplicate Entry: A term with this ${fields.join(' and ')} already exists.`
            }, { status: 400 });
        }
        
        return NextResponse.json({ 
            error: message,
            code: prismaCode || 'UNKNOWN_DB_ERROR',
            details: prismaMeta || {}
        }, { status: 500 });
    }
}

// Delete a taxonomy term
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: "'id' query param is required" }, { status: 400 });
    }

    try {
        await prisma.taxonomyTerm.delete({ where: { id } });
        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("Taxonomy Delete Error:", error);
        return NextResponse.json({ error: "Failed to delete taxonomy term" }, { status: 500 });
    }
}
