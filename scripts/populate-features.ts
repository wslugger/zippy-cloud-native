import "dotenv/config";
import { PrismaClient, ItemType, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";

type RawFeature = {
  featureName?: string;
  shortDescription?: string;
  detailedDescription?: string;
  constraints?: string;
  assumptions?: string;
};

type RawService = {
  serviceName?: string;
  name?: string;
  shortDescription?: string;
  detailedDescription?: string;
  constraints?: string;
  assumptions?: string;
  features?: RawFeature[];
};

type ParsedFeature = {
  name: string;
  value: string;
  description: string | null;
  constraints: string[];
  assumptions: string[];
};

type ParsedService = {
  name: string;
  shortDescription: string | null;
  detailedDescription: string | null;
  constraints: string | null;
  assumptions: string | null;
  features: ParsedFeature[];
};

type ExistingItem = {
  id: string;
  name: string;
  sku: string;
  type: ItemType;
  configSchema: Prisma.JsonValue | null;
};

const SERVICE_NAME_ALIASES: Record<string, string[]> = {
  "meraki sdwan": ["meraki sd-wan"],
  "cisco catalyst sdwan": ["cisco catalyst sd-wan"],
};

const CONNECTIVITY_PATTERNS = [
  /\bbroadband\b/i,
  /internet access/i,
  /\bdia\b/i,
  /wireless access/i,
  /satellite/i,
  /\bmpls\b/i,
];

function normalizeServiceName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeDesignOptionKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeText(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseRawServices(filePath: string): RawService[] {
  const content = fs.readFileSync(filePath, "utf-8");
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed as RawService[];
    }
  } catch {
    // Continue to fallback parser.
  }

  try {
    return new Function(`return [${content}];`)() as RawService[];
  } catch {
    throw new Error(
      `Failed to parse '${filePath}'. Provide JSON array data or a JS object list compatible with [ ... ] wrapping.`,
    );
  }
}

function inferType(serviceName: string): ItemType {
  return CONNECTIVITY_PATTERNS.some((pattern) => pattern.test(serviceName))
    ? ItemType.CONNECTIVITY
    : ItemType.MANAGED_SERVICE;
}

function skuForService(serviceName: string, usedSkus: Set<string>): string {
  const prefix = inferType(serviceName) === ItemType.CONNECTIVITY ? "CONN" : "SVC";
  const baseSlug = serviceName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toUpperCase();
  const baseSku = `${prefix}-${baseSlug}`;

  if (!usedSkus.has(baseSku)) {
    usedSkus.add(baseSku);
    return baseSku;
  }

  let suffix = 2;
  while (usedSkus.has(`${baseSku}-${suffix}`)) {
    suffix += 1;
  }
  const sku = `${baseSku}-${suffix}`;
  usedSkus.add(sku);
  return sku;
}

function parseFeature(raw: RawFeature, index: number, serviceName: string): ParsedFeature {
  const name = normalizeText(raw.featureName);
  if (!name) {
    throw new Error(`Feature ${index + 1} in service '${serviceName}' is missing 'featureName'.`);
  }

  const description = normalizeText(raw.detailedDescription) ?? normalizeText(raw.shortDescription);
  const constraints = normalizeText(raw.constraints);
  const assumptions = normalizeText(raw.assumptions);

  return {
    name,
    value: normalizeDesignOptionKey(name),
    description,
    constraints: constraints ? [constraints] : [],
    assumptions: assumptions ? [assumptions] : [],
  };
}

function parseService(raw: RawService, index: number): ParsedService {
  const name = normalizeText(raw.serviceName ?? raw.name);
  if (!name) {
    throw new Error(`Record ${index + 1} is missing 'serviceName' or 'name'.`);
  }

  const parsedFeatures = Array.isArray(raw.features)
    ? raw.features.map((feature, featureIndex) => parseFeature(feature, featureIndex, name))
    : [];

  return {
    name,
    shortDescription: normalizeText(raw.shortDescription),
    detailedDescription: normalizeText(raw.detailedDescription),
    constraints: normalizeText(raw.constraints),
    assumptions: normalizeText(raw.assumptions),
    features: parsedFeatures,
  };
}

function getServiceCandidates(serviceName: string): string[] {
  const normalized = serviceName.toLowerCase();
  return [serviceName, ...(SERVICE_NAME_ALIASES[normalized] ?? [])];
}

function stripFeatureConfig(config: Prisma.JsonValue | null): Prisma.JsonObject | undefined {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return undefined;
  }
  const next = { ...(config as Prisma.JsonObject) };
  delete next.serviceFeatureAssignments;
  delete next.packageFeatureAssignments;
  return next;
}

async function main() {
  const inputArg = process.argv[2];
  const inputPath = path.resolve(process.cwd(), inputArg && inputArg.trim() ? inputArg : "Sample data/features");
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const parsedServices = parseRawServices(inputPath).map(parseService);
    console.log(`Importing features from ${inputPath} for ${parsedServices.length} services.`);

    const existingItems = await prisma.catalogItem.findMany({
      where: {
        type: { in: [ItemType.MANAGED_SERVICE, ItemType.CONNECTIVITY, ItemType.SERVICE_OPTION] },
      },
      select: { id: true, name: true, sku: true, type: true, configSchema: true },
    });

    const usedSkus = new Set(existingItems.map((item) => item.sku));
    const itemsByNormalizedName = new Map<string, ExistingItem[]>();
    for (const item of existingItems) {
      const key = normalizeServiceName(item.name);
      const list = itemsByNormalizedName.get(key) ?? [];
      list.push(item);
      itemsByNormalizedName.set(key, list);
    }

    let featureTermCreated = 0;
    let featureTermUpdated = 0;
    let servicesCreated = 0;
    let servicesUpdated = 0;
    let servicesAssigned = 0;

    const termIdByFeatureValue = new Map<string, string>();
    const createdFeatureLabels = new Set<string>();
    const updatedFeatureLabels = new Set<string>();

    for (const service of parsedServices) {
      const candidates = getServiceCandidates(service.name);
      let matchedItem: ExistingItem | null = null;

      for (const candidateName of candidates) {
        const key = normalizeServiceName(candidateName);
        const matches = itemsByNormalizedName.get(key);
        if (matches && matches.length > 0) {
          matchedItem = matches[0];
          break;
        }
      }

      if (!matchedItem) {
        const created = await prisma.catalogItem.create({
          data: {
            sku: skuForService(service.name, usedSkus),
            name: service.name,
            type: inferType(service.name),
            shortDescription: service.shortDescription,
            detailedDescription: service.detailedDescription,
            constraints: service.constraints ? { create: [{ description: service.constraints }] } : undefined,
            assumptions: service.assumptions ? { create: [{ description: service.assumptions }] } : undefined,
            pricing: {
              create: [{ pricingModel: "FLAT", costMrc: 0, costNrc: 0, priceMrc: 0, priceNrc: 0 }],
            },
          },
          select: { id: true, name: true, sku: true, type: true, configSchema: true },
        });
        matchedItem = created;
        servicesCreated += 1;

        const key = normalizeServiceName(created.name);
        const list = itemsByNormalizedName.get(key) ?? [];
        list.push(created);
        itemsByNormalizedName.set(key, list);
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.itemConstraint.deleteMany({ where: { itemId: matchedItem!.id } });
          await tx.itemAssumption.deleteMany({ where: { itemId: matchedItem!.id } });
          await tx.catalogItem.update({
            where: { id: matchedItem!.id },
            data: {
              name: service.name,
              type: inferType(service.name),
              shortDescription: service.shortDescription,
              detailedDescription: service.detailedDescription,
              configSchema: stripFeatureConfig(matchedItem!.configSchema),
              constraints: service.constraints ? { create: [{ description: service.constraints }] } : undefined,
              assumptions: service.assumptions ? { create: [{ description: service.assumptions }] } : undefined,
            },
          });
        });
        servicesUpdated += 1;
      }

      const featureTermIds: string[] = [];
      for (const feature of service.features) {
        let termId = termIdByFeatureValue.get(feature.value);
        if (!termId) {
          const existingTerm = await prisma.taxonomyTerm.findUnique({
            where: { category_value: { category: "FEATURE", value: feature.value } },
            select: { id: true, label: true, description: true, constraints: true, assumptions: true },
          });

          if (existingTerm) {
            await prisma.taxonomyTerm.update({
              where: { id: existingTerm.id },
              data: {
                label: feature.name,
                description: feature.description,
                constraints: feature.constraints,
                assumptions: feature.assumptions,
              },
            });
            updatedFeatureLabels.add(feature.name);
            termId = existingTerm.id;
          } else {
            const createdTerm = await prisma.taxonomyTerm.create({
              data: {
                category: "FEATURE",
                value: feature.value,
                label: feature.name,
                description: feature.description,
                constraints: feature.constraints,
                assumptions: feature.assumptions,
              },
              select: { id: true },
            });
            createdFeatureLabels.add(feature.name);
            termId = createdTerm.id;
          }

          termIdByFeatureValue.set(feature.value, termId);
        }

        featureTermIds.push(termId);
      }

      const dedupedFeatureTermIds = Array.from(new Set(featureTermIds));

      await prisma.$transaction(async (tx) => {
        await tx.itemAttribute.deleteMany({
          where: {
            itemId: matchedItem.id,
            term: { category: "FEATURE" },
          },
        });

        if (dedupedFeatureTermIds.length > 0) {
          await tx.itemAttribute.createMany({
            data: dedupedFeatureTermIds.map((taxonomyTermId) => ({
              itemId: matchedItem!.id,
              taxonomyTermId,
            })),
            skipDuplicates: true,
          });
        }
      });

      servicesAssigned += 1;
    }

    featureTermCreated = createdFeatureLabels.size;
    featureTermUpdated = updatedFeatureLabels.size;

    console.log(`Feature terms created: ${featureTermCreated}`);
    console.log(`Feature terms updated: ${featureTermUpdated}`);
    console.log(`Services created: ${servicesCreated}`);
    console.log(`Services updated: ${servicesUpdated}`);
    console.log(`Services assigned features: ${servicesAssigned}`);
    console.log("Feature import complete.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
