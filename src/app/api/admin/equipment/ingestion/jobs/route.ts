import { NextRequest, NextResponse } from "next/server";
import { EquipmentIngestionJobStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function hasEquipmentIngestionDelegate(): boolean {
  return Boolean((prisma as unknown as { equipmentIngestionJob?: unknown }).equipmentIngestionJob);
}

function parseUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const urls = input
    .filter((row): row is string => typeof row === "string")
    .map((row) => row.trim())
    .filter(Boolean);
  return Array.from(new Set(urls));
}

function normalizeUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    if (!hasEquipmentIngestionDelegate()) {
      return NextResponse.json(
        { error: "Prisma client is stale. Run `npx prisma generate` and restart the dev server." },
        { status: 500 }
      );
    }

    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jobs = await prisma.equipmentIngestionJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        _count: { select: { sources: true } },
      },
    });

    return NextResponse.json({ jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load ingestion jobs";
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        { error: "Equipment ingestion schema is not available. Run latest Prisma migrations.", code },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasEquipmentIngestionDelegate()) {
      return NextResponse.json(
        { error: "Prisma client is stale. Run `npx prisma generate` and restart the dev server." },
        { status: 500 }
      );
    }

    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as { urls?: unknown };
    const urls = parseUrls(body.urls);

    if (urls.length === 0) {
      return NextResponse.json({ error: "Provide at least one valid URL." }, { status: 400 });
    }

    const normalizedUrls = urls
      .map((url) => ({ url, normalizedUrl: normalizeUrl(url) }))
      .filter((row): row is { url: string; normalizedUrl: string } => Boolean(row.normalizedUrl));

    if (normalizedUrls.length === 0) {
      return NextResponse.json({ error: "No valid URLs were provided." }, { status: 400 });
    }

    const job = await prisma.equipmentIngestionJob.create({
      data: {
        status: EquipmentIngestionJobStatus.PENDING,
        submittedBy: session.userId,
        sources: {
          create: normalizedUrls.map((row) => ({
            url: row.url,
            normalizedUrl: row.normalizedUrl,
          })),
        },
      },
      include: {
        sources: true,
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create ingestion job";
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
    if (code === "P2021" || code === "P2022") {
      return NextResponse.json(
        { error: "Equipment ingestion schema is not available. Run latest Prisma migrations.", code },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: message, code }, { status: 500 });
  }
}
