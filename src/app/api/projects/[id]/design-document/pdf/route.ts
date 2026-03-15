import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { getSession } from "@/lib/auth";
import { buildDesignDocumentModel, type DesignDocumentModel } from "@/lib/design-document";

const FEATURE_CATEGORY_STATUSES = new Set(["REQUIRED", "STANDARD", "OPTIONAL"] as const);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderDocumentHtml(model: DesignDocumentModel): string {
  const renderCategorizedFeatures = (features: DesignDocumentModel["sections"][number]["features"]) => {
    const categorized = features.filter((feature) => FEATURE_CATEGORY_STATUSES.has(feature.status as "REQUIRED" | "STANDARD" | "OPTIONAL"));

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
  };

  const sectionHtml = model.sections
    .map((section) => {
      if (section.kind === "PACKAGE") {
        const serviceHtml = section.services
          .map((service) => {
            const serviceOptions = service.serviceOptions
              .map((serviceOption) => `<li>${escapeHtml(serviceOption.name)} (${serviceOption.selected ? "Selected" : "Available"})</li>`)
              .join("");
            const designOptions = service.designOptions
              .map((option) => {
                const selected = option.selectedValues.map((value) => value.label).join(", ") || "Default";
                return `<li><strong>${escapeHtml(option.label)}:</strong> ${escapeHtml(selected)}</li>`;
              })
              .join("");
            const features = renderCategorizedFeatures(service.features);

            return `
              <article class="service">
                <h4>${escapeHtml(service.name)}</h4>
                <p>${escapeHtml(service.description ?? "No detailed description available.")}</p>
                <p class="meta">SKU: ${escapeHtml(service.sku)} | ${service.selected ? "Selected" : "Not selected"}</p>
                <h5>Service Options</h5>
                <ul>${serviceOptions || "<li>None</li>"}</ul>
                <h5>Design Options</h5>
                <ul>${designOptions || "<li>None</li>"}</ul>
                <h5>Features</h5>
                ${features}
              </article>
            `;
          })
          .join("");

        return `
          <section>
            <h2>${escapeHtml(section.name)} (Package)</h2>
            <p>${escapeHtml(section.description ?? "No detailed description available.")}</p>
            <p class="meta">SKU: ${escapeHtml(section.sku)}</p>
            <h3>Services</h3>
            ${serviceHtml || "<p>No services available.</p>"}
          </section>
        `;
      }

      const serviceOptions = section.serviceOptions
        .map((serviceOption) => `<li>${escapeHtml(serviceOption.name)} (${serviceOption.selected ? "Selected" : "Available"})</li>`)
        .join("");
      const designOptions = section.designOptions
        .map((option) => {
          const selected = option.selectedValues.map((value) => value.label).join(", ") || "Default";
          return `<li><strong>${escapeHtml(option.label)}:</strong> ${escapeHtml(selected)}</li>`;
        })
        .join("");
      const features = renderCategorizedFeatures(section.features);

      return `
        <section>
          <h2>${escapeHtml(section.name)}</h2>
          <p>${escapeHtml(section.description ?? "No detailed description available.")}</p>
          <p class="meta">SKU: ${escapeHtml(section.sku)}</p>
          <h3>Service Options</h3>
          <ul>${serviceOptions || "<li>None</li>"}</ul>
          <h3>Design Options</h3>
          <ul>${designOptions || "<li>None</li>"}</ul>
          <h3>Features</h3>
          ${features}
        </section>
      `;
    })
    .join("");

  const appendixHtml = model.appendix
    .map((entry) => {
      const constraints = entry.constraints.map((value) => `<li>${escapeHtml(value)}</li>`).join("");
      const assumptions = entry.assumptions.map((value) => `<li>${escapeHtml(value)}</li>`).join("");

      return `
        <article>
          <h4>${escapeHtml(entry.name)} (${escapeHtml(entry.itemType)})</h4>
          <h5>Constraints</h5>
          <ul>${constraints || "<li>None</li>"}</ul>
          <h5>Assumptions</h5>
          <ul>${assumptions || "<li>None</li>"}</ul>
        </article>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(model.title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 28px; line-height: 1.45; }
          h1 { margin: 0 0 8px; font-size: 28px; }
          h2 { margin: 22px 0 8px; font-size: 20px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
          h3 { margin: 14px 0 6px; font-size: 15px; }
          h4 { margin: 12px 0 4px; font-size: 14px; }
          h5 { margin: 10px 0 4px; font-size: 12px; text-transform: uppercase; color: #334155; }
          p { margin: 6px 0; }
          ul { margin: 6px 0 12px 18px; padding: 0; }
          .meta { color: #475569; font-size: 12px; }
          .panel { border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 10px 0; }
          .service { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 10px 0; }
          section, article { page-break-inside: avoid; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(model.title)}</h1>
        <p class="meta">Project: ${escapeHtml(model.projectName)}${model.customerName ? ` | Customer: ${escapeHtml(model.customerName)}` : ""}</p>

        <div class="panel">
          <h3>Executive Summary</h3>
          <p>${escapeHtml(model.executiveSummary)}</p>
        </div>

        ${sectionHtml}

        <div class="panel">
          <h3>Conclusions</h3>
          <p>${escapeHtml(model.conclusions)}</p>
        </div>

        <section>
          <h2>Appendix: Constraints and Assumptions</h2>
          ${appendixHtml || "<p>No appendix entries found.</p>"}
        </section>
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
