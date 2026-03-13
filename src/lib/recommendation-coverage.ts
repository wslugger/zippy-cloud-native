export type RequirementCapability = "sdwan" | "lan" | "wlan";

const CAPABILITY_LABELS: Record<RequirementCapability, string> = {
  sdwan: "SD-WAN",
  lan: "LAN",
  wlan: "WLAN",
};

const CAPABILITY_PATTERNS: Record<RequirementCapability, RegExp[]> = {
  sdwan: [
    /\bsd-?wan\b/i,
    /\bsoftware[-\s]*defined\s+wan\b/i,
  ],
  lan: [
    /(?<!wireless\s)\blan\b/i,
    /\bcampus\s+lan\b/i,
    /\bswitch(?:ing|ed)?\b/i,
  ],
  wlan: [
    /\bwlan\b/i,
    /\bwi-?fi\b/i,
    /\bwireless\s+lan\b/i,
    /\bwireless\b/i,
  ],
};

function normalizeText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function findCapabilities(text: string): Set<RequirementCapability> {
  const normalized = normalizeText(text).toLowerCase();
  const found = new Set<RequirementCapability>();

  (Object.keys(CAPABILITY_PATTERNS) as RequirementCapability[]).forEach((capability) => {
    const patterns = CAPABILITY_PATTERNS[capability];
    if (patterns.some((pattern) => pattern.test(normalized))) {
      found.add(capability);
    }
  });

  return found;
}

function orderedCapabilities(values: Iterable<RequirementCapability>): RequirementCapability[] {
  const all: RequirementCapability[] = ["sdwan", "lan", "wlan"];
  const input = new Set(values);
  return all.filter((value) => input.has(value));
}

function formatCapabilityList(capabilities: RequirementCapability[]): string {
  return capabilities.map((capability) => CAPABILITY_LABELS[capability]).join(", ");
}

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(0.99, score));
}

export interface CoverageResult {
  required: RequirementCapability[];
  coreMatched: RequirementCapability[];
  optionalMatched: RequirementCapability[];
  matched: RequirementCapability[];
  missing: RequirementCapability[];
  ratio: number;
  sentence: string;
}

export function extractRequiredCapabilities(requirements: string): RequirementCapability[] {
  return orderedCapabilities(findCapabilities(requirements));
}

export function computeCoverage(
  requirements: string,
  candidateText: string | { core: string; optional?: string }
): CoverageResult {
  const required = extractRequiredCapabilities(requirements);
  const coreText = typeof candidateText === "string" ? candidateText : candidateText.core;
  const optionalText = typeof candidateText === "string" ? "" : candidateText.optional ?? "";
  const corePresent = findCapabilities(coreText);
  const optionalPresent = findCapabilities(optionalText);
  const coreMatched = orderedCapabilities(required.filter((capability) => corePresent.has(capability)));
  const optionalMatched = orderedCapabilities(
    required.filter((capability) => !corePresent.has(capability) && optionalPresent.has(capability))
  );
  const matched = orderedCapabilities([...coreMatched, ...optionalMatched]);
  const matchedSet = new Set<RequirementCapability>(matched);
  const missing = orderedCapabilities(required.filter((capability) => !matchedSet.has(capability)));
  // Optional package components count as full capability coverage for recommendation matching.
  const ratio = required.length > 0 ? matched.length / required.length : 1;

  let sentence = "No explicit SD-WAN/LAN/WLAN requirement detected.";
  if (required.length > 0 && matched.length === required.length) {
    sentence = `Covers requested capabilities: ${formatCapabilityList(matched)} (${matched.length}/${required.length}).`;
  } else if (required.length > 0 && matched.length > 0) {
    const coverageParts: string[] = [];
    if (coreMatched.length > 0) {
      coverageParts.push(`Base coverage includes: ${formatCapabilityList(coreMatched)} (${coreMatched.length}/${required.length}).`);
    }
    if (optionalMatched.length > 0) {
      coverageParts.push(`Optional add-ons cover: ${formatCapabilityList(optionalMatched)}.`);
    }
    if (missing.length > 0) {
      coverageParts.push(`Missing: ${formatCapabilityList(missing)}.`);
    }
    sentence = coverageParts.join(" ");
  } else if (required.length > 0) {
    sentence = `Does not cover requested SD-WAN/LAN/WLAN capabilities (0/${required.length}).`;
  }

  return { required, coreMatched, optionalMatched, matched, missing, ratio, sentence };
}

export function computeIntentBonus(requirements: string, candidateText: string): number {
  const req = normalizeText(requirements).toLowerCase();
  const text = normalizeText(candidateText).toLowerCase();
  let bonus = 0;
  const prefersMeraki = /\bprefer meraki\b|\bmeraki preferred\b|\bi prefer meraki\b/.test(req);
  const prefersCatalyst = /\bprefer catalyst\b|\bprefer cisco catalyst\b|\bcatalyst preferred\b|\bi prefer catalyst\b|\bi prefer cisco catalyst\b/.test(req);
  const hasMeraki = /\bmeraki\b/.test(text);
  const hasCatalyst = /\bcatalyst\b|\bcisco catalyst\b/.test(text);

  if (/\bsimple\b/.test(req) && /\bsimple\b|\bvalue[- ]oriented\b|\bsmall\b/.test(text)) {
    bonus += 0.12;
  }
  if (/\bcost effective\b|\blow cost\b|\bbudget\b|\baffordable\b|\bvalue\b/.test(req) && /\bcost\b|\bvalue\b|\bvalue[- ]oriented\b|\blow[- ]cost\b/.test(text)) {
    bonus += 0.14;
  }
  if (/\bhub and spoke\b|\bhub-spoke\b|\bhub spoke\b/.test(req) && /\bhub and spoke\b|\bhub-spoke\b|\bhub spoke\b/.test(text)) {
    bonus += 0.12;
  }
  if (prefersMeraki) {
    if (hasMeraki) bonus += 0.26;
    if (hasCatalyst && !hasMeraki) bonus -= 0.18;
  }
  if (prefersCatalyst) {
    if (hasCatalyst) bonus += 0.26;
    if (hasMeraki && !hasCatalyst) bonus -= 0.18;
  }

  return Math.max(-0.2, Math.min(0.45, bonus));
}

export function adjustScoreForCoverage(
  baseScore: number,
  coverage: CoverageResult,
  options: { isPackage: boolean }
): number {
  const base = clampScore(baseScore);
  if (coverage.required.length === 0) return base;

  const factor = 0.3 + coverage.ratio * 0.7;
  let adjusted = base * factor;

  if (coverage.matched.length === 0) {
    adjusted = Math.min(adjusted, 0.35);
  }

  if (!options.isPackage && coverage.required.length > 1 && coverage.ratio < 1) {
    adjusted = Math.min(adjusted, 0.74);
  }

  if (options.isPackage && coverage.required.length > 1 && coverage.ratio === 1) {
    adjusted = Math.min(0.99, adjusted + 0.08);
  }

  return clampScore(adjusted);
}

export function toBoundedConfidence(rawScore: number): number {
  const nonNegative = Math.max(0, rawScore);
  const bounded = 1 - Math.exp(-nonNegative * 2.2);
  return Math.max(0, Math.min(0.99, bounded));
}
