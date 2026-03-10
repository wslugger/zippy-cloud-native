import { NextRequest, NextResponse } from "next/server";
import { calculateBOM } from "@/lib/bom-engine";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sku_ids } = body;

        if (!sku_ids || !Array.isArray(sku_ids)) {
            return NextResponse.json(
                { error: "Invalid request. 'sku_ids' must be an array of strings." },
                { status: 400 }
            );
        }

        if (sku_ids.length === 0) {
            return NextResponse.json({
                lineItems: [],
                totals: { totalNrc: 0, totalMrc: 0 },
                warnings: [],
            });
        }

        const result = await calculateBOM(sku_ids);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("BOM Calculation Error:", error);
        return NextResponse.json(
            { error: "Internal server error during BOM calculation." },
            { status: 500 }
        );
    }
}
