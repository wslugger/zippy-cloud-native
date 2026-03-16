import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { processEquipmentIngestionJob } from "@/lib/equipment-catalog";
import { prisma } from "@/lib/prisma";
import { EquipmentIngestionSourceStatus } from "@prisma/client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;

  try {
    await processEquipmentIngestionJob(jobId);
    const job = await prisma.equipmentIngestionJob.findUnique({
      where: { id: jobId },
      include: {
        sources: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            url: true,
            status: true,
            errorMessage: true,
            catalogItemId: true,
          },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Ingestion job not found after processing." }, { status: 404 });
    }

    const upsertedCount = job.sources.filter((source) => source.status === EquipmentIngestionSourceStatus.UPSERTED).length;
    const failedCount = job.sources.filter((source) => source.status === EquipmentIngestionSourceStatus.FAILED).length;

    return NextResponse.json({
      success: failedCount === 0 && upsertedCount > 0,
      job,
      upsertedCount,
      failedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process ingestion job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
