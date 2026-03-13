import "dotenv/config";
import { PrismaClient, ItemType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";

type RawService = {
  serviceName?: string;
  name?: string;
  shortDescription?: string;
  detailedDescription?: string;
  constraints?: string;
  assumptions?: string;
};

type ServiceRecord = {
  name: string;
  shortDescription: string | null;
  detailedDescription: string | null;
  constraints: string | null;
  assumptions: string | null;
};

type ExistingItem = {
  id: string;
  name: string;
  sku: string;
};

const NAME_ALIASES: Record<string, string[]> = {
  "business broadband (fiber)": ["business broadband"],
  "leo satellite": ["starlink leo satellite"],
  "meraki lan": ["meraki managed lan"],
};

const CONNECTIVITY_PATTERNS = [
  /\bbroadband\b/i,
  /internet access/i,
  /\bdia\b/i,
  /wireless access/i,
  /satellite/i,
  /\bmpls\b/i,
];

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
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
    // Continue to legacy object-list parser.
  }

  try {
    return new Function(`return [${content}];`)() as RawService[];
  } catch {
    throw new Error(
      `Failed to parse '${filePath}'. Provide JSON array data or a JS object list like Sample data/Servicesamples.`,
    );
  }
}

function toServiceRecord(raw: RawService, index: number): ServiceRecord {
  const name = normalizeText(raw.serviceName ?? raw.name);
  if (!name) {
    throw new Error(`Record ${index + 1} is missing 'serviceName' or 'name'.`);
  }

  return {
    name,
    shortDescription: normalizeText(raw.shortDescription),
    detailedDescription: normalizeText(raw.detailedDescription),
    constraints: normalizeText(raw.constraints),
    assumptions: normalizeText(raw.assumptions),
  };
}

function inferType(name: string): ItemType {
  return CONNECTIVITY_PATTERNS.some((pattern) => pattern.test(name))
    ? ItemType.CONNECTIVITY
    : ItemType.MANAGED_SERVICE;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toUpperCase();
}

function nextAvailableSku(baseSku: string, usedSkus: Set<string>): string {
  if (!usedSkus.has(baseSku)) {
    usedSkus.add(baseSku);
    return baseSku;
  }

  let index = 2;
  while (usedSkus.has(`${baseSku}-${index}`)) {
    index += 1;
  }
  const candidate = `${baseSku}-${index}`;
  usedSkus.add(candidate);
  return candidate;
}

function findExistingItem(
  serviceName: string,
  itemsByNormalizedName: Map<string, ExistingItem[]>,
  usedItemIds: Set<string>,
): ExistingItem | null {
  const aliasNames = NAME_ALIASES[serviceName.toLowerCase()] ?? [];
  const candidates = [serviceName, ...aliasNames];

  for (const candidate of candidates) {
    const key = normalizeName(candidate);
    const matches = itemsByNormalizedName.get(key) ?? [];
    const available = matches.find((item) => !usedItemIds.has(item.id));
    if (available) {
      return available;
    }
  }

  return null;
}

async function main() {
  const inputArg = process.argv[2];
  const inputPath = path.resolve(
    process.cwd(),
    inputArg && inputArg.trim().length > 0 ? inputArg : "Sample data/Services2",
  );

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const records = parseRawServices(inputPath).map(toServiceRecord);
    console.log(`Importing ${records.length} services from ${inputPath}`);

    const allItems = await prisma.catalogItem.findMany({
      select: { id: true, name: true, sku: true },
    });
    const itemsByNormalizedName = new Map<string, ExistingItem[]>();
    const usedSkus = new Set(allItems.map((item) => item.sku));
    const usedItemIds = new Set<string>();

    for (const item of allItems) {
      const key = normalizeName(item.name);
      const existing = itemsByNormalizedName.get(key) ?? [];
      existing.push(item);
      itemsByNormalizedName.set(key, existing);
    }

    const created: string[] = [];
    const updated: string[] = [];

    for (const record of records) {
      const type = inferType(record.name);
      const existing = findExistingItem(record.name, itemsByNormalizedName, usedItemIds);
      const constraintCreate = record.constraints ? [{ description: record.constraints }] : undefined;
      const assumptionCreate = record.assumptions ? [{ description: record.assumptions }] : undefined;

      if (existing) {
        usedItemIds.add(existing.id);

        await prisma.$transaction(async (tx) => {
          await tx.itemConstraint.deleteMany({ where: { itemId: existing.id } });
          await tx.itemAssumption.deleteMany({ where: { itemId: existing.id } });

          await tx.catalogItem.update({
            where: { id: existing.id },
            data: {
              name: record.name,
              shortDescription: record.shortDescription,
              detailedDescription: record.detailedDescription,
              type,
              constraints: constraintCreate ? { create: constraintCreate } : undefined,
              assumptions: assumptionCreate ? { create: assumptionCreate } : undefined,
            },
          });
        });

        updated.push(`${record.name} (${existing.sku})`);
        continue;
      }

      const prefix = type === ItemType.CONNECTIVITY ? "CONN" : "SVC";
      const baseSku = `${prefix}-${slugify(record.name)}`;
      const sku = nextAvailableSku(baseSku, usedSkus);

      const createdItem = await prisma.catalogItem.create({
        data: {
          sku,
          name: record.name,
          type,
          shortDescription: record.shortDescription,
          detailedDescription: record.detailedDescription,
          constraints: constraintCreate ? { create: constraintCreate } : undefined,
          assumptions: assumptionCreate ? { create: assumptionCreate } : undefined,
          pricing: {
            create: [{ pricingModel: "FLAT", costMrc: 0, costNrc: 0, priceMrc: 0, priceNrc: 0 }],
          },
        },
      });

      usedItemIds.add(createdItem.id);
      created.push(`${record.name} (${sku})`);

      const key = normalizeName(record.name);
      const list = itemsByNormalizedName.get(key) ?? [];
      list.push({ id: createdItem.id, name: createdItem.name, sku: createdItem.sku });
      itemsByNormalizedName.set(key, list);
    }

    console.log(`Updated: ${updated.length}`);
    updated.forEach((entry) => console.log(`  - ${entry}`));
    console.log(`Created: ${created.length}`);
    created.forEach((entry) => console.log(`  - ${entry}`));
    console.log("Service import complete.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
