const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

async function getGoogleAccessToken(): Promise<string> {
  if (process.env.GCS_ACCESS_TOKEN) {
    return process.env.GCS_ACCESS_TOKEN;
  }

  const response = await fetch(METADATA_TOKEN_URL, {
    headers: { "Metadata-Flavor": "Google" },
    signal: AbortSignal.timeout(1500),
  });

  if (!response.ok) {
    throw new Error(`Unable to acquire GCP metadata token (${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Metadata token response did not include access_token");
  }

  return payload.access_token;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export async function uploadRequirementToGcs(input: {
  projectId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<{ gcsUri: string; objectName: string }> {
  const bucket = process.env.GCS_REQUIREMENTS_BUCKET;
  if (!bucket) {
    throw new Error("GCS_REQUIREMENTS_BUCKET is not configured");
  }

  const safeName = sanitizeFileName(input.fileName || "requirements.txt");
  const objectName = `requirements/${input.projectId}/${Date.now()}-${safeName}`;
  const token = await getGoogleAccessToken();

  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": input.mimeType || "application/octet-stream",
    },
    body: input.bytes as unknown as BodyInit,
  });

  if (!uploadRes.ok) {
    const details = await uploadRes.text().catch(() => "");
    throw new Error(`GCS upload failed (${uploadRes.status}): ${details}`);
  }

  return {
    gcsUri: `gs://${bucket}/${objectName}`,
    objectName,
  };
}

export async function extractTextFromRequirementFile(file: File): Promise<string> {
  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());

  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return buffer.toString("utf-8").trim();
  }

  return `Uploaded file: ${file.name} (${mimeType}).\nBinary content uploaded for processing.`;
}
