import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// List all taxonomy terms (capped to prevent runaway queries)
export async function GET() {
    try {
        const terms = await prisma.taxonomyTerm.findMany({
            orderBy: { category: 'asc' },
            take: 1000,
        });
        return NextResponse.json(terms);
    } catch (error) {
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

        const data = {
            category,
            value,
            label,
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
    } catch (error: any) {
        // Log details to server console for debugging
        console.error("DEBUG: Taxonomy Save Error:", {
            message: error.message,
            code: error.code,
            meta: error.meta,
            stack: error.stack?.split('\n')[0] // Just first line for cleaner logs
        });
        
        // Handle unique constraint violation specifically
        if (error.code === 'P2002') {
            const fields = error.meta?.target || ['category', 'value'];
            return NextResponse.json({ 
                error: `Duplicate Entry: A term with this ${fields.join(' and ')} already exists.` 
            }, { status: 400 });
        }
        
        return NextResponse.json({ 
            error: error.message || "Failed to save taxonomy term",
            code: error.code || 'UNKNOWN_DB_ERROR',
            details: error.meta || {}
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
