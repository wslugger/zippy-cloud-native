import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import {
  EquipmentPurpose,
  EquipmentReviewStatus,
  EquipmentIngestionJobStatus,
  EquipmentIngestionSourceStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSystemConfigValue, normalizeGeminiJson } from "@/lib/recommendation-engine";

const execFileAsync = promisify(execFile);
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const EXTRACTION_CHUNK_SIZE = 40_000;
const EXTRACTION_CHUNK_OVERLAP = 3_000;
const EXTRACTION_MAX_CHUNKS = 8;
const EXTRACTION_BATCH_SIZE = 4;
const EXTRACTION_MAX_PASSES_PER_CHUNK = 6;

export interface EquipmentDraftInput {
  make: string;
  model: string;
  pricingSku?: string | null;
  family?: string | null;
  primaryPurpose: EquipmentPurpose;
  secondaryPurposes: EquipmentPurpose[];
  vendorDatasheetUrl?: string | null;
  wanSpec?: {
    throughputMbps?: number | null;
    vpnTunnels?: number | null;
    cellularSupport?: boolean | null;
    formFactor?: string | null;
    interfaces?: unknown;
  } | null;
  lanSpec?: {
    portCount?: number | null;
    portSpeed?: string | null;
    poeBudgetWatts?: number | null;
    stackable?: boolean | null;
    uplinkPorts?: unknown;
  } | null;
  wlanSpec?: {
    wifiStandard?: string | null;
    maxClients?: number | null;
    indoorOutdoor?: string | null;
    radios?: unknown;
  } | null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized.length > 0 ? normalized : null;
}

function asNullableInt(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "yes" || normalized === "1";
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean)));
}

export function normalizeEquipmentPurpose(value: unknown): EquipmentPurpose | null {
  const normalized = asString(value).toUpperCase();
  if (normalized === "WAN") return EquipmentPurpose.WAN;
  if (normalized === "LAN") return EquipmentPurpose.LAN;
  if (normalized === "WLAN") return EquipmentPurpose.WLAN;
  return null;
}

export function normalizeEquipmentPurposeArray(value: unknown): EquipmentPurpose[] {
  if (!Array.isArray(value)) return [];
  const rows = value.map((entry) => normalizeEquipmentPurpose(entry)).filter((entry): entry is EquipmentPurpose => Boolean(entry));
  return Array.from(new Set(rows));
}

export function normalizeMakeModelKey(make: string, model: string): string {
  return `${make.trim().toLowerCase()}::${model.trim().toLowerCase()}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function buildUniqueHardwareSku(make: string, model: string): Promise<string> {
  const base = `HW-${slugify(`${make}-${model}`) || randomUUID().slice(0, 8)}`.toUpperCase();
  const existing = await prisma.catalogItem.findMany({
    where: { sku: { startsWith: base } },
    select: { sku: true },
  });
  if (!existing.some((row) => row.sku === base)) return base;

  let idx = 2;
  while (true) {
    const candidate = `${base}-${idx}`;
    if (!existing.some((row) => row.sku === candidate)) return candidate;
    idx += 1;
  }
}

function coerceJsonArray(value: unknown): Prisma.InputJsonValue {
  if (Array.isArray(value)) {
    return value as Prisma.InputJsonValue;
  }
  return [] as Prisma.InputJsonValue;
}

function hasPrimaryMetric(input: EquipmentDraftInput): boolean {
  if (input.primaryPurpose === EquipmentPurpose.WAN) {
    return input.wanSpec?.throughputMbps != null || input.wanSpec?.vpnTunnels != null || Boolean(input.wanSpec?.formFactor);
  }
  if (input.primaryPurpose === EquipmentPurpose.LAN) {
    return input.lanSpec?.portCount != null || input.lanSpec?.poeBudgetWatts != null || Boolean(input.lanSpec?.portSpeed);
  }
  return input.wlanSpec?.maxClients != null || Boolean(input.wlanSpec?.wifiStandard) || Boolean(input.wlanSpec?.indoorOutdoor);
}

export function validateEquipmentPublishable(input: EquipmentDraftInput & { sku: string | null | undefined }): string[] {
  const errors: string[] = [];
  if (!asString(input.make)) errors.push("make is required");
  if (!asString(input.model)) errors.push("model is required");
  if (!asString(input.sku)) errors.push("sku is required");
  if (!input.primaryPurpose) errors.push("primaryPurpose is required");
  if (!asString(input.vendorDatasheetUrl ?? "")) errors.push("vendorDatasheetUrl is required");
  if (!hasPrimaryMetric(input)) errors.push("at least one primary-purpose metric is required");
  return errors;
}

export function normalizeDraftInput(raw: unknown): EquipmentDraftInput | null {
  const input = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : null;
  if (!input) return null;

  const make = asString(input.make);
  const model = asString(input.model);
  const primaryPurpose = normalizeEquipmentPurpose(input.primaryPurpose);
  if (!make || !model || !primaryPurpose) return null;

  return {
    make,
    model,
    pricingSku: asNullableString(input.pricingSku),
    family: asNullableString(input.family),
    primaryPurpose,
    secondaryPurposes: normalizeEquipmentPurposeArray(input.secondaryPurposes).filter((purpose) => purpose !== primaryPurpose),
    vendorDatasheetUrl: asNullableString(input.vendorDatasheetUrl),
    wanSpec: input.wanSpec && typeof input.wanSpec === "object"
      ? {
          throughputMbps: asNullableInt((input.wanSpec as Record<string, unknown>).throughputMbps),
          vpnTunnels: asNullableInt((input.wanSpec as Record<string, unknown>).vpnTunnels),
          cellularSupport: asBoolean((input.wanSpec as Record<string, unknown>).cellularSupport),
          formFactor: asNullableString((input.wanSpec as Record<string, unknown>).formFactor),
          interfaces: (input.wanSpec as Record<string, unknown>).interfaces,
        }
      : null,
    lanSpec: input.lanSpec && typeof input.lanSpec === "object"
      ? {
          portCount: asNullableInt((input.lanSpec as Record<string, unknown>).portCount),
          portSpeed: asNullableString((input.lanSpec as Record<string, unknown>).portSpeed),
          poeBudgetWatts: asNullableInt((input.lanSpec as Record<string, unknown>).poeBudgetWatts),
          stackable: asBoolean((input.lanSpec as Record<string, unknown>).stackable),
          uplinkPorts: (input.lanSpec as Record<string, unknown>).uplinkPorts,
        }
      : null,
    wlanSpec: input.wlanSpec && typeof input.wlanSpec === "object"
      ? {
          wifiStandard: asNullableString((input.wlanSpec as Record<string, unknown>).wifiStandard),
          maxClients: asNullableInt((input.wlanSpec as Record<string, unknown>).maxClients),
          indoorOutdoor: asNullableString((input.wlanSpec as Record<string, unknown>).indoorOutdoor),
          radios: (input.wlanSpec as Record<string, unknown>).radios,
        }
      : null,
  };
}

async function extractPdfTextFromBuffer(buffer: Buffer): Promise<string> {
  const inputPath = join(tmpdir(), `${randomUUID()}.pdf`);
  const outputPath = join(tmpdir(), `${randomUUID()}.txt`);

  await fs.writeFile(inputPath, buffer);
  try {
    await execFileAsync("pdftotext", [inputPath, outputPath]);
    const text = await fs.readFile(outputPath, "utf8");
    return text.trim();
  } catch {
    return "";
  } finally {
    await Promise.allSettled([fs.unlink(inputPath), fs.unlink(outputPath)]);
  }
}

function validateSourceUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (!["https:"].includes(parsed.protocol)) {
    throw new Error("Only https URLs are supported for equipment ingestion.");
  }

  const host = parsed.hostname.toLowerCase();
  if (["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error("Localhost URLs are not allowed.");
  }

  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error("Private-network URLs are not allowed.");
  }

  return parsed.toString();
}

async function fetchPdfTextFromUrl(url: string): Promise<{ text: string; contentType: string | null; contentLength: number | null }> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status})`);
  }

  const contentType = response.headers.get("content-type");
  const lengthHeader = response.headers.get("content-length");
  const declaredLength = lengthHeader ? Number.parseInt(lengthHeader, 10) : null;
  const bytes = Buffer.from(await response.arrayBuffer());

  if (bytes.length === 0) {
    throw new Error("Fetched document is empty.");
  }

  if (bytes.length > MAX_PDF_BYTES) {
    throw new Error(`Document exceeds max size of ${MAX_PDF_BYTES} bytes.`);
  }

  const hasPdfMagicHeader = bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  const isLikelyPdf =
    (contentType ?? "").toLowerCase().includes("pdf") ||
    url.toLowerCase().endsWith(".pdf") ||
    hasPdfMagicHeader;
  if (!isLikelyPdf) {
    throw new Error("URL does not appear to reference a PDF document.");
  }

  const text = await extractPdfTextFromBuffer(bytes);
  if (!text.trim()) {
    throw new Error("PDF was fetched but no extractable text was found.");
  }
  return {
    text,
    contentType,
    contentLength: Number.isFinite(declaredLength as number) ? declaredLength : bytes.length,
  };
}

function splitExtractionText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= EXTRACTION_CHUNK_SIZE) return [trimmed];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < trimmed.length && chunks.length < EXTRACTION_MAX_CHUNKS) {
    const end = Math.min(trimmed.length, cursor + EXTRACTION_CHUNK_SIZE);
    chunks.push(trimmed.slice(cursor, end));
    if (end >= trimmed.length) break;
    cursor = Math.max(0, end - EXTRACTION_CHUNK_OVERLAP);
  }
  return chunks;
}

function draftCompletenessScore(draft: EquipmentDraftInput): number {
  let score = 0;
  if (draft.pricingSku) score += 1;
  if (draft.family) score += 1;
  if (draft.secondaryPurposes.length > 0) score += 1;

  if (draft.wanSpec?.throughputMbps != null) score += 2;
  if (draft.wanSpec?.vpnTunnels != null) score += 1;
  if (draft.wanSpec?.formFactor) score += 1;
  if (Array.isArray(draft.wanSpec?.interfaces) && draft.wanSpec.interfaces.length > 0) score += 1;

  if (draft.lanSpec?.portCount != null) score += 2;
  if (draft.lanSpec?.portSpeed) score += 1;
  if (draft.lanSpec?.poeBudgetWatts != null) score += 1;
  if (Array.isArray(draft.lanSpec?.uplinkPorts) && draft.lanSpec.uplinkPorts.length > 0) score += 1;

  if (draft.wlanSpec?.wifiStandard) score += 2;
  if (draft.wlanSpec?.maxClients != null) score += 1;
  if (draft.wlanSpec?.indoorOutdoor) score += 1;
  if (Array.isArray(draft.wlanSpec?.radios) && draft.wlanSpec.radios.length > 0) score += 1;

  return score;
}

function mergeDrafts(existing: EquipmentDraftInput, incoming: EquipmentDraftInput): EquipmentDraftInput {
  const preferred = draftCompletenessScore(incoming) > draftCompletenessScore(existing) ? incoming : existing;
  const secondaryPurposes = Array.from(
    new Set([...existing.secondaryPurposes, ...incoming.secondaryPurposes].filter((p) => p !== preferred.primaryPurpose))
  );

  return {
    ...preferred,
    pricingSku: preferred.pricingSku ?? existing.pricingSku ?? incoming.pricingSku ?? null,
    family: preferred.family ?? existing.family ?? incoming.family ?? null,
    vendorDatasheetUrl: preferred.vendorDatasheetUrl ?? existing.vendorDatasheetUrl ?? incoming.vendorDatasheetUrl ?? null,
    secondaryPurposes,
  };
}

async function extractEquipmentDraftsFromGeminiChunk(input: {
  sourceUrl: string;
  extractedText: string;
  model: string;
  apiKey: string;
  chunkIndex: number;
  chunkTotal: number;
  excludedModels?: string[];
  maxRecords?: number;
}): Promise<EquipmentDraftInput[]> {
  const maxRecords = Number.isFinite(input.maxRecords) && (input.maxRecords as number) > 0
    ? Math.floor(input.maxRecords as number)
    : EXTRACTION_BATCH_SIZE;
  const excludedModels = (input.excludedModels ?? []).filter(Boolean);
  const excludedModelsInstruction = excludedModels.length > 0
    ? `\n- Skip these models because they were already extracted in previous passes: ${excludedModels.join(", ")}.`
    : "";

  const prompt = `You extract network equipment records from vendor datasheets.
Return only JSON.
Expected shape:
{
  "equipment": [
    {
      "make": "string",
      "model": "string",
      "pricingSku": "string|null",
      "family": "string|null",
      "primaryPurpose": "WAN|LAN|WLAN",
      "secondaryPurposes": ["WAN|LAN|WLAN"],
      "vendorDatasheetUrl": "string",
      "wanSpec": {"throughputMbps": number|null, "vpnTunnels": number|null, "cellularSupport": boolean, "formFactor": "string|null", "interfaces": []},
      "lanSpec": {"portCount": number|null, "portSpeed": "string|null", "poeBudgetWatts": number|null, "stackable": boolean, "uplinkPorts": []},
      "wlanSpec": {"wifiStandard": "string|null", "maxClients": number|null, "indoorOutdoor": "string|null", "radios": []}
    }
  ]
}
Rules:
- Extract one object per distinct hardware model variant in this chunk (for example MX67, MX67W, MX67C, MX67X are separate models).
- Do not collapse related models into one record.
- Return no more than ${maxRecords} equipment records in this response.
- Use null when unknown.
- Keep units normalized (Mbps for throughput).
- Set vendorDatasheetUrl to ${input.sourceUrl}.
- Return no prose.
Chunk: ${input.chunkIndex + 1}/${input.chunkTotal}.${excludedModelsInstruction}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${input.model}:generateContent?key=${input.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}\n\nDATASHEET TEXT:\n${input.extractedText}` }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Gemini extraction failed (${response.status}): ${details}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const normalizedJson = normalizeGeminiJson(rawText);
  if (!normalizedJson.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedJson) as unknown;
  } catch {
    parsed = salvageEquipmentPayloadFromTruncatedJson(normalizedJson);
    if (!parsed) {
      const preview = normalizedJson.slice(0, 300).replace(/\s+/g, " ");
      throw new Error(`Gemini returned invalid JSON payload. Preview: ${preview || "<empty>"}`);
    }
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === "object" && Array.isArray((parsed as { equipment?: unknown[] }).equipment)
      ? (parsed as { equipment: unknown[] }).equipment
      : []);

  return rows
    .map((row) => normalizeDraftInput(row))
    .filter((row): row is EquipmentDraftInput => Boolean(row));
}

async function extractEquipmentDraftsWithGemini(input: { sourceUrl: string; extractedText: string }): Promise<EquipmentDraftInput[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const chunks = splitExtractionText(input.extractedText);
  if (chunks.length === 0) {
    throw new Error("No extractable datasheet text was found.");
  }

  const model = (await getSystemConfigValue("GEMINI_MODEL")) ?? "gemini-2.5-flash";
  const deduped = new Map<string, EquipmentDraftInput>();

  for (let i = 0; i < chunks.length; i += 1) {
    const chunkDrafts = new Map<string, EquipmentDraftInput>();

    for (let pass = 0; pass < EXTRACTION_MAX_PASSES_PER_CHUNK; pass += 1) {
      let extracted: EquipmentDraftInput[] = [];
      try {
        extracted = await extractEquipmentDraftsFromGeminiChunk({
          sourceUrl: input.sourceUrl,
          extractedText: chunks[i],
          model,
          apiKey,
          chunkIndex: i,
          chunkTotal: chunks.length,
          excludedModels: Array.from(chunkDrafts.values()).map((row) => row.model),
          maxRecords: EXTRACTION_BATCH_SIZE,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown extraction error";
        if (!message.includes("invalid JSON payload")) {
          throw error;
        }

        // Retry once with tighter output bounds when the model still truncates JSON.
        extracted = await extractEquipmentDraftsFromGeminiChunk({
          sourceUrl: input.sourceUrl,
          extractedText: chunks[i].slice(0, 20_000),
          model,
          apiKey,
          chunkIndex: i,
          chunkTotal: chunks.length,
          excludedModels: Array.from(chunkDrafts.values()).map((row) => row.model),
          maxRecords: 2,
        });
      }

      const newRows = extracted.filter((draft) => !chunkDrafts.has(normalizeMakeModelKey(draft.make, draft.model)));
      if (newRows.length === 0) break;

      for (const draft of newRows) {
        chunkDrafts.set(normalizeMakeModelKey(draft.make, draft.model), draft);
      }

      if (newRows.length < EXTRACTION_BATCH_SIZE) break;
    }

    for (const draft of chunkDrafts.values()) {
      const key = normalizeMakeModelKey(draft.make, draft.model);
      const existing = deduped.get(key);
      deduped.set(key, existing ? mergeDrafts(existing, draft) : draft);
    }
  }

  return Array.from(deduped.values());
}

function salvageEquipmentPayloadFromTruncatedJson(input: string): { equipment: unknown[] } | unknown[] | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parseBalancedObjects = (source: string): unknown[] => {
    const rows: unknown[] = [];
    let inString = false;
    let escaped = false;
    let objectDepth = 0;
    let objectStart = -1;

    for (let i = 0; i < source.length; i += 1) {
      const ch = source[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (ch === "\\") {
        escaped = true;
        continue;
      }

      if (ch === "\"") {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === "{") {
        if (objectDepth === 0) objectStart = i;
        objectDepth += 1;
      } else if (ch === "}") {
        if (objectDepth > 0) objectDepth -= 1;
        if (objectDepth === 0 && objectStart >= 0) {
          const candidate = source.slice(objectStart, i + 1);
          try {
            rows.push(JSON.parse(candidate) as unknown);
          } catch {
            // Ignore malformed/truncated object fragments.
          }
          objectStart = -1;
        }
      }
    }

    return rows;
  };

  // Case 1: expected object shape with an equipment array.
  const equipmentKeyIndex = trimmed.indexOf("\"equipment\"");
  if (equipmentKeyIndex >= 0) {
    const arrayStart = trimmed.indexOf("[", equipmentKeyIndex);
    if (arrayStart >= 0) {
      const arraySlice = trimmed.slice(arrayStart + 1);
      const rows = parseBalancedObjects(arraySlice);
      if (rows.length > 0) return { equipment: rows };
    }
  }

  // Case 2: raw array/object-like output; salvage top-level objects.
  const rows = parseBalancedObjects(trimmed);
  if (rows.length > 0) return rows;

  return null;
}

async function upsertEquipmentDraft(input: EquipmentDraftInput): Promise<string> {
  const normalizedKey = normalizeMakeModelKey(input.make, input.model);
  const modelUsed = (await getSystemConfigValue("GEMINI_MODEL")) ?? "gemini-2.5-flash";

  const existingProfile = await prisma.equipmentProfile.findUnique({
    where: { normalizedMakeModel: normalizedKey },
    include: { catalogItem: { select: { id: true } } },
  });

  const catalogItemId = existingProfile?.catalogItemId ?? randomUUID();
  // Prisma validates the create payload even when update-path is expected.
  // Always provide a valid SKU for create-path to avoid runtime "sku is missing" errors.
  const skuForCreate = await buildUniqueHardwareSku(input.make, input.model);

  await prisma.$transaction(async (tx) => {
    await tx.catalogItem.upsert({
      where: { id: catalogItemId },
      update: {
        name: `${input.make} ${input.model}`,
        type: "HARDWARE",
        primaryPurpose: input.primaryPurpose,
        secondaryPurposes: input.secondaryPurposes,
      },
      create: {
        id: catalogItemId,
        sku: skuForCreate,
        name: `${input.make} ${input.model}`,
        type: "HARDWARE",
        primaryPurpose: input.primaryPurpose,
        secondaryPurposes: input.secondaryPurposes,
      },
    });

    await tx.equipmentProfile.upsert({
      where: { catalogItemId },
      update: {
        make: input.make,
        model: input.model,
        pricingSku: input.pricingSku,
        family: input.family,
        vendorDatasheetUrl: input.vendorDatasheetUrl,
        normalizedMakeModel: normalizedKey,
        reviewStatus: EquipmentReviewStatus.DRAFT,
        lastExtractedAt: new Date(),
        lastExtractedModel: modelUsed,
      },
      create: {
        catalogItemId,
        make: input.make,
        model: input.model,
        pricingSku: input.pricingSku,
        family: input.family,
        vendorDatasheetUrl: input.vendorDatasheetUrl,
        normalizedMakeModel: normalizedKey,
        reviewStatus: EquipmentReviewStatus.DRAFT,
        lastExtractedAt: new Date(),
        lastExtractedModel: modelUsed,
      },
    });

    await tx.equipmentWanSpec.upsert({
      where: { catalogItemId },
      update: {
        throughputMbps: input.wanSpec?.throughputMbps ?? null,
        vpnTunnels: input.wanSpec?.vpnTunnels ?? null,
        cellularSupport: input.wanSpec?.cellularSupport ?? false,
        formFactor: input.wanSpec?.formFactor ?? null,
        interfaces: coerceJsonArray(input.wanSpec?.interfaces),
      },
      create: {
        catalogItemId,
        throughputMbps: input.wanSpec?.throughputMbps ?? null,
        vpnTunnels: input.wanSpec?.vpnTunnels ?? null,
        cellularSupport: input.wanSpec?.cellularSupport ?? false,
        formFactor: input.wanSpec?.formFactor ?? null,
        interfaces: coerceJsonArray(input.wanSpec?.interfaces),
      },
    });

    await tx.equipmentLanSpec.upsert({
      where: { catalogItemId },
      update: {
        portCount: input.lanSpec?.portCount ?? null,
        portSpeed: input.lanSpec?.portSpeed ?? null,
        poeBudgetWatts: input.lanSpec?.poeBudgetWatts ?? null,
        stackable: input.lanSpec?.stackable ?? false,
        uplinkPorts: coerceJsonArray(input.lanSpec?.uplinkPorts),
      },
      create: {
        catalogItemId,
        portCount: input.lanSpec?.portCount ?? null,
        portSpeed: input.lanSpec?.portSpeed ?? null,
        poeBudgetWatts: input.lanSpec?.poeBudgetWatts ?? null,
        stackable: input.lanSpec?.stackable ?? false,
        uplinkPorts: coerceJsonArray(input.lanSpec?.uplinkPorts),
      },
    });

    await tx.equipmentWlanSpec.upsert({
      where: { catalogItemId },
      update: {
        wifiStandard: input.wlanSpec?.wifiStandard ?? null,
        maxClients: input.wlanSpec?.maxClients ?? null,
        indoorOutdoor: input.wlanSpec?.indoorOutdoor ?? null,
        radios: coerceJsonArray(input.wlanSpec?.radios),
      },
      create: {
        catalogItemId,
        wifiStandard: input.wlanSpec?.wifiStandard ?? null,
        maxClients: input.wlanSpec?.maxClients ?? null,
        indoorOutdoor: input.wlanSpec?.indoorOutdoor ?? null,
        radios: coerceJsonArray(input.wlanSpec?.radios),
      },
    });
  });

  return catalogItemId;
}

export async function processEquipmentIngestionJob(jobId: string): Promise<void> {
  const job = await prisma.equipmentIngestionJob.findUnique({
    where: { id: jobId },
    include: {
      sources: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!job) {
    throw new Error("Ingestion job not found.");
  }

  await prisma.equipmentIngestionJob.update({
    where: { id: jobId },
    data: {
      status: EquipmentIngestionJobStatus.PROCESSING,
      startedAt: job.startedAt ?? new Date(),
      errorSummary: null,
    },
  });

  let successes = 0;
  let failures = 0;
  const failureMessages: string[] = [];

  for (const source of job.sources) {
    if (source.status === EquipmentIngestionSourceStatus.UPSERTED) {
      successes += 1;
      continue;
    }

    try {
      const normalizedUrl = validateSourceUrl(source.url);
      await prisma.equipmentIngestionSource.update({
        where: { id: source.id },
        data: {
          normalizedUrl,
          status: EquipmentIngestionSourceStatus.PROCESSING,
          attempts: { increment: 1 },
          errorMessage: null,
        },
      });

      const fetched = await fetchPdfTextFromUrl(normalizedUrl);
      const drafts = await extractEquipmentDraftsWithGemini({
        sourceUrl: normalizedUrl,
        extractedText: fetched.text,
      });

      if (drafts.length === 0) {
        failures += 1;
        const message = "No equipment records could be extracted.";
        failureMessages.push(`${normalizedUrl}: ${message}`);
        await prisma.equipmentIngestionSource.update({
          where: { id: source.id },
          data: {
            status: EquipmentIngestionSourceStatus.FAILED,
            errorMessage: message,
            contentType: fetched.contentType,
            contentLength: fetched.contentLength,
            extractedText: fetched.text.slice(0, 20000),
            extractionPayload: [],
            processedAt: new Date(),
          },
        });
        continue;
      }

      let firstCatalogItemId: string | null = null;
      for (const draft of drafts) {
        const catalogItemId = await upsertEquipmentDraft(draft);
        if (!firstCatalogItemId) firstCatalogItemId = catalogItemId;
      }

      await prisma.equipmentIngestionSource.update({
        where: { id: source.id },
        data: {
          status: EquipmentIngestionSourceStatus.UPSERTED,
          contentType: fetched.contentType,
          contentLength: fetched.contentLength,
          extractedText: fetched.text.slice(0, 20000),
          extractionPayload: drafts as unknown as Prisma.InputJsonValue,
          catalogItemId: firstCatalogItemId,
          processedAt: new Date(),
        },
      });

      successes += 1;
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : "Unknown ingestion error";
      failureMessages.push(`${source.url}: ${message}`);
      await prisma.equipmentIngestionSource.update({
        where: { id: source.id },
        data: {
          status: EquipmentIngestionSourceStatus.FAILED,
          errorMessage: message,
          processedAt: new Date(),
        },
      });
    }
  }

  const finalStatus = failures === 0
    ? EquipmentIngestionJobStatus.COMPLETED
    : (successes > 0 ? EquipmentIngestionJobStatus.COMPLETED_WITH_ERRORS : EquipmentIngestionJobStatus.FAILED);

  await prisma.equipmentIngestionJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      errorSummary: failureMessages.length > 0 ? failureMessages.slice(0, 20).join("\n") : null,
    },
  });
}
