import "dotenv/config";
import { PrismaClient, ItemType, DependencyType, PricingModel } from "@prisma/client";
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log("Seeding test data...");

    // 1. Clean up existing data (order matters for FK constraints)
    await prisma.siteSelection.deleteMany();
    await prisma.solutionSite.deleteMany();
    await prisma.project.deleteMany();
    await prisma.itemDependency.deleteMany();
    await prisma.pricingTier.deleteMany();
    await prisma.pricing.deleteMany();
    await prisma.itemAttribute.deleteMany();
    await prisma.catalogItem.deleteMany();
    await prisma.taxonomyTerm.deleteMany();

    // 2. Create Taxonomy Terms

    // Vendors
    const vendorMeraki = await prisma.taxonomyTerm.create({
        data: { category: "VENDOR", value: "meraki", label: "Cisco Meraki" },
    });
    const vendorCatalyst = await prisma.taxonomyTerm.create({
        data: { category: "VENDOR", value: "cisco_catalyst", label: "Cisco Catalyst" },
    });

    // Features
    const featureHa = await prisma.taxonomyTerm.create({
        data: { category: "FEATURE", value: "high_availability", label: "High Availability" },
    });
    const featureZeroTouch = await prisma.taxonomyTerm.create({
        data: { category: "FEATURE", value: "zero_touch_provisioning", label: "Zero-Touch Provisioning" },
    });
    const featureAppVis = await prisma.taxonomyTerm.create({
        data: { category: "FEATURE", value: "application_visibility", label: "Application Visibility" },
    });
    const featureCloudMgmt = await prisma.taxonomyTerm.create({
        data: { category: "FEATURE", value: "cloud_management", label: "Cloud Management" },
    });

    // SLA
    const sla999 = await prisma.taxonomyTerm.create({
        data: { category: "SLA", value: "99.9", label: "99.9% Uptime" },
    });
    const sla9999 = await prisma.taxonomyTerm.create({
        data: { category: "SLA", value: "99.99", label: "99.99% Uptime" },
    });
    const slaBestEffort = await prisma.taxonomyTerm.create({
        data: { category: "SLA", value: "best_effort", label: "Best Effort" },
    });

    // Regions
    const regionNortheast = await prisma.taxonomyTerm.create({
        data: { category: "REGION", value: "northeast", label: "Northeast US" },
    });
    const regionSoutheast = await prisma.taxonomyTerm.create({
        data: { category: "REGION", value: "southeast", label: "Southeast US" },
    });
    const regionMidwest = await prisma.taxonomyTerm.create({
        data: { category: "REGION", value: "midwest", label: "Midwest US" },
    });
    const regionWest = await prisma.taxonomyTerm.create({
        data: { category: "REGION", value: "west", label: "West US" },
    });

    // 3. Create Catalog Items

    // --- Original seed items (backwards compat) ---
    const packageItem = await prisma.catalogItem.create({
        data: {
            sku: "PK-SDWAN-SMALL",
            name: "Small Office SD-WAN Package",
            type: ItemType.PACKAGE,
        },
    });

    const hardwareItemMx64 = await prisma.catalogItem.create({
        data: {
            sku: "HW-MX64",
            name: "Meraki MX64 Router",
            type: ItemType.HARDWARE,
        },
    });



    // --- Service Family: SD-WAN ---
    const sdwanFamily = await prisma.catalogItem.create({
        data: {
            sku: "FAM-SDWAN",
            name: "SD-WAN",
            shortDescription: "Software-Defined Wide Area Network service family",
            type: ItemType.SERVICE_FAMILY,
        },
    });

    // --- Managed Services (Vendor Stacks) ---
    const merakiSdwan = await prisma.catalogItem.create({
        data: {
            sku: "SVC-MERAKI-SDWAN",
            name: "Meraki SD-WAN",
            shortDescription: "Cisco Meraki cloud-managed SD-WAN",
            type: ItemType.MANAGED_SERVICE,
            configSchema: {
                type: "object",
                properties: {
                    topology: {
                        type: "string",
                        title: "Topology",
                        enum: ["hub_spoke", "mesh"],
                        enumLabels: ["Hub & Spoke", "Full Mesh"],
                        default: "hub_spoke",
                    },
                    internetBreakout: {
                        type: "string",
                        title: "Internet Breakout",
                        enum: ["local", "backhaul", "split_tunnel"],
                        enumLabels: ["Local Breakout", "Centralized Backhaul", "Split Tunnel"],
                        default: "local",
                    },
                    haEnabled: {
                        type: "boolean",
                        title: "High Availability",
                        description: "Deploy redundant appliance at this site",
                        default: false,
                    },
                },
                required: ["topology", "internetBreakout"],
            },
        },
    });

    const catalystSdwan = await prisma.catalogItem.create({
        data: {
            sku: "SVC-CATALYST-SDWAN",
            name: "Cisco Catalyst SD-WAN",
            shortDescription: "Cisco Catalyst (Viptela) SD-WAN",
            type: ItemType.MANAGED_SERVICE,
            configSchema: {
                type: "object",
                properties: {
                    topology: {
                        type: "string",
                        title: "Topology",
                        enum: ["hub_spoke", "mesh", "hybrid"],
                        enumLabels: ["Hub & Spoke", "Full Mesh", "Hybrid"],
                        default: "hub_spoke",
                    },
                    vmanageDeployment: {
                        type: "string",
                        title: "vManage Deployment",
                        enum: ["cloud", "on_prem"],
                        enumLabels: ["Cloud-Hosted", "On-Premises"],
                        default: "cloud",
                    },
                },
                required: ["topology", "vmanageDeployment"],
            },
        },
    });

    // --- Service Options (Support Tiers) ---
    const watchAlert = await prisma.catalogItem.create({
        data: {
            sku: "SVC-WATCH-ALERT",
            name: "Watch & Alert",
            shortDescription: "24/7 Monitoring and basic alerting",
            type: ItemType.SERVICE_OPTION,
        },
    });

    const hardwarePlus = await prisma.catalogItem.create({
        data: {
            sku: "SVC-HW-PLUS",
            name: "Hardware Plus",
            shortDescription: "Next-business-day hardware replacement",
            type: ItemType.SERVICE_OPTION,
        },
    });

    const totalCare = await prisma.catalogItem.create({
        data: {
            sku: "SVC-TOTAL-CARE",
            name: "Total Care",
            shortDescription: "Full proactive management and incident response",
            type: ItemType.SERVICE_OPTION,
        },
    });

    // Old mgmt tiers retyped to SERVICE_OPTION
    const mgmtSmall = await prisma.catalogItem.create({
        data: {
            sku: "SVC-MGMT-SMALL",
            name: "Managed SD-WAN - Small",
            shortDescription: "Managed service for small branch appliances",
            type: ItemType.SERVICE_OPTION,
        },
    });

    const mgmtMedium = await prisma.catalogItem.create({
        data: {
            sku: "SVC-MGMT-MEDIUM",
            name: "Managed SD-WAN - Medium",
            shortDescription: "Managed service for medium branch appliances",
            type: ItemType.SERVICE_OPTION,
        },
    });

    // --- Hardware ---
    const mx68 = await prisma.catalogItem.create({
        data: {
            sku: "HW-MX68",
            name: "Meraki MX68",
            shortDescription: "Small branch SD-WAN appliance",
            type: ItemType.HARDWARE,
        },
    });

    const mx85 = await prisma.catalogItem.create({
        data: {
            sku: "HW-MX85",
            name: "Meraki MX85",
            shortDescription: "Medium branch SD-WAN appliance",
            type: ItemType.HARDWARE,
        },
    });

    // --- Connectivity ---
    const dia = await prisma.catalogItem.create({
        data: {
            sku: "CONN-DIA",
            name: "Dedicated Internet Access (DIA)",
            shortDescription: "Fiber-based symmetric internet with SLA",
            type: ItemType.CONNECTIVITY,
        },
    });

    const broadband = await prisma.catalogItem.create({
        data: {
            sku: "CONN-BROADBAND",
            name: "Business Broadband",
            shortDescription: "Standard business broadband internet access",
            type: ItemType.CONNECTIVITY,
        },
    });

    const mpls = await prisma.catalogItem.create({
        data: {
            sku: "CONN-MPLS",
            name: "Managed MPLS",
            shortDescription: "Private Wide Area Network circuit",
            type: ItemType.CONNECTIVITY,
        },
    });

    const fwa = await prisma.catalogItem.create({
        data: {
            sku: "CONN-FWA",
            name: "Fixed Wireless Access (5G)",
            shortDescription: "High-speed wireless primary or failover",
            type: ItemType.CONNECTIVITY,
        },
    });

    const leo = await prisma.catalogItem.create({
        data: {
            sku: "CONN-LEO",
            name: "Starlink LEO Satellite",
            shortDescription: "Low-Earth Orbit satellite connectivity",
            type: ItemType.CONNECTIVITY,
        },
    });

    // 4. Create Pricing

    // Original seed pricing (backwards compat)
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
            itemId: hardwareItemMx64.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 1200,
            priceMrc: 0,
        },
    });



    // Meraki SD-WAN - month-to-month (default)
    await prisma.pricing.create({
        data: {
            itemId: merakiSdwan.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 0,
            priceMrc: 120,
            costNrc: 0,
            costMrc: 75,
        },
    });

    // Meraki SD-WAN - 36 month
    await prisma.pricing.create({
        data: {
            itemId: merakiSdwan.id,
            pricingModel: PricingModel.FLAT,
            termMonths: 36,
            priceNrc: 0,
            priceMrc: 85,
            costNrc: 0,
            costMrc: 55,
        },
    });

    // Meraki SD-WAN - 60 month
    await prisma.pricing.create({
        data: {
            itemId: merakiSdwan.id,
            pricingModel: PricingModel.FLAT,
            termMonths: 60,
            priceNrc: 0,
            priceMrc: 65,
            costNrc: 0,
            costMrc: 42,
        },
    });

    // Catalyst SD-WAN - month-to-month
    await prisma.pricing.create({
        data: {
            itemId: catalystSdwan.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 0,
            priceMrc: 140,
            costNrc: 0,
            costMrc: 90,
        },
    });

    // Catalyst SD-WAN - 36 month
    await prisma.pricing.create({
        data: {
            itemId: catalystSdwan.id,
            pricingModel: PricingModel.FLAT,
            termMonths: 36,
            priceNrc: 0,
            priceMrc: 100,
            costNrc: 0,
            costMrc: 65,
        },
    });

    // Hardware pricing
    await prisma.pricing.create({
        data: {
            itemId: mx68.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 800,
            priceMrc: 0,
            costNrc: 450,
            costMrc: 0,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: mx85.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 1800,
            priceMrc: 0,
            costNrc: 1000,
            costMrc: 0,
        },
    });

    // --- Support Tier Pricing ---
    await prisma.pricing.create({
        data: {
            itemId: watchAlert.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 0,
            priceMrc: 50,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: hardwarePlus.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 0,
            priceMrc: 100,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: totalCare.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 250,
            priceMrc: 300,
        },
    });

    // Managed Service re-priced as billable tiers
    await prisma.pricing.create({
        data: {
            itemId: mgmtSmall.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 500,
            priceMrc: 150,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: mgmtMedium.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 750,
            priceMrc: 250,
        },
    });

    // --- Connectivity Pricing ---
    await prisma.pricing.create({
        data: {
            itemId: dia.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 1000,
            priceMrc: 800,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: mpls.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 1500,
            priceMrc: 1200,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: fwa.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 250,
            priceMrc: 150,
        },
    });

    await prisma.pricing.create({
        data: {
            itemId: leo.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 500,
            priceMrc: 200,
        },
    });

    // Broadband pricing
    await prisma.pricing.create({
        data: {
            itemId: broadband.id,
            pricingModel: PricingModel.FLAT,
            priceNrc: 200,
            priceMrc: 99,
        },
    });

    // 5. Create Dependencies

    // --- Package Includes ---
    await prisma.itemDependency.create({
        data: {
            parentId: packageItem.id,
            childId: sdwanFamily.id,
            type: DependencyType.INCLUDES,
        },
    });

    // IS_A: SD-WAN family → managed services (vendor stacks)
    await prisma.itemDependency.create({
        data: {
            parentId: sdwanFamily.id,
            childId: merakiSdwan.id,
            type: DependencyType.IS_A,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: sdwanFamily.id,
            childId: catalystSdwan.id,
            type: DependencyType.IS_A,
        },
    });

    // --- Meraki Attachments ---
    // Mandatory hardware
    await prisma.itemDependency.create({
        data: {
            parentId: merakiSdwan.id,
            childId: mx68.id,
            type: DependencyType.INCLUDES,
        },
    });

    // Optional Support Tiers (Service Options)
    await prisma.itemDependency.create({
        data: {
            parentId: merakiSdwan.id,
            childId: watchAlert.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: merakiSdwan.id,
            childId: hardwarePlus.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: merakiSdwan.id,
            childId: totalCare.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    // Optional Transports (Connectivity)
    await prisma.itemDependency.create({
        data: {
            parentId: merakiSdwan.id,
            childId: dia.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: merakiSdwan.id,
            childId: broadband.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: merakiSdwan.id,
            childId: mpls.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    // --- Support Tier Mutual Exclusion (Incompatible) ---
    await prisma.itemDependency.create({
        data: {
            parentId: watchAlert.id,
            childId: totalCare.id,
            type: DependencyType.INCOMPATIBLE,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: hardwarePlus.id,
            childId: totalCare.id,
            type: DependencyType.INCOMPATIBLE,
        },
    });

    // --- Catalyst Attachments ---
    await prisma.itemDependency.create({
        data: {
            parentId: catalystSdwan.id,
            childId: dia.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    await prisma.itemDependency.create({
        data: {
            parentId: catalystSdwan.id,
            childId: mpls.id,
            type: DependencyType.OPTIONAL_ATTACHMENT,
        },
    });

    // 6. Create Item Attributes

    // Vendor attributes
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: vendorMeraki.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: catalystSdwan.id, taxonomyTermId: vendorCatalyst.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: mx68.id, taxonomyTermId: vendorMeraki.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: mx85.id, taxonomyTermId: vendorMeraki.id },
    });

    // Feature attributes — Meraki SD-WAN
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: featureCloudMgmt.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: featureZeroTouch.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: featureAppVis.id },
    });

    // Feature attributes — Catalyst SD-WAN
    await prisma.itemAttribute.create({
        data: { itemId: catalystSdwan.id, taxonomyTermId: featureHa.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: catalystSdwan.id, taxonomyTermId: featureAppVis.id },
    });

    // SLA attributes
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: sla9999.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: catalystSdwan.id, taxonomyTermId: sla999.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: broadband.id, taxonomyTermId: slaBestEffort.id },
    });

    // Region attributes (geo-eligibility)
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: regionNortheast.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: regionSoutheast.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: regionMidwest.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: merakiSdwan.id, taxonomyTermId: regionWest.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: catalystSdwan.id, taxonomyTermId: regionNortheast.id },
    });
    await prisma.itemAttribute.create({
        data: { itemId: catalystSdwan.id, taxonomyTermId: regionMidwest.id },
    });

    // 7. Create Sample Project
    const project = await prisma.project.create({
        data: {
            name: "Acme Corp SD-WAN Rollout",
            customerName: "Acme Corporation",
            termMonths: 36,
            sites: {
                create: [
                    {
                        name: "New York HQ",
                        address: "350 Fifth Avenue, New York, NY 10118",
                        region: "northeast",
                        primaryServiceId: merakiSdwan.id,
                    },
                    {
                        name: "Chicago Branch",
                        address: "233 S Wacker Dr, Chicago, IL 60606",
                        region: "midwest",
                    },
                ],
            },
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
    console.log("Hardware ID:", hardwareItemMx64.id);

    console.log("SD-WAN Family ID:", sdwanFamily.id);
    console.log("Meraki SD-WAN ID:", merakiSdwan.id);
    console.log("Catalyst SD-WAN ID:", catalystSdwan.id);
    console.log("Project ID:", project.id);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
