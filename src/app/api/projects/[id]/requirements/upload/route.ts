import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { prisma } from "@/lib/prisma";
import { advanceProjectWorkflowStage, recordProjectEvent } from "@/lib/project-analytics";
import {
  extractTextFromRequirementFile,
  uploadRequirementToGcs,
} from "@/lib/requirement-storage";

function toLocalEphemeralUri(projectId: string, fileName: string): string {
  const safeName = (fileName || "requirements.txt")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 180);
  return `local://requirements/${projectId}/${Date.now()}-${safeName}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  try {
    await assertProjectOwnership(projectId, session.userId);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "'file' form field is required" }, { status: 400 });
    }

    const mimeType = file.type || "application/octet-stream";
    const extractedText = await extractTextFromRequirementFile(file);
    let gcsUri = toLocalEphemeralUri(projectId, file.name);

    if (process.env.GCS_REQUIREMENTS_BUCKET) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const uploaded = await uploadRequirementToGcs({
        projectId,
        fileName: file.name,
        mimeType,
        bytes,
      });
      gcsUri = uploaded.gcsUri;
    }

    const docStatus = extractedText ? "PARSED" : "UPLOADED";
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.projectRequirementDocument.create({
        data: {
          projectId,
          fileName: file.name,
          mimeType,
          gcsUri,
          extractedText,
          status: docStatus,
        },
      });

      const workflowStage = await advanceProjectWorkflowStage(tx, projectId, "REQUIREMENTS_CAPTURED");
      await recordProjectEvent(tx, {
        projectId,
        userId: session.userId,
        eventType: "REQUIREMENT_DOC_UPLOADED",
        workflowStage: workflowStage ?? "REQUIREMENTS_CAPTURED",
        metadata: {
          fileName: file.name,
          mimeType,
          status: docStatus,
        },
      });

      return created;
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload requirement file";

    if (message === "PROJECT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
