import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/catalog/compare?ids=id1,id2,id3
// Returns feature comparison matrix for selected catalog items
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get('ids');

    if (!idsParam) {
        return NextResponse.json({ error: "Query param 'ids' is required" }, { status: 400 });
    }

    const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean);
    if (ids.length === 0) {
        return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });
    }

    try {
        const items = await prisma.catalogItem.findMany({
            where: { id: { in: ids } },
            include: {
                attributes: {
                    include: { term: true },
                    where: {
                        term: { category: { in: ['FEATURE'] } },
                    },
                },
                pricing: true,
            },
        });

        // Collect all unique feature attribute values across all items
        const allTerms = new Map<string, { id: string; category: string; value: string; label: string }>();
        for (const item of items) {
            for (const attr of item.attributes) {
                allTerms.set(attr.term.id, {
                    id: attr.term.id,
                    category: attr.term.category,
                    value: attr.term.value,
                    label: attr.term.label,
                });
            }
        }

        const terms = Array.from(allTerms.values()).sort((a, b) =>
            a.category.localeCompare(b.category) || a.label.localeCompare(b.label)
        );

        const matrix = items.map(item => {
            const itemTermIds = new Set(item.attributes.map(a => a.taxonomyTermId));
            return {
                id: item.id,
                sku: item.sku,
                name: item.name,
                type: item.type,
                pricing: item.pricing,
                features: terms.map(term => ({
                    termId: term.id,
                    has: itemTermIds.has(term.id),
                })),
            };
        });

        return NextResponse.json({ terms, items: matrix });
    } catch (error) {
        return NextResponse.json({ error: "Failed to build comparison matrix" }, { status: 500 });
    }
}
