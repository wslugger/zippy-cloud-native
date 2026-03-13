import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const outputPath = resolve(process.cwd(), "prisma/seed-data.json");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const seedData = {
    taxonomyTerm: await prisma.taxonomyTerm.findMany({ orderBy: [{ category: "asc" }, { value: "asc" }] }),
    catalogItem: await prisma.catalogItem.findMany({ orderBy: [{ sku: "asc" }] }),
    itemConstraint: await prisma.itemConstraint.findMany({ orderBy: [{ itemId: "asc" }, { id: "asc" }] }),
    itemAssumption: await prisma.itemAssumption.findMany({ orderBy: [{ itemId: "asc" }, { id: "asc" }] }),
    itemCollateral: await prisma.itemCollateral.findMany({ orderBy: [{ itemId: "asc" }, { id: "asc" }] }),
    itemAttribute: await prisma.itemAttribute.findMany({ orderBy: [{ itemId: "asc" }, { taxonomyTermId: "asc" }] }),
    itemDependency: await prisma.itemDependency.findMany({
      orderBy: [{ parentId: "asc" }, { childId: "asc" }, { type: "asc" }],
    }),
    pricing: await prisma.pricing.findMany({ orderBy: [{ itemId: "asc" }, { effectiveDate: "asc" }] }),
    pricingTier: await prisma.pricingTier.findMany({ orderBy: [{ pricingId: "asc" }, { startingUnit: "asc" }] }),
    user: await prisma.user.findMany({ orderBy: [{ email: "asc" }] }),
    project: await prisma.project.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] }),
    projectItem: await prisma.projectItem.findMany({ orderBy: [{ projectId: "asc" }, { catalogItemId: "asc" }] }),
    projectItemDesignOption: await prisma.projectItemDesignOption.findMany({
      orderBy: [{ projectItemId: "asc" }, { taxonomyTermId: "asc" }],
    }),
    solutionSite: await prisma.solutionSite.findMany({ orderBy: [{ projectId: "asc" }, { name: "asc" }] }),
    siteSelection: await prisma.siteSelection.findMany({ orderBy: [{ siteId: "asc" }, { catalogItemId: "asc" }] }),
    systemConfig: await prisma.systemConfig.findMany({ orderBy: [{ key: "asc" }] }),
    designOptionDefinition: await prisma.designOptionDefinition.findMany({ orderBy: [{ key: "asc" }] }),
    designOptionValue: await prisma.designOptionValue.findMany({
      orderBy: [{ designOptionId: "asc" }, { sortOrder: "asc" }, { value: "asc" }],
    }),
    catalogItemDesignOption: await prisma.catalogItemDesignOption.findMany({
      orderBy: [{ catalogItemId: "asc" }, { designOptionId: "asc" }],
    }),
    catalogItemDesignOptionValue: await prisma.catalogItemDesignOptionValue.findMany({
      orderBy: [{ itemDesignOptionId: "asc" }, { designOptionValueId: "asc" }],
    }),
    packageCompositionItem: await prisma.packageCompositionItem.findMany({
      orderBy: [{ packageId: "asc" }, { displayOrder: "asc" }, { catalogItemId: "asc" }],
    }),
    packageDesignOptionPolicy: await prisma.packageDesignOptionPolicy.findMany({
      orderBy: [
        { packageId: "asc" },
        { targetCatalogItemId: "asc" },
        { designOptionId: "asc" },
        { operator: "asc" },
      ],
    }),
    packageDesignOptionPolicyValue: await prisma.packageDesignOptionPolicyValue.findMany({
      orderBy: [{ policyId: "asc" }, { designOptionValueId: "asc" }],
    }),
    projectRequirementDocument: await prisma.projectRequirementDocument.findMany({
      orderBy: [{ projectId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    projectRecommendation: await prisma.projectRecommendation.findMany({
      orderBy: [{ projectId: "asc" }, { catalogItemId: "asc" }],
    }),
  };

  writeFileSync(outputPath, `${JSON.stringify(seedData, null, 2)}\n`, "utf8");

  const counts = Object.fromEntries(Object.entries(seedData).map(([key, value]) => [key, value.length]));
  console.log(`Wrote ${outputPath}`);
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
