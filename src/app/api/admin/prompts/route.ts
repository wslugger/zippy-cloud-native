import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const configs = await prisma.systemConfig.findMany({
            where: { key: { startsWith: 'PROMPT_' } },
            orderBy: { updatedAt: 'desc' },
        });
        return NextResponse.json(configs);
    } catch (error) {
        console.error("GET PROMPTS ERROR:", error);
        return NextResponse.json({ error: "Failed to fetch AI prompts" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { key, value, description } = body;

        if (!key || !value) {
            return NextResponse.json({ error: "'key' and 'value' are required" }, { status: 400 });
        }

        const config = await prisma.systemConfig.upsert({
            where: { key },
            update: { value, description },
            create: { key, value, description },
        });

        return NextResponse.json(config);
    } catch (error) {
        console.error("POST PROMPT ERROR:", error);
        return NextResponse.json({ error: "Failed to save AI prompt" }, { status: 500 });
    }
}
