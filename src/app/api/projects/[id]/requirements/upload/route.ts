import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertProjectOwnership } from "@/lib/project-ownership";
import { prisma } from "@/lib/prisma";
import {
  extractTextFromRequirementFile,
  uploadRequirementToGcs,
} from "@/lib/requirement-storage";

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
    const bytes = new Uint8Array(await file.arrayBuffer());
    const extractedText = await extractTextFromRequirementFile(file);

    const { gcsUri } = await uploadRequirementToGcs({
      projectId,
      fileName: file.name,
      mimeType,
      bytes,
    });

    const document = await prisma.projectRequirementDocument.create({
      data: {
        projectId,
        fileName: file.name,
        mimeType,
        gcsUri,
        extractedText,
        status: extractedText ? "PARSED" : "UPLOADED",
      },
    });

    if (extractedText) {
      const current = await prisma.project.findUnique({
        where: { id: projectId },
        select: { rawRequirements: true },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: {
          rawRequirements: [current?.rawRequirements, extractedText].filter(Boolean).join("\n\n"),
        },
      });
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload requirement file";

    if (message === "PROJECT_NOT_FOUND_OR_FORBIDDEN") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
