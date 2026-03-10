import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// List all taxonomy terms
export async function GET() {
    try {
        const terms = await prisma.taxonomyTerm.findMany({
            orderBy: { category: 'asc' },
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

        const term = await prisma.taxonomyTerm.upsert({
            where: { id: id || 'new-id' },
            update: { category, value, label },
            create: { category, value, label },
        });

        return NextResponse.json(term);
    } catch (error) {
        console.error("Taxonomy Error:", error);
        return NextResponse.json({ error: "Failed to save taxonomy term" }, { status: 500 });
    }
}
