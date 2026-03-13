import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

type SeedData = {
  taxonomyTerm: Record<string, unknown>[];
  catalogItem: Record<string, unknown>[];
  itemConstraint: Record<string, unknown>[];
  itemAssumption: Record<string, unknown>[];
  itemCollateral: Record<string, unknown>[];
  itemAttribute: Record<string, unknown>[];
  itemDependency: Record<string, unknown>[];
  pricing: Record<string, unknown>[];
  pricingTier: Record<string, unknown>[];
  user: Record<string, unknown>[];
  project: Record<string, unknown>[];
  projectItem: Record<string, unknown>[];
  projectItemDesignOption: Record<string, unknown>[];
  solutionSite: Record<string, unknown>[];
  siteSelection: Record<string, unknown>[];
  systemConfig: Record<string, unknown>[];
  designOptionDefinition: Record<string, unknown>[];
  designOptionValue: Record<string, unknown>[];
  catalogItemDesignOption: Record<string, unknown>[];
  catalogItemDesignOptionValue: Record<string, unknown>[];
  packageCompositionItem: Record<string, unknown>[];
  packageDesignOptionPolicy: Record<string, unknown>[];
  packageDesignOptionPolicyValue: Record<string, unknown>[];
  projectRequirementDocument: Record<string, unknown>[];
  projectRecommendation: Record<string, unknown>[];
};

const seedData = JSON.parse(
  readFileSync(resolve(process.cwd(), "prisma/seed-data.json"), "utf8"),
) as SeedData;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function clearDatabase() {
  await prisma.$transaction([
    prisma.packageDesignOptionPolicyValue.deleteMany(),
    prisma.packageDesignOptionPolicy.deleteMany(),
    prisma.packageCompositionItem.deleteMany(),
    prisma.catalogItemDesignOptionValue.deleteMany(),
    prisma.catalogItemDesignOption.deleteMany(),
    prisma.projectRecommendation.deleteMany(),
    prisma.projectRequirementDocument.deleteMany(),
    prisma.projectItemDesignOption.deleteMany(),
    prisma.projectItem.deleteMany(),
    prisma.siteSelection.deleteMany(),
    prisma.solutionSite.deleteMany(),
    prisma.pricingTier.deleteMany(),
    prisma.pricing.deleteMany(),
    prisma.itemDependency.deleteMany(),
    prisma.itemAttribute.deleteMany(),
    prisma.itemCollateral.deleteMany(),
    prisma.itemAssumption.deleteMany(),
    prisma.itemConstraint.deleteMany(),
    prisma.designOptionValue.deleteMany(),
    prisma.designOptionDefinition.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
    prisma.systemConfig.deleteMany(),
    prisma.catalogItem.deleteMany(),
    prisma.taxonomyTerm.deleteMany(),
  ]);
}

async function createManyIfPresent(label: string, rows: Record<string, unknown>[], createMany: () => Promise<unknown>) {
  if (rows.length === 0) {
    return;
  }

  await createMany();
  console.log(`Seeded ${label}: ${rows.length}`);
}

async function seedDatabase() {
  await createManyIfPresent("taxonomyTerm", seedData.taxonomyTerm, () =>
    prisma.taxonomyTerm.createMany({ data: seedData.taxonomyTerm as any[] }),
  );
  await createManyIfPresent("catalogItem", seedData.catalogItem, () =>
    prisma.catalogItem.createMany({ data: seedData.catalogItem as any[] }),
  );
  await createManyIfPresent("user", seedData.user, () => prisma.user.createMany({ data: seedData.user as any[] }));
  await createManyIfPresent("project", seedData.project, () =>
    prisma.project.createMany({ data: seedData.project as any[] }),
  );
  await createManyIfPresent("solutionSite", seedData.solutionSite, () =>
    prisma.solutionSite.createMany({ data: seedData.solutionSite as any[] }),
  );

  await createManyIfPresent("designOptionDefinition", seedData.designOptionDefinition, () =>
    prisma.designOptionDefinition.createMany({ data: seedData.designOptionDefinition as any[] }),
  );
  await createManyIfPresent("designOptionValue", seedData.designOptionValue, () =>
    prisma.designOptionValue.createMany({ data: seedData.designOptionValue as any[] }),
  );
  await createManyIfPresent("catalogItemDesignOption", seedData.catalogItemDesignOption, () =>
    prisma.catalogItemDesignOption.createMany({ data: seedData.catalogItemDesignOption as any[] }),
  );
  await createManyIfPresent("catalogItemDesignOptionValue", seedData.catalogItemDesignOptionValue, () =>
    prisma.catalogItemDesignOptionValue.createMany({ data: seedData.catalogItemDesignOptionValue as any[] }),
  );
  await createManyIfPresent("packageCompositionItem", seedData.packageCompositionItem, () =>
    prisma.packageCompositionItem.createMany({ data: seedData.packageCompositionItem as any[] }),
  );
  await createManyIfPresent("packageDesignOptionPolicy", seedData.packageDesignOptionPolicy, () =>
    prisma.packageDesignOptionPolicy.createMany({ data: seedData.packageDesignOptionPolicy as any[] }),
  );
  await createManyIfPresent("packageDesignOptionPolicyValue", seedData.packageDesignOptionPolicyValue, () =>
    prisma.packageDesignOptionPolicyValue.createMany({ data: seedData.packageDesignOptionPolicyValue as any[] }),
  );

  await createManyIfPresent("itemConstraint", seedData.itemConstraint, () =>
    prisma.itemConstraint.createMany({ data: seedData.itemConstraint as any[] }),
  );
  await createManyIfPresent("itemAssumption", seedData.itemAssumption, () =>
    prisma.itemAssumption.createMany({ data: seedData.itemAssumption as any[] }),
  );
  await createManyIfPresent("itemCollateral", seedData.itemCollateral, () =>
    prisma.itemCollateral.createMany({ data: seedData.itemCollateral as any[] }),
  );
  await createManyIfPresent("itemAttribute", seedData.itemAttribute, () =>
    prisma.itemAttribute.createMany({ data: seedData.itemAttribute as any[] }),
  );
  await createManyIfPresent("itemDependency", seedData.itemDependency, () =>
    prisma.itemDependency.createMany({ data: seedData.itemDependency as any[] }),
  );
  await createManyIfPresent("pricing", seedData.pricing, () =>
    prisma.pricing.createMany({ data: seedData.pricing as any[] }),
  );
  await createManyIfPresent("pricingTier", seedData.pricingTier, () =>
    prisma.pricingTier.createMany({ data: seedData.pricingTier as any[] }),
  );

  await createManyIfPresent("projectItem", seedData.projectItem, () =>
    prisma.projectItem.createMany({ data: seedData.projectItem as any[] }),
  );
  await createManyIfPresent("projectItemDesignOption", seedData.projectItemDesignOption, () =>
    prisma.projectItemDesignOption.createMany({ data: seedData.projectItemDesignOption as any[] }),
  );
  await createManyIfPresent("siteSelection", seedData.siteSelection, () =>
    prisma.siteSelection.createMany({ data: seedData.siteSelection as any[] }),
  );
  await createManyIfPresent("projectRequirementDocument", seedData.projectRequirementDocument, () =>
    prisma.projectRequirementDocument.createMany({ data: seedData.projectRequirementDocument as any[] }),
  );
  await createManyIfPresent("projectRecommendation", seedData.projectRecommendation, () =>
    prisma.projectRecommendation.createMany({ data: seedData.projectRecommendation as any[] }),
  );

  await createManyIfPresent("systemConfig", seedData.systemConfig, () =>
    prisma.systemConfig.createMany({ data: seedData.systemConfig as any[] }),
  );
}

async function main() {
  console.log("Resetting database before snapshot seed...");
  await clearDatabase();

  console.log("Applying seed snapshot from prisma/seed-data.json...");
  await seedDatabase();

  console.log("Seed snapshot applied.");
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
