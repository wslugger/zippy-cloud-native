import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getSession } from "@/lib/auth";
import { buildDesignDocumentModel, type DesignDocumentModel } from "@/lib/design-document";

const FEATURE_CATEGORY_STATUSES = new Set(["REQUIRED", "STANDARD", "OPTIONAL"] as const);

type DesignDocumentSection = DesignDocumentModel["sections"][number];
type DesignDocumentFeature = DesignDocumentSection["features"][number];
type AppendixGroup = { key: string; label: string; matches: (itemType: string) => boolean };

const APPENDIX_GROUPS: AppendixGroup[] = [
  { key: "PACKAGE", label: "Packages", matches: (itemType) => itemType === "PACKAGE" },
  { key: "SERVICE", label: "Services", matches: (itemType) => itemType === "MANAGED_SERVICE" || itemType === "CONNECTIVITY" },
  { key: "SERVICE_OPTION", label: "Service Options", matches: (itemType) => itemType === "SERVICE_OPTION" },
  { key: "DESIGN_OPTION", label: "Design Options", matches: (itemType) => itemType === "DESIGN_OPTION" },
  { key: "FEATURE", label: "Features", matches: (itemType) => itemType === "FEATURE" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderZippyLogoSvg(): string {
  return `
    <svg width="168" height="42" viewBox="0 0 168 42" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Zippy">
      <g transform="translate(0,4)">
        <ellipse cx="24" cy="20" rx="14" ry="10" fill="#65B741" />
        <ellipse cx="24" cy="20" rx="14" ry="10" fill="url(#zl-sg-pdf)" opacity="0.3" />
        <circle cx="32" cy="14" r="6" fill="#65B741" />
        <circle cx="34" cy="13" r="1.5" fill="#1B2A4A" />
        <line x1="31" y1="9" x2="29" y2="5" stroke="#65B741" stroke-width="1.5" stroke-linecap="round" />
        <line x1="33" y1="8" x2="32" y2="4" stroke="#65B741" stroke-width="1.5" stroke-linecap="round" />
        <circle cx="29" cy="4.5" r="1.5" fill="#65B741" />
        <circle cx="32" cy="3.5" r="1.5" fill="#65B741" />
        <path d="M2 18 Q8 16 14 17" stroke="#2196F3" stroke-width="2" stroke-linecap="round" opacity="0.7" />
        <path d="M0 21 Q7 19 13 20" stroke="#00BCD4" stroke-width="1.5" stroke-linecap="round" opacity="0.5" />
        <path d="M4 24 Q9 22 15 23" stroke="#65B741" stroke-width="1.5" stroke-linecap="round" opacity="0.4" />
        <defs>
          <linearGradient id="zl-sg-pdf" x1="10" y1="12" x2="38" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#7dcf53" />
            <stop offset="100%" stop-color="#4a9e2a" />
          </linearGradient>
        </defs>
      </g>
      <g transform="translate(46,0)">
        <text x="0" y="24" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="800" letter-spacing="0.5" fill="#1B2A4A">ZIPPY</text>
        <text x="1" y="36" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="700" letter-spacing="2" fill="#64748B">MANAGED SERVICES</text>
      </g>
    </svg>
  `;
}

function renderCategorizedFeatures(features: DesignDocumentFeature[]): string {
  const categorized = features.filter((feature) =>
    FEATURE_CATEGORY_STATUSES.has(feature.status as "REQUIRED" | "STANDARD" | "OPTIONAL")
  );

  const required = categorized
    .filter((feature) => feature.status === "REQUIRED")
    .map((feature) => `<li>${escapeHtml(feature.label)}</li>`)
    .join("");
  const standard = categorized
    .filter((feature) => feature.status === "STANDARD")
    .map((feature) => `<li>${escapeHtml(feature.label)}</li>`)
    .join("");
  const optional = categorized
    .filter((feature) => feature.status === "OPTIONAL")
    .map((feature) => `<li>${escapeHtml(feature.label)}</li>`)
    .join("");

  if (!required && !standard && !optional) {
    return "<ul><li>None</li></ul>";
  }

  return `
    ${required ? `<h5>Required</h5><ul>${required}</ul>` : ""}
    ${standard ? `<h5>Standard</h5><ul>${standard}</ul>` : ""}
    ${optional ? `<h5>Optional</h5><ul>${optional}</ul>` : ""}
  `;
}

function renderSectionHtml(section: DesignDocumentSection): string {
  if (section.kind === "PACKAGE") {
    const serviceHtml = section.services
      .map((service) => {
        const serviceOptions = service.serviceOptions
          .filter((serviceOption) => serviceOption.selected)
          .map((serviceOption) => {
            const description = serviceOption.description ? ` - ${escapeHtml(serviceOption.description)}` : "";
            return `<li><strong>${escapeHtml(serviceOption.name)}</strong> (Selected)${description}</li>`;
          })
          .join("");

        const designOptions = service.designOptions
          .map((option) => {
            const selected = option.selectedValues.map((value) => value.label).join(", ") || "Default";
            return `<li><strong>${escapeHtml(option.label)}:</strong> ${escapeHtml(selected)}</li>`;
          })
          .join("");

        return `
          <article class="service">
            <h4>${escapeHtml(service.name)}</h4>
            <p>${escapeHtml(service.description ?? "No detailed description available.")}</p>
            <p class="meta">SKU: ${escapeHtml(service.sku)} | ${service.selected ? "Selected" : "Not selected"}</p>
            <h5>Service Options</h5>
            <ul>${serviceOptions || "<li>No selected service options</li>"}</ul>
            <h5>Design Options</h5>
            <ul>${designOptions || "<li>None</li>"}</ul>
            <h5>Features</h5>
            ${renderCategorizedFeatures(service.features)}
          </article>
        `;
      })
      .join("");

    return `
      <section class="package">
        <h2>${escapeHtml(section.name)} (Package)</h2>
        <p>${escapeHtml(section.description ?? "No detailed description available.")}</p>
        <p class="meta">SKU: ${escapeHtml(section.sku)}</p>
        <h3>Services</h3>
        ${serviceHtml || "<p>No services available.</p>"}
      </section>
    `;
  }

  const serviceOptions = section.serviceOptions
    .filter((serviceOption) => serviceOption.selected)
    .map((serviceOption) => {
      const description = serviceOption.description ? ` - ${escapeHtml(serviceOption.description)}` : "";
      return `<li><strong>${escapeHtml(serviceOption.name)}</strong> (Selected)${description}</li>`;
    })
    .join("");

  const designOptions = section.designOptions
    .map((option) => {
      const selected = option.selectedValues.map((value) => value.label).join(", ") || "Default";
      return `<li><strong>${escapeHtml(option.label)}:</strong> ${escapeHtml(selected)}</li>`;
    })
    .join("");

  return `
    <section class="panel">
      <h2>${escapeHtml(section.name)}</h2>
      <p>${escapeHtml(section.description ?? "No detailed description available.")}</p>
      <p class="meta">SKU: ${escapeHtml(section.sku)}</p>
      <h3>Service Options</h3>
      <ul>${serviceOptions || "<li>No selected service options</li>"}</ul>
      <h3>Design Options</h3>
      <ul>${designOptions || "<li>None</li>"}</ul>
      <h3>Features</h3>
      ${renderCategorizedFeatures(section.features)}
    </section>
  `;
}

function renderDocumentHtml(model: DesignDocumentModel): string {
  const sectionHtml = model.sections.map((section) => renderSectionHtml(section)).join("");

  const appendixHtml = APPENDIX_GROUPS.map((group) => {
    const entries = model.appendix
      .filter((entry) => group.matches(entry.itemType))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (entries.length === 0) {
      return "";
    }

    const entriesHtml = entries.map((entry) => {
      const constraints = entry.constraints.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
      const assumptions = entry.assumptions.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
      const features = (entry.features ?? [])
        .map((feature) => `<li><strong>${escapeHtml(feature.status)}:</strong> ${escapeHtml(feature.label)}</li>`)
        .join("");

      return `
        <article class="service">
          <h4>${escapeHtml(entry.name)} (${escapeHtml(entry.itemType)})</h4>
          ${entry.description ? `<p>${escapeHtml(entry.description)}</p>` : ""}
          <h5>Features</h5>
          <ul>${features || "<li>None</li>"}</ul>
          <h5>Constraints</h5>
          <ul>${constraints || "<li>None</li>"}</ul>
          <h5>Assumptions</h5>
          <ul>${assumptions || "<li>None</li>"}</ul>
        </article>
      `;
    }).join("");

    return `
      <section class="appendix-group">
        <h3>${escapeHtml(group.label)}</h3>
        ${entriesHtml}
      </section>
    `;
  }).join("");

  const generatedOn = new Date(model.generatedAt).toLocaleString();
  const updatedOn = new Date(model.document.updatedAt).toLocaleString();
  const customerName = model.customerName ? escapeHtml(model.customerName) : "Customer";

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(model.title)}</title>
        <style>
          :root {
            --brand-green: #65B741;
            --brand-navy: #1B2A4A;
            --slate-900: #0F172A;
            --slate-700: #334155;
            --slate-600: #475569;
            --slate-300: #CBD5E1;
            --slate-200: #E2E8F0;
          }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: var(--slate-900);
            margin: 0;
            padding: 0;
            line-height: 1.45;
            font-size: 12px;
            background: white;
          }
          .document { width: 100%; }
          .brand-header {
            border-bottom: 2px solid var(--brand-green);
            padding-bottom: 12px;
            margin-bottom: 18px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
          }
          .doc-title {
            margin: 0 0 6px;
            font-size: 26px;
            line-height: 1.15;
            color: var(--brand-navy);
          }
          .doc-subtitle {
            margin: 0;
            color: var(--slate-700);
            font-size: 13px;
          }
          .doc-meta {
            text-align: right;
            min-width: 220px;
          }
          .doc-meta-row {
            margin: 0 0 4px;
            color: var(--slate-600);
            font-size: 11px;
          }
          .panel {
            border: 1px solid var(--slate-300);
            border-radius: 10px;
            padding: 14px 16px;
            margin: 0 0 14px;
            page-break-inside: auto;
            break-inside: auto;
            background: white;
          }
          .panel-muted { background: #F8FAFC; }
          .section-heading {
            margin: 0 0 8px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--slate-600);
          }
          .body-prewrap {
            margin: 0;
            white-space: pre-wrap;
            color: var(--slate-900);
            font-size: 12px;
          }
          section {
            page-break-inside: auto;
            break-inside: auto;
            margin-bottom: 14px;
          }
          h2 {
            margin: 0 0 6px;
            font-size: 18px;
            color: var(--brand-navy);
          }
          h3 {
            margin: 0 0 8px;
            font-size: 13px;
            color: var(--slate-700);
            text-transform: uppercase;
            letter-spacing: 0.8px;
          }
          h4 {
            margin: 0 0 4px;
            font-size: 14px;
            color: var(--slate-900);
          }
          h5 {
            margin: 8px 0 4px;
            font-size: 11px;
            color: var(--slate-700);
            text-transform: uppercase;
            letter-spacing: 0.7px;
          }
          p { margin: 0 0 6px; color: var(--slate-700); }
          ul { margin: 4px 0 8px 18px; padding: 0; }
          li { margin: 0 0 2px; }
          .meta { color: var(--slate-600); font-size: 11px; }
          .package {
            border: 1px solid var(--slate-300);
            border-left: 4px solid var(--brand-green);
            border-radius: 10px;
            padding: 12px;
            margin-bottom: 12px;
            background: #FCFFFA;
          }
          .service {
            border: 1px solid var(--slate-200);
            border-radius: 8px;
            padding: 10px 12px;
            margin: 8px 0;
            background: white;
            page-break-inside: auto;
            break-inside: auto;
          }
          .divider {
            height: 1px;
            background: var(--slate-200);
            margin: 18px 0 14px;
          }
          .appendix-group { margin-bottom: 12px; }
          .page-break { page-break-before: auto; break-before: auto; }
          p, li { orphans: 3; widows: 3; }
        </style>
      </head>
      <body>
        <main class="document">
          <header class="brand-header">
            <div>
              ${renderZippyLogoSvg()}
              <h1 class="doc-title">${escapeHtml(model.title)}</h1>
              <p class="doc-subtitle">Project: ${escapeHtml(model.projectName)}</p>
              <p class="doc-subtitle">Prepared for: ${customerName}</p>
            </div>
            <div class="doc-meta">
              <p class="doc-meta-row"><strong>Document Version:</strong> v${model.document.version}</p>
              <p class="doc-meta-row"><strong>Generated:</strong> ${escapeHtml(generatedOn)}</p>
              <p class="doc-meta-row"><strong>Last Updated:</strong> ${escapeHtml(updatedOn)}</p>
              <p class="doc-meta-row"><strong>Status:</strong> ${escapeHtml(model.document.status)}</p>
            </div>
          </header>

          <section class="panel panel-muted">
            <p class="section-heading">Executive Summary</p>
            <p class="body-prewrap">${escapeHtml(model.executiveSummary)}</p>
          </section>

          <div class="divider"></div>
          ${sectionHtml}

          <section class="panel panel-muted">
            <p class="section-heading">Conclusions</p>
            <p class="body-prewrap">${escapeHtml(model.conclusions)}</p>
          </section>

          <section class="panel">
            <h2>Appendix: Constraints and Assumptions</h2>
            ${appendixHtml || "<p>No appendix entries found.</p>"}
          </section>
        </main>
      </body>
    </html>
  `;
}

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

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent(renderDocumentHtml(model), { waitUntil: "networkidle" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "18mm",
        right: "14mm",
        bottom: "18mm",
        left: "14mm",
      },
    });

    const safeName = model.projectName.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "");
    const filename = `${safeName || "project"}-design-document-v${model.document.version}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to render PDF";
    return NextResponse.json({ error: "Failed to generate PDF", message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
