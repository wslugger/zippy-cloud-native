import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildDesignDocumentModel, updateDraftDesignDocument } from "@/lib/design-document";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const model = await buildDesignDocumentModel({ projectId, userId: session.userId });
  if (!model) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(model);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;
  const body = (await request.json()) as {
    title?: string;
    executiveSummary?: string;
    conclusions?: string;
  };

  const existing = await buildDesignDocumentModel({ projectId, userId: session.userId });
  if (!existing) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await updateDraftDesignDocument({
    projectId,
    ...(typeof body.title === "string" ? { title: body.title.trim() || "Design Document" } : {}),
    ...(typeof body.executiveSummary === "string" ? { executiveSummary: body.executiveSummary.trim() } : {}),
    ...(typeof body.conclusions === "string" ? { conclusions: body.conclusions.trim() } : {}),
  });

  const updated = await buildDesignDocumentModel({ projectId, userId: session.userId });
  if (!updated) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
