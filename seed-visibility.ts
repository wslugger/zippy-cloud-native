import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const defaults = [
        { category: 'PANEL_PRICING', label: 'Hardware', value: 'HARDWARE' },
        { category: 'PANEL_PRICING', label: 'Managed Service', value: 'MANAGED_SERVICE' },
        { category: 'PANEL_PRICING', label: 'Service Option', value: 'SERVICE_OPTION' },
        { category: 'PANEL_PRICING', label: 'Connectivity', value: 'CONNECTIVITY' },
        { category: 'PANEL_PRICING', label: 'Design Package', value: 'PACKAGE' },
        
        { category: 'PANEL_ATTACHMENTS', label: 'Hardware', value: 'HARDWARE' },
        { category: 'PANEL_ATTACHMENTS', label: 'Managed Service', value: 'MANAGED_SERVICE' },
        { category: 'PANEL_ATTACHMENTS', label: 'Service Option', value: 'SERVICE_OPTION' },
        { category: 'PANEL_ATTACHMENTS', label: 'Connectivity', value: 'CONNECTIVITY' },
        { category: 'PANEL_ATTACHMENTS', label: 'Design Package', value: 'PACKAGE' },
        
        { category: 'PANEL_SERVICE_OPTIONS', label: 'Service Family', value: 'SERVICE_FAMILY' },
        { category: 'PANEL_SERVICE_OPTIONS', label: 'Design Package', value: 'PACKAGE' },
        
        { category: 'PANEL_FEATURES', label: 'Hardware', value: 'HARDWARE' },
        { category: 'PANEL_FEATURES', label: 'Managed Service', value: 'MANAGED_SERVICE' },
        { category: 'PANEL_FEATURES', label: 'Service Option', value: 'SERVICE_OPTION' },
    ];

    for (const term of defaults) {
        await prisma.taxonomyTerm.upsert({
            where: { category_value: { category: term.category, value: term.value } },
            update: {},
            create: term
        });
    }
    console.log("Visibility rules seeded successfully.");
}

main().finally(() => prisma.$disconnect());
