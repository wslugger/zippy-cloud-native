import "dotenv/config";
import { PrismaClient, ItemType, DependencyType, PricingModel } from "@prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding test data...");

    // 1. Clean up existing data
    await prisma.itemDependency.deleteMany();
    await prisma.pricingTier.deleteMany();
    await prisma.pricing.deleteMany();
    await prisma.itemAttribute.deleteMany();
    await prisma.catalogItem.deleteMany();
    await prisma.taxonomyTerm.deleteMany();

    // 2. Create Taxonomy Terms
    const vendorMeraki = await prisma.taxonomyTerm.create({
        data: { category: "VENDOR", value: "meraki", label: "Cisco Meraki" },
    });

    // 3. Create Items
    const packageItem = await prisma.catalogItem.create({
        data: {
            sku: "PK-SDWAN-SMALL",
            name: "Small Office SD-WAN Package",
            type: ItemType.PACKAGE,
        },
    });

    const hardwareItem = await prisma.catalogItem.create({
        data: {
            sku: "HW-MX64",
            name: "Meraki MX64 Router",
            type: ItemType.HARDWARE,
        },
    });

    const licenseItem = await prisma.catalogItem.create({
        data: {
            sku: "LIC-ADV-SEC-1Y",
            name: "Advanced Security License (1 Year)",
            type: ItemType.LICENSE,
        },
    });

    // 4. Create Pricing
    await prisma.pricing.create({
        data: {
            itemId: packageItem.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 500,
            priceMrc: 0,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: hardwareItem.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 1200,
            priceMrc: 0,
        },
    });

    const licensePricing = await prisma.pricing.create({
        data: {
            itemId: licenseItem.id,
            pricingModel: PricingModel.TIERED,
            priceNrc: 0,
            priceMrc: 150,
        },
    });

    await prisma.pricingTier.create({
        data: {
            pricingId: licensePricing.id,
            startingUnit: 1,
            endingUnit: 5,
            priceMrc: 140,
            costMrc: 100,
        },
    });

    // 5. Create Dependencies (Package -> Hardware -> License)
    await prisma.itemDependency.create({
        data: {
            parentId: packageItem.id,
            childId: hardwareItem.id,
            type: DependencyType.INCLUDES,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: hardwareItem.id,
            childId: licenseItem.id,
            type: DependencyType.MANDATORY_ATTACHMENT,
        },
    });

    // Seed System Configs (AI Prompts)
    console.log("Seeding system configurations...");
    await prisma.systemConfig.upsert({
        where: { key: 'PROMPT_BOM_GEN' },
        update: {},
        create: {
            key: 'PROMPT_BOM_GEN',
            value: 'You are a Network Solution Architect. Based on the site requirements, select the most appropriate SKUs from the catalog...',
            description: 'Primary system prompt for BOM generation logic.'
        }
    });

    await prisma.systemConfig.upsert({
        where: { key: 'PROMPT_TRIAGE' },
        update: {},
        create: {
            key: 'PROMPT_TRIAGE',
            value: 'Analyze the user input and determine which technical stack is required (SD-WAN, LAN, or WLAN)...',
            description: 'Prompt for initial project triage.'
        }
    });

    console.log("Seeding complete!");
    console.log("Package ID:", packageItem.id);
    console.log("Hardware ID:", hardwareItem.id);
    console.log("License ID:", licenseItem.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
