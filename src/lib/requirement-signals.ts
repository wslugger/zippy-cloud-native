export interface RequirementSignals {
  siteCount?: number;
  topology?: "full_mesh" | "hub_spoke";
  internetBreakout?: "local" | "backhaul" | "split_tunnel";
}

export function parseRequirementSignals(text: string): RequirementSignals {
  const normalized = text.toLowerCase();
  const signals: RequirementSignals = {};

  const siteMatch = normalized.match(/(\d{1,5})\s+(?:site|sites|locations|branches)/);
  if (siteMatch) {
    const parsed = Number(siteMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      signals.siteCount = parsed;
    }
  }

  if (normalized.includes("full mesh") || normalized.includes("full-mesh")) {
    signals.topology = "full_mesh";
  } else if (
    normalized.includes("hub and spoke") ||
    normalized.includes("hub-and-spoke") ||
    normalized.includes("hub spoke")
  ) {
    signals.topology = "hub_spoke";
  }

  if (normalized.includes("split tunnel") || normalized.includes("split-tunnel")) {
    signals.internetBreakout = "split_tunnel";
  } else if (normalized.includes("backhaul")) {
    signals.internetBreakout = "backhaul";
  } else if (normalized.includes("local breakout")) {
    signals.internetBreakout = "local";
  }

  return signals;
}

/**
 * Structural feasibility check: validates that a package's design option policies
 * do not conflict with detected requirement signals (topology, internet breakout).
 *
 * This is NOT a scoring function — it returns a boolean indicating whether the
 * package is structurally compatible with the requirements.
 */
export function isFeasibleBySignals(
  policies: Array<{
    operator: string;
    designOption?: { key?: string };
    values?: Array<{ designOptionValue?: { value?: string } }>;
  }>,
  signals: RequirementSignals
): boolean {
  const signalMap: Record<string, string | undefined> = {
    topology: signals.topology,
    internetBreakout: signals.internetBreakout,
  };

  for (const policy of policies) {
    const optionKey = policy.designOption?.key;
    if (!optionKey) continue;
    const signal = signalMap[optionKey];
    if (!signal) continue;

    const values = new Set(
      (policy.values ?? []).map((v) => v.designOptionValue?.value).filter(Boolean) as string[]
    );

    if (policy.operator === "FORCE" && !values.has(signal)) return false;
    if (policy.operator === "FORBID" && values.has(signal)) return false;
    if (policy.operator === "ALLOW_ONLY" && !values.has(signal)) return false;
    if (policy.operator === "REQUIRE_ONE_OF" && !values.has(signal)) return false;
  }

  return true;
}
