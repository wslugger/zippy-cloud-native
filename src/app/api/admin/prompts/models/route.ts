import { NextResponse } from "next/server";

const FALLBACK_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ models: FALLBACK_MODELS, source: "fallback" });
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!res.ok) {
      return NextResponse.json({ models: FALLBACK_MODELS, source: "fallback" });
    }

    const payload = await res.json() as { models?: Array<{ name?: string }> };
    const models = (payload.models ?? [])
      .map((model) => model.name ?? "")
      .filter((name) => name.startsWith("models/"))
      .map((name) => name.replace(/^models\//, ""))
      .filter((name) => name.startsWith("gemini-"))
      .sort((a, b) => a.localeCompare(b));

    if (models.length === 0) {
      return NextResponse.json({ models: FALLBACK_MODELS, source: "fallback" });
    }

    return NextResponse.json({ models, source: "live" });
  } catch {
    return NextResponse.json({ models: FALLBACK_MODELS, source: "fallback" });
  }
}
