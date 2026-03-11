import { PrismaClient, ItemType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const filePath = path.join(process.cwd(), 'Sample data/Servicesamples');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // The content is a list of object literals like:
  // { name: "...", ... }, { ... }
  // We need to wrap it in [] and make it valid JSON or use eval.
  // Since keys are not quoted, we'll use a hack to quote them for JSON.parse or just use eval.
  // Given the context of a seed script, eval on local trusted data is often acceptable if handled carefully.
  // However, I'll try to convert it to a more stable format.
  
  // Let's try to parse it by wrapping in [] and using eval in a controlled way if needed, 
  // but better to use a simple transformation.
  let services: any[] = [];
  try {
    // Attempt to parse as a JS array
    services = eval(`[${content}]`);
  } catch (err) {
    console.error('Failed to parse Servicesamples file. Please ensure it is a valid list of JavaScript objects.');
    throw err;
  }

  console.log(`Found ${services.length} services to populate.`);

  for (const service of services) {
    const slug = service.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    // Determine type based on name or presence of certain words
    let type: ItemType = ItemType.MANAGED_SERVICE;
    const nameLower = service.name.toLowerCase();
    if (
      nameLower.includes('internet') || 
      nameLower.includes('broadband') || 
      nameLower.includes('mpls') || 
      nameLower.includes('interconnect')
    ) {
      type = ItemType.CONNECTIVITY;
    }

    const skuPrefix = type === ItemType.CONNECTIVITY ? 'CON' : 'SRV';
    const sku = `${skuPrefix}-${slug.toUpperCase()}`;

    console.log(`Processing ${service.name} (${sku})...`);

    // Use a transaction to ensure clean state for each item (clearing old constraints/assumptions)
    await prisma.$transaction(async (tx) => {
      // Delete existing relations if any (simplest way to update)
      const existing = await tx.catalogItem.findUnique({ where: { sku } });
      if (existing) {
        await tx.itemConstraint.deleteMany({ where: { itemId: existing.id } });
        await tx.itemAssumption.deleteMany({ where: { itemId: existing.id } });
      }

      await tx.catalogItem.upsert({
        where: { sku },
        update: {
          name: service.name,
          shortDescription: service.shortDescription,
          detailedDescription: service.detailedDescription,
          type: type,
          constraints: {
            create: [
              { description: service.constraints }
            ]
          },
          assumptions: {
            create: [
              { description: service.assumptions }
            ]
          }
        },
        create: {
          sku,
          name: service.name,
          shortDescription: service.shortDescription,
          detailedDescription: service.detailedDescription,
          type: type,
          constraints: {
            create: [
              { description: service.constraints }
            ]
          },
          assumptions: {
            create: [
              { description: service.assumptions }
            ]
          }
        }
      });
    });
  }

  console.log('Population complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
