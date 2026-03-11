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
    try {
        const body = await request.json();
        const { id, category, value, label } = body;

        if (!category || !value || !label) {
            return NextResponse.json({ error: "'category', 'value', and 'label' are required" }, { status: 400 });
        }

        let term;
        if (id) {
            // Update existing record
            term = await prisma.taxonomyTerm.update({
                where: { id },
                data: { category, value, label },
            });
        } else {
            // Create new record — never use a fake fallback ID
            term = await prisma.taxonomyTerm.create({
                data: { category, value, label },
            });
        }

        return NextResponse.json(term);
    } catch (error) {
        console.error("Taxonomy Error:", error);
        return NextResponse.json({ error: "Failed to save taxonomy term" }, { status: 500 });
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
