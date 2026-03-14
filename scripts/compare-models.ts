#!/usr/bin/env npx tsx
/**
 * Gemini Model Comparison Script for Recommendation Engine
 *
 * Tests all available Gemini models against requirement documents with variations.
 * Requires: GEMINI_API_KEY env var and a running database with catalog data.
 *
 * Usage:
 *   GEMINI_API_KEY=<key> npx tsx scripts/compare-models.ts
 *
 * Output: Console table + results/model-comparison.json
 */

import { PrismaClient, ItemType } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Models to test
// ---------------------------------------------------------------------------

const MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

// ---------------------------------------------------------------------------
// Test requirement documents (extracted PDF text)
// ---------------------------------------------------------------------------

const PDF1_CLOUD_FIRST = `A Cloud-First SD-WAN strategy shifts the center of gravity from the data center to the Cloud (SaaS, IaaS, and PaaS). In this model, the network is no longer a "hub-and-spoke" system centered on a corporate office; it is a distributed fabric designed to get users to their applications via the fastest, most secure path possible.

1. Cloud-First Strategy Overview
The goal is to provide seamless, high-performance access to cloud environments (AWS, Azure, Google Cloud) and SaaS applications (Microsoft 365, Salesforce, Zoom) without backhauling traffic through a central data center, which adds unnecessary latency.

2. Connectivity & Cloud On-Ramp Requirements
- Virtual Gateway Integration: The ability to deploy "Virtual SD-WAN Appliances" directly within VPCs (AWS) or VNets (Azure) to extend the fabric into the cloud.
- Direct Internet Access (DIA): Intelligent "Local Breakout" at the branch level, allowing trusted SaaS traffic to bypass the corporate VPN and go straight to the internet.
- Cloud Gateway/Hub Support: Support for cloud-native middle-mile providers or "Cloud On-Ramp" services that place SD-WAN nodes in proximity to major SaaS peering points.
- SaaS Optimization: Real-time monitoring of SaaS performance (e.g., DNS latency or HTTP response times) to select the best ISP path for specific cloud tools.

3. Security & SASE Integration
A cloud-first network effectively moves the perimeter to the cloud.
- SASE (Secure Access Service Edge) Readiness: Integration with cloud-delivered security (DNS filtering, Secure Web Gateway, and CASB) to protect users at the edge.
- Zero Trust Network Access (ZTNA): Shifting from "site-wide" access to identity-based access, ensuring users only see the cloud resources they are authorized to use.
- Automated Tunneling: Automatic orchestration of IPsec or GRE tunnels to cloud security points of presence (PoPs) without manual CLI configuration.

4. Technical & Operational Requirements
4.1 Application-First Steering
The network must categorize traffic by application signature rather than IP address:
- Office 365 Recognition: Identifying specific M365 streams (e.g., Outlook vs. Teams) to prioritize real-time voice over background email syncing.
- Dynamic Path Selection: If "Link A" shows 1% packet loss, the system should automatically move latency-sensitive cloud apps to "Link B" instantly.

4.2 Automated Orchestration
- API-First Management: The SD-WAN controller must have robust APIs to integrate with cloud automation tools (e.g., Terraform or Ansible).
- Global Visibility: A single dashboard that shows the health of the physical branch, the ISP links, and the virtual cloud instances in one view.

5. Performance Metrics (SLAs)
- Mean Opinion Score (MOS): Continuous tracking of voice quality for cloud-based UCaaS (Zoom/Teams).
- Reduced Hairpinning: 100% elimination of traffic being sent to a data center just to reach a cloud application.`;

const PDF2_LOW_COST = `This document outlines the requirements for transitioning from a legacy MPLS network to a modern, internet-only SD-WAN architecture. The primary drivers are cost reduction, ease of deployment, and operational simplicity.

1. Executive Summary
The objective is to replace expensive, rigid MPLS circuits with a software-defined overlay using diverse, low-cost Internet connections (Broadband, DIA, 5G). The solution must support "Zero-Touch Provisioning" (ZTP) to ensure that non-technical staff can deploy hardware at remote sites without on-site engineering support.

2. Connectivity & Infrastructure Requirements
Since this is an Internet-only migration, the solution must mitigate the inherent "best-effort" nature of the public internet.
- Transport Independence: Ability to aggregate any combination of Business Broadband, Dedicated Internet Access (DIA), and 4G/5G LTE.
- Dual-Active Links: Support for "Active-Active" link steering to ensure maximum bandwidth utilization (unlike MPLS active-standby models).
- Carrier Diversity: Capability to terminate links from different ISPs to prevent single-provider outages.
- Sub-second Failover: Automatic path switching in the event of a brownout or blackout, ensuring session persistence for VoIP and video calls.

3. Business & Functional Requirements
3.1 Cost Optimization
- Zero Recurring MPLS Fees: Elimination of all private line circuit costs.
- Standardized Hardware: Use of low-cost, branch-specific appliances that do not require specialized proprietary modules.
- Cloud-Native Orchestration: Management via a cloud-hosted controller to eliminate the need for on-premise management servers.

3.2 Ease of Deployment (Agility)
- Zero-Touch Provisioning (ZTP): Appliances should "call home" and download configurations automatically upon connecting to the internet.
- Templatized Configuration: Ability to push global policies (Security, QoS) to hundreds of sites simultaneously from a single dashboard.
- Rapid Site Turn-up: New locations must be operational within minutes of receiving the hardware, using whatever internet is available (e.g., 5G/LTE) while waiting for wired circuits.

4. Performance & Technical Requirements
4.1 Application-Aware Routing
The system must identify applications (Office 365, Zoom, Salesforce) and route them based on real-time link health:
- Critical Apps: Route over the path with the lowest latency/jitter.
- Bulk Apps: Route over the highest capacity/lowest cost path.

4.2 Traffic Conditioning
- Forward Error Correction (FEC): To reconstruct lost packets on "dirty" broadband links, mimicking MPLS-like stability.
- Jitter Buffering: Smooth out delivery for real-time voice and video traffic.

5. Security Requirements
As traffic moves from a private MPLS cloud to the public internet, security must be integrated ("Secure SD-WAN"):
- Automated IPsec Tunnels: End-to-end encryption for all site-to-site traffic.
- Integrated Stateful Firewall: Layer 7 visibility and protection at every branch edge.
- Direct Internet Access (DIA) Security: Secure web gateway capabilities or cloud-security integration for users accessing SaaS directly from the branch.

6. Management & Visibility
- Single Pane of Glass: One dashboard to monitor health, performance, and security across the entire global footprint.
- Real-time Analytics: Visual reporting on ISP performance (latency, loss, jitter) and application usage.
- Role-Based Access Control (RBAC): Ability to delegate limited access to regional IT staff.`;

// ---------------------------------------------------------------------------
// Test variations
// ---------------------------------------------------------------------------

interface TestCase {
  name: string;
  requirements: string;
}

function buildTestCases(baseName: string, baseText: string): TestCase[] {
  return [
    {
      name: `${baseName} — SD-WAN only`,
      requirements: baseText,
    },
    {
      name: `${baseName} — SD-WAN + LAN + WLAN`,
      requirements: `${baseText}\n\nAdditional requirements: I also need LAN switching for campus network infrastructure and wireless networking (WLAN/Wi-Fi) for all branch office locations.`,
    },
    {
      name: `${baseName} — Prefer Cisco Catalyst`,
      requirements: `${baseText}\n\nVendor preference: I prefer Cisco Catalyst for this deployment.`,
    },
    {
      name: `${baseName} — Prefer Meraki`,
      requirements: `${baseText}\n\nVendor preference: I prefer Meraki for this deployment.`,
    },
  ];
}

const TEST_CASES: TestCase[] = [
  ...buildTestCases("Cloud-First SD-WAN", PDF1_CLOUD_FIRST),
  ...buildTestCases("Internet-Only Low-Cost", PDF2_LOW_COST),
];

// ---------------------------------------------------------------------------
// Candidate loading (mirrors recommendation-engine.ts)
// ---------------------------------------------------------------------------

interface CandidateSummary {
  id: string;
  sku: string;
  name: string;
  type: string;
  line: string;
}

async function loadCandidateSummaries(): Promise<CandidateSummary[]> {
  const items = await prisma.catalogItem.findMany({
    where: { type: { in: [ItemType.PACKAGE, ItemType.MANAGED_SERVICE] } },
    include: {
      attributes: { include: { term: { select: { label: true, value: true } } } },
      constraints: { select: { description: true } },
      assumptions: { select: { description: true } },
      packageCompositions: {
        include: {
          catalogItem: {
            select: {
              name: true,
              shortDescription: true,
              detailedDescription: true,
              attributes: { include: { term: { select: { label: true, value: true } } } },
            },
          },
        },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      },
      packagePolicies: {
        where: { active: true },
        include: {
          designOption: true,
          values: { include: { designOptionValue: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return items.map((item) => {
    const features = item.attributes.map((a) => a.term.label || a.term.value).filter(Boolean) as string[];
    const constraints = item.constraints.map((c) => c.description);
    const assumptions = item.assumptions.map((a) => a.description);
    const requiredIncluded = item.packageCompositions
      .filter((r) => r.role === "REQUIRED" || r.role === "AUTO_INCLUDED")
      .map((r) => r.catalogItem.name);
    const optionalRecommended = item.packageCompositions
      .filter((r) => r.role === "OPTIONAL")
      .map((r) => r.catalogItem.name);
    const requiredIncludedDetails = item.packageCompositions
      .filter((r) => r.role === "REQUIRED" || r.role === "AUTO_INCLUDED")
      .map((r) => {
        const mf = r.catalogItem.attributes.map((a) => a.term.label || a.term.value).filter(Boolean);
        return [r.catalogItem.name, r.catalogItem.shortDescription ?? "", r.catalogItem.detailedDescription ?? "", mf.join(", ")].filter(Boolean).join(" | ");
      });
    const optionalIncludedDetails = item.packageCompositions
      .filter((r) => r.role === "OPTIONAL")
      .map((r) => {
        const mf = r.catalogItem.attributes.map((a) => a.term.label || a.term.value).filter(Boolean);
        return [r.catalogItem.name, r.catalogItem.shortDescription ?? "", r.catalogItem.detailedDescription ?? "", mf.join(", ")].filter(Boolean).join(" | ");
      });
    const designOptionRules = item.packagePolicies.map((p) => {
      const option = p.designOption?.label ?? p.designOption?.key ?? "unknown";
      const values = p.values.map((v) => v.designOptionValue?.label ?? v.designOptionValue?.value ?? "").filter(Boolean);
      return `${option} ${p.operator} ${values.join(", ") || "any"}`;
    });

    const line = `- id:${item.id} | type:${item.type} | sku:${item.sku} | name:${item.name} | short_desc:${item.shortDescription ?? "N/A"} | long_desc:${item.detailedDescription ?? "N/A"} | features:${features.join(", ") || "none"} | constraints:${constraints.join(", ") || "none"} | assumptions:${assumptions.join(", ") || "none"} | required:${requiredIncluded.join(", ") || "none"} | optional:${optionalRecommended.join(", ") || "none"} | required_component_details:${requiredIncludedDetails.join(" || ") || "none"} | optional_component_details:${optionalIncludedDetails.join(" || ") || "none"} | design_option_rules:${designOptionRules.join(" || ") || "none"}`;

    return { id: item.id, sku: item.sku, name: item.name, type: item.type, line };
  });
}

// ---------------------------------------------------------------------------
// Prompt building (mirrors recommendation-engine.ts buildPrompt)
// ---------------------------------------------------------------------------

function buildPrompt(promptTemplate: string, requirements: string, candidateSummary: string): string {
  return `${promptTemplate}

SCORING RULES:
1. Base your score (0-1) on how well the candidate's description, features, constraints, assumptions, and included components match the customer requirements.
2. PACKAGE PREFERENCE: When a design package and individual standalone services both cover the same requirements equally well, score the package higher. Only recommend standalone services when they are specifically requested in the requirements OR when no package adequately covers the requirements.
3. VENDOR PREFERENCE: If the customer states a vendor preference (e.g., "prefer Meraki", "prefer Cisco Catalyst"), boost candidates aligned with that vendor and reduce candidates for a competing vendor. If no preference is stated, treat vendors neutrally.
4. COVERAGE: For each candidate, identify which technology domains it covers (e.g., SD-WAN, LAN, WLAN, Security, UCaaS, Cloud). Candidates covering more of the customer's required domains should score higher.
5. RISK ASSESSMENT: If a candidate's constraints or assumptions conflict with the stated requirements, reduce the score and note the risk.
6. DESIGN OPTIONS: Analyze package design option rules (FORCE/FORBID/ALLOW_ONLY/REQUIRE_ONE_OF) for compatibility with requirements. If rules conflict with requirements, reduce the score.

Evaluate EVERY candidate against these rules. Return up to 8 results sorted by score descending.

CUSTOMER REQUIREMENTS:
${requirements}

AVAILABLE CATALOG ITEMS:
${candidateSummary}

Return ONLY a JSON array. Each object MUST have these keys:
- "id": the exact catalog item id from above
- "score": number from 0 to 1
- "reason": 2-3 sentence explanation of why this item matches (or partially matches)
- "shortReason": single sentence summary (max 25 words)
- "coverageAreas": array of technology domains this candidate covers from the requirements (e.g., ["SD-WAN", "Security"])
- "matchedCharacteristics": array using only values from: name, short_description, long_description, features, constraints, assumptions
- "vendorAlignment": "full", "partial", or "none" based on customer vendor preference
- "riskFactors": array of strings describing any constraint/assumption conflicts (empty array if none)

Only include items that genuinely match some requirements. If fewer than 8 are relevant, return fewer.
Respond ONLY with the JSON array, no markdown fences or extra text.`;
}

// ---------------------------------------------------------------------------
// Gemini invocation
// ---------------------------------------------------------------------------

interface GeminiResult {
  id: string;
  score: number;
  reason: string;
  shortReason?: string;
  coverageAreas?: string[];
  matchedCharacteristics?: string[];
  vendorAlignment?: string;
  riskFactors?: string[];
}

interface ModelTestResult {
  model: string;
  testCase: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  results: GeminiResult[];
  topPick?: { name: string; type: string; score: number };
  packageInTop3: boolean;
  vendorCorrect: boolean | null; // null if no vendor preference in test
}

async function callGemini(model: string, prompt: string, apiKey: string): Promise<{ results: GeminiResult[]; latencyMs: number }> {
  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) throw new Error("Response is not an array");

  return { results: parsed as GeminiResult[], latencyMs };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY environment variable is required.");
    process.exit(1);
  }

  console.log("Loading catalog candidates from database...");
  const candidates = await loadCandidateSummaries();
  console.log(`Found ${candidates.length} catalog items.\n`);

  if (candidates.length === 0) {
    console.error("ERROR: No catalog items found. Ensure database is seeded.");
    process.exit(1);
  }

  const candidateLines = candidates.map((c) => c.line).join("\n");
  const candidateLookup = new Map(candidates.map((c) => [c.id, c]));

  const promptTemplate = "You are a solution architect assistant. Your job is to match customer requirements to the best catalog offerings by analyzing each candidate's name, short description, detailed description, features, constraints, assumptions, and included components. Evaluate every candidate thoroughly before scoring.";

  const allResults: ModelTestResult[] = [];
  const totalTests = MODELS.length * TEST_CASES.length;
  let completed = 0;

  for (const model of MODELS) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`MODEL: ${model}`);
    console.log("=".repeat(70));

    for (const testCase of TEST_CASES) {
      completed++;
      const progress = `[${completed}/${totalTests}]`;
      process.stdout.write(`${progress} ${testCase.name}... `);

      const prompt = buildPrompt(promptTemplate, testCase.requirements, candidateLines);

      const isVendorTest = testCase.name.includes("Catalyst") || testCase.name.includes("Meraki");
      const expectedVendor = testCase.name.includes("Catalyst") ? "catalyst" : testCase.name.includes("Meraki") ? "meraki" : null;

      let testResult: ModelTestResult;

      try {
        const { results, latencyMs } = await callGemini(model, prompt, apiKey);

        const topResults = results.slice(0, 3);
        const topPick = topResults[0];
        const topPickCandidate = topPick ? candidateLookup.get(topPick.id) : undefined;

        const packageInTop3 = topResults.some((r) => {
          const c = candidateLookup.get(r.id);
          return c?.type === "PACKAGE";
        });

        let vendorCorrect: boolean | null = null;
        if (isVendorTest && topPickCandidate && expectedVendor) {
          const topName = topPickCandidate.name.toLowerCase();
          vendorCorrect = topName.includes(expectedVendor);
        }

        testResult = {
          model,
          testCase: testCase.name,
          latencyMs,
          success: true,
          results: topResults,
          topPick: topPickCandidate
            ? { name: topPickCandidate.name, type: topPickCandidate.type, score: topPick?.score ?? 0 }
            : undefined,
          packageInTop3,
          vendorCorrect,
        };

        const vendorStatus = vendorCorrect === null ? "" : vendorCorrect ? " ✅vendor" : " ❌vendor";
        console.log(`${latencyMs}ms | ${topResults.length} results | pkg=${packageInTop3 ? "✅" : "❌"}${vendorStatus}`);

        if (topPickCandidate) {
          console.log(`  → Top: ${topPickCandidate.name} (${topPickCandidate.type}) score=${topPick?.score?.toFixed(2)}`);
        }
        for (const r of topResults.slice(0, 3)) {
          const c = candidateLookup.get(r.id);
          if (c) {
            console.log(`    ${r.score?.toFixed(2)} | ${c.type.padEnd(16)} | ${c.name} | ${r.shortReason ?? r.reason?.slice(0, 60)}`);
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.log(`FAILED: ${errMsg.slice(0, 100)}`);
        testResult = {
          model,
          testCase: testCase.name,
          latencyMs: 0,
          success: false,
          error: errMsg,
          results: [],
          packageInTop3: false,
          vendorCorrect: null,
        };
      }

      allResults.push(testResult);

      // Rate limit: small delay between calls
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("SUMMARY");
  console.log("=".repeat(70));

  const modelSummaries: Array<{
    model: string;
    successRate: string;
    avgLatency: string;
    packageRate: string;
    vendorRate: string;
    avgScore: string;
  }> = [];

  for (const model of MODELS) {
    const modelResults = allResults.filter((r) => r.model === model);
    const successes = modelResults.filter((r) => r.success);
    const avgLatency = successes.length > 0 ? Math.round(successes.reduce((s, r) => s + r.latencyMs, 0) / successes.length) : 0;
    const packageRate = successes.filter((r) => r.packageInTop3).length;
    const vendorTests = successes.filter((r) => r.vendorCorrect !== null);
    const vendorCorrect = vendorTests.filter((r) => r.vendorCorrect === true).length;
    const avgScore = successes.length > 0
      ? (successes.reduce((s, r) => s + (r.topPick?.score ?? 0), 0) / successes.length).toFixed(2)
      : "N/A";

    modelSummaries.push({
      model,
      successRate: `${successes.length}/${modelResults.length}`,
      avgLatency: `${avgLatency}ms`,
      packageRate: `${packageRate}/${successes.length}`,
      vendorRate: vendorTests.length > 0 ? `${vendorCorrect}/${vendorTests.length}` : "N/A",
      avgScore,
    });
  }

  console.table(modelSummaries);

  // Write results to file
  const outputDir = path.join(process.cwd(), "results");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, "model-comparison.json");
  fs.writeFileSync(outputPath, JSON.stringify({ timestamp: new Date().toISOString(), summary: modelSummaries, details: allResults }, null, 2));
  console.log(`\nDetailed results written to: ${outputPath}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  prisma.$disconnect();
  process.exit(1);
});
