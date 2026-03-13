import { NextRequest, NextResponse } from "next/server";
import { extractTextFromRequirementFile } from "@/lib/requirement-storage";

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const model = String(formData.get("model") ?? "").trim();
    const prompt = String(formData.get("prompt") ?? "").trim();
    const inputText = String(formData.get("inputText") ?? "").trim();
    const fileValue = formData.get("file");
    const file = fileValue instanceof File ? fileValue : null;

    if (!model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    let extractedText = "";
    let fileContext = "";

    if (file) {
      extractedText = await extractTextFromRequirementFile(file);
      fileContext = extractedText
        ? extractedText
        : `Uploaded document: ${file.name} (${file.type || "application/octet-stream"}).`;
    }

    const mergedInput = [inputText, fileContext].filter(Boolean).join("\n\n").trim();
    if (!mergedInput) {
      return NextResponse.json({ error: "Provide input text or upload a file to test the prompt." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    const composedPrompt = `${prompt}

INPUT CONTEXT:
${mergedInput}

Return only the direct answer for this input.`;

    const started = Date.now();
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: composedPrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      }
    );
    const latencyMs = Date.now() - started;
    const payload = (await res.json().catch(() => ({}))) as GeminiResponse & { error?: { message?: string } };

    if (!res.ok) {
      const detail = payload.error?.message || "Model invocation failed";
      return NextResponse.json({ error: detail, model, latencyMs }, { status: res.status });
    }

    const candidate = payload.candidates?.[0];
    const output = candidate?.content?.parts?.[0]?.text ?? "";
    return NextResponse.json({
      model,
      latencyMs,
      finishReason: candidate?.finishReason ?? null,
      usageMetadata: payload.usageMetadata ?? null,
      output,
      inputSummary: {
        inputTextChars: inputText.length,
        uploadedFileName: file?.name ?? null,
        extractedChars: extractedText.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to run prompt test";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
